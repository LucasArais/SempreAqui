"""Semana: linha de base, mudanças de padrão, lista da consulta, resumo e PDF."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from agents.semana import resumir_semana
from api.main import app, obter_fabrica_provedor, obter_repositorio
from core import guardrails
from core.repositorio import Repositorio
from core.schemas.diario import RegistroDiario
from core.semana import montar_semana

FUSO = "America/Sao_Paulo"
FIM = date(2026, 11, 9)  # segunda-feira


def relato(
    dias_atras: int, sono="boa", horas=7, acordou=1, remedio="sim", comida="boa", episodios=()
):
    quando = datetime.combine(FIM - timedelta(days=dias_atras), time(21), ZoneInfo(FUSO))
    registro = RegistroDiario.model_validate(
        {
            "sono": {
                "qualidade": sono,
                "horas_aproximadas": horas,
                "despertares_noturnos": acordou,
            },
            "alimentacao": {"qualidade": comida, "hidratacao": "boa"},
            "humor": {"predominante": "calmo"},
            "agitacao": {"nivel": "nenhuma"},
            "episodios": list(episodios),
            "medicacao": {"tomou": remedio},
            "quem_cuida": {"cansaco": "algum"},
        }
    ).model_dump()
    return {
        "id": f"r{dias_atras}",
        "etapa": "pronto",
        "gravado_em": quando.isoformat(),
        "registro": registro,
        "alertas": [],
    }


def semana_dificil():
    base = [relato(d) for d in range(7, 28)]  # três semanas de noites boas
    semana = [
        relato(0),
        relato(1, episodios=[{"tipo": "queda", "descricao": "Escorregou no banheiro"}]),
        relato(2, sono="ruim", horas=4, acordou=4, remedio="parcial"),
        relato(3, sono="ruim", horas=5, acordou=3),
        relato(4, sono="ruim", horas=4.5, acordou=4, remedio="parcial"),
    ]
    return base + semana


def test_detecta_mudancas_em_relacao_ao_habitual():
    fatos = montar_semana(semana_dificil(), FIM, FUSO, quem_cuida="A Cláudia")
    textos = [m["texto"] for m in fatos["mudancas"]]
    assert fatos["mudancas"][0]["tipo"] == "risco"
    assert any("Noites ruins 3 dias seguidos" in t for t in textos)
    assert any("Acordou mais vezes à noite" in t and "o habitual é 1 vez" in t for t in textos)
    assert any("Não tomou todos os remédios em 2 dias" in t for t in textos)
    assert fatos["habitual_sono_horas"] == 7


def test_semana_tranquila_nao_gera_alarme():
    fatos = montar_semana([relato(d) for d in range(0, 28)], FIM, FUSO)
    assert fatos["mudancas"] == []
    assert "Nenhuma queda ou situação de risco registrada" in fatos["para_consulta"]


def test_textos_sem_interpretacao_clinica():
    fatos = montar_semana(semana_dificil(), FIM, FUSO)
    for texto in [m["texto"] for m in fatos["mudancas"]] + fatos["para_consulta"]:
        assert guardrails.verificar_texto_familia(texto) == [], texto


def test_resumo_seguro_sem_ia_menciona_192_quando_ha_risco():
    resumo, seguro = resumir_semana(None, montar_semana(semana_dificil(), FIM, FUSO))
    assert seguro and "192" in resumo


def test_api_semana_e_pdf(tmp_path):
    repo = Repositorio(tmp_path)
    for r in semana_dificil():
        repo.criar_relato(
            "familia-teste", f"relato-{r['id']}", None, "audio/mp4", 30, r["gravado_em"]
        )
        repo.salvar_resultado(
            f"relato-{r['id']}", "texto", r["registro"], [], "resumo", False, "v2", "teste"
        )
    app.dependency_overrides[obter_repositorio] = lambda: repo
    app.dependency_overrides[obter_fabrica_provedor] = lambda: lambda: None
    try:
        cliente = TestClient(app)
        cabecalho = {"X-Familia": "familia-teste"}
        semana = cliente.get(f"/semana?fim={FIM.isoformat()}", headers=cabecalho).json()
        assert semana["periodo"] == "3 a 9 de novembro" and semana["dias_com_relato"] == 5
        pdf = cliente.get(
            f"/semana/consulta.pdf?fim={FIM.isoformat()}&nome=Dona Isabel", headers=cabecalho
        )
        assert pdf.headers["content-type"] == "application/pdf" and pdf.content.startswith(b"%PDF")
    finally:
        app.dependency_overrides.clear()
