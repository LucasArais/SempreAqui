# Backend

API, agentes de IA, guardrails, RAG de fontes oficiais e avaliações do SempreAqui.

```bash
uv sync
uv run pytest                               # testes (sem rede, com provedor falso)
uv run python -m evals.avaliar_guardrails   # avaliação dos guardrails
uv run python -m evals.avaliar_diario       # avaliação do Diário (precisa de OPENROUTER_API_KEY)
uv run python -m demo.seed                  # família de demonstração
uv run uvicorn api.main:app --reload --host 0.0.0.0   # API em http://localhost:8000/docs
```

| Pasta | Conteúdo |
|---|---|
| `api/` | FastAPI: relatos (criar, listar, ver, tentar de novo, corrigir campo, desfazer, enviar, apagar, ouvir o áudio), eventos e `/metricas` |
| `agents/` | Grafos LangGraph, um por função do produto ([lista](agents/README.md)) |
| `core/` | Configuração, camada de provedores de IA, prompts, guardrails e schemas Pydantic |
| `prompts/` | Prompts versionados em Markdown |
| `rag/` | Fontes oficiais aprovadas para o RAG ([detalhes](rag/README.md)) |
| `evals/` | Gabaritos, conjuntos adversariais e scripts de avaliação |
| `db/` | Migrações do Supabase com RLS (`uv run python -m db.migrar`) |
| `demo/` | `uv run python -m demo.seed`: família de demonstração com relatos prontos |
| `tests/` | pytest |
