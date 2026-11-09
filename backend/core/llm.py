"""Camada de abstração de provedores de IA.

O resto do código depende só de `ProvedorIA`. Trocar de provedor é questão de configuração
(LLM_PROVIDER no .env) e de uma nova classe que implemente os três métodos abaixo.
"""

from __future__ import annotations

import base64
import json
import shutil
import subprocess
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from core.config import config

M = TypeVar("M", bound=BaseModel)


class ErroProvedorIA(RuntimeError):
    pass


class ProvedorIA(Protocol):
    def transcrever_audio(self, audio: bytes, mime_type: str, instrucoes: str) -> str: ...

    def gerar_texto(self, prompt: str, sistema: str) -> str: ...

    def gerar_estruturado(self, prompt: str, sistema: str, modelo: type[M]) -> M: ...


class ProvedorGemini:
    """Gemini via SDK oficial google-genai. Multimodal e bom com áudio em português."""

    def __init__(self, api_key: str | None = None, modelo: str | None = None) -> None:
        from google import genai

        cfg = config()
        chave = api_key or cfg.gemini_api_key
        if not chave:
            raise ErroProvedorIA(
                "GEMINI_API_KEY não definida. Copie .env.example para .env e preencha a chave."
            )
        self._cliente = genai.Client(api_key=chave)
        self._modelo = modelo or cfg.gemini_model

    def _config(self, sistema: str | None = None, **extra):
        from google.genai import types

        return types.GenerateContentConfig(system_instruction=sistema, temperature=0.2, **extra)

    def transcrever_audio(self, audio: bytes, mime_type: str, instrucoes: str) -> str:
        from google.genai import types

        resposta = self._cliente.models.generate_content(
            model=self._modelo,
            contents=[types.Part.from_bytes(data=audio, mime_type=mime_type), instrucoes],
            config=self._config(),
        )
        return (resposta.text or "").strip()

    def gerar_texto(self, prompt: str, sistema: str) -> str:
        resposta = self._cliente.models.generate_content(
            model=self._modelo, contents=prompt, config=self._config(sistema)
        )
        return (resposta.text or "").strip()

    def gerar_estruturado(self, prompt: str, sistema: str, modelo: type[M]) -> M:
        """Pede JSON no formato do schema Pydantic e valida. Tenta corrigir uma vez se falhar."""
        cfg = self._config(
            sistema,
            response_mime_type="application/json",
            response_json_schema=modelo.model_json_schema(),
        )
        texto = self._cliente.models.generate_content(
            model=self._modelo, contents=prompt, config=cfg
        ).text
        try:
            return modelo.model_validate_json(texto or "")
        except ValidationError as erro:
            correcao = (
                f"{prompt}\n\nSua resposta anterior não passou na validação:\n{erro}\n"
                "Responda novamente apenas com o JSON corrigido."
            )
            texto = self._cliente.models.generate_content(
                model=self._modelo, contents=correcao, config=cfg
            ).text
            return modelo.model_validate_json(texto or "")


FORMATOS_DIRETOS = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}


def preparar_audio(audio: bytes, mime_type: str) -> tuple[bytes, str]:
    """Garante um formato aceito por todos os modelos (mp3 ou wav).

    O app grava em m4a (AAC). Se o ffmpeg estiver disponível, convertemos para mp3 mono 16 kHz,
    que também deixa o envio menor. Sem ffmpeg, enviamos o original com o formato declarado.
    """
    if mime_type in FORMATOS_DIRETOS:
        return audio, FORMATOS_DIRETOS[mime_type]
    if shutil.which("ffmpeg"):
        resultado = subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-i",
                "pipe:0",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-b:a",
                "48k",
                "-f",
                "mp3",
                "pipe:1",
            ],
            input=audio,
            capture_output=True,
            check=False,
        )
        if resultado.returncode == 0 and resultado.stdout:
            return resultado.stdout, "mp3"
    return audio, mime_type.split("/")[-1].replace("x-", "")


