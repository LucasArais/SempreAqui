"""Avaliação do Diário Inteligente contra o gabarito (evals/diario/gabarito.yaml).

Uso (a partir de backend/):
    uv run python -m evals.avaliar_diario              # áudio completo: transcrição + extração + resumo
    uv run python -m evals.avaliar_diario --modo texto # só extração e resumo, a partir do roteiro

Precisa de GEMINI_API_KEY no .env. Resultados vão para evals/resultados/.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

import yaml

from agents.diario import processar_relato
from core import guardrails
from core.config import RAIZ_BACKEND, RAIZ_REPO, config
from core.llm import provedor_padrao
from evals.metricas import campo_correto, precisao_revocacao, valor_no_caminho, wer

GABARITO = RAIZ_BACKEND / "evals" / "diario" / "gabarito.yaml"
RESULTADOS = RAIZ_BACKEND / "evals" / "resultados"


def avaliar(modo: str) -> dict:
    casos = yaml.safe_load(GABARITO.read_text(encoding="utf-8"))["casos"]
    provedor = provedor_padrao()
    linhas = []
    campos_certos = campos_total = 0
    ep_vp = ep_fp = ep_fn = 0
    risco_certos = 0
    violacoes_total = 0

    for caso in casos:
        roteiro = (RAIZ_REPO / caso["roteiro"]).read_text(encoding="utf-8").strip()
        inicio = time.perf_counter()
        if modo == "audio":
            estado = processar_relato(provedor, audio=(RAIZ_REPO / caso["audio"]).read_bytes())
        else:
            estado = processar_relato(provedor, transcricao=roteiro)
        segundos = time.perf_counter() - inicio

        registro = estado["registro"].model_dump()
        erros_campos = []
        for caminho, aceitos in caso["campos"].items():
            campos_total += 1
            obtido = valor_no_caminho(registro, caminho)
            if campo_correto(obtido, aceitos):
                campos_certos += 1
            else:
                erros_campos.append(f"{caminho}: obtido {obtido!r}, aceitos {aceitos}")

        tipos_obtidos = {e["tipo"] for e in registro["episodios"]}
        tipos_esperados = set(caso["episodios_tipos"])
        ep_vp += len(tipos_obtidos & tipos_esperados)
        ep_fp += len(tipos_obtidos - tipos_esperados)
        ep_fn += len(tipos_esperados - tipos_obtidos)

        ajudou = guardrails.normalizar(" ".join(registro["o_que_ajudou"]))
        ajudou_ok = all(p in ajudou for p in caso["o_que_ajudou_contem"])

        risco_obtido = bool(estado["alertas"])
        risco_ok = risco_obtido == caso["risco_esperado"]
        risco_certos += risco_ok

        violacoes = guardrails.verificar_texto_familia(estado["resumo"])
        if caso["risco_esperado"] and not guardrails.menciona_192(estado["resumo"]):
            violacoes.append(guardrails.Violacao("risco_sem_192", ""))
        violacoes_total += len(violacoes)

        linhas.append(
            {
                "id": caso["id"],
                "wer": round(wer(roteiro, estado["transcricao"]), 3) if modo == "audio" else None,
                "campos_corretos": f"{len(caso['campos']) - len(erros_campos)}/{len(caso['campos'])}",
                "erros_campos": erros_campos,
                "episodios": sorted(tipos_obtidos),
                "o_que_ajudou_ok": ajudou_ok,
                "risco_ok": risco_ok,
                "violacoes_resumo": [f"{v.regra}: {v.trecho}" for v in violacoes],
                "resumo_seguro_usado": estado.get("resumo_seguro_usado", False),
                "segundos": round(segundos, 1),
                "resumo": estado["resumo"],
            }
        )

    ep_p, ep_r = precisao_revocacao(ep_vp, ep_fp, ep_fn)
    wers = [linha["wer"] for linha in linhas if linha["wer"] is not None]
    return {
        "data": datetime.now().isoformat(timespec="seconds"),
        "modelo": config().gemini_model,
        "modo": modo,
        "n_casos": len(casos),
        "metricas": {
            "wer_medio": round(sum(wers) / len(wers), 3) if wers else None,
            "acuracia_campos": round(campos_certos / campos_total, 3),
            "episodios_precisao": round(ep_p, 3),
            "episodios_revocacao": round(ep_r, 3),
            "deteccao_risco_acuracia": round(risco_certos / len(casos), 3),
            "violacoes_guardrail_no_resumo_final": violacoes_total,
            "latencia_media_s": round(sum(linha["segundos"] for linha in linhas) / len(linhas), 1),
        },
        "casos": linhas,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modo", choices=["audio", "texto"], default="audio")
    args = parser.parse_args()

    resultado = avaliar(args.modo)
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    nome = f"diario_{args.modo}_{datetime.now():%Y%m%d_%H%M}.json"
    caminho: Path = RESULTADOS / nome
    caminho.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"\nModelo: {resultado['modelo']}  |  modo: {args.modo}  |  casos: {resultado['n_casos']}\n"
    )
    print("| Métrica | Valor |\n|---|---|")
    for chave, valor in resultado["metricas"].items():
        print(f"| {chave} | {valor} |")
    for linha in resultado["casos"]:
        if linha["erros_campos"]:
            print(f"\n{linha['id']}:")
            for erro in linha["erros_campos"]:
                print(f"  - {erro}")
    print(f"\nResultado completo em {caminho.relative_to(RAIZ_REPO)}")


if __name__ == "__main__":
    main()
