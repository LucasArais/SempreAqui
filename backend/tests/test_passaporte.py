"""Passaporte: fotos, link somente leitura e organização de memórias por IA."""

from core.llm import ProvedorFalso
from demo.passaporte import PASSAPORTE_DEMO
from tests.test_api import FAMILIA, ambiente  # noqa: F401 - fixture

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def test_foto_enviada_so_aparece_para_a_propria_familia(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    resposta = cliente.post(
        "/passaporte/fotos", files={"foto": ("f.jpg", JPEG, "image/jpeg")}, headers=FAMILIA
    )
    assert resposta.status_code == 201
    chave = resposta.json()["chave"]
    assert cliente.get(f"/passaporte/fotos/{chave}", headers=FAMILIA).content == JPEG
    assert (
        cliente.get(f"/passaporte/fotos/{chave}", headers={"X-Familia": "outra"}).status_code == 404
    )
    falsa = cliente.post(
        "/passaporte/fotos", files={"foto": ("f.jpg", b"<html>", "image/jpeg")}, headers=FAMILIA
    )
    assert falsa.status_code == 415
    assert cliente.get("/passaporte/fotos/..%2F..%2Fsegredo", headers=FAMILIA).status_code == 404


def test_link_somente_leitura_mostra_o_passaporte_e_pode_ser_desligado(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    cliente.put("/passaporte", json=PASSAPORTE_DEMO, headers=FAMILIA)
    assert cliente.get("/passaporte/link", headers=FAMILIA).json()["ativo"] is False
    url = cliente.post("/passaporte/link", headers=FAMILIA).json()["url"]
    caminho = "/p/" + url.rsplit("/p/", 1)[1]
    pagina = cliente.get(caminho)
    assert pagina.status_code == 200
    assert "Dona Isabel" in pagina.text and "Roberto Carlos" in pagina.text
    assert pagina.headers["cache-control"] == "no-store"
    assert "noindex" in pagina.headers["x-robots-tag"]
    assert cliente.get(f"{caminho}/fotos/atelie").status_code == 200
    assert cliente.get(f"{caminho}/fotos/cuidador").status_code == 404, "foto fora do passaporte"
    cliente.delete("/passaporte/link", headers=FAMILIA)
    assert cliente.get(caminho).status_code == 404
    assert cliente.get("/p/token-que-nao-existe-de-jeito-nenhum").status_code == 404


def test_pagina_publica_escapa_o_texto_da_familia(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    cliente.put(
        "/passaporte",
        json={**PASSAPORTE_DEMO, "quem_ela": "<script>alert(1)</script>"},
        headers=FAMILIA,
    )
    url = cliente.post("/passaporte/link", headers=FAMILIA).json()["url"]
    pagina = cliente.get("/p/" + url.rsplit("/p/", 1)[1]).text
    assert "<script>" not in pagina and "&lt;script&gt;" in pagina


def test_organizar_sugere_e_filtra_linguagem(ambiente):  # noqa: F811
    cliente, _repo, _provedor, estado = ambiente
    estado["fabrica"] = lambda: ProvedorFalso(
        estruturado={
            "quem_ela": "Uma paciente tranquila.",
            "acalma": [{"titulo": "Café passado na hora"}],
            "musicas": [{"titulo": "Asa Branca", "artista": "Luiz Gonzaga"}],
            "pessoas_importantes": [{"nome": "A irmã", "relacao": "virou um peso"}],
        }
    )
    resposta = cliente.post(
        "/passaporte/organizar",
        data={"texto": "Ela gosta de café e de Asa Branca."},
        headers=FAMILIA,
    )
    assert resposta.status_code == 200
    sugestao = resposta.json()
    assert sugestao["quem_ela"] is None
    assert sugestao["acalma"][0]["titulo"] == "Café passado na hora"
    assert sugestao["pessoas_importantes"] == []
    assert cliente.get("/passaporte", headers=FAMILIA).json()["acalma"] == [], (
        "organizar não salva nada"
    )
    assert (
        cliente.post("/passaporte/organizar", data={"texto": " "}, headers=FAMILIA).status_code
        == 422
    )


def test_criar_link_na_demo_nao_apaga_o_passaporte_da_dona_isabel(ambiente):  # noqa: F811
    cliente, *_ = ambiente
    demo = {"X-Familia": "familia-demo"}
    cliente.post("/passaporte/link", headers=demo)
    passaporte = cliente.get("/passaporte", headers=demo).json()
    assert passaporte["como_gosta_de_ser_chamada"] == "Dona Isabel"
    assert len(passaporte["lembrancas"]) == 5
