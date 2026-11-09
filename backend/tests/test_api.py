from fastapi.testclient import TestClient

from api.main import app, obter_provedor


def test_saude():
    assert TestClient(app).get("/saude").json() == {"status": "ok"}


def test_relato_por_audio(provedor_tranquilo):
    app.dependency_overrides[obter_provedor] = lambda: provedor_tranquilo
    try:
        resposta = TestClient(app).post(
            "/diario/relatos", files={"audio": ("relato.mp3", b"falso", "audio/mpeg")}
        )
    finally:
        app.dependency_overrides.clear()
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["registro"]["sono"]["qualidade"] == "boa"
    assert corpo["resumo_familia"]


def test_rejeita_formato_invalido(provedor_tranquilo):
    app.dependency_overrides[obter_provedor] = lambda: provedor_tranquilo
    try:
        resposta = TestClient(app).post(
            "/diario/relatos", files={"audio": ("x.txt", b"oi", "text/plain")}
        )
    finally:
        app.dependency_overrides.clear()
    assert resposta.status_code == 415
