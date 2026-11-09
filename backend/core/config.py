"""Configuração lida do ambiente. Segredos só vêm do .env, nunca do código."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

RAIZ_REPO = Path(__file__).resolve().parents[2]
RAIZ_BACKEND = RAIZ_REPO / "backend"

load_dotenv(RAIZ_REPO / ".env")


@dataclass(frozen=True)
class Config:
    llm_provider: str
    gemini_api_key: str | None
    gemini_model: str
    gemini_embedding_model: str
    database_url: str | None
    log_level: str


@lru_cache
def config() -> Config:
    return Config(
        llm_provider=os.getenv("LLM_PROVIDER", "gemini"),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        database_url=os.getenv("DATABASE_URL") or None,
        log_level=os.getenv("LOG_LEVEL", "info"),
    )
