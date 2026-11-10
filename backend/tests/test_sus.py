"""SUS: Cartão SUS e unidades perto da família (sem rede: a API do CNES é simulada)."""

from core import sus


def _unidade(nome, lat, lon, tipo=2, sus_=True, publica=True, h24=False):
    return {
        "cnes": 1,
        "nome": nome,
        "tipo": tipo,
        "endereco": "",
        "telefone": None,
        "lat": lat,
        "lon": lon,
        "sus": sus_,
        "publica": publica,
        "h24": h24,
    }


def test_distancia_e_ordem():
    assert 0.88 < sus.distancia_km(-23.589, -46.634, -23.597, -46.634) < 0.9
    perto = _unidade("UBS perto", -23.590, -46.634)
    longe = _unidade("UBS longe", -23.640, -46.634)
    clinica = _unidade("Clínica particular", -23.589, -46.6341, publica=False, sus_=False)
    lista = sus.mais_proximas(-23.589, -46.634, [longe, clinica, perto], "ubs")
    assert [u["nome"] for u in lista] == ["UBS perto", "UBS longe"], (
        "clínica particular não entra como UBS"
    )


def test_emergencia_prioriza_sus_e_24h():
    particular = _unidade(
        "Hospital particular", -23.589, -46.635, tipo=5, sus_=False, publica=False, h24=True
    )
    upa = _unidade("UPA", -23.595, -46.634, tipo=73, sus_=True, publica=True, h24=True)
    lista = sus.mais_proximas(-23.589, -46.634, [particular, upa], "emergencia")
    assert lista[0]["nome"] == "UPA" and lista[0]["tipo_rotulo"] == "Pronto atendimento (UPA)"
    assert len(lista) == 2, "o particular continua na lista"


def test_municipio_pelo_nome_sem_acento(tmp_path, monkeypatch):
    class Resposta:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"id": 3550308, "nome": "São Paulo"}, {"id": 3509502, "nome": "Campinas"}]

    monkeypatch.setattr(sus.httpx, "get", lambda *a, **k: Resposta())
    assert sus.codigo_municipio("sao paulo", "sp", tmp_path) == 355030
    assert sus.codigo_municipio("Cidade Inventada", "SP", tmp_path) is None
    assert sus.codigo_municipio("São Paulo", "XX", tmp_path) is None


def test_cns():
    assert not sus.cns_valido("123456789012345")
    valido = next(n for n in (f"7{str(i).zfill(14)}" for i in range(10000)) if sus.cns_valido(n))
    assert sus.formatar_cns(valido) == f"{valido[:3]} {valido[3:7]} {valido[7:11]} {valido[11:]}"
