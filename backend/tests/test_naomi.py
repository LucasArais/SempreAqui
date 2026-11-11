"""Naomi agente: a IA só aparece quando cita fontes reais e passa nos guardrails."""

from core import avisos, naomi
from core.llm import ProvedorFalso
from demo.passaporte import PASSAPORTE_DEMO
from tests.test_assistente import CTX, HOJE, relato


def ia(**campos) -> ProvedorFalso:
    base = {"texto": "", "fontes": [], "sabe_responder": True, "acao": None, "sugestoes": []}
    return ProvedorFalso(estruturado={**base, **campos})


def test_resposta_da_ia_com_fonte_real():
    p = ia(
        texto="A Dona Isabel dormiu mal na noite do dia 9, umas 4 horas.",
        fontes=["relato-r9"],
        acao="ver_semana",
    )
    r = naomi.responder("e a noite de anteontem, como foi?", CTX, p)
    assert r["motor"] == "ia"
    assert r["relato_id"] == "r9"
    assert "Diário" in r["origem"]
    assert r["acao"] == "ver_semana"


def test_fonte_inventada_volta_para_as_regras():
    p = ia(texto="Ela dormiu 9 horas.", fontes=["relato-nao-existe"])
    r = naomi.responder("ela tem dormido bem?", CTX, p)
    assert r["motor"] == "regras"


def test_orientacao_medica_da_ia_e_barrada():
    p = ia(texto="Aumente a dose do remédio da noite.", fontes=["relato-r9"])
    r = naomi.responder("o que eu faço com o sono dela?", CTX, p)
    assert r["motor"] == "regras"
    assert "dose" not in (r.get("texto") or "")


def test_risco_nem_chega_na_ia():
    p = ia(texto="qualquer coisa", fontes=["relato-r9"])
    r = naomi.responder("ela caiu e bateu a cabeça", CTX, p)
    assert r["tipo"] == "apoio"
    assert p.chamadas == []


def test_sem_provedor_as_regras_respondem():
    r = naomi.responder("Como foi a semana?", CTX, None)
    assert r["motor"] == "regras"
    assert r["texto"]


def test_ia_que_nao_sabe_cede_para_as_regras():
    p = ia(texto="Não sei.", sabe_responder=False)
    r = naomi.responder("Como foi a semana?", CTX, p)
    assert r["motor"] == "regras"


def test_documentos_trazem_guia_e_historia():
    docs = {d["id"]: d for d in naomi.documentos("ela está agitada à tarde", CTX)}
    assert "naomi" in docs and "passaporte-acalma" in docs
    assert any(i.startswith("guia-") for i in docs)


# Avisos ---------------------------------------------------------------------


def _mes_com_agitacao_a_tarde():
    rs = []
    for dia in range(1, 11):
        r = relato(dia)
        r["registro"]["agitacao"] = {
            "nivel": "moderada" if dia % 2 else "nenhuma",
            "periodos": ["tarde"] if dia % 2 else [],
        }
        r["registro"]["quem_cuida"] = {"cansaco": "muito" if dia > 6 else "algum"}
        rs.append(r)
    return list(reversed(rs))


def test_detectores_acham_agitacao_a_tarde_e_cansaco():
    r = avisos.gerar(_mes_com_agitacao_a_tarde(), PASSAPORTE_DEMO, HOJE, None)
    titulos = " ".join(a["titulo"] for a in r["avisos"])
    assert "tarde" in titulos
    assert any(a["tipo"] == "cuidar_de_quem_cuida" for a in r["avisos"])


def test_aviso_da_ia_precisa_de_tres_relatos_reais():
    p = ProvedorFalso(
        estruturado={
            "avisos": [
                {
                    "titulo": "Agitação à tarde",
                    "texto": "Em 5 relatos a agitação veio à tarde. Vale contar à equipe de saúde.",
                    "tipo": "levar_a_consulta",
                    "evidencias": ["r1", "r3", "r5"],
                },
                {
                    "titulo": "Sono pior",
                    "texto": "O sono piorou.",
                    "tipo": "levar_a_consulta",
                    "evidencias": ["r1", "inventado", "outro"],
                },
            ]
        }
    )
    r = avisos.gerar(_mes_com_agitacao_a_tarde(), PASSAPORTE_DEMO, HOJE, p)
    assert r["motor"] == "ia"
    assert [a["titulo"] for a in r["avisos"]] == ["Agitação à tarde"]


def test_poucos_relatos_sem_aviso():
    assert avisos.gerar([relato(10)], PASSAPORTE_DEMO, HOJE, None)["avisos"] == []


def test_pergunta_de_periodo_vai_para_a_ia_mas_risco_nao():
    p = ia(texto="A agitação apareceu mais à tarde.", fontes=["relato-r9"])
    assert naomi.responder("Em que período ela fica mais agitada?", CTX, p)["motor"] == "ia"
    p2 = ia(texto="x", fontes=["relato-r9"])
    assert (
        naomi.responder("Quando ela caiu e bateu a cabeça, o que faço?", CTX, p2)["tipo"] == "apoio"
    )
    assert p2.chamadas == []
