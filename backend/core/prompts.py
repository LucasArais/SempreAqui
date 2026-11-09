"""Prompts versionados em arquivos (backend/prompts/<area>/<nome>.<versao>.md).

Mudar um prompt é criar uma nova versão e rodar as avaliações, nunca editar em silêncio.
"""

from __future__ import annotations

from functools import lru_cache

from core.config import RAIZ_BACKEND

PASTA_PROMPTS = RAIZ_BACKEND / "prompts"


@lru_cache
def carregar(nome: str, versao: str = "v1") -> str:
    caminho = PASTA_PROMPTS / f"{nome}.{versao}.md"
    return caminho.read_text(encoding="utf-8").strip()


def preencher(modelo: str, **valores: str) -> str:
    """Substitui {{chave}} sem conflitar com chaves de JSON no texto."""
    for chave, valor in valores.items():
        modelo = modelo.replace("{{" + chave + "}}", valor)
    return modelo


def sistema(versao_guardrails: str = "v1") -> str:
    return carregar("base/guardrails", versao_guardrails)
