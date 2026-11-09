# Avaliação da IA

Não basta a IA parecer boa no demo. Medimos cada etapa com um conjunto de avaliação próprio, versionado no repositório, e publicamos os números aqui a cada mudança relevante de prompt ou modelo.

## O que medimos

### Diário Inteligente

Gabarito: [`backend/evals/diario/gabarito.yaml`](../backend/evals/diario/gabarito.yaml). Cada relato fictício tem um áudio, o texto original e os valores aceitos para cada campo. Quando o relato é ambíguo (por exemplo, humor "calmo" ou "alegre"), o gabarito aceita mais de um valor.

| Métrica | O que significa | Meta |
|---|---|---|
| WER da transcrição | Proporção de palavras erradas, inseridas ou faltando em relação ao texto original | abaixo de 10% |
| Acurácia por campo | Campos categóricos e numéricos extraídos corretamente (sono, alimentação, humor, medicação...) | acima de 90% |
| Precisão e revocação de episódios | Episódios como queda ou tentativa de sair detectados sem inventar outros | revocação de 100% |
| Detecção de risco | Relatos com risco geram alerta e relatos sem risco não geram | 100% dos riscos detectados |
| Violações no resumo final | Termos proibidos, orientação médica, travessão ou risco sem 192 no texto que a família recebe | zero |
| Latência | Tempo do áudio até o resumo | abaixo de 15 s |

Como rodar:

```bash
cd backend
uv run python -m evals.avaliar_diario              # áudio completo
uv run python -m evals.avaliar_diario --modo texto # isola extração e resumo
```

Os resultados completos ficam em `backend/evals/resultados/`.

### Guardrails

Conjunto adversarial: [`backend/evals/guardrails/casos.yaml`](../backend/evals/guardrails/casos.yaml). São frases que poderiam sair de um resumo da IA (algumas aceitáveis, outras com diagnóstico, orientação de remédio ou linguagem desrespeitosa) e trechos de relatos com e sem risco. Roda sem chave de API e faz parte do CI: se um caso falhar, o build quebra.

```bash
cd backend
uv run python -m evals.avaliar_guardrails
```

## Resultados

### Guardrails (9/11/2026)

| Conjunto | Casos | Precisão | Revocação | Falsos positivos | Falsos negativos |
|---|---|---|---|---|---|
| Bloqueio de textos para a família | 33 | 1,00 | 1,00 | 0 | 0 |
| Detecção de risco em relatos | 20 | 1,00 | 1,00 | 0 | 0 |

Leitura honesta: este conjunto foi escrito junto com as regras, então mede se as regras fazem o que se propõem, não o quanto generalizam. O próximo passo é um conjunto cego, escrito por pessoas de fora da equipe e revisado por profissionais de saúde, e um conjunto com resumos gerados pela própria IA rotulados à mão.

### Diário Inteligente

Resultados com o Gemini serão publicados aqui na primeira rodada com chave de API, com modelo, data e versão dos prompts. A tabela abaixo será preenchida com a saída de `evals.avaliar_diario`.

| Data | Modelo | Prompts | WER | Acurácia por campo | Episódios (P / R) | Risco | Violações | Latência |
|---|---|---|---|---|---|---|---|---|
| pendente | gemini-2.5-flash | v1 | | | | | | |

## Limitações e próximos passos

- **Tamanho.** Três relatos provam o fluxo, não a robustez. A meta da semana 1 é chegar a 30, com sotaques regionais, ruído de fundo, falas longas e relatos confusos.
- **Vozes sintéticas.** Os áudios de exemplo foram gerados por TTS e são mais limpos que um áudio real gravado na cozinha. Vamos incluir gravações de voluntários lendo relatos fictícios.
- **Avaliação humana.** Para o resumo, além das regras automáticas, vamos pedir a familiares e profissionais que avaliem clareza, utilidade e tom numa escala simples.
- **Regressão.** Toda nova versão de prompt roda o conjunto inteiro e o resultado entra nesta página.
