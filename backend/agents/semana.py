"""Resumo semanal para a família: IA para o texto, guardrails para a segurança.

As mudanças de padrão vêm de core/semana.py (determinístico). A IA só escreve o texto humano a
partir desses fatos. Se a IA falhar ou violar uma regra duas vezes, usamos um resumo montado sem IA.
"""

from __future__ import annotations

import json

from core import guardrails, prompts
from core.llm import ProvedorIA

MAX_TENTATIVAS = 2


def resumo_seguro_semana(fatos: dict) -> str:
    if not fatos["dias_com_relato"]:
        return "Ainda não há relatos nesta semana."
    partes = [f"A família registrou {fatos['dias_com_relato']} de 7 dias."]
    mudancas = fatos["mudancas"]
    if mudancas:
        partes.append("O que mudou: " + "; ".join(m["texto"].lower() for m in mudancas) + ".")
    else:
        partes.append("Nenhuma mudança importante em relação ao habitual.")
    if fatos["o_que_ajudou"]:
        partes.append("O que ajudou: " + ", ".join(fatos["o_que_ajudou"]) + ".")
    if any(m["tipo"] == "risco" for m in mudancas):
        partes.append(guardrails.MENSAGEM_RISCO)
    return " ".join(partes)


def resumir_semana(provedor: ProvedorIA | None, fatos: dict) -> tuple[str, bool]:
    """Devolve (resumo, resumo_seguro_usado)."""
    if provedor is None or not fatos["dias_com_relato"]:
        return resumo_seguro_semana(fatos), True
    risco = any(m["tipo"] == "risco" for m in fatos["mudancas"])
    resumidos = {
        k: fatos[k]
        for k in (
            "periodo",
            "dias_com_relato",
            "mudancas",
            "o_que_ajudou",
            "momentos_bons",
            "para_consulta",
        )
    }
    prompt = prompts.preencher(
        prompts.carregar("diario/resumo_semana", "v1"),
        fatos=json.dumps(resumidos, ensure_ascii=False, indent=2),
    )
    sistema = prompts.sistema()
    violacoes: list[str] = []
    for _ in range(MAX_TENTATIVAS):
        pedido = (
            prompt
            if not violacoes
            else prompt + "\n\nA versão anterior foi recusada por: " + "; ".join(violacoes)
        )
        try:
            texto = guardrails.remover_travessoes(provedor.gerar_texto(pedido, sistema))
        except Exception:  # noqa: BLE001 - sem IA, o resumo seguro cobre
            return resumo_seguro_semana(fatos), True
        violacoes = [f"{v.regra} ({v.trecho})" for v in guardrails.verificar_texto_familia(texto)]
        if risco and not guardrails.menciona_192(texto):
            violacoes.append("risco sem orientação de ligar 192")
        if texto.strip() and not violacoes:
            return texto, False
    return resumo_seguro_semana(fatos), True
