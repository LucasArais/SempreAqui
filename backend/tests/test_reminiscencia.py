"""Conversa de hoje: muda todo dia, nunca testa a memória e aprende com a reação da família."""

from datetime import date, timedelta

from core import guardrails, reminiscencia
from demo.passaporte import PASSAPORTE_DEMO
from tests.test_api import FAMILIA, ambiente  # noqa: F401 - fixture

HOJE = date(2026, 11, 10)


def conversa(dia=HOJE, historico=None, pular=None):
    return reminiscencia.conversa_do_dia(PASSAPORTE_DEMO, historico or [], dia, "familia-x", pular)


def test_nenhum_roteiro_testa_a_memoria_nem_viola_guardrails():
    for tipo, roteiros in reminiscencia.ROTEIROS.items():
        for roteiro in roteiros:
            for pergunta in roteiro:
                assert not reminiscencia.PROIBIDO.search(pergunta), (tipo, pergunta)
                assert not guardrails.verificar_texto_familia(pergunta), (tipo, pergunta)


def test_mesmo_dia_mesma_conversa_e_dias_seguidos_variam():
    assert conversa() == conversa()
    temas = {conversa(HOJE + timedelta(days=i))["tema_chave"] for i in range(7)}
    assert len(temas) >= 4


def test_perguntas_preenchidas_sem_marcadores():
    for i in range(30):
        c = conversa(HOJE + timedelta(days=i))
        assert len(c["perguntas"]) == 4
        for p in c["perguntas"]:
            assert "{" not in p and "}" not in p
            assert not reminiscencia.PROIBIDO.search(p)


def test_tema_recente_nao_repete_e_desconforto_sai_da_roda():
    primeira = conversa()
    ontem = {
        "data": (HOJE - timedelta(days=1)).isoformat(),
        "tema_chave": primeira["tema_chave"],
        "conjunto": 0,
    }
    assert (
        conversa(historico=[{**ontem, "reacao": "gostou"}])["tema_chave"] != primeira["tema_chave"]
    )
    for i in range(1, 15):
        dia = HOJE + timedelta(days=i)
        ruim = {**ontem, "reacao": "desconforto"}
        assert conversa(dia, historico=[ruim])["tema_chave"] != primeira["tema_chave"]


def test_mesmo_tema_volta_com_outras_perguntas():
    c = conversa()
    antes = {
        "data": (HOJE - timedelta(days=10)).isoformat(),
        "tema_chave": c["tema_chave"],
        "conjunto": c["conjunto"],
    }
    pesos = reminiscencia._pesos(reminiscencia.temas_do_passaporte(PASSAPORTE_DEMO), [antes], HOJE)
    assert pesos[c["tema_chave"]] > 0
    tema = next(
        t for t in reminiscencia.temas_do_passaporte(PASSAPORTE_DEMO) if t.chave == c["tema_chave"]
    )
    assert len(reminiscencia.ROTEIROS[tema.tipo]) > 1


def test_pular_troca_o_tema():
    c = conversa()
    assert conversa(pular=[c["tema_chave"]])["tema_chave"] != c["tema_chave"]


def test_artigos_encaixam_nas_frases():
    assert reminiscencia._sem_artigo("O marido") == ("o marido", "do marido")
    assert reminiscencia._sem_artigo("Rafael") == ("Rafael", "de Rafael")


def test_api_passaporte_e_conversa(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    vazio = cliente.get("/passaporte", headers=FAMILIA).json()
    assert vazio["acalma"] == []
    assert cliente.get("/conversa/hoje", headers=FAMILIA).json()["roteiro"] is None

    resposta = cliente.put("/passaporte", json=PASSAPORTE_DEMO, headers=FAMILIA)
    assert resposta.status_code == 200
    salvo = cliente.get("/passaporte", headers=FAMILIA).json()
    assert salvo["como_gosta_de_ser_chamada"] == "Dona Isabel"

    ruim = {**PASSAPORTE_DEMO, "quem_ela": "Uma paciente muito querida."}
    assert cliente.put("/passaporte", json=ruim, headers=FAMILIA).status_code == 422
    link_ruim = {
        **PASSAPORTE_DEMO,
        "musicas": [{"id": "m1", "titulo": "X", "link": "javascript:alert(1)"}],
    }
    assert cliente.put("/passaporte", json=link_ruim, headers=FAMILIA).status_code == 422

    hoje = cliente.get("/conversa/hoje", headers=FAMILIA).json()
    roteiro = hoje["roteiro"]
    assert hoje["feitas_hoje"] == 0
    feito = cliente.post("/conversas", json={**roteiro, "reacao": "gostou_muito"}, headers=FAMILIA)
    assert feito.status_code == 201
    depois = cliente.get("/conversa/hoje", headers=FAMILIA).json()
    assert depois["feitas_hoje"] == 1 and depois["ultima_reacao"] == "gostou_muito"
    assert (
        cliente.post("/conversas", json={**roteiro, "reacao": "xyz"}, headers=FAMILIA).status_code
        == 422
    )
    assert len(cliente.get("/conversas", headers=FAMILIA).json()) == 1
    assert cliente.get("/conversas", headers={"X-Familia": "outra-familia"}).json() == []


def test_demo_comeca_com_o_passaporte_da_dona_isabel(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    demo = cliente.get("/passaporte", headers={"X-Familia": "familia-demo"}).json()
    assert demo["como_gosta_de_ser_chamada"] == "Dona Isabel"
    assert len(demo["lembrancas"]) == 5


def test_nome_proprio_nao_vira_minuscula():
    tema = reminiscencia.Tema("gosto:x", "gosto", "Roberto Carlos")
    assert "Roberto Carlos" in reminiscencia._preencher("A senhora gosta de {t}, né?", tema)
    tema2 = reminiscencia.Tema("gosto:y", "gosto", "Retalhos de tecido")
    assert "de retalhos de tecido" in reminiscencia._preencher("A senhora gosta de {t}, né?", tema2)
