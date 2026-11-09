"""Contrato do repositório no Supabase real. Só roda com TESTAR_SUPABASE=1.

Cria uma família temporária, exercita relato, áudio, correção e isolamento, e apaga tudo no fim.
"""

import os
import uuid

import pytest

from core.config import config
from core.repositorio import FamiliaDesconhecida

pytestmark = pytest.mark.skipif(
    os.getenv("TESTAR_SUPABASE") != "1", reason="TESTAR_SUPABASE=1 para rodar"
)


@pytest.fixture
def repo():
    from core.repositorio_supabase import RepositorioSupabase

    cfg = config()
    repositorio = RepositorioSupabase(
        cfg.supabase_database_url, cfg.supabase_url, cfg.supabase_secret_key
    )
    codigo = f"teste-{uuid.uuid4().hex[:12]}"
    repositorio.garantir_grupo(codigo, "Família de teste automático")
    yield repositorio, codigo
    for relato in repositorio.listar(codigo, limite=100):
        repositorio.apagar(codigo, relato["id"])
    repositorio._sql("delete from grupos_familiares where codigo = %s", (codigo,))


def test_relato_audio_correcao_e_isolamento(repo):
    repositorio, codigo = repo
    relato_id = f"teste-{uuid.uuid4()}"

    relato, novo = repositorio.criar_relato(
        codigo, relato_id, b"audio-de-teste" * 100, "audio/mp4", 12, None
    )
    assert novo and relato["etapa"] == "recebido"
    assert repositorio.criar_relato(codigo, relato_id, b"x", "audio/mp4", 12, None)[1] is False
    assert repositorio.ler_audio(relato) == b"audio-de-teste" * 100

    registro = {"sono": {"qualidade": "boa"}}
    repositorio.salvar_resultado(relato_id, "texto", registro, [], "resumo", False, "v2", "teste")
    correcao = repositorio.registrar_correcao(
        codigo, relato_id, "sono.qualidade", "boa", "ruim", "resumo"
    )
    assert repositorio.campos_corrigidos(codigo, [relato_id]) == {relato_id: ["sono.qualidade"]}
    assert repositorio.correcoes_recentes(codigo)[0]["trecho"] == "texto"
    repositorio.marcar_correcao_desfeita(correcao)
    assert repositorio.campos_corrigidos(codigo, [relato_id]) == {}

    with pytest.raises(FamiliaDesconhecida):
        repositorio.obter("familia-que-nao-existe", relato_id)

    assert repositorio.apagar(codigo, relato_id)
    assert repositorio.ler_audio(relato) is None
