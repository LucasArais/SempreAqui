"""Verifica as regras de linguagem do projeto em todos os arquivos versionados.

1. Nenhum travessão (em dash) ou meia-risca (en dash) em nenhum texto.
2. Nenhum termo desrespeitoso ("paciente", "fardo") nas telas do app.

Uso: python scripts/verificar_textos.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
TRAVESSOES = (chr(0x2014), chr(0x2013))
IGNORAR = {"package-lock.json", "uv.lock"}
EXTENSOES_TEXTO = {
    ".md", ".py", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".toml", ".sql", ".sh", ".txt",
}
TERMOS_PROIBIDOS_APP = re.compile(r"\b(pacientes?|fardos?)\b", re.IGNORECASE)


def arquivos_versionados() -> list[Path]:
    saida = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=RAIZ, capture_output=True, text=True, check=True,
    ).stdout
    return [RAIZ / linha for linha in saida.splitlines() if linha]


def main() -> int:
    problemas = []
    for arquivo in arquivos_versionados():
        if arquivo.name in IGNORAR or arquivo.suffix not in EXTENSOES_TEXTO or not arquivo.exists():
            continue
        texto = arquivo.read_text(encoding="utf-8", errors="ignore")
        relativo = arquivo.relative_to(RAIZ)
        for numero, linha in enumerate(texto.splitlines(), start=1):
            if any(t in linha for t in TRAVESSOES):
                problemas.append(f"{relativo}:{numero}: travessão. Use vírgula ou ponto.")
            if relativo.parts[:2] == ("app", "src") and TERMOS_PROIBIDOS_APP.search(linha):
                problemas.append(f"{relativo}:{numero}: termo desrespeitoso na interface.")
    for problema in problemas:
        print(problema)
    if problemas:
        print(f"\n{len(problemas)} problema(s) de linguagem.")
        return 1
    print("Linguagem ok.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
