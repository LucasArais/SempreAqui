"""Camada de abstração de provedores de IA.

O resto do código depende só de `ProvedorIA`. Trocar de provedor é questão de configuração
(LLM_PROVIDER no .env) e de uma nova classe que implemente os três métodos abaixo.
"""

from __future__ import annotations

import json
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
    if nome == "gemini":
        return ProvedorGemini()
    raise ErroProvedorIA(f"Provedor de IA desconhecido: {nome!r}")
