"""API do Diário de ponta a ponta, com provedor falso e repositório temporário."""

import pytest
from fastapi.testclient import TestClient

from api.main import app, obter_fabrica_naomi, obter_fabrica_provedor, obter_repositorio
from core.llm import ErroProvedorIA, ProvedorFalso
from core.repositorio import Repositorio
from tests.conftest import REGISTRO_QUEDA, REGISTRO_TRANQUILO

FAMILIA = {"X-Familia": "familia-teste"}
OUTRA = {"X-Familia": "outra-familia"}


class ProvedorEspiao(ProvedorFalso):
    """Provedor falso que guarda os prompts recebidos e nunca fica sem textos."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.prompts: list[str] = []

    def gerar_estruturado(self, prompt, sistema, modelo):
        self.prompts.append(prompt)
        return super().gerar_estruturado(prompt, sistema, modelo)

    def gerar_texto(self, prompt, sistema):
        self.chamadas.append("gerar_texto")
        return self.textos[0] if self.textos else "Resumo do dia."


@pytest.fixture
def ambiente(tmp_path):
    repo = Repositorio(tmp_path)
    provedor = ProvedorEspiao(
        transcricao="Hoje foi um dia bom. A mãe dormiu bem.",
        estruturado=REGISTRO_TRANQUILO,
        textos=["A Dona Isabel teve um dia bom e dormiu bem."],
    )
    estado = {"fabrica": lambda: provedor}
    app.dependency_overrides[obter_repositorio] = lambda: repo
    app.dependency_overrides[obter_fabrica_provedor] = lambda: lambda: estado["fabrica"]()
    app.dependency_overrides[obter_fabrica_naomi] = lambda: lambda: estado["fabrica"]()
    yield TestClient(app), repo, provedor, estado
    app.dependency_overrides.clear()


def enviar(cliente, relato_id="relato-0001", cabecalhos=FAMILIA, **extra):
    dados = {"id": relato_id, "duracao_s": "42", **extra}
    return cliente.post(
        "/diario/relatos",
        files={"audio": ("dia.m4a", b"audio-falso", "audio/mp4")},
        data=dados,
        headers=cabecalhos,
    )


def test_saude(ambiente):
    cliente, *_ = ambiente
    assert cliente.get("/saude").json() == {"status": "ok"}


def test_campos_editaveis_vem_do_schema(ambiente):
    cliente, *_ = ambiente
    campos = {c["campo"]: c for c in cliente.get("/diario/campos").json()}
    assert campos["sono.qualidade"]["opcoes"] == ["boa", "regular", "ruim", "nao_informado"]
    assert campos["sono.horas_aproximadas"]["opcoes"] is None


def test_envio_processa_e_fica_pronto(ambiente):
    cliente, repo, *_ = ambiente
    resposta = enviar(cliente)
    assert resposta.status_code == 202

    relato = cliente.get("/diario/relatos/relato-0001", headers=FAMILIA).json()
    assert relato["etapa"] == "pronto"
    assert relato["registro"]["sono"]["qualidade"] == "boa"
    assert relato["resumo"].startswith("A Dona Isabel")
    assert relato["tem_audio"] is True
    assert repo.metricas()["diarios_por_semana"][0]["diarios"] == 1


def test_progresso_passa_pelas_etapas(ambiente, monkeypatch):
    cliente, repo, *_ = ambiente
    etapas = []
    original = repo.atualizar_etapa
    monkeypatch.setattr(
        repo, "atualizar_etapa", lambda i, e, erro=None: (etapas.append(e), original(i, e, erro))
    )
    enviar(cliente)
    assert etapas == ["transcrevendo", "organizando", "resumindo"]


def test_reenvio_da_fila_offline_nao_duplica(ambiente):
    cliente, *_ = ambiente
    enviar(cliente, enviado_offline="true")
    enviar(cliente, enviado_offline="true")
    assert len(cliente.get("/diario/relatos", headers=FAMILIA).json()) == 1


def test_outra_familia_nao_ve_o_relato(ambiente):
    cliente, *_ = ambiente
    enviar(cliente)
    assert cliente.get("/diario/relatos/relato-0001", headers=OUTRA).status_code == 404
    assert cliente.get("/diario/relatos", headers=OUTRA).json() == []
    assert cliente.get("/diario/relatos/relato-0001/audio", headers=OUTRA).status_code == 404


def test_formato_invalido_tem_mensagem_humana(ambiente):
    cliente, *_ = ambiente
    resposta = cliente.post(
        "/diario/relatos",
        files={"audio": ("x.txt", b"oi", "text/plain")},
        data={"id": "relato-0002"},
        headers=FAMILIA,
    )
    assert resposta.status_code == 415
    assert "Tente gravar de novo" in resposta.json()["detail"]


def test_tipo_generico_usa_a_extensao(ambiente):
    cliente, *_ = ambiente
    resposta = cliente.post(
        "/diario/relatos",
        files={"audio": ("relato.m4a", b"audio", "application/octet-stream")},
        data={"id": "relato-0003"},
        headers=FAMILIA,
    )
    assert resposta.status_code == 202


def test_sem_login_e_recusado(ambiente):
    cliente, *_ = ambiente
    assert enviar(cliente, cabecalhos={}).status_code == 401


def test_token_invalido_e_recusado(ambiente):
    cliente, *_ = ambiente
    assert enviar(cliente, cabecalhos={"Authorization": "Bearer nao-e-um-token"}).status_code == 401


def test_sessao_coloca_usuario_numa_familia(ambiente, monkeypatch):
    cliente, repo, *_ = ambiente
    monkeypatch.setattr("api.main.usuario_do_token", lambda token: "usuario-anonimo-1")
    login = {"Authorization": "Bearer token-falso"}
    sessao = cliente.post("/sessao", json={"nome_exibicao": "Cláudia"}, headers=login).json()
    assert sessao["papel"] == "quem_cuida" and sessao["familia"].startswith("familia-")
    # A família vem do login, não do cliente: X-Familia de outra família é ignorado.
    enviar(cliente, cabecalhos={**login, "X-Familia": "outra-familia"})
    assert len(cliente.get("/diario/relatos", headers=login).json()) == 1
    assert cliente.get("/diario/relatos", headers=OUTRA).json() == []
    resposta = cliente.post(
        "/consentimentos",
        json={"versao_termo": "1", "finalidades": ["dados_de_saude_diario", "audio_e_fotos"]},
        headers=login,
    )
    assert resposta.status_code == 204


def test_ia_fora_do_ar_guarda_audio_e_permite_tentar_de_novo(ambiente):
    cliente, _, provedor, estado = ambiente

    def sem_ia():
        raise ErroProvedorIA("sem saldo")

    estado["fabrica"] = sem_ia
    enviar(cliente)
    relato = cliente.get("/diario/relatos/relato-0001", headers=FAMILIA).json()
    assert relato["etapa"] == "erro"
    assert "Seu áudio está guardado" in relato["erro"]
    assert relato["tem_audio"] is True

    estado["fabrica"] = lambda: provedor
    cliente.post("/diario/relatos/relato-0001/tentar-de-novo", headers=FAMILIA)
    assert cliente.get("/diario/relatos/relato-0001", headers=FAMILIA).json()["etapa"] == "pronto"


def test_correcao_refaz_resumo_e_pode_ser_desfeita(ambiente):
    cliente, _, provedor, _ = ambiente
    enviar(cliente)
    provedor.textos = ["A Dona Isabel dormiu de forma irregular."]

    resposta = cliente.patch(
        "/diario/relatos/relato-0001/campos",
        json={"campo": "sono.qualidade", "valor": "regular"},
        headers=FAMILIA,
    ).json()
    assert resposta["relato"]["registro"]["sono"]["qualidade"] == "regular"
    assert resposta["relato"]["resumo"] == "A Dona Isabel dormiu de forma irregular."
    assert resposta["relato"]["corrigidos"] == ["sono.qualidade"]

    desfeito = cliente.delete(
        f"/diario/relatos/relato-0001/correcoes/{resposta['correcao_id']}", headers=FAMILIA
    ).json()
    assert desfeito["registro"]["sono"]["qualidade"] == "boa"
    assert desfeito["resumo"].startswith("A Dona Isabel teve um dia bom")
    assert desfeito["corrigidos"] == []


def test_correcao_sem_ia_usa_resumo_seguro(ambiente):
    cliente, _, _, estado = ambiente
    enviar(cliente)

    def sem_ia():
        raise ErroProvedorIA("fora do ar")

    estado["fabrica"] = sem_ia
    resposta = cliente.patch(
        "/diario/relatos/relato-0001/campos",
        json={"campo": "medicacao.tomou", "valor": "parcial"},
        headers=FAMILIA,
    )
    assert resposta.status_code == 200
    assert "remédios tomados: parcial" in resposta.json()["relato"]["resumo"]


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("sono.qualidade", "maravilhosa"), ("sinais_de_alerta", []), ("sono.horas_aproximadas", 30)],
)
def test_correcao_invalida_e_recusada(ambiente, campo, valor):
    cliente, *_ = ambiente
    enviar(cliente)
    resposta = cliente.patch(
        "/diario/relatos/relato-0001/campos", json={"campo": campo, "valor": valor}, headers=FAMILIA
    )
    assert resposta.status_code == 422


def test_correcoes_entram_no_proximo_relato(ambiente):
    cliente, _, provedor, _ = ambiente
    enviar(cliente)
    cliente.patch(
        "/diario/relatos/relato-0001/campos",
        json={"campo": "sono.qualidade", "valor": "ruim"},
        headers=FAMILIA,
    )
    enviar(cliente, relato_id="relato-0002")
    ultimo_prompt = provedor.prompts[-1]
    assert (
        'Campo "sono.qualidade": a IA marcou "boa", a família corrigiu para "ruim"' in ultimo_prompt
    )


def test_audio_pode_ser_ouvido_e_apagado(ambiente):
    cliente, *_ = ambiente
    enviar(cliente)
    assert (
        cliente.get("/diario/relatos/relato-0001/audio", headers=FAMILIA).content == b"audio-falso"
    )
    assert cliente.delete("/diario/relatos/relato-0001", headers=FAMILIA).status_code == 204
    assert cliente.get("/diario/relatos/relato-0001", headers=FAMILIA).status_code == 404


def test_alerta_de_risco_chega_ao_app(ambiente):
    cliente, _, provedor, _ = ambiente
    provedor.estruturado = REGISTRO_QUEDA
    provedor.textos = ["A Dona Isabel caiu e bateu a cabeça. Se houver risco agora, ligue 192."]
    enviar(cliente)
    relato = cliente.get("/diario/relatos/relato-0001", headers=FAMILIA).json()
    assert relato["alertas"]
    assert "192" in relato["resumo"]


def test_exportar_e_apagar_tudo(ambiente):
    import io
    import json
    import zipfile

    cliente, *_ = ambiente
    enviar(cliente)
    cliente.patch(
        "/diario/relatos/relato-0001/campos",
        json={"campo": "sono.qualidade", "valor": "ruim"},
        headers=FAMILIA,
    )
    arquivo = zipfile.ZipFile(io.BytesIO(cliente.get("/familia/exportar", headers=FAMILIA).content))
    dados = json.loads(arquivo.read("dados.json"))
    assert dados["relatos"][0]["id"] == "relato-0001" and len(dados["correcoes"]) == 1
    assert arquivo.read("audios/relato-0001.m4a") == b"audio-falso"

    assert (
        cliente.request(
            "DELETE", "/familia", json={"confirmar": "sim"}, headers=FAMILIA
        ).status_code
        == 422
    )
    assert (
        cliente.request(
            "DELETE", "/familia", json={"confirmar": "APAGAR"}, headers=FAMILIA
        ).status_code
        == 204
    )
    assert cliente.get("/diario/relatos", headers=FAMILIA).json() == []


def test_metricas_sao_anonimas_e_calculam_taxa_de_correcao(ambiente):
    cliente, *_ = ambiente
    enviar(cliente, segundos_desde_instalacao="95")
    enviar(cliente, relato_id="relato-0002")
    cliente.patch(
        "/diario/relatos/relato-0001/campos",
        json={"campo": "humor.predominante", "valor": "ansioso"},
        headers=FAMILIA,
    )
    assert cliente.post("/eventos", json={"tipo": "qualquer"}, headers=FAMILIA).status_code == 422
    cliente.post("/eventos", json={"tipo": "sessao_concluida", "rotulo": "sorriu"}, headers=FAMILIA)

    painel = cliente.get("/metricas").json()
    assert painel["taxa_de_correcao"] == 0.5
    assert painel["correcoes_por_campo"] == [{"campo": "humor.predominante", "correcoes": 1}]
    assert painel["segundos_ate_primeiro_diario_mediana"] == 95
    assert painel["sessoes_reminiscencia"] == [{"reacao": "sorriu", "sessoes": 1}]
    texto = str(painel)
    assert "familia-teste" not in texto and "dormiu" not in texto


# IA no próprio celular -----------------------------------------------------


def enviar_do_aparelho(cliente, relato_id="relato-aparelho-1", **extra):
    corpo = {
        "id": relato_id,
        "duracao_s": 30,
        "transcricao": "Hoje foi um dia bom. A mãe dormiu bem.",
        "registro": REGISTRO_TRANQUILO,
        "resumo": "A Dona Isabel teve um dia bom e dormiu bem.",
        **extra,
    }
    return cliente.post("/diario/relatos/do-aparelho", json=corpo, headers=FAMILIA)


def test_relato_do_aparelho_fica_pronto_sem_audio_e_sem_nuvem(ambiente):
    cliente, _repo, provedor, _ = ambiente
    resposta = enviar_do_aparelho(cliente)
    assert resposta.status_code == 201
    relato = resposta.json()
    assert relato["etapa"] == "pronto"
    assert relato["no_aparelho"] is True
    assert relato["tem_audio"] is False
    assert relato["resumo"].startswith("A Dona Isabel")
    assert provedor.chamadas == []
    # Reenvio da fila não duplica.
    assert enviar_do_aparelho(cliente).status_code == 201
    assert len(cliente.get("/diario/relatos", headers=FAMILIA).json()) == 1


def test_relato_do_aparelho_passa_pelos_guardrails_do_servidor(ambiente):
    cliente, *_ = ambiente
    relato = enviar_do_aparelho(
        cliente,
        transcricao="Ela caiu no banheiro de manhã.",
        resumo="O paciente teve um dia tranquilo.",
    ).json()
    assert relato["alertas"], "palavra de queda no relato sempre vira alerta"
    assert relato["resumo_seguro"] is True
    assert "paciente" not in relato["resumo"].lower()
    assert "192" in relato["resumo"]


def test_correcao_de_relato_do_aparelho_nao_usa_a_nuvem(ambiente):
    cliente, _repo, provedor, _ = ambiente
    enviar_do_aparelho(cliente)
    resposta = cliente.patch(
        "/diario/relatos/relato-aparelho-1/campos",
        json={"campo": "sono.qualidade", "valor": "ruim"},
        headers=FAMILIA,
    )
    assert resposta.status_code == 200
    assert provedor.chamadas == []
    novo = cliente.put(
        "/diario/relatos/relato-aparelho-1/resumo",
        json={"resumo": "A noite foi difícil, mas o dia foi calmo."},
        headers=FAMILIA,
    ).json()
    assert novo["resumo"] == "A noite foi difícil, mas o dia foi calmo."
    texto = cliente.get("/diario/correcoes", headers=FAMILIA).json()["texto"]
    assert "sono.qualidade" in texto


def test_resumo_do_aparelho_so_para_relatos_do_aparelho(ambiente):
    cliente, *_ = ambiente
    enviar(cliente)
    resposta = cliente.put(
        "/diario/relatos/relato-0001/resumo", json={"resumo": "Outro texto."}, headers=FAMILIA
    )
    assert resposta.status_code == 409


def test_alerta_negado_pelo_modelo_nao_vira_alerta():
    from agents.diario import alertas_do_relato
    from core.schemas.diario import RegistroDiario

    registro = RegistroDiario.model_validate(
        {**REGISTRO_TRANQUILO, "sinais_de_alerta": ["Não há sinais de alerta"]}
    )
    assert alertas_do_relato(registro, "Hoje foi um dia bom.") == []
    queda = RegistroDiario.model_validate(
        {**REGISTRO_TRANQUILO, "sinais_de_alerta": ["Queda no banheiro"]}
    )
    assert alertas_do_relato(queda, "Ela caiu.") == ["Queda no banheiro"]
