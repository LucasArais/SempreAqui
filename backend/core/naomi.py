"""Naomi agente: a IA que conversa, entende e conecta os dados da família.

Camadas, nesta ordem:

1. Rede de segurança (sem IA, nunca desligada): risco vira 192 antes de tudo; remédio, dose e
   diagnóstico viram recusa gentil; situação difícil vira o Apoio com trechos oficiais
   (core/apoio.py). Saudação, origem do nome e "onde tem hospital" também ficam nas regras:
   são respostas exatas e de graça.
2. Busca (RAG): o que a família registrou vira documentos curtos, cada um com um id: Passaporte,
   relatos dos últimos 30 dias, a semana, as tarefas, a conversa do dia, Cartão SUS e UBS,
   trechos do Guia Prático do Cuidador e a história do nome. Sem embeddings: o acervo de uma
   família cabe inteiro no contexto, e a escolha dos trechos do Guia é por palavras.
3. Resposta da IA presa a um JSON: texto, ids das fontes usadas, uma ação do app e sugestões.
4. Validação: toda resposta precisa citar ao menos um documento que existe e passar nos
   guardrails (sem orientação médica, sem termos desrespeitosos). Se falhar, ou se a IA disser
   que os documentos não respondem, a resposta das regras (core/assistente.py) entra no lugar.

A pergunta e a conversa não são guardadas no servidor.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from core import apoio, assistente, guardrails
from core.fontes import TRECHOS, citacao
from core.llm import ErroProvedorIA, ProvedorIA
from core.sus import MEU_SUS_DIGITAL, formatar_cns

Acao = Literal[
    "ver_semana",
    "ver_tarefas",
    "nova_tarefa",
    "ver_passaporte",
    "abrir_conversa",
    "ver_sus",
    "ver_perto",
    "ver_naomi",
]

MAX_TEXTO = 900
MAX_HISTORICO = 6

HISTORIA_DO_NOME = (
    "O nome Naomi é uma homenagem a Naomi Feil (1932 a 2023), assistente social e gerontóloga. "
    "Fugiu da Alemanha nazista ainda criança e cresceu num lar de idosos em Cleveland, onde o pai "
    "era o administrador. Entre 1963 e 1980 criou o método Validation: em vez de corrigir a pessoa "
    "desorientada, acolher o sentimento por trás do que ela diz."
)

O_QUE_O_APP_FAZ = (
    "No SempreAqui a família grava como foi o dia (Diário), vê a semana, divide tarefas (aba "
    "Família), guarda o Passaporte de Memória (aba Memórias), tem a conversa do dia para fazer com "
    "a pessoa, o Cartão SUS e os serviços do SUS, e um mapa de hospitais, UPAs, UBS e CAPS perto."
)

SISTEMA = """Você é a Naomi, a assistente do SempreAqui, um app que ajuda famílias a cuidar juntas de alguém que vive com Alzheimer.

Seu jeito vem de Naomi Feil e do método Validation: primeiro acolher quem pergunta, sem julgar, depois responder com o que está registrado. Fale como uma pessoa próxima da família: português simples, frases curtas, no máximo 4 frases. Chame a pessoa cuidada pelo nome que a família usa.

