"""Provedor OpenRouter com a rede simulada: formato do pedido, privacidade e erros."""

import json
import shutil
import subprocess

import httpx
import pytest

from core import llm
from core.config import RAIZ_REPO
from core.llm import ErroProvedorIA, ProvedorOpenRouter, preparar_audio
from core.schemas.diario import RegistroDiario
from tests.conftest import REGISTRO_TRANQUILO


class RespostaFalsa:
    def __init__(self, status: int, corpo: dict):
        self.status_code = status
        self._corpo = corpo

    def json(self):
        return self._corpo


@pytest.fixture
def pedidos(monkeypatch):
    enviados: list[dict] = []
    respostas: list[RespostaFalsa] = []

    def post_falso(url, json=None, headers=None, timeout=None):
        enviados.append({"url": url, "json": json, "headers": headers})
        return respostas.pop(0)

    monkeypatch.setattr(httpx, "post", post_falso)
    return enviados, respostas


def ok(texto: str) -> RespostaFalsa:
    return RespostaFalsa(200, {"choices": [{"message": {"content": texto}}]})


def test_transcricao_envia_instrucoes_antes_do_audio_e_exige_privacidade(pedidos):
    enviados, respostas = pedidos
    respostas.append(ok("Hoje a vó caiu."))
    provedor = ProvedorOpenRouter(api_key="chave-de-teste", modelo="modelo/teste")

    texto = provedor.transcrever_audio(b"ID3audio", "audio/mpeg", "Transcreva.")

    assert texto == "Hoje a vó caiu."
    corpo = enviados[0]["json"]
    partes = corpo["messages"][0]["content"]
    assert [p["type"] for p in partes] == ["text", "input_audio"]
    assert partes[1]["input_audio"]["format"] == "mp3"
    assert corpo["provider"]["data_collection"] == "deny"
    assert corpo["model"] == "modelo/teste"


def test_estruturado_valida_e_tolera_bloco_de_codigo(pedidos):
    enviados, respostas = pedidos
    respostas.append(ok("```json\n" + json.dumps(REGISTRO_TRANQUILO) + "\n```"))
    provedor = ProvedorOpenRouter(api_key="chave-de-teste")

    registro = provedor.gerar_estruturado("relato", "sistema", RegistroDiario)

    assert registro.medicacao.tomou == "sim"
    assert enviados[0]["json"]["response_format"]["type"] == "json_schema"


def test_estruturado_invalido_tenta_corrigir_uma_vez(pedidos):
    enviados, respostas = pedidos
    respostas.extend([ok('{"sono": "bom"}'), ok(json.dumps(REGISTRO_TRANQUILO))])
    provedor = ProvedorOpenRouter(api_key="chave-de-teste")

    registro = provedor.gerar_estruturado("relato", "sistema", RegistroDiario)

    assert registro.sono.qualidade == "boa"
    assert len(enviados) == 2
    assert "não passou na validação" in enviados[1]["json"]["messages"][-1]["content"]


def test_erro_do_provedor_vira_erro_claro_sem_vazar_conteudo(pedidos):
    _, respostas = pedidos
    respostas.append(RespostaFalsa(402, {"error": {"message": "Saldo insuficiente"}}))
    provedor = ProvedorOpenRouter(api_key="chave-de-teste")

    with pytest.raises(ErroProvedorIA) as erro:
        provedor.gerar_texto("relato sensível da família", "sistema")

    assert "402" in str(erro.value)
    assert "relato sensível" not in str(erro.value)


def test_sem_chave_avisa_como_configurar(monkeypatch):
    monkeypatch.setattr(
        llm,
        "config",
        lambda: type(
            "C",
            (),
            {
                "openrouter_api_key": None,
                "openrouter_model": "x",
                "openrouter_coleta_dados": "deny",
            },
        )(),
    )
    with pytest.raises(ErroProvedorIA, match="OPENROUTER_API_KEY"):
        ProvedorOpenRouter()


def test_mp3_passa_direto():
    assert preparar_audio(b"abc", "audio/mpeg") == (b"abc", "mp3")


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="precisa do ffmpeg")
def test_m4a_do_celular_vira_mp3_com_audio_de_verdade(tmp_path):
    """Regressão: ler m4a por pipe gerava um mp3 vazio, e o modelo inventava o relato."""
    m4a = tmp_path / "relato.m4a"
    origem = RAIZ_REPO / "poc/exemplos/relato_03_queda.mp3"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(origem), "-c:a", "aac", str(m4a)], check=True
    )

    dados, formato = preparar_audio(m4a.read_bytes(), "audio/mp4")

    assert formato == "mp3"
    assert len(dados) > 50_000


def test_conversao_impossivel_envia_o_original():
    assert preparar_audio(b"nao-e-audio", "audio/mp4") == (b"nao-e-audio", "m4a")
