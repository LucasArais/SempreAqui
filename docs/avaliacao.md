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

### Escolha do modelo de transcrição (9/11/2026)

Primeira rodada com modelos reais, pelo OpenRouter. Três relatos fictícios, duas rodadas cada, mesmas instruções. Script: `uv run python -m evals.comparar_transcricao <modelos>`.

| Modelo | WER médio | Pior WER | Tempo médio | Queda transcrita |
|---|---|---|---|---|
| **google/gemini-3-flash-preview** | **3,4%** | 5% | 2,7 s | **2/2** |
| google/gemini-3.1-flash-lite | 8,6% | 16% | 2,3 s | 2/2 |
| google/gemini-3.5-flash | 9,1% | 17% | 37,0 s | 2/2 |
| qwen/qwen3.8-omni-flash | 14,5% | 30% | 13,2 s | 0/2 |
| google/gemini-2.5-flash | 29,2% | 103% | 3,4 s | 0/2 |
| google/gemini-3.5-flash-lite | 29,9% | 49% | 2,3 s | 0/2 |

O que aprendemos:

- **O modelo que tínhamos como padrão era perigoso.** O `gemini-2.5-flash` inventou o começo do relato da queda ("Hoje, Graça dormiu até as 10:30") e perdeu a batida na cabeça nas duas rodadas. Sem a queda na transcrição, não há alerta de 192. Trocamos o padrão para `gemini-3-flash-preview`.
- **A ordem importa.** Com as instruções antes do áudio, os modelos repetem menos o prompt na resposta. O provedor envia sempre nessa ordem, e há teste para isso.
- **"Queda transcrita" virou critério de corte.** Um modelo que perde uma situação de risco não entra, mesmo que seja mais rápido ou mais barato.
- **Limite honesto:** os áudios são de voz sintética. O próximo conjunto terá gravações de voluntários com ruído de casa.

### Diário Inteligente

Resultados completos do Diário serão publicados aqui na primeira rodada com chave de API, com modelo, data e versão dos prompts. A tabela abaixo será preenchida com a saída de `evals.avaliar_diario`.

| Data | Modelo | Prompts | WER | Acurácia por campo | Episódios (P / R) | Risco | Violações | Latência |
|---|---|---|---|---|---|---|---|---|
| 9/11/2026 | gemini-3-flash-preview (OpenRouter) | extracao.v2 | só texto | 100% | 1,00 / 1,00 | 3/3 | 0 | 6,0 s |

Primeira rodada no modo texto (extração e resumo a partir do roteiro, sem transcrição). O modo com áudio aguarda saldo no OpenRouter. Na leitura estrita do gabarito original, a precisão de episódios foi 0,50: o modelo marcou "desorientação" no relato em que a pessoa pergunta pela casa da mãe e "recusa de cuidado" quando recusa o remédio. As duas leituras são defensáveis, então entraram no gabarito como episódios opcionais (aceitos, não exigidos). Registramos as duas versões para não esconder a mudança.

### Resumo da semana e mudanças de padrão

As mudanças de padrão não usam IA: são regras explícitas sobre a linha de base da própria pessoa (`backend/core/semana.py`), testadas em `tests/test_semana.py`. A IA só escreve o texto do resumo para a família, que passa pelos mesmos guardrails do Diário e cai num resumo seguro se falhar. Testes garantem que nenhum texto de mudança ou da lista da consulta contém interpretação clínica.

### Apoio na Hora Difícil (10/11/2026)

`uv run python -m evals.avaliar_apoio`, sobre `evals/apoio/casos.yaml`, com o Passaporte e um Diário de exemplo. Também roda no pytest, então quebra o CI se cair.

| Critério | Resultado | Meta |
|---|---|---|
| Recusa correta em perguntas médicas (dose, remédio, diagnóstico, "é normal?", "está piorando?") | 20/20 | 100% |
| Risco com 192 e aviso à família | 9/9 | 100% |
| Situação do dia a dia reconhecida (agitação, banho, comida, sono, cansaço...) | 14/14 | alto |
| Respostas com fonte oficial e link | 44/44 | 100% |
| Violações de guardrail no texto mostrado | 0 | 0 |

O Apoio é determinístico de propósito: na hora difícil, previsibilidade vale mais que criatividade. Os trechos oficiais são cópias literais do Guia Prático do Cuidador (Ministério da Saúde, 2008), conferidas contra o PDF original com a página de cada um. "Falar de remédio" não é tratado como pergunta médica ("ela não quer tomar o remédio" recebe apoio prático); pedir dose, indicação, troca ou interpretação é.

### Modelos abertos para a IA no Android (10/11/2026)

`uv run python -m evals.comparar_modelos_aparelho modelo.gguf ...` sobe cada modelo no llama.cpp (só CPU) e pede a extração dos três relatos do gabarito com os mesmos prompts do app e a saída presa ao esquema do registro, com todos os campos obrigatórios, como no celular.

| Modelo | Licença | Campos certos | Risco certo | Tempo por relato |
|---|---|---|---|---|
| **Llama 3.2 3B Instruct (Q4_K_M)** | Llama 3.2 Community License | **20/24 (83%)** | 2/3 | 24 s |
| Llama 3.2 1B Instruct (Q4_K_M) | Llama 3.2 Community License | 7/24 (29%) | 1/3 | 14 s |
| SmolLM3 3B (Q4_K_M) | Apache 2.0 | 10/24 (42%), JSON inválido em 1 relato | 0/3 | 39 s |
| Qwen2.5 1.5B Instruct (Q4_K_M) | Apache 2.0 | 1/24 (4%), JSON inválido em 2 relatos | 1/3 | 22 s |

O Llama 3.2 3B virou o modelo do Android para celulares com 6 GB de RAM ou mais. O único erro de risco foi um alerta a mais (tentativa de sair de casa); o detector por palavras-chave do backend continua cobrindo quedas e engasgos independente do modelo. Abaixo de 3B, os modelos erram demais para valer a pena: nesses aparelhos, a nuvem. Uma primeira versão do script tratava campos opcionais como opcionais no JSON Schema e o llama.cpp deixava o modelo pular as horas de sono; corrigido para o mesmo esquema do app.

A transcrição no Android usa o Whisper `small`. Com voz natural, transcreve quase sem erro; com a voz sintética mais robótica do macOS, falha. O `large-v3-turbo` acerta, mas tem 574 MB e é três vezes mais lento.

## Limitações e próximos passos

- **Tamanho.** Três relatos provam o fluxo, não a robustez. A meta da semana 1 é chegar a 30, com sotaques regionais, ruído de fundo, falas longas e relatos confusos.
- **Vozes sintéticas.** Os áudios de exemplo foram gerados por TTS e são mais limpos que um áudio real gravado na cozinha. Vamos incluir gravações de voluntários lendo relatos fictícios.
- **Avaliação humana.** Para o resumo, além das regras automáticas, vamos pedir a familiares e profissionais que avaliem clareza, utilidade e tom numa escala simples.
- **Regressão.** Toda nova versão de prompt roda o conjunto inteiro e o resultado entra nesta página.
