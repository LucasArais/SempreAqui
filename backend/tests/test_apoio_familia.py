"""Ciclos 5 e 6: Apoio na Hora Difícil e Rede da Família."""

from core import apoio
from core.fontes import TRECHOS
from core.guardrails import verificar_texto_familia
from evals.avaliar_apoio import avaliar
from tests.test_api import FAMILIA, ambiente, enviar  # noqa: F401 - fixture


def test_evals_do_apoio_passam_em_100_por_cento():
    resultado = avaliar()
    assert resultado["falhas"] == [], resultado["falhas"]
    m = resultado["metricas"]
    assert m["medicas"][0] == m["medicas"][1] and m["riscos"][0] == m["riscos"][1]
    assert m["com_fonte"][0] == m["com_fonte"][1] and m["violacoes"] == 0


def test_trechos_oficiais_tem_link_e_respeitam_os_guardrails():
    for t in TRECHOS:
        assert not verificar_texto_familia(t["texto"]), t["id"]
        assert t["pagina"] > 0


def test_falar_de_remedio_sem_pedir_dose_nao_e_pergunta_medica():
    assert apoio.classificar("Ela não quer tomar o remédio da manhã") == "geral"
    assert apoio.classificar("Posso dar o remédio da manhã mais tarde?") == "medica"


def test_api_apoio_usa_o_passaporte_da_familia(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    resposta = cliente.post(
        "/apoio",
        json={"texto": "Ela está agitada e quer ir embora"},
        headers={"X-Familia": "familia-demo"},
    ).json()
    assert resposta["tipo"] == "geral"
    assert any("Passaporte" in s["origem"] for s in resposta["sugestoes"])
    assert resposta["fontes"][0]["url"].startswith("https://bvsms.saude.gov.br/")
    risco = cliente.post(
        "/apoio", json={"texto": "Ela caiu e bateu a cabeça"}, headers=FAMILIA
    ).json()
    assert risco["tipo"] == "risco" and "avisar_familia" in risco["acoes"]


def test_tarefas_assumir_concluir_e_feed_com_obrigado(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    tarefa = cliente.post(
        "/tarefas",
        json={"titulo": "Cobrir a folga de sábado", "tipo": "cobrir_folga"},
        headers=FAMILIA,
    )
    assert tarefa.status_code == 201
    tid = tarefa.json()["id"]
    assumida = cliente.patch(f"/tarefas/{tid}", json={"assumir": True}, headers=FAMILIA).json()
    assert assumida["responsavel_nome"] == "Alguém da família"
    feita = cliente.patch(f"/tarefas/{tid}", json={"concluida": True}, headers=FAMILIA).json()
    assert feita["concluida"] is True
    feed = cliente.get("/feed", headers=FAMILIA).json()
    tipos = [i["tipo"] for i in feed]
    assert "tarefa_assumida" in tipos and "tarefa_concluida" in tipos
    item = next(i for i in feed if i["tipo"] == "tarefa_concluida")
    cliente.post("/feed/obrigado", json={"ref": item["ref"]}, headers=FAMILIA)
    cliente.post("/feed/obrigado", json={"ref": item["ref"]}, headers=FAMILIA)
    depois = next(
        i for i in cliente.get("/feed", headers=FAMILIA).json() if i["ref"] == item["ref"]
    )
    assert depois["obrigados"] == ["Alguém da família"], "um obrigado por pessoa"
    assert cliente.get("/tarefas", headers={"X-Familia": "outra"}).json() == []
    assert (
        cliente.patch(
            f"/tarefas/{tid}", json={"concluida": True}, headers={"X-Familia": "outra"}
        ).status_code
        == 404
    )
    assert cliente.delete(f"/tarefas/{tid}", headers=FAMILIA).status_code == 204


def test_aviso_fica_no_topo_e_resumo_enviado_aparece_no_feed(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    enviar(cliente)
    cliente.post("/diario/relatos/relato-0001/enviar", headers=FAMILIA)
    cliente.post("/familia/avisos", json={"texto": "Ela caiu, já liguei 192."}, headers=FAMILIA)
    feed = cliente.get("/feed", headers=FAMILIA).json()
    assert feed[0]["tipo"] == "aviso"
    assert any(i["tipo"] == "resumo" for i in feed)


def test_convite_tem_codigo_e_mensagem_para_whatsapp(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    convite = cliente.post("/familia/convites", json={"papel": "familiar"}, headers=FAMILIA).json()
    assert len(convite["codigo"]) == 8 and convite["codigo"][:4] in convite["mensagem"]
    assert (
        cliente.post("/familia/convites", json={"papel": "chefe"}, headers=FAMILIA).status_code
        == 422
    )
    sem_login = cliente.post(
        "/familia/entrar", json={"codigo": convite["codigo"], "nome": "Rafael"}
    )
    assert sem_login.status_code == 401


def test_entrar_com_convite_muda_de_familia(tmp_path):
    from core.repositorio import Repositorio

    repo = Repositorio(tmp_path)
    repo.entrar_na_familia("u1", "familia-a", "Rafael", "quem_cuida")
    repo.criar_convite("familia-b", "ABCD2345", "familiar", "2999-01-01T00:00:00+00:00")
    convite = repo.usar_convite("ABCD2345")
    repo.mudar_de_familia("u1", convite["familia"], "Rafael", convite["papel"])
    assert repo.familia_do_usuario("u1") == {"familia": "familia-b", "papel": "familiar"}
    repo.criar_convite("familia-b", "VENCIDO2", "familiar", "2000-01-01T00:00:00+00:00")
    assert repo.usar_convite("VENCIDO2") is None
