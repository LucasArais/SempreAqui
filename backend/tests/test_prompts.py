"""Os prompts são parte dos guardrails. Estes testes impedem que uma edição apague as regras."""

from core import prompts
from core.config import RAIZ_BACKEND


def test_prompt_base_contem_regras_inegociaveis():
    base = prompts.sistema()
    assert "não diagnostica" in base
    assert "192" in base
    assert "fonte oficial" in base
    assert "paciente" in base  # aparece apenas na lista de termos proibidos


def test_prompts_nao_tem_travessao():
    for arquivo in (RAIZ_BACKEND / "prompts").rglob("*.md"):
        texto = arquivo.read_text(encoding="utf-8")
        assert "\u2014" not in texto and "\u2013" not in texto, arquivo


def test_preencher_nao_quebra_chaves_json():
    assert prompts.preencher('{"a": 1} {{x}}', x="ok") == '{"a": 1} ok'
