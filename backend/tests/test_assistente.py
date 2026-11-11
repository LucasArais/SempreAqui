"""Ajudante: responde com o que está registrado e mantém as regras do Apoio."""

from datetime import date

from core import assistente
from core.guardrails import verificar_texto_familia
from demo.passaporte import PASSAPORTE_DEMO

HOJE = date(2026, 11, 10)


def relato(
    dia: int, sono="boa", horas=7, comida="boa", tomou="sim", resumo="Dia tranquilo.", alertas=None
):
    return {
        "id": f"r{dia}",
        "gravado_em": f"2026-11-{dia:02d}T21:00:00-03:00",
        "resumo": resumo,
        "alertas": alertas or [],
        "registro": {
            "sono": {"qualidade": sono, "horas_aproximadas": horas},
            "alimentacao": {"qualidade": comida},
            "humor": {"predominante": "calmo"},
            "medicacao": {"tomou": tomou},
            "momentos_bons": ["Cantou com a neta"],
            "o_que_ajudou": ["músicas do Roberto Carlos"],
        },
    }


CTX = {
    "passaporte": PASSAPORTE_DEMO,
    "relatos": [
        relato(10, resumo="A Dona Isabel teve um dia bom."),
        relato(9, sono="ruim", horas=4, comida="pouca", tomou="parcial"),
    ],
    "semana": {
        "periodo": "4 a 10 de novembro",
        "dias_com_relato": 2,
        "mudancas": [{"texto": "Acordou mais vezes à noite"}],
    },
    "resumo_semana": None,
    "tarefas": [
        {"titulo": "Cobrir a folga de sábado", "responsavel_nome": None, "concluida": False},
        {"titulo": "Consulta na UBS", "responsavel_nome": "Cláudia", "concluida": False},
    ],
    "conversa": {"tema": "O ateliê de costura", "perguntas": ["O que a senhora vê aqui?"]},
    "hoje": HOJE,
}


def perguntar(texto):
    return assistente.responder(texto, CTX)


def test_responde_com_os_dados_e_diz_de_onde_veio():
    hoje = perguntar("Como ela está hoje?")
    assert "dia bom" in hoje["texto"] and hoje["origem"].startswith("Do Diário")
    sono = perguntar("Ela tem dormido bem?")
    assert "noite boa em 1 dia" in sono["texto"] and "noite ruim em 1 dia" in sono["texto"]
    assert "5,5 horas" in sono["texto"]
    assert "acordou mais vezes" in perguntar("Como foi a semana?")["texto"]
    tarefas = perguntar("O que falta fazer?")
    assert "ninguém assumiu ainda" in tarefas["texto"] and tarefas["acao"] == "ver_tarefas"
    assert "Roberto Carlos" in perguntar("Do que ela gosta?")["texto"]
    assert "ateliê" in perguntar("Sobre o que conversar com ela?")["texto"]


def test_seguranca_vem_antes_de_tudo():
    risco = perguntar("Ela caiu e bateu a cabeça")
    assert risco["tipo"] == "apoio" and risco["apoio"]["tipo"] == "risco"
    medica = perguntar("Posso dar meio comprimido de rivotril?")
    assert medica["tipo"] == "apoio" and medica["apoio"]["tipo"] == "medica"
    assert perguntar("Ela está piorando?")["apoio"]["tipo"] == "medica"
    situacao = perguntar("Ela está agitada, o que eu faço?")
    assert situacao["tipo"] == "apoio" and situacao["apoio"]["fontes"]
    assert perguntar("Ela não quer comer")["tipo"] == "apoio"
    assert perguntar("Ela comeu bem?")["tipo"] == "resposta"


def test_nao_inventa_quando_nao_sabe():
    r = perguntar("Qual é a capital da França?")
    assert r["tipo"] == "nao_entendi" and r["sugestoes"]
    assert "Dona Isabel" in r["contexto"]


def test_textos_respeitam_os_guardrails():
    for pergunta in [
        "Oi",
        "O que você sabe?",
        "Como ela está?",
        "Como foi a semana?",
        "Ela tem dormido bem?",
        "Ela comeu bem?",
        "Ela tomou os remédios?",
        "Como está o humor dela?",
        "O que falta fazer?",
        "Do que ela gosta?",
    ]:
        r = perguntar(pergunta)
        assert r["tipo"] == "resposta", pergunta
        assert not verificar_texto_familia(r["texto"]), (pergunta, r["texto"])


def test_perto_e_sus():
    assert perguntar("Tem hospital perto?")["acao"] == "ver_perto"
    assert perguntar("Onde fica a UBS mais próxima?")["acao"] == "ver_perto"
    assert perguntar("Qual o cartão SUS dela?")["acao"] == "ver_sus"
    assert perguntar("Ela caiu, tem hospital perto?")["tipo"] == "apoio", "risco vem antes"


def test_naomi_conta_a_origem_do_nome():
    for pergunta in [
        "Por que você se chama Naomi?",
        "qual a origem do seu nome?",
        "quem foi Naomi Feil?",
    ]:
        r = assistente.responder(pergunta, CTX)
        assert "Naomi Feil" in (r.get("texto") or ""), pergunta
        assert r.get("acao") == "ver_naomi"


def test_confusao_de_repente_vai_para_o_apoio_mesmo_falando_de_hoje():
    r = perguntar("Desde hoje cedo ela está muito mais confusa que o normal, de repente")
    assert r["tipo"] == "apoio"
    assert "ligar_unidade" in r["apoio"]["acoes"]
