"""Cadastro sem e-mail real: serviço administrativo simulado, sem tocar dados remotos."""

from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from api.main import app
from core import cadastro


@pytest.fixture
def ambiente(monkeypatch):
    cadastro._tentativas.clear()
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setattr(
        cadastro,
        "config",
        lambda: SimpleNamespace(
            supabase_url="https://teste.invalid", supabase_secret_key="segredo-ficticio"
        ),
    )
    chamadas = []
    status = {"valor": 200, "corpo": {"id": "usuario-ficticio"}}

    def enviar(url, **kwargs):
        chamadas.append((url, kwargs))
        return httpx.Response(status["valor"], json=status["corpo"])

    monkeypatch.setattr(cadastro.httpx, "post", enviar)
    yield TestClient(app), chamadas, status
    cadastro._tentativas.clear()


def dados(**mudancas):
    return {
        "nome": "  Cláudia  Silva ",
        "email": "  CLAUDIA@EXAMPLE.COM ",
        "senha": "Segredo123",
        "aceite_termos": True,
        "versao_termos": "1",
        **mudancas,
    }


def test_cadastro_sem_confirmacao_com_aceite_no_servidor(ambiente):
    cliente, chamadas, _ = ambiente
    resposta = cliente.post("/auth/cadastro", json=dados())
    assert resposta.status_code == 201 and resposta.json() == {"criado": True}
    payload = chamadas[0][1]["json"]
    assert payload["email"] == "claudia@example.com"
    assert payload["user_metadata"]["nome"] == "Cláudia Silva"
    assert payload["email_confirm"] is True
    assert payload["app_metadata"]["aceite_termos"]["versao"] == "1"
    assert payload["app_metadata"]["aceite_termos"]["aceito_em"]
    assert "Segredo123" not in resposta.text and "segredo-ficticio" not in resposta.text


@pytest.mark.parametrize(
    "mudancas",
    [
        {"nome": " "},
        {"email": "invalido"},
        {"senha": "curta1"},
        {"senha": "apenasletras"},
        {"senha": "123456789"},
        {"aceite_termos": False},
        {"versao_termos": "antiga"},
    ],
)
def test_valida_campos_e_nunca_devolve_a_senha(ambiente, mudancas):
    cliente, chamadas, _ = ambiente
    resposta = cliente.post("/auth/cadastro", json=dados(**mudancas))
    assert resposta.status_code == 422
    assert not chamadas
    assert dados(**mudancas)["senha"] not in resposta.text


def test_email_duplicado_nao_atualiza_nem_confirma_conta_existente(ambiente):
    cliente, chamadas, status = ambiente
    status.update(valor=422, corpo={"code": "email_exists"})
    resposta = cliente.post("/auth/cadastro", json=dados())
    assert resposta.status_code == 409
    assert "Quer entrar" in resposta.json()["detail"]
    assert len(chamadas) == 1 and chamadas[0][0].endswith("/admin/users")


def test_limite_de_tentativas_por_email(ambiente):
    cliente, chamadas, _ = ambiente
    for _ in range(5):
        assert cliente.post("/auth/cadastro", json=dados()).status_code == 201
    assert cliente.post("/auth/cadastro", json=dados()).status_code == 429
    assert len(chamadas) == 5


def test_falha_no_provedor_nao_expoe_resposta(ambiente):
    cliente, _, status = ambiente
    status.update(valor=500, corpo={"msg": "segredo-do-provedor"})
    resposta = cliente.post("/auth/cadastro", json=dados())
    assert resposta.status_code == 503
    assert "segredo-do-provedor" not in resposta.text
