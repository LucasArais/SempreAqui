"""Testa o fluxo do grafo do Diário com um provedor falso (sem rede)."""

from agents.diario import processar_relato
from core.llm import ProvedorFalso
from tests.conftest import REGISTRO_QUEDA, REGISTRO_TRANQUILO


def test_fluxo_completo_a_partir_de_audio(provedor_tranquilo):
    estado = processar_relato(provedor_tranquilo, audio=b"falso")
    assert estado["transcricao"].startswith("Hoje foi um dia bom")
    assert estado["registro"].medicacao.tomou == "sim"
    assert estado["alertas"] == []
    assert "Roberto Carlos" in estado["resumo"]
    assert provedor_tranquilo.chamadas == ["transcrever_audio", "gerar_estruturado", "gerar_texto"]


def test_transcricao_pronta_pula_audio(provedor_tranquilo):
    processar_relato(provedor_tranquilo, transcricao="A mãe dormiu bem.")
    assert "transcrever_audio" not in provedor_tranquilo.chamadas


def test_resumo_com_violacao_e_refeito():
    provedor = ProvedorFalso(
        transcricao="x",
        estruturado=REGISTRO_TRANQUILO,
        textos=["O paciente teve um bom dia.", "A mãe teve um bom dia."],
    )
    estado = processar_relato(provedor, transcricao="A mãe teve um bom dia.")
    assert estado["resumo"] == "A mãe teve um bom dia."
    assert estado["resumo_seguro_usado"] is False
    assert provedor.chamadas.count("gerar_texto") == 2


def test_violacao_persistente_usa_resumo_seguro():
    provedor = ProvedorFalso(
        estruturado=REGISTRO_TRANQUILO,
        textos=["Aumente a dose do remédio.", "Talvez reduzir a dose do remédio ajude."],
    )
    estado = processar_relato(provedor, transcricao="relato")
    assert estado["resumo_seguro_usado"] is True
    assert "dose" not in estado["resumo"]
    assert "Roberto Carlos" in estado["resumo"]


def test_risco_exige_192_no_resumo():
    provedor = ProvedorFalso(
        estruturado=REGISTRO_QUEDA,
        textos=[
            "A vó caiu hoje, mas o resto do dia foi tranquilo.",
            "A vó caiu hoje e bateu a cabeça. Ainda sem 192.",
        ],
    )
    estado = processar_relato(provedor, transcricao="A vó caiu e bateu a cabeça.")
    assert estado["alertas"]
    assert "192" in estado["resumo"]


def test_palavra_chave_de_risco_gera_alerta_mesmo_se_ia_nao_marcar():
    registro = {**REGISTRO_TRANQUILO, "sinais_de_alerta": []}
    provedor = ProvedorFalso(
        estruturado=registro, textos=["Ela engasgou no almoço. Se houver risco agora, ligue 192."]
    )
    estado = processar_relato(provedor, transcricao="Ela engasgou no almoço.")
    assert estado["alertas"]
    assert "192" in estado["resumo"]
