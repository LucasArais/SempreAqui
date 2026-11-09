# Prova de conceito: Diário Inteligente

Esta pasta prova que a parte mais difícil do SempreAqui funciona: transformar um áudio de quem cuida, falado do jeito que a pessoa fala, em informação organizada que a família consegue acompanhar.

```
áudio de quem cuida  ->  transcrição  ->  registro estruturado (JSON validado)  ->  resumo para a família
                                                  |
                                                  +-> alerta de risco com orientação de ligar 192
```

## O que ela faz

Para cada áudio, a PoC devolve:

1. **Transcrição** do relato em português, feita por um modelo multimodal que recebe o áudio direto (hoje o Gemini 3 Flash, escolhido por benchmark).
2. **Registro do Diário** com sono, alimentação, hidratação, humor, agitação, episódios, medicação tomada (sim, não, parcial), o que ajudou, momentos bons, cansaço de quem cuida e sinais de alerta. O JSON segue o schema [`RegistroDiario`](../backend/core/schemas/diario.py) e é validado com Pydantic. Se a validação falhar, o modelo recebe o erro e tenta de novo uma vez.
3. **Resumo para a família**, em até 5 frases, conferido pelos guardrails: sem diagnóstico, sem orientação de remédio, sem "paciente" ou "fardo", sem travessão e com orientação de ligar 192 quando há risco. Se a IA falhar duas vezes, entra um resumo seguro montado sem IA.

A PoC chama o mesmo grafo LangGraph usado pela API ([`backend/agents/diario.py`](../backend/agents/diario.py)). Não é código descartável.

## Como rodar

Pré-requisitos: [uv](https://docs.astral.sh/uv/) e uma chave do [OpenRouter](https://openrouter.ai/keys) (ou do Gemini direto, com `LLM_PROVIDER=gemini`).

```bash
# na raiz do repositório
cp .env.example .env            # coloque sua OPENROUTER_API_KEY
uv sync --project backend

# um áudio
uv run --project backend python poc/diario_poc.py poc/exemplos/relato_02_noite_dificil.mp3

# os três exemplos
uv run --project backend python poc/diario_poc.py --todos

# a partir de texto, sem áudio
uv run --project backend python poc/diario_poc.py --texto poc/exemplos/relato_03_queda.txt
```

As saídas também ficam em `poc/saidas/` (ignorado pelo git).

Para gravar o seu próprio relato fictício, use o gravador do celular e passe o arquivo `.m4a` ou `.mp3`. **Não use relatos de pessoas reais.**

## Áudios de exemplo

Três relatos fictícios, escritos para cobrir situações diferentes, e convertidos em áudio com as vozes em português do Brasil do macOS (`say`). O texto de cada um está no `.txt` de mesmo nome.

| Arquivo | Situação | O que testa |
|---|---|---|
| `relato_01_dia_tranquilo` | Dia bom, ansiedade leve no fim da tarde, música ajudou | campos completos, "o que ajudou", cansaço leve |
| `relato_02_noite_dificil` | Acordou 4 vezes, recusou o remédio da manhã, tentou sair de casa | medicação parcial, episódio, cansaço intenso de quem cuida |
| `relato_03_queda` | Escorregou no banheiro e bateu a cabeça | detecção de risco e orientação de ligar 192 |

Para regenerar os áudios: `bash poc/gerar_audios.sh` (somente macOS).

## Como medimos

O gabarito de cada relato está em [`backend/evals/diario/gabarito.yaml`](../backend/evals/diario/gabarito.yaml). Para medir:

```bash
cd backend
uv run python -m evals.avaliar_diario            # áudio completo
uv run python -m evals.avaliar_diario --modo texto
```

Métricas: taxa de erro de palavras da transcrição (WER), acurácia por campo, precisão e revocação de episódios, acerto na detecção de risco e violações de guardrail no resumo final. Metodologia e resultados em [`docs/avaliacao.md`](../docs/avaliacao.md).
