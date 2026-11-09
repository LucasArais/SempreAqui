# Demo do Ciclo 2: a semana em 30 segundos (1 minuto)

**Antes:** backend rodando e `uv run python -m demo.seed` executado (quatro semanas de histórico).

| Tempo | O que fazer | O que dizer |
|---|---|---|
| 0:00 | Tela Hoje, cartão "Esta semana" | "O Rafael mora em Recife. Ele abre o app no intervalo do trabalho e quer saber uma coisa: como a mãe passou a semana." |
| 0:10 | Toca em "Ver a semana" | "Um resumo em linguagem de família, escrito pela IA a partir dos relatos da Cláudia." |
| 0:20 | Mostra "O que mudou" | "Aqui não tem IA adivinhando. São regras comparando com o habitual da própria Dona Isabel: três noites ruins seguidas, mais despertares, remédio recusado em dois dias. Calmo, sem diagnóstico." |
| 0:35 | Gráfico de sono | "Os dias sem relato aparecem tracejados: a gente não inventa dado." |
| 0:42 | Toca em "Salvar PDF para a consulta" | "Uma página com fatos para a equipe de saúde. Quem interpreta é o médico." |
| 0:52 | Família, Privacidade e dados | "E os dados são da família: baixa tudo ou apaga tudo, com um toque." |

**Se perguntarem**
- *Por que não usar IA para detectar as mudanças?* Porque um alerta inventado assusta a família. Regras explícitas são auditáveis e testadas; a IA só escreve o texto, com guardrails.
- *E sem histórico?* Com menos de cinco dias anteriores, o app não compara com o habitual e avisa isso na tela.
