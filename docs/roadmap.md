# Roadmap

O critério para priorizar é simples: o que faz uma família real cuidar menos sozinha já na semana seguinte. Cada semana termina com algo que roda no celular e com números de avaliação atualizados.

## Fase 0: inscrição (até 12/11/2026)

- [x] Repositório público com licença MIT, guia de contribuição e código de conduta
- [x] Documentação: problema, arquitetura, ética e segurança, ODS, avaliação
- [x] Prova de conceito do Diário: áudio para transcrição, JSON validado e resumo para a família
- [x] Grafo LangGraph do Diário com guardrails e resumo seguro
- [x] Conjunto de avaliação de guardrails e gabarito do Diário
- [x] App Expo com as telas navegáveis e dados fictícios
- [x] Schema do banco com Row Level Security por grupo familiar
- [x] CI com testes, lint e verificação de linguagem

## Antes da aceleração

- [ ] Rodar as avaliações do Diário com o modelo e publicar os números em `docs/avaliacao.md`
- [ ] Gravação real de áudio no app enviando para `POST /diario/relatos`
- [ ] Deploy da API para o demo
- [ ] Conversar com 5 famílias e 2 profissionais de saúde para validar as telas

## Semana 1 da aceleração: Diário e Passaporte

- [ ] Diário ponta a ponta no celular, com correção manual dos campos
- [ ] Linha de base por pessoa e detecção de mudança de padrão (sono, alimentação, agitação, medicação)
- [ ] Grafo do Passaporte de Memória: áudios, fotos e textos da família viram o perfil estruturado
- [ ] Ampliar o gabarito do Diário para 30 relatos, com variação de sotaque e ruído

## Semana 2: Reminiscência e Apoio

- [ ] Grafo de Reminiscência: sessões de 5 a 10 minutos a partir do Passaporte, aprendendo com as reações
- [ ] RAG de fontes oficiais com pgvector e citação obrigatória de link
- [ ] Grafo de Apoio na Hora Difícil: cruza Passaporte e Diário para sugerir o que já funcionou, 192 em risco
- [ ] Avaliação do Apoio: fidelidade às fontes e presença do link em 100% das respostas de saúde

## Semana 3: Rede da Família e Demo Day

- [ ] Grupo familiar com papéis, convites e divisão de tarefas (consultas, visitas, cobrir folga)
- [ ] Feed com o resumo semanal e a lista "Para levar na consulta"
- [ ] Link somente leitura e PDF de uma página do Passaporte
- [ ] Exportar e apagar todos os dados
- [ ] Teste com famílias reais (com consentimento) e roteiro do demo ao vivo

## Depois do Demo Day

- Parceria com associações de familiares e serviços de atenção primária para pilotos.
- Modo offline para regiões com internet instável.
- Suporte a outras línguas faladas no Brasil e a cuidadores com baixa alfabetização, com mais voz e menos texto.
- Avaliação de impacto: horas de cuidado divididas na família e bem-estar de quem cuida.
