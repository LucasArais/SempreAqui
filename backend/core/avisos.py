"""A Naomi que avisa sozinha: padrões nas semanas de relatos, sem ninguém perguntar.

A IA lê os relatos dos últimos 30 dias (já organizados pelo Diário) e aponta até 3 padrões que
valem atenção: agitação que se repete no mesmo período, sono piorando, remédio recusado,
quem cuida cada vez mais cansado, o que tem funcionado. Cada aviso precisa citar os relatos
que o sustentam, e só é mostrado se:

- citar ao menos 3 relatos que existem (padrão é repetição, não um dia ruim);
- passar nos guardrails (sem diagnóstico, sem remédio, sem termos desrespeitosos).

A IA aponta o fato e sugere o próximo passo ("vale contar à equipe de saúde", "dá para dividir
essa tarefa"); nunca diz o que o padrão significa. Sem provedor de IA, ou se a IA falhar,
detectores simples por contagem dão os mesmos tipos de aviso.
"""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from core import guardrails
from core.llm import ErroProvedorIA, ProvedorIA
from core.naomi import _data, _linha_do_registro

MINIMO_RELATOS = 5
MINIMO_EVIDENCIAS = 3
DIAS = 30

Tipo = Literal["levar_a_consulta", "cuidar_de_quem_cuida", "o_que_funciona"]
AcaoAviso = Literal["ver_semana", "nova_tarefa", "ver_passaporte"]

SISTEMA = """Você é a Naomi, a assistente do SempreAqui, e lê os relatos diários que a família grava sobre alguém que vive com Alzheimer.

Procure até 3 padrões que se repetem nos relatos e que valem a atenção da família: algo que acontece sempre no mesmo período do dia, sono ou alimentação mudando ao longo das semanas, remédio recusado mais de uma vez, quem cuida cada vez mais cansado, algo que tem ajudado de forma consistente.

Regras que você nunca quebra:
- Cada padrão precisa de pelo menos 3 relatos como evidência. Liste os ids exatos em "evidencias".
- Descreva o fato registrado, com números quando houver ("em 5 dos 8 relatos com agitação, foi à tarde"). Não diga o que o padrão significa e não fale em doença, diagnóstico, remédio ou dose.
- Sugira um próximo passo simples: contar à equipe de saúde na próxima consulta, dividir uma tarefa com a família, repetir o que tem funcionado.
- Português simples e acolhedor, sem travessão. Título com até 6 palavras, texto com até 2 frases.
- Se não houver padrão claro, devolva a lista vazia. É melhor não avisar do que avisar errado."""


class Aviso(BaseModel):
    titulo: str = Field(description="Até 6 palavras.")
    texto: str = Field(description="O padrão e o próximo passo, em até 2 frases.")
    tipo: Tipo
    evidencias: list[str] = Field(description="Ids dos relatos que mostram o padrão.")
    acao: AcaoAviso | None = None


class Avisos(BaseModel):
    avisos: list[Aviso] = Field(default_factory=list)


def _recentes(relatos: list[dict], hoje: date) -> list[dict]:
    def dias(r: dict) -> int:
        return (hoje - datetime.fromisoformat(r["gravado_em"].replace("Z", "+00:00")).date()).days

    return [r for r in relatos if dias(r) < DIAS]


def validar(aviso: Aviso, ids: set[str]) -> list[str]:
    problemas = []
    if len({e for e in aviso.evidencias if e in ids}) < MINIMO_EVIDENCIAS:
        problemas.append("poucas evidências reais")
    for texto in (aviso.titulo, aviso.texto):
        problemas += [f"{v.regra} ({v.trecho})" for v in guardrails.verificar_texto_familia(texto)]
    if len(aviso.texto) > 400:
        problemas.append("texto longo demais")
    return problemas


def _pronto(aviso: Aviso, ids: set[str]) -> dict:
    return {
        "titulo": guardrails.remover_travessoes(aviso.titulo.strip()),
        "texto": guardrails.remover_travessoes(aviso.texto.strip()),
        "tipo": aviso.tipo,
        "evidencias": [e for e in dict.fromkeys(aviso.evidencias) if e in ids],
        "acao": aviso.acao,
    }


