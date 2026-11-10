"""Compara modelos abertos candidatos à IA no aparelho do Android, no modo texto.

Uso (a partir de backend/, com llama.cpp instalado: brew install llama.cpp):
    uv run python -m evals.comparar_modelos_aparelho modelo1.gguf [modelo2.gguf ...]

Para cada modelo, sobe um llama-server local e pede a extração do registro dos relatos do
gabarito (evals/diario/gabarito.yaml), com os MESMOS prompts do app
(app/prompts/diario-aparelho.ts) e a saída presa ao JSON Schema do RegistroDiario, como o
llama.rn faz no celular. Mede acerto por campo, episódios, risco e tempo.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

import httpx
import yaml

from agents.diario import alertas_do_relato
from core.config import RAIZ_BACKEND
from core.schemas.diario import RegistroDiario

RAIZ = RAIZ_BACKEND.parent
GABARITO = RAIZ_BACKEND / "evals" / "diario" / "gabarito.yaml"
PROMPTS_APP = RAIZ / "app" / "prompts" / "diario-aparelho.ts"
PORTA = 8765


def _prompts_do_app() -> tuple[str, str]:
    """O texto do sistema e o molde da extração, exatamente como estão no app."""
    ts = PROMPTS_APP.read_text(encoding="utf-8")
    sistema = re.search(r"export const SISTEMA = `(.*?)`;", ts, re.S).group(1)
    molde = re.search(
        r"export function promptExtracao\(.*?\) \{\s*return `(.*?)`;", ts, re.S
    ).group(1)
    return sistema, molde


def _extracao(molde: str, transcricao: str) -> str:
    texto = molde.replace("${correcoes || 'Nenhuma correção ainda.'}", "Nenhuma correção ainda.")
    return texto.replace("${transcricao}", transcricao)


def _todos_obrigatorios(esquema: dict) -> dict:
    """Como no app (adaptador.android.ts): todo campo é obrigatório, podendo ser vazio.

    Campo opcional no JSON Schema deixa o modelo simplesmente pular a chave.
    """
    if isinstance(esquema, dict):
        if esquema.get("type") == "object" and "properties" in esquema:
            esquema["required"] = list(esquema["properties"])
            esquema["additionalProperties"] = False
        for valor in esquema.values():
            _todos_obrigatorios(valor)
    elif isinstance(esquema, list):
        for valor in esquema:
            _todos_obrigatorios(valor)
    return esquema


ESQUEMA = _todos_obrigatorios(RegistroDiario.model_json_schema())


def _ler(registro: dict, caminho: str):
    atual = registro
    for parte in caminho.split("."):
        atual = atual.get(parte) if isinstance(atual, dict) else None
    return atual


def avaliar_modelo(modelo: Path, casos: list[dict], sistema: str, molde: str) -> dict:
    servidor = subprocess.Popen(
        [
            "llama-server",
            "-m",
            str(modelo),
            "--port",
            str(PORTA),
            "-c",
            "4096",
            "-ngl",
            "0",
            "-t",
            "8",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(120):
            try:
                if httpx.get(f"http://127.0.0.1:{PORTA}/health", timeout=2).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(1)
        acertos = total = risco_ok = 0
        segundos: list[float] = []
        detalhes = []
        for caso in casos:
            transcricao = (RAIZ / caso["roteiro"]).read_text(encoding="utf-8").strip()
            inicio = time.perf_counter()
            resposta = httpx.post(
                f"http://127.0.0.1:{PORTA}/v1/chat/completions",
                json={
                    "messages": [
                        {"role": "system", "content": sistema},
                        {"role": "user", "content": _extracao(molde, transcricao)},
                    ],
                    "temperature": 0,
                    "max_tokens": 900,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"strict": True, "schema": ESQUEMA},
                    },
                },
                timeout=600,
            ).json()
            segundos.append(time.perf_counter() - inicio)
            texto = resposta["choices"][0]["message"]["content"]
            try:
                registro = RegistroDiario.model_validate_json(
                    texto[texto.index("{") : texto.rindex("}") + 1]
                )
            except Exception as erro:  # noqa: BLE001
                detalhes.append(f"{caso['id']}: JSON inválido ({type(erro).__name__})")
                total += len(caso["campos"])
                continue
            dados = registro.model_dump()
            errados = []
            for campo, aceitos in caso["campos"].items():
                total += 1
                if _ler(dados, campo) in aceitos:
                    acertos += 1
                else:
                    errados.append(f"{campo}={_ler(dados, campo)}")
            risco = bool(alertas_do_relato(registro, transcricao))
            risco_ok += risco == caso["risco_esperado"]
            detalhes.append(
                f"{caso['id']}: erros {errados or 'nenhum'}; risco {'ok' if risco == caso['risco_esperado'] else 'ERRADO'}"
            )
        return {
            "modelo": modelo.name,
            "campos": f"{acertos}/{total} ({100 * acertos / total:.0f}%)",
            "risco": f"{risco_ok}/{len(casos)}",
            "segundos_por_relato": round(sum(segundos) / len(segundos), 1),
            "detalhes": detalhes,
        }
    finally:
        servidor.terminate()
        servidor.wait(timeout=30)


def main() -> int:
    casos = yaml.safe_load(GABARITO.read_text(encoding="utf-8"))["casos"]
    sistema, molde = _prompts_do_app()
    for caminho in sys.argv[1:]:
        r = avaliar_modelo(Path(caminho), casos, sistema, molde)
        print(json.dumps(r, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
