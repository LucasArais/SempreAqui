"""Login: valida o token do Supabase (inclusive de usuários anônimos) no próprio backend.

O Supabase assina os tokens com ES256 e publica as chaves públicas (JWKS). Verificamos a
assinatura, a validade e o público ("authenticated") localmente, sem chamar o Supabase a cada
requisição. As chaves ficam em cache.
"""

from __future__ import annotations

from functools import lru_cache

import jwt

from core.config import config


class TokenInvalido(Exception):
    pass


@lru_cache
def _cliente_jwks() -> jwt.PyJWKClient:
    url = config().supabase_url
    if not url:
        raise TokenInvalido("Supabase não configurado.")
    return jwt.PyJWKClient(f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True)


def usuario_do_token(token: str) -> str:
    """Devolve o id do usuário (claim sub) de um token válido do Supabase."""
    try:
        chave = _cliente_jwks().get_signing_key_from_jwt(token)
        dados = jwt.decode(token, chave.key, algorithms=["ES256"], audience="authenticated")
    except (jwt.PyJWTError, jwt.PyJWKClientError) as erro:
        raise TokenInvalido(str(erro)) from erro
    return dados["sub"]
