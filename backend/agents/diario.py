"""Grafo do Diário Inteligente.

    áudio ──> transcrever ──> extrair ──> avaliar_risco ──> resumir ──> revisar ──> fim
                                                                 ^          │
                                                                 └─ refazer ┘ (uma vez)

- transcrever: áudio de quem cuida vira texto (pulado se a transcrição já vier pronta).
- extrair: texto vira RegistroDiario validado com Pydantic.
- avaliar_risco: soma o que a IA marcou como alerta com uma checagem por palavras-chave.
- resumir: escreve a mensagem curta para a família.
- revisar: guardrails determinísticos. Se o resumo violar uma regra, refaz uma vez;
  se violar de novo, usa um resumo seguro montado sem IA.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from core import guardrails, prompts
from core.llm import ProvedorIA
from core.schemas.diario import RegistroDiario

MAX_TENTATIVAS_RESUMO = 2

# Versão de cada prompt usada em produção. Mudar aqui é mudar o comportamento: rode as evals.
VERSOES = {"transcricao": "v1", "extracao": "v2", "resumo_familia": "v1"}

# Etapas mostradas para quem gravou, na ordem em que acontecem.
ETAPAS = ("recebido", "transcrevendo", "organizando", "resumindo", "pronto")
_ETAPA_DEPOIS_DO_NO = {"transcrever": "organizando", "avaliar_risco": "resumindo"}


class EstadoDiario(TypedDict, total=False):
    audio: bytes | None
    mime_type: str
    transcricao: str
    registro: RegistroDiario
    alertas: list[str]
    resumo: str
    tentativas_resumo: int
    violacoes: list[str]
    resumo_seguro_usado: bool


def resumo_seguro(registro: RegistroDiario, alertas: list[str]) -> str:
    """Resumo montado sem IA, usado quando a IA não passa nos guardrails."""
    partes = []
    if alertas:
        partes.append(f"Atenção: {alertas[0]}. {guardrails.MENSAGEM_RISCO}")
    rotulos = {
        "sono": registro.sono.qualidade,
        "alimentação": registro.alimentacao.qualidade,
        "humor": registro.humor.predominante,
        "remédios tomados": registro.medicacao.tomou,
    }
    itens = [f"{k}: {v.replace('_', ' ')}" for k, v in rotulos.items() if v != "nao_informado"]
    if itens:
        partes.append("Resumo do dia. " + "; ".join(itens) + ".")
    if registro.o_que_ajudou:
        partes.append("O que ajudou: " + ", ".join(registro.o_que_ajudou) + ".")
    if registro.quem_cuida.cansaco == "muito":
        partes.append("Quem cuida relatou muito cansaço hoje. Que tal combinar quem pode ajudar?")
    return " ".join(partes) or "Registro do dia salvo."


def _prompt_resumo(registro: RegistroDiario, transcricao: str, violacoes: list[str]) -> str:
    registro_json = json.dumps(registro.model_dump(exclude_none=True), ensure_ascii=False, indent=2)
    prompt = prompts.preencher(
        prompts.carregar("diario/resumo_familia", VERSOES["resumo_familia"]),
        registro=registro_json,
        transcricao=transcricao,
    )
    if violacoes:
        prompt += (
            "\n\nA versão anterior foi recusada pela revisão por: "
            + "; ".join(violacoes)
            + ". Reescreva sem esses problemas."
        )
    return prompt


def _violacoes(resumo: str, alertas: list[str]) -> list[str]:
    violacoes = [f"{v.regra} ({v.trecho})" for v in guardrails.verificar_texto_familia(resumo)]
    if alertas and not guardrails.menciona_192(resumo):
        violacoes.append("alerta de risco sem orientação de ligar 192")
    if not resumo.strip():
        violacoes.append("resumo vazio")
    return violacoes


def refazer_resumo(
    provedor: ProvedorIA, registro: RegistroDiario, transcricao: str, alertas: list[str]
) -> tuple[str, bool]:
    """Escreve de novo o resumo para a família (por exemplo, depois de uma correção).

    Mesmas regras do grafo: até duas tentativas e, se a IA insistir em violar uma regra,
    o resumo seguro montado sem IA. Devolve (resumo, resumo_seguro_usado).
    """
    sistema = prompts.sistema()
    violacoes: list[str] = []
    for _ in range(MAX_TENTATIVAS_RESUMO):
        texto = guardrails.remover_travessoes(
            provedor.gerar_texto(_prompt_resumo(registro, transcricao, violacoes), sistema)
        )
        violacoes = _violacoes(texto, alertas)
        if not violacoes:
            return texto, False
    return resumo_seguro(registro, alertas), True


def formatar_correcoes(correcoes: list[dict]) -> str:
    """Correções anteriores da família, no formato que entra no prompt de extração."""
    if not correcoes:
        return "Nenhuma correção ainda."
    linhas = []
    for c in correcoes:
        trecho = (c.get("trecho") or "").strip().replace("\n", " ")[:160]
        linhas.append(
            f'- Campo "{c["campo"]}": a IA marcou {json.dumps(c["valor_anterior"], ensure_ascii=False)}, '
            f"a família corrigiu para {json.dumps(c['valor_novo'], ensure_ascii=False)}"
            + (f' (relato: "{trecho}")' if trecho else "")
        )
    return "\n".join(linhas)


def construir_grafo(provedor: ProvedorIA, correcoes: str = ""):
    sistema = prompts.sistema()

    def transcrever(estado: EstadoDiario) -> EstadoDiario:
        if estado.get("transcricao"):
            return {}
        texto = provedor.transcrever_audio(
            estado["audio"] or b"",
            estado.get("mime_type", "audio/mpeg"),
            prompts.carregar("diario/transcricao", VERSOES["transcricao"]),
        )
        return {"transcricao": texto}

    def extrair(estado: EstadoDiario) -> EstadoDiario:
        prompt = prompts.preencher(
            prompts.carregar("diario/extracao", VERSOES["extracao"]),
            transcricao=estado["transcricao"],
            correcoes=correcoes or formatar_correcoes([]),
        )
        return {"registro": provedor.gerar_estruturado(prompt, sistema, RegistroDiario)}

    def avaliar_risco(estado: EstadoDiario) -> EstadoDiario:
        alertas = list(estado["registro"].sinais_de_alerta)
        if not alertas:
            palavras = guardrails.detectar_risco(estado["transcricao"])
            if palavras:
                alertas.append(f"relato menciona '{palavras[0]}', vale verificar")
        return {"alertas": alertas}

    def resumir(estado: EstadoDiario) -> EstadoDiario:
        prompt = _prompt_resumo(
            estado["registro"], estado["transcricao"], estado.get("violacoes") or []
        )
        texto = provedor.gerar_texto(prompt, sistema)
        return {
            "resumo": guardrails.remover_travessoes(texto),
            "tentativas_resumo": estado.get("tentativas_resumo", 0) + 1,
        }

    def revisar(estado: EstadoDiario) -> EstadoDiario:
        violacoes = _violacoes(estado["resumo"], estado["alertas"])
        if violacoes and estado["tentativas_resumo"] >= MAX_TENTATIVAS_RESUMO:
            return {
                "resumo": resumo_seguro(estado["registro"], estado["alertas"]),
                "violacoes": violacoes,
                "resumo_seguro_usado": True,
            }
        return {"violacoes": violacoes, "resumo_seguro_usado": False}

    def proximo_passo(estado: EstadoDiario) -> str:
        if estado["violacoes"] and not estado["resumo_seguro_usado"]:
            return "resumir"
        return END

    grafo = StateGraph(EstadoDiario)
    grafo.add_node("transcrever", transcrever)
    grafo.add_node("extrair", extrair)
    grafo.add_node("avaliar_risco", avaliar_risco)
    grafo.add_node("resumir", resumir)
    grafo.add_node("revisar", revisar)
    grafo.add_edge(START, "transcrever")
    grafo.add_edge("transcrever", "extrair")
    grafo.add_edge("extrair", "avaliar_risco")
    grafo.add_edge("avaliar_risco", "resumir")
    grafo.add_edge("resumir", "revisar")
    grafo.add_conditional_edges("revisar", proximo_passo, ["resumir", END])
    return grafo.compile()


def processar_relato(
    provedor: ProvedorIA,
    audio: bytes | None = None,
    mime_type: str = "audio/mpeg",
    transcricao: str | None = None,
    correcoes: str = "",
    ao_mudar_etapa: Callable[[str], None] | None = None,
) -> EstadoDiario:
    """Roda o grafo inteiro a partir de um áudio ou de uma transcrição pronta.

    ao_mudar_etapa recebe "transcrevendo", "organizando" e "resumindo" conforme o grafo avança,
    para quem gravou ver o progresso real em linguagem humana.
    """
    if audio is None and not transcricao:
        raise ValueError("Envie um áudio ou uma transcrição.")
    estado: EstadoDiario = {"audio": audio, "mime_type": mime_type}
    if transcricao:
        estado["transcricao"] = transcricao
    avisar = ao_mudar_etapa or (lambda _etapa: None)
    avisar("organizando" if transcricao else "transcrevendo")
    final: EstadoDiario = estado
    grafo = construir_grafo(provedor, correcoes)
    for modo, pedaco in grafo.stream(estado, stream_mode=["updates", "values"]):
        if modo == "updates":
            for no in pedaco:
                if no in _ETAPA_DEPOIS_DO_NO:
                    avisar(_ETAPA_DEPOIS_DO_NO[no])
        else:
            final = pedaco
    return final
