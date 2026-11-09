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
    openrouter_api_key: str | None
    openrouter_model: str
    openrouter_coleta_dados: str
    dados_dir: Path
    repositorio: str
    supabase_url: str | None
    supabase_secret_key: str | None
    supabase_database_url: str | None


@lru_cache
def config() -> Config:
    return Config(
        llm_provider=os.getenv("LLM_PROVIDER", "openrouter"),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        database_url=os.getenv("DATABASE_URL") or None,
        log_level=os.getenv("LOG_LEVEL", "info"),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY") or None,
        openrouter_model=os.getenv("OPENROUTER_MODEL", "google/gemini-3-flash-preview"),
        # "deny": só provedores que não guardam nem treinam com os dados. Obrigatório com dados reais.
        openrouter_coleta_dados=os.getenv("OPENROUTER_COLETA_DADOS", "deny"),
        dados_dir=RAIZ_BACKEND / os.getenv("DADOS_DIR", "dados"),
        # "supabase" (padrão quando configurado) ou "local" (SQLite em DADOS_DIR)
        repositorio=os.getenv("REPOSITORIO", "supabase"),
        supabase_url=os.getenv("SUPABASE_URL") or None,
        supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY") or None,
        supabase_database_url=os.getenv("SUPABASE_DATABASE_URL") or None,
    )