def gerar(relatos: list[dict], passaporte: dict, hoje: date, provedor: ProvedorIA | None) -> dict:
    """{"avisos": [...], "motor": "ia" | "regras"}. Lista vazia com poucos relatos."""
    recentes = _recentes(relatos, hoje)
    if len(recentes) < MINIMO_RELATOS:
        return {"avisos": [], "motor": "regras"}
    ids = {r["id"] for r in recentes}
    chamada = passaporte.get("como_gosta_de_ser_chamada") or passaporte.get("nome") or "ela"
    if provedor is not None:
        linhas = "\n".join(
            f"[{r['id']}] {_data(r['gravado_em'])}: {_linha_do_registro(r)}" for r in recentes
        )
        prompt = f"Pessoa cuidada: {chamada}. Relatos dos últimos {DIAS} dias, do mais recente ao mais antigo:\n{linhas}"
        try:
            resposta = provedor.gerar_estruturado(prompt, SISTEMA, Avisos)
            bons = [_pronto(a, ids) for a in resposta.avisos if not validar(a, ids)]
            return {"avisos": bons[:3], "motor": "ia"}
        except (ErroProvedorIA, ValueError):
            pass
    return {"avisos": detectores(recentes, chamada)[:3], "motor": "regras"}


def detectores(recentes: list[dict], chamada: str) -> list[dict]:
    """Os mesmos tipos de aviso, por contagem simples. Usados sem IA e como base de comparação."""
    avisos = []

    def reg(r: dict, campo: str) -> dict:
        return (r.get("registro") or {}).get(campo) or {}

    agitados = [
        r for r in recentes if reg(r, "agitacao").get("nivel") in ("leve", "moderada", "intensa")
    ]
    periodos = Counter(p for r in agitados for p in reg(r, "agitacao").get("periodos") or [])
    if periodos:
        periodo, n = periodos.most_common(1)[0]
        if n >= MINIMO_EVIDENCIAS and n / len(agitados) >= 0.6:
            nome = {"manha": "de manhã", "tarde": "à tarde", "noite": "à noite"}.get(
                periodo, "de madrugada"
            )
            avisos.append(
                {
                    "titulo": f"Agitação costuma vir {nome}",
                    "texto": f"Em {n} dos {len(agitados)} relatos com agitação, ela apareceu {nome}. Vale contar isso à equipe de saúde na próxima consulta.",
                    "tipo": "levar_a_consulta",
                    "evidencias": [
                        r["id"]
                        for r in agitados
                        if periodo in (reg(r, "agitacao").get("periodos") or [])
                    ],
                    "acao": "ver_semana",
                }
            )

    recusas = [r for r in recentes if reg(r, "medicacao").get("tomou") in ("nao", "parcial")]
    if len(recusas) >= MINIMO_EVIDENCIAS:
        avisos.append(
            {
                "titulo": "Remédio recusado algumas vezes",
                "texto": f"Em {len(recusas)} relatos do último mês a {chamada} não tomou todos os remédios. Vale contar à equipe de saúde.",
                "tipo": "levar_a_consulta",
                "evidencias": [r["id"] for r in recusas],
                "acao": "ver_semana",
            }
        )

    cansados = [r for r in recentes if reg(r, "quem_cuida").get("cansaco") == "muito"]
    if len(cansados) >= MINIMO_EVIDENCIAS:
        avisos.append(
            {
                "titulo": "Quem cuida está cansado",
                "texto": f"Em {len(cansados)} relatos do último mês quem cuida contou estar muito cansado. Que tal dividir uma tarefa com a família?",
                "tipo": "cuidar_de_quem_cuida",
                "evidencias": [r["id"] for r in cansados],
                "acao": "nova_tarefa",
            }
        )

    ajudou = Counter(
        a.strip().lower()
        for r in recentes
        for a in (r.get("registro") or {}).get("o_que_ajudou") or []
    )
    if ajudou:
        coisa, n = ajudou.most_common(1)[0]
        if n >= MINIMO_EVIDENCIAS:
            avisos.append(
                {
                    "titulo": "O que tem funcionado",
                    "texto": f"{coisa[0].upper() + coisa[1:]} ajudou em {n} relatos do último mês. Vale repetir nos momentos difíceis.",
                    "tipo": "o_que_funciona",
                    "evidencias": [
                        r["id"]
                        for r in recentes
                        if coisa
                        in [
                            a.strip().lower()
                            for a in (r.get("registro") or {}).get("o_que_ajudou") or []
                        ]
                    ],
                    "acao": "ver_passaporte",
                }
            )
    return avisos
