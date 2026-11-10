"""SUS: Cartão Nacional de Saúde (CNS) e os serviços públicos que a família pode usar.

Não lemos nem gravamos nada nos sistemas do SUS (isso exige credenciamento na RNDS). O que o
SempreAqui faz é guardar o número do cartão e a UBS de referência no Passaporte, levar isso para
o PDF da consulta e apontar para os serviços oficiais, com links conferidos.
"""

from __future__ import annotations

import json
import math
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

MEU_SUS_DIGITAL = "https://meususdigital.saude.gov.br"


def so_digitos(texto: str) -> str:
    return re.sub(r"\D", "", texto or "")


def cns_valido(numero: str) -> bool:
    """Confere o número do Cartão Nacional de Saúde pelo dígito verificador oficial.

    15 dígitos, começando com 1 ou 2 (definitivo) ou 7, 8 ou 9 (provisório). A soma de cada
    dígito multiplicado pelo peso (15 para o primeiro, 14 para o segundo... 1 para o último)
    precisa ser múltipla de 11.
    """
    cns = so_digitos(numero)
    if len(cns) != 15 or cns[0] not in "12789":
        return False
    return sum(int(d) * (15 - i) for i, d in enumerate(cns)) % 11 == 0


def formatar_cns(numero: str) -> str:
    """ "898001160660000" vira "898 0011 6066 0000", como no cartão."""
    cns = so_digitos(numero)
    return f"{cns[:3]} {cns[3:7]} {cns[7:11]} {cns[11:]}" if len(cns) == 15 else numero


# Unidades de saúde perto da família ---------------------------------------
#
# Dados abertos do CNES (Cadastro Nacional de Estabelecimentos de Saúde), do Ministério da Saúde:
# nome, endereço, telefone, coordenadas, se atende pelo SUS e se funciona 24 horas. Sem cadastro.
# A API devolve 20 por página; guardamos a lista por cidade e tipo por 7 dias em DADOS_DIR/cnes.


CNES_API = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
IBGE_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios"
VALIDADE_CACHE_S = 7 * 24 * 3600
POR_PAGINA = 20
MAX_PAGINAS = 80

# Grupo pedido pelo app -> tipos de unidade do CNES e o nome em palavras de gente.
GRUPOS: dict[str, dict[int, str]] = {
    "emergencia": {
        73: "Pronto atendimento (UPA)",
        20: "Pronto-socorro",
        5: "Hospital",
        15: "Unidade mista",
    },
    "ubs": {2: "UBS", 1: "Posto de saúde"},
    "caps": {70: "CAPS"},
}
UFS = {
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
}


def _chave(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in sem_acento if not unicodedata.combining(c)).lower().strip()


def _cache(pasta: Path, nome: str):
    arquivo = pasta / f"{nome}.json"
    if arquivo.exists() and time.time() - arquivo.stat().st_mtime < VALIDADE_CACHE_S:
        return json.loads(arquivo.read_text(encoding="utf-8"))
    return None


def _guardar(pasta: Path, nome: str, dados) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / f"{nome}.json").write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")


def codigo_municipio(cidade: str, uf: str, pasta: Path) -> int | None:
    """Código do município no CNES (6 dígitos do código IBGE) a partir do nome e da UF."""
    uf = uf.strip().upper()
    if uf not in UFS:
        return None
    municipios = _cache(pasta, f"municipios-{uf}")
    if municipios is None:
        resposta = httpx.get(IBGE_MUNICIPIOS.format(uf=uf), timeout=20)
        resposta.raise_for_status()
        municipios = {_chave(m["nome"]): m["id"] for m in resposta.json()}
        _guardar(pasta, f"municipios-{uf}", municipios)
    codigo = municipios.get(_chave(cidade))
    return int(str(codigo)[:6]) if codigo else None


def _pagina(municipio: int, tipo: int, offset: int) -> list[dict]:
    resposta = httpx.get(
        CNES_API,
        params={
            "codigo_municipio": municipio,
            "codigo_tipo_unidade": tipo,
            "limit": POR_PAGINA,
            "offset": offset,
        },
        timeout=30,
    )
    resposta.raise_for_status()
    return resposta.json().get("estabelecimentos", [])


def unidades_do_municipio(municipio: int, tipo: int, pasta: Path) -> list[dict]:
    """Todas as unidades de um tipo no município, só com os campos que o app usa."""
    nome = f"cnes-v2-{municipio}-{tipo}"
    salvas = _cache(pasta, nome)
    if salvas is not None:
        return salvas
    brutas: list[dict] = []
    offset = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        while offset < POR_PAGINA * MAX_PAGINAS:
            lote = list(
                pool.map(
                    lambda o: _pagina(municipio, tipo, o),
                    range(offset, offset + 6 * POR_PAGINA, POR_PAGINA),
                )
            )
            for pagina in lote:
                brutas.extend(pagina)
            if any(len(p) < POR_PAGINA for p in lote):
                break
            offset += 6 * POR_PAGINA
    unidades = []
    for e in brutas:
        lat, lon = (
            e.get("latitude_estabelecimento_decimo_grau"),
            e.get("longitude_estabelecimento_decimo_grau"),
        )
        if lat is None or lon is None or e.get("codigo_motivo_desabilitacao_estabelecimento"):
            continue
        endereco = ", ".join(
            x
            for x in [
                e.get("endereco_estabelecimento"),
                e.get("numero_estabelecimento"),
                e.get("bairro_estabelecimento"),
            ]
            if x
        )
        unidades.append(
            {
                "cnes": e["codigo_cnes"],
                "nome": (e.get("nome_fantasia") or e.get("nome_razao_social") or "").title(),
                "tipo": tipo,
                "endereco": endereco.title(),
                "telefone": e.get("numero_telefone_estabelecimento"),
                "lat": lat,
                "lon": lon,
                "sus": e.get("estabelecimento_faz_atendimento_ambulatorial_sus") == "SIM",
                # Natureza jurídica 1xxx = administração pública (UBS, UPA, hospital público).
                "publica": str(
                    e.get("descricao_natureza_juridica_estabelecimento") or ""
                ).startswith("1"),
                "h24": "24 HORAS" in (e.get("descricao_turno_atendimento") or ""),
            }
        )
    _guardar(pasta, nome, unidades)
    return unidades


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def mais_proximas(
    lat: float, lon: float, unidades: list[dict], grupo: str, quantas: int = 12
) -> list[dict]:
    rotulos = GRUPOS[grupo]
    if grupo == "ubs":
        # Só UBS públicas que atendem pelo SUS: clínicas e unidades militares às vezes usam o mesmo tipo.
        unidades = [u for u in unidades if u.get("publica") and u.get("sus")]
    elif grupo == "caps":
        unidades = [u for u in unidades if u.get("publica")]
    com_distancia = [
        {
            **u,
            "tipo_rotulo": rotulos.get(u["tipo"], ""),
            "distancia_km": round(distancia_km(lat, lon, u["lat"], u["lon"]), 1),
        }
        for u in unidades
    ]

    # Em emergência, quando a distância é parecida, vem antes o que é do SUS (não cobra) e o que
    # funciona 24 horas. Hospitais particulares continuam na lista, sem o selo do SUS.
    def peso(u: dict) -> float:
        if grupo != "emergencia":
            return u["distancia_km"]
        return (
            u["distancia_km"] - (1.5 if u["sus"] or u["publica"] else 0) - (0.8 if u["h24"] else 0)
        )

    return sorted(com_distancia, key=peso)[:quantas]
