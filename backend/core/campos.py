"""Campos do Diário que a família pode corrigir, com os valores aceitos.

Os valores vêm do próprio schema (Literal), então não há como a lista ficar desatualizada.
"""

from __future__ import annotations

import copy
from typing import Any, Literal, get_args, get_origin

from core.schemas.diario import RegistroDiario

# campo -> rótulo para a interface
EDITAVEIS: dict[str, str] = {
    "sono.qualidade": "Sono",
    "sono.horas_aproximadas": "Horas de sono",
    "sono.despertares_noturnos": "Vezes que acordou",
    "alimentacao.qualidade": "Alimentação",
    "alimentacao.hidratacao": "Água",
    "humor.predominante": "Humor",
    "agitacao.nivel": "Agitação",
    "medicacao.tomou": "Remédios",
    "quem_cuida.cansaco": "Seu cansaço",
    "observacoes": "Observações",
}


class CampoInvalido(ValueError):
    pass


def _anotacao(caminho: str):
    modelo: Any = RegistroDiario
    anotacao = None
    for parte in caminho.split("."):
        anotacao = modelo.model_fields[parte].annotation
        modelo = anotacao
    return anotacao


def opcoes(caminho: str) -> list[str] | None:
    """Valores aceitos para campos de escolha. None para número ou texto livre."""
    anotacao = _anotacao(caminho)
    if get_origin(anotacao) is Literal:
        return list(get_args(anotacao))
    return None


def ler(registro: dict, caminho: str) -> Any:
    atual: Any = registro
    for parte in caminho.split("."):
        atual = atual.get(parte) if isinstance(atual, dict) else None
    return atual


def aplicar(registro: dict, caminho: str, valor: Any) -> dict:
    """Devolve um novo registro com o campo alterado, validado pelo schema."""
    if caminho not in EDITAVEIS:
        raise CampoInvalido(f"O campo {caminho!r} não pode ser corrigido.")
    novo = copy.deepcopy(registro)
    alvo = novo
    partes = caminho.split(".")
    for parte in partes[:-1]:
        alvo = alvo.setdefault(parte, {})
    alvo[partes[-1]] = valor
    try:
        return RegistroDiario.model_validate(novo).model_dump()
    except ValueError as erro:
        raise CampoInvalido(f"Valor inválido para {caminho}.") from erro


def descrever() -> list[dict]:
    """Lista para o app montar a tela de correção."""
    return [{"campo": c, "rotulo": r, "opcoes": opcoes(c)} for c, r in EDITAVEIS.items()]
