# Agentes

Um grafo LangGraph por função do produto. Todos usam o mesmo `ProvedorIA` (`core/llm.py`), os mesmos guardrails (`core/guardrails.py`) e prompts versionados em `backend/prompts/`.

| Grafo | Status | Entradas | Saídas |
|---|---|---|---|
| `diario.py` | **funcionando (Fase 0)** | áudio ou texto de quem cuida | transcrição, `RegistroDiario`, alertas, resumo para a família |
| `passaporte.py` | planejado (semana 1) | áudios, fotos e textos da família | `PassaporteMemoria` estruturado, link somente leitura, PDF de uma página |
| `reminiscencia.py` | planejado (semana 2) | Passaporte + reações anteriores | roteiro de sessão de 5 a 10 minutos |
| `apoio.py` | planejado (semana 2) | situação descrita por voz | sugestões do histórico da pessoa, respostas com fonte oficial (RAG), alerta 192 |
| `semanal.py` | planejado (semana 3) | registros do Diário | resumo semanal e lista "Para levar na consulta" |

## Princípios comuns

- Toda saída voltada à família passa por `guardrails.verificar_texto_familia` antes de ser mostrada.
- Toda resposta com informação de saúde carrega a URL da fonte oficial que a sustenta.
- Risco imediato sempre gera a orientação de ligar 192, independentemente do resto do grafo.
- O estado dos grafos nunca é logado. Logs registram apenas nomes de nós, tempos e erros.
