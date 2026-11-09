# Changelog

O que mudou em cada ciclo, do mais recente para o mais antigo.

## Ciclo 1: Diário Inteligente redondo (novembro de 2026)

**Para quem cuida**
- Gravar o dia de verdade: onda que acompanha a voz, pausar e continuar, concluir, e descartar com Desfazer.
- Funciona sem internet: o áudio fica no celular e é enviado sozinho quando a conexão volta.
- Progresso em linguagem humana enquanto a IA trabalha ("Ouvindo o que você contou...").
- Cada campo do resultado (sono, alimentação, humor, agitação, remédios, cansaço) é corrigido com um toque, com Desfazer.
- "Ver o que foi dito": ouvir o áudio e ler a transcrição.
- Diário em linha do tempo, com o detalhe de cada relato.
- Microfone no cabeçalho de todas as abas: gravar está sempre a 2 toques.
- Primeira abertura: 3 telas e já o primeiro relato. Termo de consentimento em linguagem simples.

**IA**
- Provedor OpenRouter com exigência de provedores que não guardam dados.
- Benchmark de transcrição: o modelo padrão anterior perdia a queda do relato de risco. Novo padrão: `gemini-3-flash-preview`, 3,4% de erro de palavras.
- As correções da família entram no prompt de extração seguinte (`extracao.v2`).
- Corrigido: o áudio m4a do celular chegava vazio ao modelo.

**Bastidores**
- Relatos, correções e métricas guardados no backend, com isolamento por família e reenvio sem duplicar.
- Métricas anônimas e taxa de correção em `/metricas`.
- Seed da família de demonstração: `uv run python -m demo.seed`.
- Proteção contra vazamento de chaves: hook de pre-commit e gitleaks no CI.
- Personas oficiais: Cláudia, Rafael e Dona Isabel.

## Redesign (novembro de 2026)

- Visual no estilo dos apps da Apple: tokens de cor, tipografia e espaço, componentes reutilizáveis, tab bar nativa, modo escuro e Dynamic Type.

## Fase 0: inscrição (novembro de 2026)

- Documentação, prova de conceito do Diário, guardrails com avaliação, app navegável e schema com RLS.
