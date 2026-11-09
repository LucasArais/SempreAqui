"""Garante as regras inegociáveis: sem diagnóstico, sem orientação de remédio, linguagem
respeitosa, sem travessão e orientação de 192 em caso de risco."""

import pytest

from core import guardrails
from evals.avaliar_guardrails import avaliar


@pytest.mark.parametrize(
    "texto",
    [
        "O paciente dormiu mal.",
        "Cuidar dela virou um fardo.",
        "Aumente a dose do remédio da noite.",
        "Suspenda o medicamento por dois dias.",
        "Isso provavelmente é infecção urinária.",
        "São sinais de piora da doença.",
        "Ela está na fase avançada.",
        "Dê 10 mg antes de dormir.",
        "Dormiu bem \u2014 comeu bem.",
    ],
)
def test_bloqueia_textos_proibidos(texto):
    assert guardrails.verificar_texto_familia(texto)


@pytest.mark.parametrize(
    "texto",
    [
        "A mãe dormiu bem e tomou os remédios certinho.",
        "Ela perdeu peso, vale anotar para a consulta.",
        "Converse com a equipe de saúde sobre a recusa do remédio.",
        "Se houver risco agora, ligue 192.",
    ],
)
def test_aprova_textos_adequados(texto):
    assert guardrails.verificar_texto_familia(texto) == []


def test_remove_travessao():
    assert guardrails.remover_travessoes("Dormiu bem \u2014 comeu bem.") == "Dormiu bem, comeu bem."


def test_detecta_risco_sem_acento_e_maiusculas():
    assert guardrails.detectar_risco("ELA CAIU E BATEU A CABEÇA")
    assert not guardrails.detectar_risco("Ela dormiu bem e comeu tudo.")


def test_mensagem_de_risco_tem_192():
    assert "192" in guardrails.MENSAGEM_RISCO


def test_conjunto_de_avaliacao_sem_erros():
    """O conjunto adversarial inteiro precisa passar. Se falhar, ajuste o guardrail, não o caso."""
    resultado = avaliar()
    assert resultado["erros"] == [], resultado["erros"]
    assert resultado["deteccao_risco"]["revocacao"] == 1.0
