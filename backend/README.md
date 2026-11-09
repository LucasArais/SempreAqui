# Backend

API, agentes de IA, guardrails, RAG de fontes oficiais e avaliações do SempreAqui.

```bash
uv sync
uv run pytest                               # testes (sem rede, com provedor falso)
uv run python -m evals.avaliar_guardrails   # avaliação dos guardrails
uv run python -m evals.avaliar_diario       # avaliação do Diário (precisa de GEMINI_API_KEY)
uv run uvicorn api.main:app --reload        # API em http://localhost:8000/docs
```

| Pasta | Conteúdo |
|---|---|
| `api/` | FastAPI. `POST /diario/relatos` recebe um áudio e devolve transcrição, registro, alertas e resumo |
| `agents/` | Grafos LangGraph, um por função do produto ([lista](agents/README.md)) |
| `core/` | Configuração, camada de provedores de IA, prompts, guardrails e schemas Pydantic |
| `prompts/` | Prompts versionados em Markdown |
| `rag/` | Fontes oficiais aprovadas para o RAG ([detalhes](rag/README.md)) |
| `evals/` | Gabaritos, conjuntos adversariais e scripts de avaliação |
| `db/` | Schema SQL com Row Level Security por grupo familiar |
| `tests/` | pytest |
