"""API do SempreAqui.

Rodar localmente:  uv run uvicorn api.main:app --reload --host 0.0.0.0

Privacidade: nenhum conteúdo de relato, transcrição, nome ou áudio vai para log.
Logs registram só ids, etapas, tempos e tipos de erro.

Identificação da família: por enquanto pelo cabeçalho X-Familia (família de demonstração).
Com o Supabase ligado, passa a vir do token de login, e o RLS do banco garante o isolamento.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import re
import time
import zipfile
from collections.abc import Callable
from datetime import date, datetime
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks, Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from agents.diario import (
    VERSOES,
    alertas_do_relato,
    formatar_correcoes,
    processar_relato,
    refazer_resumo,
    resumo_seguro,
    violacoes_do_resumo,
)
from agents.semana import resumir_semana
from core import campos, guardrails
from core.auth import TokenInvalido, usuario_do_token
from core.config import config
from core.llm import ErroProvedorIA, ProvedorIA, provedor_padrao
from core.pdf import pdf_consulta
from core.repositorio import (
    EVENTOS_PERMITIDOS,
    FamiliaDesconhecida,
    Repositorio,
    repositorio_padrao,
)
from core.schemas.diario import RegistroDiario
from core.semana import montar_semana

logging.basicConfig(level=config().log_level.upper())
log = logging.getLogger("sempreaqui.api")

app = FastAPI(
    title="SempreAqui API",
    description="IA que aproxima famílias em torno do cuidado de quem vive com Alzheimer.",
    version="0.2.0",
)

TIPOS_AUDIO = {
    "audio/mpeg",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
}
TAMANHO_MAXIMO = 25 * 1024 * 1024
POR_EXTENSAO = {
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "aac": "audio/aac",
}
MSG_IA_INDISPONIVEL = (
    "Não consegui organizar agora. Seu áudio está guardado e dá para tentar de novo."
)


# Dependências --------------------------------------------------------------


@lru_cache
def _repositorio_padrao() -> Repositorio:
    return repositorio_padrao()


def obter_repositorio() -> Repositorio:
    return _repositorio_padrao()


def obter_fabrica_provedor() -> Callable[[], ProvedorIA]:
    return provedor_padrao


def obter_provedor() -> ProvedorIA:
    """Mantido para compatibilidade com testes antigos e chamadas diretas."""
    try:
        return provedor_padrao()
    except ErroProvedorIA as erro:
        raise HTTPException(status_code=503, detail=MSG_IA_INDISPONIVEL) from erro


def obter_usuario(authorization: str | None = Header(None)) -> str | None:
    """Id do usuário do Supabase, se veio um token válido. None se não veio token."""
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sua sessão expirou. Abra o app de novo.")
    try:
        return usuario_do_token(authorization.removeprefix("Bearer ").strip())
    except TokenInvalido as erro:
        raise HTTPException(401, "Sua sessão expirou. Abra o app de novo.") from erro


def obter_familia(
    usuario: str | None = Depends(obter_usuario),
    x_familia: str | None = Header(None, description="Só em testes e uso local"),
    repo: Repositorio = Depends(obter_repositorio),
) -> str:
    """Família de quem está usando. Com login, vem da tabela de membros; nunca do cliente."""
    if usuario:
        membro = repo.familia_do_usuario(usuario)
        if not membro:
            raise HTTPException(403, "Você ainda não entrou numa família.")
        return membro["familia"]
    if x_familia and config().aceitar_cabecalho_familia:
        if not re.fullmatch(r"[A-Za-z0-9-]{3,64}", x_familia):
            raise HTTPException(400, "Família inválida.")
        return x_familia
    raise HTTPException(401, "Entre no app para continuar.")


# Modelos de resposta -------------------------------------------------------


class Relato(BaseModel):
    id: str
    etapa: str
    erro: str | None = None
    gravado_em: str
    duracao_s: float | None = None
    transcricao: str | None = None
    registro: dict | None = None
    alertas: list[str] = []
    resumo: str | None = None
    resumo_seguro: bool = False
    enviado_familia: bool = False
    tem_audio: bool = False
    corrigidos: list[str] = []
    no_aparelho: bool = False


# Relatos organizados pela IA do próprio celular chegam com este prefixo no campo "modelo".
PREFIXO_APARELHO = "aparelho:"


def _no_aparelho(dados: dict) -> bool:
    return str(dados.get("modelo") or "").startswith(PREFIXO_APARELHO)


class Correcao(BaseModel):
    campo: str
    valor: Any


class RespostaCorrecao(BaseModel):
    relato: Relato
    correcao_id: str


class Evento(BaseModel):
    tipo: str
    valor: float | None = None
    rotulo: str | None = None


@app.exception_handler(FamiliaDesconhecida)
def _familia_desconhecida(_request, _erro) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": "Família não encontrada."})


def _para_resposta(
    repo: Repositorio, familia_id: str, dados: dict, corrigidos: list[str] | None = None
) -> Relato:
    if corrigidos is None:
        corrigidos = repo.campos_corrigidos(familia_id, [dados["id"]]).get(dados["id"], [])
    return Relato(
        **{
            k: dados[k]
            for k in Relato.model_fields
            if k in dados and k not in {"tem_audio", "corrigidos", "no_aparelho"}
        },
        tem_audio=repo.tem_audio(dados),
        corrigidos=corrigidos,
        no_aparelho=_no_aparelho(dados),
    )


def _obter_ou_404(repo: Repositorio, familia_id: str, relato_id: str) -> dict:
    dados = repo.obter(familia_id, relato_id)
    if not dados:
        raise HTTPException(404, "Não encontrei esse relato.")
    return dados


# Processamento -------------------------------------------------------------


def processar_em_segundo_plano(
    repo: Repositorio,
    familia_id: str,
    relato_id: str,
    fabrica: Callable[[], ProvedorIA],
) -> None:
    relato = repo.obter(familia_id, relato_id)
    audio = repo.ler_audio(relato) if relato else None
    if not relato or audio is None:
        return
    inicio = time.perf_counter()
    try:
        provedor = fabrica()
        estado = processar_relato(
            provedor,
            audio=audio,
            mime_type=relato["mime"] or "audio/mp4",
            correcoes=formatar_correcoes(repo.correcoes_recentes(familia_id)),
            ao_mudar_etapa=lambda etapa: repo.atualizar_etapa(relato_id, etapa),
        )
    except Exception as erro:  # noqa: BLE001 - qualquer falha vira mensagem humana
        log.warning("diario.falhou relato=%s erro=%s", relato_id, type(erro).__name__)
        repo.atualizar_etapa(relato_id, "erro", MSG_IA_INDISPONIVEL)
        return
    repo.salvar_resultado(
        relato_id,
        transcricao=estado["transcricao"],
        registro=estado["registro"].model_dump(),
        alertas=estado["alertas"],
        resumo=estado["resumo"],
        resumo_seguro=estado.get("resumo_seguro_usado", False),
        versao_prompt=f"extracao.{VERSOES['extracao']}",
        modelo=getattr(provedor, "modelo", type(provedor).__name__),
    )
    repo.registrar_evento("diario_gravado", familia_id, valor=relato["duracao_s"])
    log.info(
        "diario.pronto relato=%s segundos=%.1f alertas=%d",
        relato_id,
        time.perf_counter() - inicio,
        len(estado["alertas"]),
    )


# Rotas ---------------------------------------------------------------------


@app.get("/saude")
def saude() -> dict:
    return {"status": "ok"}


class PedidoSessao(BaseModel):
    nome_exibicao: str = "Quem cuida"


class Sessao(BaseModel):
    familia: str
    papel: str


@app.post("/sessao", response_model=Sessao)
def iniciar_sessao(
    pedido: PedidoSessao,
    usuario: str | None = Depends(obter_usuario),
    repo: Repositorio = Depends(obter_repositorio),
) -> Sessao:
    """Primeira chamada do app depois do login anônimo: entra na família ou cria uma."""
    if not usuario:
        raise HTTPException(401, "Entre no app para continuar.")
    membro = repo.familia_do_usuario(usuario)
    if not membro:
        nome = pedido.nome_exibicao.strip()[:60] or "Quem cuida"
        demo = config().familia_demo_para_novos
        try:
            if not demo:
                raise FamiliaDesconhecida("sem família de demonstração")
            repo.entrar_na_familia(usuario, demo, nome, "quem_cuida")
        except FamiliaDesconhecida:
            repo.criar_familia(usuario, "Minha família", nome)
        membro = repo.familia_do_usuario(usuario)
    return Sessao(**membro)


class Consentimento(BaseModel):
    versao_termo: str
    finalidades: list[str]


FINALIDADES = {
    "dados_de_saude_diario",
    "passaporte_memoria",
    "audio_e_fotos",
    "compartilhamento_link",
}


@app.post("/consentimentos", status_code=204)
def registrar_consentimento(
    consentimento: Consentimento,
    usuario: str | None = Depends(obter_usuario),
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> None:
    """Consentimento explícito por finalidade, com a versão do termo (LGPD, art. 11)."""
    if not usuario:
        raise HTTPException(401, "Entre no app para continuar.")
    finalidades = [f for f in consentimento.finalidades if f in FINALIDADES]
    if not finalidades:
        raise HTTPException(422, "Nenhuma finalidade válida.")
    repo.registrar_consentimento(usuario, familia_id, finalidades, consentimento.versao_termo[:20])


@app.get("/familia/exportar")
def exportar_tudo(
    familia_id: str = Depends(obter_familia), repo: Repositorio = Depends(obter_repositorio)
) -> Response:
    """Cópia de tudo da família (LGPD, art. 18): dados em JSON e os áudios originais, num ZIP."""
    dados = repo.exportar(familia_id)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_:
        zip_.writestr(
            "LEIA-ME.txt",
            "Cópia dos dados da sua família no SempreAqui.\n"
            "dados.json: relatos, transcrições, registros, resumos, correções, membros e consentimentos.\n"
            "audios/: os áudios originais de cada relato.\n",
        )
        zip_.writestr("dados.json", json.dumps(dados, ensure_ascii=False, indent=2, default=str))
        for relato in dados["relatos"]:
            audio = repo.ler_audio(relato)
            if audio:
                zip_.writestr(
                    f"audios/{relato['id']}.{(relato['audio_arquivo'] or '').rsplit('.', 1)[-1]}",
                    audio,
                )
    return Response(
        buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="sempreaqui-dados.zip"'},
    )


class ConfirmacaoApagar(BaseModel):
    confirmar: str


@app.delete("/familia", status_code=204)
def apagar_tudo(
    confirmacao: ConfirmacaoApagar,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> None:
    """Apaga todos os dados da família, inclusive os áudios (LGPD, art. 18).

    Só as métricas anônimas permanecem: elas não têm conteúdo nem identificam a família.
    """
    if confirmacao.confirmar != "APAGAR":
        raise HTTPException(422, "Confirmação ausente.")
    quantos = repo.apagar_familia(familia_id)
    log.info("familia.apagada relatos=%d", quantos)


_cache_semana: dict[tuple, dict] = {}


def _fatos_da_semana(repo: Repositorio, familia_id: str, fim: str | None) -> dict:
    fuso = config().fuso
    data_fim = date.fromisoformat(fim) if fim else datetime.now(ZoneInfo(fuso)).date()
    relatos = repo.listar(familia_id, limite=500)
    return montar_semana(relatos, data_fim, fuso)


@app.get("/semana")
def semana(
    fim: str | None = None,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
    fabrica: Callable[[], ProvedorIA] = Depends(obter_fabrica_provedor),
) -> dict:
    """Como foi a semana: dias, mudanças em relação ao habitual, resumo e lista da consulta."""
    fatos = _fatos_da_semana(repo, familia_id, fim)
    chave = (
        familia_id,
        fatos["fim"],
        hashlib.sha256(json.dumps(fatos, sort_keys=True, default=str).encode()).hexdigest(),
    )
    if chave not in _cache_semana:
        try:
            provedor = fabrica()
        except Exception:  # noqa: BLE001 - sem IA, o resumo seguro cobre
            provedor = None
        resumo, seguro = resumir_semana(provedor, fatos)
        if not seguro:
            _cache_semana[chave] = {"resumo": resumo, "resumo_seguro": False}
        else:
            return {**fatos, "resumo": resumo, "resumo_seguro": True}
    return {**fatos, **_cache_semana[chave]}


@app.get("/semana/consulta.pdf")
def semana_pdf(
    fim: str | None = None,
    nome: str = "Pessoa cuidada",
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Response:
    """Lista "Para levar na consulta" em PDF de uma página."""
    nome_limpo = re.sub(r"[^A-Za-zÀ-ÿ ]", "", nome)[:40].strip() or "Pessoa cuidada"
    conteudo = pdf_consulta(_fatos_da_semana(repo, familia_id, fim), nome_limpo)
    return Response(
        conteudo,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="para-levar-na-consulta.pdf"'},
    )


@app.get("/diario/campos")
def listar_campos() -> list[dict]:
    """Campos que a família pode corrigir e as opções de cada um."""
    return campos.descrever()


@app.post("/diario/relatos", response_model=Relato, status_code=202)
async def criar_relato(
    background: BackgroundTasks,
    audio: UploadFile,
    id: str = Form(..., description="Id gerado no celular. Reenvios não duplicam."),
    duracao_s: float | None = Form(None),
    gravado_em: str | None = Form(None),
    segundos_desde_instalacao: float | None = Form(None),
    enviado_offline: bool = Form(False),
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
    fabrica: Callable[[], ProvedorIA] = Depends(obter_fabrica_provedor),
) -> Relato:
    if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", id):
        raise HTTPException(400, "Identificador do relato inválido.")
    mime = audio.content_type
    if mime not in TIPOS_AUDIO:
        # Alguns celulares mandam um tipo genérico; a extensão do arquivo resolve.
        extensao = (audio.filename or "").rsplit(".", 1)[-1].lower()
        mime = POR_EXTENSAO.get(extensao)
    if mime not in TIPOS_AUDIO:
        raise HTTPException(415, "Não consegui ler esse formato de áudio. Tente gravar de novo.")
    conteudo = await audio.read()
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(413, "O áudio ficou longo demais. Tente gravar em partes menores.")
    dados, novo = repo.criar_relato(familia_id, id, conteudo, mime, duracao_s, gravado_em)
    if novo:
        log.info(
            "diario.recebido relato=%s bytes=%d offline=%s", id, len(conteudo), enviado_offline
        )
        if segundos_desde_instalacao is not None and not repo.listar(familia_id, limite=2)[1:]:
            repo.registrar_evento("primeiro_diario", familia_id, valor=segundos_desde_instalacao)
        if enviado_offline:
            repo.registrar_evento("relato_enviado_offline", familia_id)
        background.add_task(processar_em_segundo_plano, repo, familia_id, id, fabrica)
    return _para_resposta(repo, familia_id, dados)


# IA no próprio celular -----------------------------------------------------


class RelatoDoAparelho(BaseModel):
    """Relato transcrito e organizado no celular. O áudio não vem: ele nunca sai do aparelho."""

    id: str
    duracao_s: float | None = None
    gravado_em: str | None = None
    segundos_desde_instalacao: float | None = None
    enviado_offline: bool = False
    transcricao: str
    registro: RegistroDiario
    resumo: str
    modelo: str = "apple-foundation-models"
    versao_prompt: str = "extracao.aparelho.v1"


def _resumo_aprovado(registro: RegistroDiario, resumo: str, alertas: list[str]) -> tuple[str, bool]:
    """O backend confere de novo o que o celular escreveu: os guardrails daqui são a palavra final."""
    texto = guardrails.remover_travessoes(resumo)
    if violacoes_do_resumo(texto, alertas):
        return resumo_seguro(registro, alertas), True
    return texto, False


@app.post("/diario/relatos/do-aparelho", response_model=Relato, status_code=201)
def criar_relato_do_aparelho(
    relato: RelatoDoAparelho,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Relato:
    if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", relato.id):
        raise HTTPException(400, "Identificador do relato inválido.")
    if not relato.transcricao.strip():
        raise HTTPException(422, "O relato chegou sem texto.")
    dados, novo = repo.criar_relato(
        familia_id, relato.id, None, "audio/mp4", relato.duracao_s, relato.gravado_em
    )
    if not novo:
        return _para_resposta(repo, familia_id, dados)
    # O risco é recalculado aqui também: palavra de queda no relato sempre vira alerta.
    alertas = alertas_do_relato(relato.registro, relato.transcricao)
    resumo, seguro = _resumo_aprovado(relato.registro, relato.resumo, alertas)
    repo.salvar_resultado(
        relato.id,
        transcricao=relato.transcricao,
        registro=relato.registro.model_dump(),
        alertas=alertas,
        resumo=resumo,
        resumo_seguro=seguro,
        versao_prompt=relato.versao_prompt[:60],
        modelo=PREFIXO_APARELHO + re.sub(r"[^A-Za-z0-9._-]", "", relato.modelo)[:60],
    )
    repo.registrar_evento("diario_gravado", familia_id, valor=relato.duracao_s, rotulo="aparelho")
    if relato.segundos_desde_instalacao is not None and not repo.listar(familia_id, limite=2)[1:]:
        repo.registrar_evento("primeiro_diario", familia_id, valor=relato.segundos_desde_instalacao)
    if relato.enviado_offline:
        repo.registrar_evento("relato_enviado_offline", familia_id)
    log.info("diario.do_aparelho relato=%s alertas=%d seguro=%s", relato.id, len(alertas), seguro)
    return _para_resposta(repo, familia_id, repo.obter(familia_id, relato.id))


class NovoResumo(BaseModel):
    resumo: str


@app.put("/diario/relatos/{relato_id}/resumo", response_model=Relato)
def atualizar_resumo_do_aparelho(
    relato_id: str,
    pedido: NovoResumo,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Relato:
    """Depois de uma correção, o celular reescreve o resumo com a IA dele e manda só o texto."""
    dados = _obter_ou_404(repo, familia_id, relato_id)
    if not _no_aparelho(dados) or not dados["registro"]:
        raise HTTPException(409, "Esse relato é organizado pelo servidor.")
    registro = RegistroDiario.model_validate(dados["registro"])
    resumo, _ = _resumo_aprovado(registro, pedido.resumo, dados["alertas"])
    repo.atualizar_registro(relato_id, dados["registro"], resumo)
    return _para_resposta(repo, familia_id, repo.obter(familia_id, relato_id))


@app.get("/diario/correcoes")
def correcoes_da_familia(
    familia_id: str = Depends(obter_familia), repo: Repositorio = Depends(obter_repositorio)
) -> dict:
    """Correções recentes já no formato do prompt, para a IA do celular aprender com a família."""
    return {"texto": formatar_correcoes(repo.correcoes_recentes(familia_id))}


@app.get("/diario/relatos", response_model=list[Relato])
def listar_relatos(
    familia_id: str = Depends(obter_familia), repo: Repositorio = Depends(obter_repositorio)
) -> list[Relato]:
    relatos = repo.listar(familia_id)
    corrigidos = repo.campos_corrigidos(familia_id, [r["id"] for r in relatos])
    return [_para_resposta(repo, familia_id, r, corrigidos.get(r["id"], [])) for r in relatos]


@app.get("/diario/relatos/{relato_id}", response_model=Relato)
def obter_relato(
    relato_id: str,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Relato:
    return _para_resposta(repo, familia_id, _obter_ou_404(repo, familia_id, relato_id))


@app.post("/diario/relatos/{relato_id}/tentar-de-novo", response_model=Relato, status_code=202)
def tentar_de_novo(
    relato_id: str,
    background: BackgroundTasks,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
    fabrica: Callable[[], ProvedorIA] = Depends(obter_fabrica_provedor),
) -> Relato:
    dados = _obter_ou_404(repo, familia_id, relato_id)
    if dados["etapa"] != "erro":
        return _para_resposta(repo, familia_id, dados)
    repo.atualizar_etapa(relato_id, "recebido")
    background.add_task(processar_em_segundo_plano, repo, familia_id, relato_id, fabrica)
    return _para_resposta(repo, familia_id, repo.obter(familia_id, relato_id))


@app.patch("/diario/relatos/{relato_id}/campos", response_model=RespostaCorrecao)
def corrigir_campo(
    relato_id: str,
    correcao: Correcao,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
    fabrica: Callable[[], ProvedorIA] = Depends(obter_fabrica_provedor),
) -> RespostaCorrecao:
    dados = _obter_ou_404(repo, familia_id, relato_id)
    if dados["etapa"] != "pronto" or not dados["registro"]:
        raise HTTPException(409, "Esse relato ainda está sendo organizado.")
    anterior = campos.ler(dados["registro"], correcao.campo)
    try:
        novo_registro = campos.aplicar(dados["registro"], correcao.campo, correcao.valor)
    except campos.CampoInvalido as erro:
        raise HTTPException(422, str(erro)) from erro

    registro = RegistroDiario.model_validate(novo_registro)
    if _no_aparelho(dados):
        # O relato foi organizado no celular e o texto dele não vai para a nuvem. O resumo seguro
        # reflete a correção na hora; o app reescreve o resumo com a IA do aparelho em seguida.
        resumo = resumo_seguro(registro, dados["alertas"])
    else:
        try:
            resumo, _ = refazer_resumo(
                fabrica(), registro, dados["transcricao"] or "", dados["alertas"]
            )
        except Exception as erro:  # noqa: BLE001 - sem IA, o resumo seguro reflete a correção
            log.warning(
                "diario.resumo_apos_correcao_falhou relato=%s erro=%s",
                relato_id,
                type(erro).__name__,
            )
            resumo = resumo_seguro(registro, dados["alertas"])

    correcao_id = repo.registrar_correcao(
        familia_id, relato_id, correcao.campo, anterior, correcao.valor, dados["resumo"]
    )
    repo.atualizar_registro(relato_id, novo_registro, resumo)
    repo.registrar_evento("campo_corrigido", familia_id, rotulo=correcao.campo)
    return RespostaCorrecao(
        relato=_para_resposta(repo, familia_id, repo.obter(familia_id, relato_id)),
        correcao_id=correcao_id,
    )


@app.delete("/diario/relatos/{relato_id}/correcoes/{correcao_id}", response_model=Relato)
def desfazer_correcao(
    relato_id: str,
    correcao_id: str,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Relato:
    dados = _obter_ou_404(repo, familia_id, relato_id)
    correcao = repo.obter_correcao(familia_id, correcao_id)
    if not correcao or correcao["relato_id"] != relato_id:
        raise HTTPException(404, "Não encontrei essa correção.")
    if not correcao["desfeita"]:
        registro = campos.aplicar(dados["registro"], correcao["campo"], correcao["valor_anterior"])
        repo.atualizar_registro(relato_id, registro, correcao["resumo_anterior"] or dados["resumo"])
        repo.marcar_correcao_desfeita(correcao_id)
        repo.registrar_evento("correcao_desfeita", familia_id, rotulo=correcao["campo"])
    return _para_resposta(repo, familia_id, repo.obter(familia_id, relato_id))


@app.post("/diario/relatos/{relato_id}/enviar", response_model=Relato)
def enviar_para_familia(
    relato_id: str,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Relato:
    _obter_ou_404(repo, familia_id, relato_id)
    repo.marcar_enviado(familia_id, relato_id)
    return _para_resposta(repo, familia_id, repo.obter(familia_id, relato_id))


@app.delete("/diario/relatos/{relato_id}", status_code=204)
def apagar_relato(
    relato_id: str,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> None:
    if not repo.apagar(familia_id, relato_id):
        raise HTTPException(404, "Não encontrei esse relato.")


@app.get("/diario/relatos/{relato_id}/audio")
def ouvir_audio(
    relato_id: str,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> Response:
    dados = _obter_ou_404(repo, familia_id, relato_id)
    audio = repo.ler_audio(dados)
    if not audio:
        raise HTTPException(404, "O áudio desse relato não está mais guardado.")
    return Response(audio, media_type=dados["mime"] or "audio/mp4")


@app.post("/eventos", status_code=204)
def registrar_evento(
    evento: Evento,
    familia_id: str = Depends(obter_familia),
    repo: Repositorio = Depends(obter_repositorio),
) -> None:
    """Eventos anônimos vindos do app. Só tipos conhecidos, sem conteúdo."""
    if evento.tipo not in EVENTOS_PERMITIDOS:
        raise HTTPException(422, "Evento desconhecido.")
    rotulo = (
        evento.rotulo if evento.rotulo and re.fullmatch(r"[a-z_.]{1,40}", evento.rotulo) else None
    )
    repo.registrar_evento(evento.tipo, familia_id, evento.valor, rotulo)


@app.get("/metricas")
def metricas(repo: Repositorio = Depends(obter_repositorio)) -> dict:
    """Painel agregado e anônimo. A taxa de correção é o principal indicador de qualidade da IA."""
    return repo.metricas()
