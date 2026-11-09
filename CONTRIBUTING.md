# Como contribuir com o SempreAqui

Obrigado pelo interesse. O SempreAqui é um projeto aberto e independente, feito para famílias que cuidam de alguém que vive com Alzheimer. Toda ajuda conta: código, revisão de texto, design, testes com famílias, indicação de fontes oficiais.

## Antes de começar

1. Leia o [Código de Conduta](CODE_OF_CONDUCT.md).
2. Leia [docs/etica-e-seguranca.md](docs/etica-e-seguranca.md). Ele define o que a IA faz e o que ela nunca faz. Nenhuma contribuição pode contrariar esse documento.
3. Procure uma issue aberta ou abra uma nova descrevendo o que você quer fazer. Para mudanças grandes, converse antes de programar.

## Regras do projeto

- **A IA não diagnostica e não dá orientação médica.** Ela organiza, resume, identifica mudanças de padrão e encaminha. Qualquer informação de saúde precisa vir de fonte oficial com link visível.
- **Nada de dado real.** Nunca use áudios, fotos, nomes ou relatos de pessoas reais em testes, exemplos, issues ou logs. Use apenas os dados fictícios do repositório ou crie novos, também fictícios.
- **Linguagem respeitosa.** Na interface e nos textos para a família, use "pessoa que vive com Alzheimer", "quem cuida", "família". Não use "paciente", "fardo" ou "peso".
- **Português do Brasil** em toda a interface e documentação.
- **Sem travessão.** Não use o caractere de travessão (em dash) em nenhum texto. Use vírgula ou ponto. O CI verifica isso.
- **Segredos só em `.env`.** Nunca versione chaves. Se adicionar uma variável nova, inclua no `.env.example`.
- **Acessibilidade primeiro.** Fonte grande, alto contraste, botões grandes e voz como entrada principal.

## Ambiente de desenvolvimento

```bash
cp .env.example .env          # preencha GEMINI_API_KEY
docker compose up -d db       # Postgres com pgvector

# Backend
cd backend
uv sync
uv run pytest
uv run ruff check .

# App
cd app
npm install
npx expo start
```

## Fluxo de trabalho

1. Crie um branch a partir de `main`: `feat/diario-linha-de-base`, `fix/texto-resumo`, `docs/avaliacao`.
2. Faça commits pequenos e descritivos, em português, no formato `tipo(escopo): descrição`. Exemplos: `feat(diario): detecta mudança no padrão de sono`, `docs(readme): atualiza roadmap`.
3. Se mexer em prompt, crie uma nova versão do arquivo em `backend/prompts/` em vez de sobrescrever, e rode as avaliações (`docs/avaliacao.md`). Inclua os números antes e depois no pull request.
4. Abra o pull request explicando o que mudou, por quê, e como testar.

## Mudanças em prompts e na IA

Prompts são código. Toda mudança precisa:

- passar nos testes de guardrail (`backend/tests/test_guardrails.py`);
- não piorar as métricas do conjunto de avaliação;
- manter a citação de fonte em qualquer resposta com informação de saúde.

## Dúvidas

Abra uma issue com a etiqueta `pergunta`.
