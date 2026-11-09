"""Prova de conceito do Diário Inteligente (Fase 0).

Recebe o áudio de quem cuida contando o dia e devolve:
  (a) a transcrição,
  (b) o registro estruturado do Diário, validado com Pydantic,
  (c) um resumo curto para a família, conferido pelos guardrails.

Usa exatamente o mesmo grafo LangGraph que a API (backend/agents/diario.py).
A PoC não é um protótipo descartável: é a primeira fatia do produto.

Uso (a partir da raiz do repositório):
    uv run --project backend python poc/diario_poc.py poc/exemplos/relato_01_dia_tranquilo.mp3
    uv run --project backend python poc/diario_poc.py --todos
    uv run --project backend python poc/diario_poc.py --texto poc/exemplos/relato_03_queda.txt
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))

from agents.diario import processar_relato  # noqa: E402
from core.guardrails import MENSAGEM_RISCO  # noqa: E402
from core.llm import ErroProvedorIA, provedor_padrao  # noqa: E402

EXEMPLOS = RAIZ / "poc" / "exemplos"
SAIDAS = RAIZ / "poc" / "saidas"


def linha(titulo: str) -> None:
    print(f"\n{'=' * 70}\n{titulo}\n{'=' * 70}")


def rodar(caminho: Path, provedor, so_texto: bool = False) -> dict:
    inicio = time.perf_counter()
    if so_texto:
        estado = processar_relato(provedor, transcricao=caminho.read_text(encoding="utf-8"))
    else:
        mime = mimetypes.guess_type(caminho.name)[0] or "audio/mpeg"
        estado = processar_relato(provedor, audio=caminho.read_bytes(), mime_type=mime)
    segundos = time.perf_counter() - inicio

    linha(f"{caminho.name}  ({segundos:.1f} s)")
    print("\n(a) TRANSCRIÇÃO\n")
    print(estado["transcricao"])

    print("\n(b) DIÁRIO ESTRUTURADO (validado com Pydantic)\n")
    registro = estado["registro"].model_dump(exclude_none=True)
    print(json.dumps(registro, ensure_ascii=False, indent=2))

    print("\n(c) RESUMO PARA A FAMÍLIA\n")
    print(estado["resumo"])

    if estado["alertas"]:
        print("\n!! ALERTA DE RISCO")
        for alerta in estado["alertas"]:
            print(f"   - {alerta}")
        print(f"   {MENSAGEM_RISCO}")
    if estado.get("resumo_seguro_usado"):
        print("\n(o resumo da IA não passou nos guardrails; foi usado o resumo seguro)")

    saida = {
        "arquivo": caminho.name,
        "segundos": round(segundos, 1),
        "transcricao": estado["transcricao"],
        "registro": registro,
        "resumo_familia": estado["resumo"],
        "alertas": estado["alertas"],
    }
    SAIDAS.mkdir(exist_ok=True)
    (SAIDAS / f"{caminho.stem}.json").write_text(
        json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return saida


def main() -> int:
    parser = argparse.ArgumentParser(description="PoC do Diário Inteligente do SempreAqui")
    parser.add_argument("audio", nargs="?", type=Path, help="arquivo de áudio (mp3, m4a, wav)")
    parser.add_argument("--todos", action="store_true", help="roda os 3 áudios de exemplo")
    parser.add_argument("--texto", type=Path, help="usa um relato em texto, sem áudio")
    args = parser.parse_args()

    try:
        provedor = provedor_padrao()
    except ErroProvedorIA as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 1

    if args.texto:
        rodar(args.texto, provedor, so_texto=True)
    elif args.todos:
        for audio in sorted(EXEMPLOS.glob("*.mp3")):
            rodar(audio, provedor)
    elif args.audio:
        rodar(args.audio, provedor)
    else:
        parser.print_help()
        return 1
    print(f"\nSaídas salvas em {SAIDAS.relative_to(RAIZ)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
