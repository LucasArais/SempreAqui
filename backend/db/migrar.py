"""Aplica as migrações de backend/db/migrations no banco do Supabase, em ordem, uma vez cada.

Uso (a partir de backend/):  uv run python -m db.migrar
Lê SUPABASE_DATABASE_URL do .env. Cada arquivo roda numa transação: ou entra inteiro, ou nada.
"""

from __future__ import annotations

import os
import sys

import psycopg

from core.config import RAIZ_BACKEND

PASTA = RAIZ_BACKEND / "db" / "migrations"


def main() -> int:
    url = os.getenv("SUPABASE_DATABASE_URL")
    if not url:
        print("SUPABASE_DATABASE_URL não definida no .env.")
        return 1
    with psycopg.connect(url, autocommit=False) as conexao:
        conexao.execute(
            "create table if not exists public._migracoes "
            "(arquivo text primary key, aplicada_em timestamptz not null default now())"
        )
        conexao.execute("alter table public._migracoes enable row level security")
        conexao.commit()
        feitas = {linha[0] for linha in conexao.execute("select arquivo from public._migracoes")}
        pendentes = sorted(p for p in PASTA.glob("*.sql") if p.name not in feitas)
        if not pendentes:
            print("Banco em dia. Nenhuma migração pendente.")
            return 0
        for arquivo in pendentes:
            try:
                conexao.execute(arquivo.read_text(encoding="utf-8"))
                conexao.execute(
                    "insert into public._migracoes (arquivo) values (%s)", (arquivo.name,)
                )
                conexao.commit()
                print(f"aplicada: {arquivo.name}")
            except psycopg.Error as erro:
                conexao.rollback()
                print(f"falhou: {arquivo.name}\n{erro.diag.message_primary if erro.diag else erro}")
                return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