class ProvedorOpenRouter:
    """Qualquer modelo do OpenRouter pela API compatível com OpenAI.

    Por padrão exige provedores que não guardam nem usam os dados para treino
    (data_collection = deny) e que suportam todos os parâmetros pedidos.
    """

    URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, api_key: str | None = None, modelo: str | None = None) -> None:
        cfg = config()
        self._chave = api_key or cfg.openrouter_api_key
        if not self._chave:
            raise ErroProvedorIA(
                "OPENROUTER_API_KEY não definida. Copie .env.example para .env e preencha a chave."
            )
        self.modelo = modelo or cfg.openrouter_model
        self._coleta = cfg.openrouter_coleta_dados

    def _chamar(self, mensagens: list[dict], **extra) -> str:
        import httpx

        corpo = {
            "model": self.modelo,
            "messages": mensagens,
            "temperature": 0.2,
            "provider": {"data_collection": self._coleta, "require_parameters": True},
            **extra,
        }
        cabecalhos = {
            "Authorization": f"Bearer {self._chave}",
            "X-Title": "SempreAqui",
            "HTTP-Referer": "https://github.com/LucasArais/SempreAqui",
        }
        for tentativa in range(2):
            resposta = httpx.post(self.URL, json=corpo, headers=cabecalhos, timeout=120)
            if resposta.status_code in (429, 500, 502, 503) and tentativa == 0:
                continue
            break
        if resposta.status_code != 200:
            # Nunca repassa o conteúdo enviado; só o erro do provedor.
            try:
                detalhe = resposta.json().get("error", {}).get("message", "")
            except ValueError:
                detalhe = ""
            raise ErroProvedorIA(f"OpenRouter respondeu {resposta.status_code}: {detalhe[:200]}")
        conteudo = resposta.json()["choices"][0]["message"]["content"]
        if isinstance(conteudo, list):
            conteudo = "".join(p.get("text", "") for p in conteudo if isinstance(p, dict))
        return (conteudo or "").strip()

    def transcrever_audio(self, audio: bytes, mime_type: str, instrucoes: str) -> str:
        dados, formato = preparar_audio(audio, mime_type)
        partes = [
            {"type": "text", "text": instrucoes},
            {
                "type": "input_audio",
                "input_audio": {"data": base64.b64encode(dados).decode(), "format": formato},
            },
        ]
        return self._chamar([{"role": "user", "content": partes}])

    def gerar_texto(self, prompt: str, sistema: str) -> str:
        return self._chamar(
            [{"role": "system", "content": sistema}, {"role": "user", "content": prompt}]
        )

    def gerar_estruturado(self, prompt: str, sistema: str, modelo: type[M]) -> M:
        formato = {
            "type": "json_schema",
            "json_schema": {
                "name": modelo.__name__,
                "strict": False,
                "schema": modelo.model_json_schema(),
            },
        }
        mensagens = [{"role": "system", "content": sistema}, {"role": "user", "content": prompt}]
        texto = self._chamar(mensagens, response_format=formato)
        try:
            return modelo.model_validate_json(_limpar_json(texto))
        except ValidationError as erro:
            mensagens += [
                {"role": "assistant", "content": texto},
                {
                    "role": "user",
                    "content": f"Sua resposta não passou na validação:\n{erro}\n"
                    "Responda novamente apenas com o JSON corrigido.",
                },
            ]
            texto = self._chamar(mensagens, response_format=formato)
            return modelo.model_validate_json(_limpar_json(texto))


def _limpar_json(texto: str) -> str:
    """Alguns modelos embrulham o JSON em blocos de código."""
    texto = texto.strip()
    if texto.startswith("```"):
        texto = texto.split("\n", 1)[1] if "\n" in texto else texto
        texto = texto.rsplit("```", 1)[0]
    return texto.strip()


class ProvedorFalso:
    """Provedor determinístico para testes. Não chama rede nenhuma."""

    def __init__(
        self,
        transcricao: str = "",
        estruturado: dict | None = None,
        textos: list[str] | None = None,
    ) -> None:
        self.transcricao = transcricao
        self.estruturado = estruturado or {}
        self.textos = list(textos or [])
        self.chamadas: list[str] = []

    def transcrever_audio(self, audio: bytes, mime_type: str, instrucoes: str) -> str:
        self.chamadas.append("transcrever_audio")
        return self.transcricao

    def gerar_texto(self, prompt: str, sistema: str) -> str:
        self.chamadas.append("gerar_texto")
        return self.textos.pop(0) if self.textos else ""

    def gerar_estruturado(self, prompt: str, sistema: str, modelo: type[M]) -> M:
        self.chamadas.append("gerar_estruturado")
        return modelo.model_validate_json(json.dumps(self.estruturado))


def provedor_padrao() -> ProvedorIA:
    nome = config().llm_provider
    if nome == "openrouter":
        return ProvedorOpenRouter()
    if nome == "gemini":
        return ProvedorGemini()
    raise ErroProvedorIA(f"Provedor de IA desconhecido: {nome!r}")
