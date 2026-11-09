"""Métricas usadas nas avaliações. Sem dependências externas, para rodar em qualquer lugar."""

from __future__ import annotations

import re

from core.guardrails import normalizar


def palavras(texto: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalizar(texto))


def wer(referencia: str, hipotese: str) -> float:
    """Word Error Rate: (substituições + inserções + remoções) / palavras da referência."""
    ref, hip = palavras(referencia), palavras(hipotese)
    if not ref:
        return 0.0 if not hip else 1.0
    anterior = list(range(len(hip) + 1))
    for i, r in enumerate(ref, start=1):
        atual = [i] + [0] * len(hip)
        for j, h in enumerate(hip, start=1):
            atual[j] = min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (r != h))
        anterior = atual
    return anterior[-1] / len(ref)


def valor_no_caminho(dados: dict, caminho: str):
    atual = dados
    for parte in caminho.split("."):
        if not isinstance(atual, dict):
            return None
        atual = atual.get(parte)
    return atual


def campo_correto(obtido, aceitos: list) -> bool:
    if isinstance(obtido, int | float) and not isinstance(obtido, bool):
        return any(isinstance(a, int | float) and abs(obtido - a) <= 0.5 for a in aceitos)
    return obtido in aceitos


def precisao_revocacao(verdadeiro_pos: int, falso_pos: int, falso_neg: int) -> tuple[float, float]:
    precisao = verdadeiro_pos / (verdadeiro_pos + falso_pos) if verdadeiro_pos + falso_pos else 1.0
    revocacao = verdadeiro_pos / (verdadeiro_pos + falso_neg) if verdadeiro_pos + falso_neg else 1.0
    return precisao, revocacao
