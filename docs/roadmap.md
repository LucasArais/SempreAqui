# Roadmap

Trabalhamos em ciclos curtos. Cada ciclo entrega uma funcionalidade de ponta a ponta, que roda no celular, nunca várias pela metade. A ordem foi pensada para que, a qualquer momento, o app já conte uma história completa no demo. Os ciclos 1 a 4 são obrigatórios para o Demo Day.

Personas que guiam cada decisão: **Cláudia**, 52 anos, cuida da mãe e abre o app às 23h, cansada, com uma mão. **Rafael**, 28 anos, irmão em Recife, quer saber como a mãe está sem precisar ligar. **Dona Isabel**, 81 anos, vive com Alzheimer e vê o app nas sessões de reminiscência.

## Fase 0: inscrição (concluída, 12/11/2026)

- [x] Repositório público, licença MIT, documentação, guardrails com avaliação
- [x] Prova de conceito do Diário, app navegável, schema com RLS, CI
- [x] Redesign no estilo dos apps da Apple, modo escuro e Dynamic Type

## Ciclo 1: Diário Inteligente redondo (concluído)

**Pronto quando:** a Cláudia grava, vê o resultado organizado e corrige algo errado em menos de 1 minuto.

- [x] Gravação real com onda, pausa e retomada, descarte com Desfazer
- [x] Salvamento offline e envio automático, sem duplicar
- [x] Resultado em cards, cada campo editável com um toque
- [x] Ver o que foi dito: player do áudio e transcrição
- [x] Histórico em linha do tempo
- [x] Correções alimentam a IA no relato seguinte
- [x] Benchmark de transcrição e troca do modelo padrão
- [x] Métricas anônimas e taxa de correção
- [x] Seed da família de demonstração
- [ ] Rodar as avaliações completas do Diário com o modelo novo (aguarda saldo no OpenRouter)
- [ ] Banco no Supabase com login anônimo (aguarda senha do banco e login anônimo ligado)

## Ciclo 2: Resumo da semana e mudanças de padrão

**Pronto quando:** o Rafael abre o app e entende como a mãe passou a semana em 30 segundos.

- [ ] Linha de base por pessoa a partir dos diários
- [ ] Detecção de mudanças relevantes (por exemplo, três noites seguidas dormindo mal), em linguagem calma e sem interpretação clínica
- [ ] Resumo semanal em linguagem humana para a família
- [ ] Lista "Para levar na consulta" exportável em PDF de uma página
- [ ] Tela Hoje pensada também para quem mora longe

## Ciclo 3: Passaporte de Memória

**Pronto quando:** a família monta um passaporte útil em 15 minutos só falando.

- [ ] Memórias por áudio, foto ou texto, em qualquer ordem
- [ ] IA organiza nas seções e mostra o que falta, com perguntas sugeridas
- [ ] Link somente leitura e PDF para cuidador ou hospital

## Ciclo 4: Conversas de Reminiscência

**Pronto quando:** uma sessão de 5 minutos roda do início ao fim sem a cuidadora precisar pensar no que dizer.

- [ ] Sessões geradas a partir do Passaporte: foto, pergunta gentil, música opcional
- [ ] Modo de exibição para a pessoa: tela cheia, fonte enorme, um elemento por vez
- [ ] Reação marcada depois (sorriu, conversou, indiferente, agitada) e usada para escolher as próximas
- [ ] Regras de prompt e evals: nunca "você lembra?"

## Ciclo 5: Apoio na Hora Difícil

**Pronto quando:** as evals mostram 100% de recusa correta em perguntas médicas e toda resposta geral tem fonte.

- [ ] Entrada por voz
- [ ] Agente que cruza Passaporte e Diário e explica de onde veio cada sugestão
- [ ] RAG sobre fontes oficiais com link visível
- [ ] Risco: 192 e aviso à família
- [ ] Recusa gentil para diagnóstico e dose, coberta por evals

## Ciclo 6: Rede da Família

**Pronto quando:** o Rafael assume uma tarefa da semana em 3 toques.

- [ ] Convite por link no WhatsApp
- [ ] Papéis, tarefas divididas e lembretes
- [ ] Feed com resumos e "obrigado", para quem cuida se sentir vista

## Ciclo 7: Polimento para o Demo Day

- [ ] Revisão completa de acessibilidade (VoiceOver, TalkBack, fonte máxima, contraste)
- [ ] Nenhuma tela leva mais de 1 segundo para abrir
- [ ] Deploy do backend e build instalável do app
- [ ] Roteiro de demo de 3 a 5 minutos e slide com os números das evals e dos testes com usuários

## Em paralelo, o tempo todo

- Testes com cuidadores conduzidos pelo Laércio ([roteiro](testes-usuarios/roteiro.md)), virando melhorias priorizadas a cada rodada.
- Métricas anônimas de uso ([metricas.md](metricas.md)).
