import os

# Testes sempre no modo local: SQLite e cabeçalho X-Familia aceito. Nunca tocam o Supabase.
os.environ["REPOSITORIO"] = "local"
os.environ["ACEITAR_X_FAMILIA"] = "1"
os.environ.pop("FAMILIA_DEMO_PARA_NOVOS", None)

import pytest

from core.llm import ProvedorFalso

REGISTRO_QUEDA = {
    "sono": {"qualidade": "boa", "horas_aproximadas": 8},
    "alimentacao": {"qualidade": "boa", "hidratacao": "nao_informado"},
    "humor": {"predominante": "calmo"},
    "agitacao": {"nivel": "nenhuma"},
    "episodios": [
        {"tipo": "queda", "descricao": "Escorregou no banheiro e bateu a cabeça na pia."}
    ],
    "medicacao": {"tomou": "sim"},
    "o_que_ajudou": ["ver fotos antigas da família"],
    "quem_cuida": {"cansaco": "nao_informado"},
    "sinais_de_alerta": ["queda com batida na cabeça e sonolência fora do normal"],
}

REGISTRO_TRANQUILO = {
    "sono": {"qualidade": "boa", "horas_aproximadas": 7, "despertares_noturnos": 1},
    "alimentacao": {"qualidade": "regular", "hidratacao": "boa"},
    "humor": {"predominante": "calmo"},
    "agitacao": {"nivel": "leve", "periodos": ["tarde"], "gatilhos": ["pergunta pela mãe"]},
    "medicacao": {"tomou": "sim"},
    "o_que_ajudou": ["músicas do Roberto Carlos"],
    "momentos_bons": ["sorriu na chamada de vídeo com o filho"],
    "quem_cuida": {"cansaco": "algum"},
}


@pytest.fixture
def provedor_tranquilo():
    return ProvedorFalso(
        transcricao="Hoje foi um dia bom. A mãe dormiu bem.",
        estruturado=REGISTRO_TRANQUILO,
        textos=["A mãe teve um dia bom. Dormiu bem e cantou com as músicas do Roberto Carlos."],
    )
