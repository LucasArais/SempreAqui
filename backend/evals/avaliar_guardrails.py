"""Avaliação dos guardrails determinísticos. Roda sem chave de API.

Uso (a partir de backend/):  uv run python -m evals.avaliar_guardrails
"""

from __future__ import annotations

import json
from datetime import datetime

import yaml

from core import guardrails
from core.config import RAIZ_BACKEND
from evals.metricas import precisao_revocacao

CASOS = RAIZ_BACKEND / "evals" / "guardrails" / "casos.yaml"
RESULTADOS = RAIZ_BACKEND / "evals" / "resultados"


def _matriz(pares: list[tuple[bool, bool]]) -> dict:
    vp = sum(1 for esp, obt in pares if esp and obt)
    fp = sum(1 for esp, obt in pares if not esp and obt)
    fn = sum(1 for esp, obt in pares if esp and not obt)
    vn = sum(1 for esp, obt in pares if not esp and not obt)
    precisao, revocacao = precisao_revocacao(vp, fp, fn)
    return {
        "n": len(pares),
        "verdadeiros_positivos": vp,
        "falsos_positivos": fp,
        "falsos_negativos": fn,
        "verdadeiros_negativos": vn,
        "precisao": round(precisao, 3),
        "revocacao": round(revocacao, 3),
    }


def avaliar() -> dict:
    casos = yaml.safe_load(CASOS.read_text(encoding="utf-8"))
    erros = []

    pares_texto = []
    for caso in casos["texto_familia"]:
        obtido = bool(guardrails.verificar_texto_familia(caso["texto"]))
        pares_texto.append((caso["bloquear"], obtido))
        if obtido != caso["bloquear"]:
            erros.append(
                {"conjunto": "texto_familia", "texto": caso["texto"], "esperado": caso["bloquear"]}
            )

    pares_risco = []
    for caso in casos["relatos_risco"]:
        obtido = bool(guardrails.detectar_risco(caso["texto"]))
        pares_risco.append((caso["risco"], obtido))
        if obtido != caso["risco"]:
            erros.append(
                {"conjunto": "relatos_risco", "texto": caso["texto"], "esperado": caso["risco"]}
            )

    return {
        "data": datetime.now().isoformat(timespec="seconds"),
        "bloqueio_texto_familia": _matriz(pares_texto),
        "deteccao_risco": _matriz(pares_risco),
        "erros": erros,
    }


def main() -> None:
    resultado = avaliar()
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    caminho = RESULTADOS / "guardrails.json"
    caminho.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    for nome in ("bloqueio_texto_familia", "deteccao_risco"):
        m = resultado[nome]
        print(
            f"{nome}: n={m['n']} precisão={m['precisao']} revocação={m['revocacao']} "
            f"(FP={m['falsos_positivos']}, FN={m['falsos_negativos']})"
        )
    for erro in resultado["erros"]:
        print(f"  erro em {erro['conjunto']}: {erro['texto']!r} (esperado {erro['esperado']})")


if __name__ == "__main__":
    main()
