"""Cadastro no Supabase Auth, sem confirmação de e-mail nesta etapa.

A chave administrativa nunca sai do servidor. Senhas não entram no repositório
nem nos logs; o hash é responsabilidade do Supabase Auth.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from datetime import UTC, datetime
from threading import Lock
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, SecretStr, field_validator

from core.config import config

VERSAO_TERMOS = "1"
router = APIRouter(prefix="/auth", tags=["Conta"])
_tentativas: dict[str, list[float]] = {}
_lock = Lock()


class Cadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=60)
    email: str = Field(max_length=254)
    senha: SecretStr = Field(min_length=8, max_length=128)
    aceite_termos: Literal[True]
    versao_termos: Literal["1"]

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if len(valor) < 2:
            raise ValueError("Diga seu nome para a família saber quem é você.")
        return valor

    @field_validator("email")
    @classmethod
    def email_valido(cls, valor: str) -> str:
        valor = valor.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", valor):
            raise ValueError("Confira o e-mail informado.")
        return valor

    @field_validator("senha")
    @classmethod
    def senha_valida(cls, valor: SecretStr) -> SecretStr:
        senha = valor.get_secret_value()
        if not any(c.isalpha() for c in senha) or not any(c.isdigit() for c in senha):
            raise ValueError("Use pelo menos uma letra e um número na senha.")
        return valor


def limitar_cadastro(ip: str, email: str) -> None:
    agora = time.monotonic()
    chaves = [
        hashlib.sha256(f"{tipo}:{valor}".encode()).hexdigest()
        for tipo, valor in [("ip", ip), ("email", email)]
    ]
    with _lock:
        for chave in list(_tentativas):
            recentes = [t for t in _tentativas[chave] if agora - t < 900]
            if recentes:
                _tentativas[chave] = recentes
            else:
                del _tentativas[chave]
        if any(
            len(_tentativas.get(chave, [])) >= limite
            for chave, limite in zip(chaves, [20, 5], strict=True)
        ):
            raise HTTPException(429, "Muitas tentativas agora. Espere um pouco e tente de novo.")
        for chave in chaves:
            _tentativas.setdefault(chave, []).append(agora)


def criar_usuario(dados: Cadastro) -> None:
    cfg = config()
    chave = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or cfg.supabase_secret_key
    if not cfg.supabase_url or not chave:
        raise HTTPException(503, "Não consegui criar sua conta agora. Tente de novo em instantes.")
    aceite = {"versao": VERSAO_TERMOS, "aceito_em": datetime.now(UTC).isoformat()}
    try:
        resposta = httpx.post(
            f"{cfg.supabase_url.rstrip('/')}/auth/v1/admin/users",
            headers={"apikey": chave, "Authorization": f"Bearer {chave}"},
            json={
                "email": dados.email,
                "password": dados.senha.get_secret_value(),
                "email_confirm": True,
                "user_metadata": {"nome": dados.nome},
                "app_metadata": {"aceite_termos": aceite},
            },
            timeout=15,
        )
    except httpx.HTTPError:
        raise HTTPException(
            503, "Não consegui criar sua conta agora. Confira sua conexão e tente de novo."
        ) from None
    if resposta.is_success:
        return
    try:
        codigo = resposta.json().get("error_code") or resposta.json().get("code")
    except (ValueError, AttributeError):
        codigo = None
    if codigo in {"email_exists", "user_already_exists"}:
        raise HTTPException(409, "Já existe uma conta com esse e-mail. Quer entrar?")
    if codigo == "weak_password":
        raise HTTPException(
            422, "Escolha uma senha mais forte, com pelo menos 8 caracteres, uma letra e um número."
        )
    raise HTTPException(503, "Não consegui criar sua conta agora. Tente de novo em instantes.")


@router.post("/cadastro", status_code=201)
def cadastrar(dados: Cadastro, request: Request) -> dict:
    limitar_cadastro(request.client.host if request.client else "desconhecido", dados.email)
    criar_usuario(dados)
    return {"criado": True}
