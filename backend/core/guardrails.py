"""Guardrails determinísticos aplicados depois da IA.

O prompt pede o comportamento certo; este módulo confere. Se o texto da IA violar uma regra,
o agente tenta de novo e, se ainda falhar, usa um texto seguro montado sem IA.
Tudo aqui é testado em tests/test_guardrails.py e medido em evals/guardrails/.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

MENSAGEM_RISCO = (
    "Se houver risco agora, ligue 192 (SAMU). "
    "Em caso de violência, ligue 190. Para denunciar violência contra a pessoa idosa, Disque 100."
)

# Termos que desrespeitam a pessoa que vive com Alzheimer na interface da família.
_TERMOS_DESRESPEITOSOS = [
    r"\bpacientes?\b",
    r"\bfardos?\b",
    r"\b(e|eh|virou|vira|se tornou|tornou-se|tem sido|esta sendo|sendo) (um|uma) peso\b",
    r"\bdementes?\b",
    r"\bcaduc[oa]s?\b",
    r"\bcaducando\b",
]

# Padrões de diagnóstico, interpretação clínica ou orientação sobre medicamento.
_ORIENTACAO_MEDICA = [
    r"\bdiagnostic",
    r"\b(aumente|aumentar|reduza|reduzir|diminua|diminuir|suspenda|suspender|pare de dar|"
    r"troque|trocar|ajuste|ajustar|dobre|dobrar)\b.{0,40}\b(dose|doses|remedio|remedios|"
    r"medicacao|medicamento|medicamentos|comprimido)",
    r"\b(de|dar|ofereca|administre|administrar)\b.{0,15}\b(\d+ ?mg|comprimidos? de|"
    r"dipirona|paracetamol|rivotril|clonazepam|haloperidol|quetiapina|risperidona|donepezila|"
    r"memantina|rivastigmina|galantamina)\b",
    r"\bprovavelmente (e|tem|esta com|seja|sejam)\b",
    r"\b(sinal|sinais|sintoma|sintomas|indicio|indicios) de "
    r"(piora|progressao|avanco|infeccao|avc|delirium|depressao)\b",
    r"\b(estagio|fase) (inicial|moderad[oa]|avancad[oa]|grave|final)\b",
    r"\bpiora (da doenca|do alzheimer|da demencia|cognitiva)\b",
    r"\ba doenca (esta )?(avancando|progredindo)\b",
]

# Palavras que indicam possível emergência no relato de quem cuida.
_RISCO = [
    r"\bcai[ru]\b",
    r"\bcaiu\b",
    r"\bqueda\b",
    r"\bbateu a cabeca\b",
    r"\bengasg",
    r"\bfalta de ar\b",
    r"\bnao (consegue|conseguia) respirar\b",
    r"\bdesmai",
    r"\bsangr",
    r"\bconvuls",
    r"\b(sumiu|desapareceu|nao (encontro|acho) (ela|ele))\b",
    r"\bagred",
    r"\bviolencia\b",
    r"\bme bateu\b",
    r"\bnao acorda\b",
    r"\binconscien",
    r"\bdor no peito\b",
]

_TRAVESSOES = ("\u2014", "\u2013")


@dataclass(frozen=True)
class Violacao:
    regra: str
    trecho: str


def normalizar(texto: str) -> str:
    """Minúsculas e sem acentos, para casar padrões de forma robusta."""
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.lower()


def _buscar(padroes: list[str], texto: str) -> list[str]:
    base = normalizar(texto)
    achados = []
    for padrao in padroes:
        m = re.search(padrao, base)
        if m:
            achados.append(m.group(0))
    return achados


def remover_travessoes(texto: str) -> str:
    texto = re.sub(r"\s*[\u2014\u2013]\s*", ", ", texto)
    return re.sub(r",\s*,", ",", texto)


def verificar_texto_familia(texto: str) -> list[Violacao]:
    """Confere um texto que será mostrado à família. Lista vazia significa aprovado."""
    violacoes = [
        Violacao("linguagem_desrespeitosa", t) for t in _buscar(_TERMOS_DESRESPEITOSOS, texto)
    ]
    violacoes += [Violacao("orientacao_medica", t) for t in _buscar(_ORIENTACAO_MEDICA, texto)]
    if any(t in texto for t in _TRAVESSOES):
        violacoes.append(Violacao("travessao", "travessão"))
    return violacoes


def detectar_risco(texto: str) -> list[str]:
    """Detecção por palavras-chave, complementar à da IA. Prefere falso positivo a falso negativo."""
    return _buscar(_RISCO, texto)


def menciona_192(texto: str) -> bool:
    return "192" in texto