Regras que você nunca quebra:
- Use SOMENTE os documentos fornecidos. Não invente datas, números, nomes nem fatos.
- Em "fontes", liste os ids exatos dos documentos que sustentam a resposta.
- Se os documentos não respondem, ponha sabe_responder = false e diga isso com gentileza no texto.
- Não dê diagnóstico, não interprete sintomas, não fale de remédio, dose ou tratamento. Para isso, a equipe de saúde.
- Padrões que aparecem nos relatos (por exemplo, agitação sempre à tarde) podem ser apontados como fatos registrados, sugerindo contar à equipe de saúde, sem dizer o que significam.
- Se houver risco, oriente ligar 192 (SAMU).
- Não use travessão. Não use termos como "demente", "senil" ou "caduca".
- Em "acao", escolha a tela do app que ajuda a seguir a conversa, ou deixe vazio.
- Em "sugestoes", até 3 perguntas curtas que a família poderia fazer em seguida."""


class RespostaNaomi(BaseModel):
    texto: str = Field(description="A resposta para a família, no máximo 4 frases.")
    fontes: list[str] = Field(
        default_factory=list, description="Ids dos documentos usados na resposta."
    )
    sabe_responder: bool = Field(description="false se os documentos não respondem à pergunta.")
    acao: Acao | None = Field(default=None, description="Tela do app para seguir, se ajudar.")
    sugestoes: list[str] = Field(
        default_factory=list, description="Até 3 perguntas curtas para a família fazer em seguida."
    )


# Busca -----------------------------------------------------------------------


def _data(iso: str) -> str:
    return assistente._data(iso)


def _linha_do_registro(r: dict) -> str:
    reg = r.get("registro") or {}
    partes = []
    sono = reg.get("sono") or {}
    if sono.get("qualidade") not in (None, "nao_informado"):
        extra = f", {sono['horas_aproximadas']:g} h" if sono.get("horas_aproximadas") else ""
        partes.append(f"sono {sono['qualidade']}{extra}")
    comida = (reg.get("alimentacao") or {}).get("qualidade")
    if comida not in (None, "nao_informado"):
        partes.append(f"alimentação {comida}")
    humor = (reg.get("humor") or {}).get("predominante")
    if humor not in (None, "nao_informado"):
        partes.append(f"humor {humor}")
    agit = reg.get("agitacao") or {}
    if agit.get("nivel") not in (None, "nao_informado", "nenhuma"):
        quando = f" ({', '.join(agit['periodos'])})" if agit.get("periodos") else ""
        partes.append(f"agitação {agit['nivel']}{quando}")
    remedio = (reg.get("medicacao") or {}).get("tomou")
    if remedio not in (None, "nao_informado"):
        partes.append(f"remédios: {remedio}")
    cansaco = (reg.get("quem_cuida") or {}).get("cansaco")
    if cansaco not in (None, "nao_informado"):
        partes.append(f"cansaço de quem cuida: {cansaco}")
    for e in reg.get("episodios") or []:
        partes.append(f"episódio: {e.get('tipo')} ({e.get('descricao', '')})")
    if reg.get("o_que_ajudou"):
        partes.append("ajudou: " + "; ".join(reg["o_que_ajudou"]))
    if reg.get("momentos_bons"):
        partes.append("momentos bons: " + "; ".join(reg["momentos_bons"]))
    return "; ".join(partes)


def _lista(itens: list[dict]) -> str:
    return "; ".join(
        " ".join(
            x for x in [i.get("titulo") or i.get("nome"), i.get("detalhe") or i.get("relacao")] if x
        )
        for i in itens
    )


def documentos(pergunta: str, ctx: dict) -> list[dict]:
    """Tudo o que a Naomi pode usar, cada um com id, rótulo (de onde veio) e texto."""
    p = ctx["passaporte"]
    chamada = p.get("como_gosta_de_ser_chamada") or p.get("nome") or "ela"
    docs: list[dict] = []

    def add(id_: str, rotulo: str, texto: str, **extra) -> None:
        if texto and texto.strip():
            docs.append({"id": id_, "rotulo": rotulo, "texto": texto.strip(), **extra})

    perfil = [f"Nome: {p.get('nome') or ''}. Chamada de: {chamada}."]
    if p.get("idade"):
        perfil.append(f"Idade: {p['idade']} anos.")
    for campo, nome in [("quem_ela", "Quem ela é"), ("como_se_comunica", "Como se comunica")]:
        if p.get(campo):
            perfil.append(f"{nome}: {p[campo]}")
    add("passaporte-perfil", "Passaporte de Memória", " ".join(perfil))
    for campo, nome in [
        ("acalma", "O que acalma"),
        ("agita", "O que agita"),
        ("musicas", "Músicas"),
        ("comidas", "Comidas"),
        ("rotina", "Rotina"),
        ("pessoas_importantes", "Pessoas importantes"),
        ("lembrancas", "Lembranças"),
    ]:
        if p.get(campo):
            add(f"passaporte-{campo}", "Passaporte de Memória", f"{nome}: {_lista(p[campo])}.")

    hoje: date = ctx["hoje"]
    for r in ctx["relatos"][:30]:
        quando = assistente._quando(r["gravado_em"], hoje)
        texto = f"Relato de {quando} ({_data(r['gravado_em'])}). Resumo: {r.get('resumo') or ''} Registro: {_linha_do_registro(r)}."
        if r.get("alertas"):
            texto += " Esse relato teve sinal de risco."
        add(f"relato-{r['id']}", f"Diário, {_data(r['gravado_em'])}", texto, relato_id=r["id"])

    s = ctx.get("semana") or {}
    if s.get("dias_com_relato"):
        texto = f"Semana de {s['periodo']}: relato em {s['dias_com_relato']} de 7 dias."
        if ctx.get("resumo_semana"):
            texto += f" Resumo: {ctx['resumo_semana']}"
        mudancas = [m["texto"] for m in s.get("mudancas", [])]
        if mudancas:
            texto += " O que mudou em relação ao habitual: " + "; ".join(mudancas) + "."
        add("semana", f"Semana de {s['periodo']}", texto)

    tarefas = ctx.get("tarefas") or []
    if tarefas:
        linhas = [
            f"{t['titulo']} ({'feita' if t['concluida'] else 'aberta'}, "
            f"{t.get('responsavel_nome') or 'ninguém assumiu'})"
            for t in tarefas[:10]
        ]
        add("tarefas", "Tarefas da família", "Tarefas: " + "; ".join(linhas) + ".")
    else:
        add("tarefas", "Tarefas da família", "Nenhuma tarefa cadastrada.")

    c = ctx.get("conversa")
    if c:
        add(
            "conversa",
            "Conversa do dia",
            f"Conversa de hoje: tema {c['tema']}. Perguntas: {' '.join(c['perguntas'][:3])}",
        )

    sus = []
    if p.get("cartao_sus"):
        sus.append(f"Cartão SUS da {chamada}: {formatar_cns(p['cartao_sus'])}.")
    else:
        sus.append("Cartão SUS ainda não cadastrado (dá para pôr em Memórias, Saúde e SUS).")
    if p.get("ubs_referencia"):
        sus.append(f"UBS de referência: {p['ubs_referencia']}.")
    sus.append(
        f"No Meu SUS Digital ({MEU_SUS_DIGITAL}) ficam o cartão digital, as vacinas e os exames."
    )
    add("sus", "Passaporte e serviços do SUS", " ".join(sus))

    for t in _trechos_do_guia(pergunta):
        cit = citacao(t)
        add(f"guia-{t['id']}", cit["fonte"], t["texto"], url=cit["url"])

    add("naomi", "Sobre a Naomi", HISTORIA_DO_NOME)
    add("app", "SempreAqui", O_QUE_O_APP_FAZ)
    return docs


def _trechos_do_guia(pergunta: str, maximo: int = 3) -> list[dict]:
    base = guardrails.normalizar(pergunta)
    palavras = set(re.findall(r"[a-z]{4,}", base)) | set(apoio.situacoes(pergunta))
    pontuados = []
    for i, t in enumerate(TRECHOS):
        temas = set(t["temas"])
        pontos = len(temas & palavras) * 2 + sum(
            1 for w in palavras if any(w[:5] == tema[:5] for tema in temas)
        )
        if pontos:
            pontuados.append((-pontos, i, t))
    return [t for _, _, t in sorted(pontuados)[:maximo]]


# Resposta --------------------------------------------------------------------

_SO_REGRAS = ("saudacao", "nome", "perto")

# "Em que período ela fica inquieta?" é pergunta sobre o que foi registrado, não pedido de ajuda.
_SOBRE_OS_DADOS = re.compile(
    r"^(em que|quando|quantas|quantos|com que frequencia|qual (o |a )?(periodo|horario|hora|dia))"
)


def _pergunta_sobre_os_dados(pergunta: str, regras: dict) -> bool:
    """Só perguntas gerais (sem risco, sem remédio, sem confusão de repente) podem ir para a IA."""
    a = regras.get("apoio") or {}
    if a.get("tipo") != "geral" or "confusao_subita" in a.get("situacoes", []):
        return False
    return bool(_SOBRE_OS_DADOS.search(guardrails.normalizar(pergunta).strip()))


def _prompt(pergunta: str, docs: list[dict], historico: list[dict]) -> str:
    blocos = "\n".join(f"[{d['id']}] {d['texto']}" for d in docs)
    conversa = ""
    if historico:
        linhas = [
            f"{'Família' if h.get('de') == 'eu' else 'Naomi'}: {h.get('texto', '')[:400]}"
            for h in historico[-MAX_HISTORICO:]
        ]
        conversa = "Conversa até agora:\n" + "\n".join(linhas) + "\n\n"
    return f"Documentos:\n{blocos}\n\n{conversa}Pergunta da família: {pergunta}"


def validar(resposta: RespostaNaomi, docs: list[dict]) -> list[str]:
    """Problemas que impedem mostrar a resposta da IA. Lista vazia: pode mostrar."""
    problemas = []
    ids = {d["id"] for d in docs}
    if not resposta.texto.strip():
        problemas.append("texto vazio")
    if len(resposta.texto) > MAX_TEXTO:
        problemas.append("texto longo demais")
    if resposta.sabe_responder and not [f for f in resposta.fontes if f in ids]:
        problemas.append("sem fonte que exista")
    problemas += [
        f"{v.regra} ({v.trecho})" for v in guardrails.verificar_texto_familia(resposta.texto)
    ]
    return problemas


def responder(
    pergunta: str,
    ctx: dict,
    provedor: ProvedorIA | None,
    historico: list[dict] | None = None,
) -> dict:
    """Resposta da Naomi. Sempre devolve algo seguro: a IA quando passa na validação, as regras
    quando não passa, quando não há provedor ou quando a pergunta é de segurança."""
    regras = assistente.responder(pergunta, ctx)
    regras["motor"] = "regras"
    if provedor is None:
        return regras
    if regras["tipo"] == "apoio" and not _pergunta_sobre_os_dados(pergunta, regras):
        return regras
    if assistente.intencao(pergunta) in _SO_REGRAS:
        return regras

    docs = documentos(pergunta, ctx)
    try:
        r = provedor.gerar_estruturado(
            _prompt(pergunta, docs, historico or []), SISTEMA, RespostaNaomi
        )
    except (ErroProvedorIA, ValueError) as erro:
        regras["motor"] = f"regras ({type(erro).__name__})"
        return regras
    if not r.sabe_responder or validar(r, docs):
        return regras

    por_id = {d["id"]: d for d in docs}
    usados = [por_id[f] for f in dict.fromkeys(r.fontes) if f in por_id]
    rotulos = list(dict.fromkeys(d["rotulo"] for d in usados))
    relatos = [d["relato_id"] for d in usados if d.get("relato_id")]
    guia = [{"fonte": d["rotulo"], "url": d["url"]} for d in usados if d.get("url")]
    resposta = {
        "tipo": "resposta",
        "texto": guardrails.remover_travessoes(r.texto.strip()),
        "origem": "De: " + ", ".join(rotulos[:3]),
        "acao": r.acao,
        "sugestoes": [s.strip() for s in r.sugestoes if s.strip()][:3],
        "motor": "ia",
        "fontes": [d["id"] for d in usados],
    }
    if len(relatos) == 1:
        resposta["relato_id"] = relatos[0]
    if guia:
        resposta["links"] = guia[:2]
    return resposta
