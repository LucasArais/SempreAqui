"""API do SempreAqui.

Rodar localmente:  uv run uvicorn api.main:app --reload --host 0.0.0.0

Privacidade: nenhum conteúdo de relato, transcrição, nome ou áudio vai para log.
Logs registram só ids, etapas, tempos e tipos de erro.

Identificação da família: por enquanto pelo cabeçalho X-Familia (família de demonstração).
Com o Supabase ligado, passa a vir do token de login, e o RLS do banco garante o isolamento.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from functools import lru_cache
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from agents.diario import (
    VERSOES,
    formatar_correcoes,
    processar_relato,
    refazer_resumo,
    resumo_seguro,
)
from core import campos
from core.config import config
from core.llm import ErroProvedorIA, ProvedorIA, provedor_padrao
from core.repositorio import EVENTOS_PERMITIDOS, Repositorio
from core.schemas.diario import RegistroDiario

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
MSG_IA_INDISPONIVEL = (
    "Não consegui organizar agora. Seu áudio está guardado e dá para tentar de novo."
)


# Dependências --------------------------------------------------------------


@lru_cache
def _repositorio_padrao() -> Repositorio:
    return Repositorio(config().dados_dir)


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


def obter_familia(x_familia: str = Header(..., description="Id da família")) -> str:
    if not re.fullmatch(r"[A-Za-z0-9-]{3,64}", x_familia):
        raise HTTPException(400, "Família inválida.")
    return x_familia


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


def _para_resposta(repo: Repositorio, familia_id: str, dados: dict) -> Relato:
    corrigidos = [
        c["campo"]
        for c in repo.correcoes_recentes(familia_id, limite=200)
        if c["relato_id"] == dados["id"]
    ]
    return Relato(
        **{
            k: dados[k]
            for k in Relato.model_fields
            if k in dados and k not in {"tem_audio", "corrigidos"}
        },
        tem_audio=repo.caminho_audio(dados) is not None,
        corrigidos=sorted(set(corrigidos)),
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
    if audio.content_type not in TIPOS_AUDIO:
        raise HTTPException(415, "Não consegui ler esse formato de áudio. Tente gravar de novo.")
    conteudo = await audio.read()
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(413, "O áudio ficou longo demais. Tente gravar em partes menores.")
    dados, novo = repo.criar_relato(
        familia_id, id, conteudo, audio.content_type, duracao_s, gravado_em
    )
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


@app.get("/diario/relatos", response_model=list[Relato])
def listar_relatos(
    familia_id: str = Depends(obter_familia), repo: Repositorio = Depends(obter_repositorio)
) -> list[Relato]:
    return [_para_resposta(repo, familia_id, r) for r in repo.listar(familia_id)]


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
    try:
        resumo, _ = refazer_resumo(
            fabrica(), registro, dados["transcricao"] or "", dados["alertas"]
        )
    except Exception as erro:  # noqa: BLE001 - sem IA, o resumo seguro reflete a correção
        log.warning(
            "diario.resumo_apos_correcao_falhou relato=%s erro=%s", relato_id, type(erro).__name__
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
) -> FileResponse:
    dados = _obter_ou_404(repo, familia_id, relato_id)
    caminho = repo.caminho_audio(dados)
    if not caminho:
        raise HTTPException(404, "O áudio desse relato não está mais guardado.")
    return FileResponse(caminho, media_type=dados["mime"] or "audio/mp4")


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
