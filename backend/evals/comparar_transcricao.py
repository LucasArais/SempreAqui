"""Compara modelos de transcrição nos relatos do gabarito.

Uso (a partir de backend/, precisa de OPENROUTER_API_KEY e saldo):
    uv run python -m evals.comparar_transcricao google/gemini-3-flash-preview google/gemini-2.5-flash

Mede, em 2 rodadas por relato: erro de palavras (WER) médio e pior caso, tempo médio e se a queda
do relato 3 foi transcrita. Perder a queda é a falha mais grave: sem ela não há alerta de 192.
"""

from __future__ import annotations

import concurrent.futures as cf
import statistics
import sys
import time

import yaml

from core.config import RAIZ_BACKEND, RAIZ_REPO
from core.llm import ErroProvedorIA, ProvedorOpenRouter
from core.prompts import carregar
from evals.metricas import wer

RODADAS = 2


def main(modelos: list[str]) -> None:
    casos = yaml.safe_load((RAIZ_BACKEND / "evals/diario/gabarito.yaml").read_text())["casos"]
    instrucoes = carregar("diario/transcricao")

    def transcrever(modelo: str, caso: dict):
        audio = (RAIZ_REPO / caso["audio"]).read_bytes()
        referencia = (RAIZ_REPO / caso["roteiro"]).read_text(encoding="utf-8")
        inicio = time.perf_counter()
        try:
            texto = ProvedorOpenRouter(modelo=modelo).transcrever_audio(
                audio, "audio/mpeg", instrucoes
            )
        except ErroProvedorIA as erro:
            return modelo, caso, None, 0.0, str(erro)
        return modelo, caso, wer(referencia, texto), time.perf_counter() - inicio, texto

    tarefas = [(m, c) for m in modelos for c in casos for _ in range(RODADAS)]
    resultados: dict[str, list] = {}
    with cf.ThreadPoolExecutor(8) as executor:
        for modelo, caso, erro_palavras, segundos, texto in executor.map(
            lambda a: transcrever(*a), tarefas
        ):
            resultados.setdefault(modelo, []).append((caso, erro_palavras, segundos, texto))

    print("| Modelo | WER médio | Pior WER | Tempo médio | Queda transcrita |")
    print("|---|---|---|---|---|")
    for modelo in modelos:
        ok = [r for r in resultados[modelo] if r[1] is not None]
        if not ok:
            print(f"| {modelo} | erro: {resultados[modelo][0][3][:60]} | | | |")
            continue
        quedas = [r for r in ok if r[0]["risco_esperado"]]
        captadas = sum(1 for r in quedas if "caiu" in r[3].lower())
        print(
            f"| {modelo} | {statistics.mean(r[1] for r in ok):.1%} | {max(r[1] for r in ok):.0%} | "
            f"{statistics.mean(r[2] for r in ok):.1f} s | {captadas}/{len(quedas)} |"
        )


if __name__ == "__main__":
    main(sys.argv[1:] or ["google/gemini-3-flash-preview"])
