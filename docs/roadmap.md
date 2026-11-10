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
- [x] Avaliação do Diário no modo texto: campos 100%, risco 3/3, zero violações
- [ ] Avaliação do Diário com áudio (aguarda saldo no OpenRouter)
- [x] Banco no Supabase com RLS e login anônimo no app
- [x] Exportar e apagar todos os dados da família (LGPD)

## Ciclo 2: Resumo da semana e mudanças de padrão (construído)

**Pronto quando:** o Rafael abre o app e entende como a mãe passou a semana em 30 segundos.

- [x] Linha de base por pessoa a partir dos diários (quatro semanas anteriores)
- [x] Detecção de mudanças relevantes por regras explícitas, em linguagem calma e sem interpretação clínica
- [x] Resumo semanal em linguagem humana para a família, com guardrails e resumo seguro
- [x] Lista "Para levar na consulta" exportável em PDF de uma página
- [x] Tela Hoje mostra a semana primeiro para quem mora longe
- [ ] Testar com o Rafael de verdade: entende a semana em 30 segundos?

## Ciclo 3: Passaporte de Memória (construído)

**Pronto quando:** a família monta um passaporte útil em 15 minutos só falando.

- [x] Passaporte editável por seção: adicionar, editar e apagar com Desfazer
- [x] PDF de uma página para cuidador ou hospital, com o que a família preencheu
- [x] Memórias por voz, texto e foto (galeria ou câmera), com fotos no armazenamento privado da família
- [x] IA separa o que a família contou nas seções; a família marca o que entra. No iPhone, no próprio aparelho
- [x] "Falta pouco": seções vazias com perguntas para responder falando
- [x] Link somente leitura, sem o Diário, que a família liga e desliga
- [ ] Medir com uma família de verdade: passaporte útil em 15 minutos só falando

## Ciclo 4: Conversas de Reminiscência (construído)

**Pronto quando:** uma sessão de 5 minutos roda do início ao fim sem a cuidadora precisar pensar no que dizer.

- [x] Conversa do dia a partir do Passaporte: tema, foto, perguntas gentis e música, mudando todo dia
- [x] Reação e anotação guardadas, pesando na escolha dos próximos temas
- [x] Perguntas personalizadas pela IA do celular, a partir dos roteiros revisados, validadas antes de aparecer
- [x] Modo de exibição para a pessoa: tela cheia, fonte enorme, um elemento por vez
- [x] Teste automático: nenhum roteiro testa a memória nem viola os guardrails
- [x] Validação das perguntas da IA ("lembra", "recorda", "esqueceu" e guardrails) checada no CI
- [ ] Testar uma sessão de 5 minutos com quem cuida de verdade

## Ciclo 5: Apoio na Hora Difícil (construído)

**Pronto quando:** as evals mostram 100% de recusa correta em perguntas médicas e toda resposta geral tem fonte.

- [x] Entrada por voz, transcrita no celular quando dá
- [x] Agente que cruza Passaporte e Diário e explica de onde veio cada sugestão (com as datas do Diário)
- [x] Busca em acervo de trechos oficiais literais (Guia Prático do Cuidador, Ministério da Saúde) com link para a página
- [x] Risco: 192 primeiro e aviso à família no app e no WhatsApp
- [x] Recusa gentil para diagnóstico, remédio e dose, sem deixar a pessoa sem apoio prático
- [x] Evals: 20/20 recusas médicas, 9/9 riscos, 14/14 situações, 44/44 respostas com fonte, zero violações (no CI pelo pytest)
- [ ] Ampliar o acervo com outras fontes oficiais (ABRAz, Relatório Nacional sobre a Demência)

## Ciclo 6: Rede da Família (construído)

**Pronto quando:** o Rafael assume uma tarefa da semana em 3 toques.

- [x] Convite por código e link no WhatsApp, válido por 7 dias
- [x] Papéis (quem cuida, familiar, cuidador profissional) e nome de cada um
- [x] Tarefas divididas: "Eu assumo" em um toque na tela Hoje, lembrete no celular de quem assumiu
- [x] Feed com resumos, conversas, tarefas feitas, avisos e "obrigado"
- [ ] Notificação no celular dos outros quando chega um aviso (precisa do backend publicado, Ciclo 7)
- [ ] Testar com o Rafael de verdade: assume uma tarefa em 3 toques?

## Ciclo 7: Polimento para o Demo Day

- [x] Navegação mais simples: Hoje em ordem de urgência, atalho para ajuda, listas longas recolhidas

- [ ] Revisão completa de acessibilidade (VoiceOver, TalkBack, fonte máxima, contraste)
- [ ] Nenhuma tela leva mais de 1 segundo para abrir
- [ ] Deploy do backend e build instalável do app
- [ ] Roteiro de demo de 3 a 5 minutos e slide com os números das evals e dos testes com usuários

## IA no próprio celular (construído no iPhone)

**Pronto quando:** um relato é transcrito e organizado no iPhone, sem internet, passando nas mesmas avaliações do Diário (risco 3/3, zero violações).

- [x] Transcrição no aparelho com o reconhecimento de fala do iOS 26
- [x] Registro organizado pelo modelo local da Apple, com saída presa ao schema
- [x] Guardrails determinísticos também no app, iguais aos do backend nos 53 casos adversariais
- [x] Sincroniza só o resultado; o áudio fica no celular; o backend confere de novo
- [x] Nuvem como reserva para aparelhos sem suporte ou se a IA local falhar
- [x] Chave para ligar e desligar em Privacidade e dados
- [ ] Medir no aparelho com o conjunto de avaliação do Diário: qualidade, tempo e bateria
- [x] Regra fixa para o campo de remédios quando o relato não fala de remédio
- [ ] Android, passo 1: transcrição com o SpeechRecognizer no aparelho
- [ ] Android, passo 2: Gemini Nano pelo ML Kit nos aparelhos com suporte
- [ ] Android, passo 3: modelo aberto pequeno via llama.cpp com gramática JSON, baixado pelo Wi-Fi com consentimento

Detalhes em [ia-no-aparelho.md](ia-no-aparelho.md).

## Em paralelo, o tempo todo

- Testes com cuidadores conduzidos pelo Laércio ([roteiro](testes-usuarios/roteiro.md)), virando melhorias priorizadas a cada rodada.
- Métricas anônimas de uso ([metricas.md](metricas.md)).
