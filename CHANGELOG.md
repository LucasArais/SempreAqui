# Changelog

O que mudou em cada ciclo, do mais recente para o mais antigo.




## IA no próprio celular também no Android (novembro de 2026)

- O relato é transcrito e organizado no Android, sem a nuvem: Whisper `small` para a fala e Qwen2.5 1.5B para organizar, com saída presa ao formato do registro.
- Os modelos (1,2 GB) são baixados uma vez em Privacidade e dados, com consentimento, progresso e retomada; versão fixa e tamanho conferido. Dá para apagar.
- "Testar a IA do celular": roda um relato de exemplo pelo caminho inteiro, sem internet, e mostra o resultado e o tempo. Também no iPhone.
- Proteções novas contra erros de modelos pequenos, no app e no backend: alerta negado ("Não há sinais de alerta") não vira alerta; resumo que copia o relato é refeito; abertura "Aqui está um resumo" é removida; sem nada concreto registrado, entra o resumo seguro.
- Corrigido: o simulador do iOS não abria (o pacote do Android puxava o módulo `buffer` do Node). Agora o código do Android só é empacotado no Android.

## Servidor público pelo Cloudflare Tunnel (novembro de 2026)

- O app passa a falar com o backend por HTTPS, de qualquer rede, através de um Cloudflare Tunnel. Detalhes e próximos passos em `docs/deploy.md`.
- Proteções para o servidor público: documentação da API desligada, `/metricas` com login, limite de uso por pessoa nas rotas que gastam IA ou consultam serviços de fora.
- Contas novas criam a própria família; testadores entram por convite.

## Integração com o SUS (novembro de 2026)

**Para a família**
- Cartão SUS e UBS de referência no Passaporte, com o número conferido pelo dígito verificador oficial. Vão para o PDF do passaporte e da consulta; nunca para o link compartilhado.
- Tela "SUS": o Cartão SUS dela, os programas do SUS para o Alzheimer (remédios de graça pelo Componente Especializado, protocolo oficial de tratamento, Melhor em Casa, Brasil que Cuida), Meu SUS Digital (cartão digital, vacinação e exames), Farmácia Popular, vacinação, Ouvidoria e telefones 192, 136 e 100. Todos os links conferidos no ar.
- "Perto de você": hospitais, UPAs, pronto-socorros, UBS e CAPS mais próximos, do cadastro oficial do SUS (CNES), num mapa e numa lista com distância, 24 horas, "Atende pelo SUS", rota no Mapas e telefone. Em emergência, o que é do SUS e funciona 24 horas vem antes.
- Atalhos: "Hospitais e UPAs perto de você" no Hoje; "Hospitais e UPAs perto" na resposta de risco do Ajudante; o Ajudante responde "qual o cartão SUS dela?" e "tem hospital perto?".

**Bastidores**
- `core/sus.py`: validação do CNS, código do município pelo IBGE e unidades pela API de dados abertos do Ministério da Saúde, com cache de 7 dias por cidade e tipo. Só UBS públicas que atendem pelo SUS entram como UBS (clínicas particulares às vezes usam o mesmo tipo no cadastro).
- Rota `GET /sus/unidades`. A localização vem do celular só para a distância e não é guardada.
- `expo-location` e `expo-maps` (Apple Maps nativo) no app.

## Cadastro com botão azul (10 de novembro de 2026)

- As ações Criar nova conta e Criar conta usam azul, com contraste validado nos temas claro e escuro.

## Cadastro pelo app (10 de novembro de 2026)

- Botão Criar nova conta na entrada; cadastro com nome, e-mail, senha, requisitos visíveis e aceite dos termos.
- Termos e privacidade acessíveis antes de entrar. Validação no app e no servidor, erro de e-mail duplicado e proteção contra envio repetido.
- Cadastro administrativo no Supabase sem confirmação de e-mail, seguido de login e onboarding. Nome e aceite versionado registrados.
- Testes de cadastro, validação, duplicidade e limite de tentativas.

## Carregamento com feedback e nova tentativa (10 de novembro de 2026)

- Informações da família carregam em paralelo, sem esperar a checagem da IA local ou a personalização da conversa.
- Indicador de atualização e skeletons em Hoje, Memórias e Família; falhas oferecem “Tentar de novo” e mantêm o conteúdo disponível.
- Atualização ao voltar para o app ou recuperar a conexão; puxar Hoje atualiza todas as informações.
- Consultas têm limite de espera, evitando carregamento sem fim. A restauração da sessão mostra progresso e permite tentar novamente.
- Testes de concorrência, falha parcial, nova tentativa, logout e timeout.

## Login básico por e-mail e senha (10 de novembro de 2026)

- Tela Entrar no estilo atual, com validação, mostrar/ocultar senha, preenchimento automático e haptics.
- Autenticação pelo Supabase existente; rotas internas protegidas e saída com confirmação nos Ajustes.
- Sessão no SecureStore no celular, caches e filas separados por conta. Cadastro e recuperação continuam pendentes.
- Testes automatizados de restauração, credenciais e saída.

## Tarefas mais claras (novembro de 2026)

- A tarefa assumida fica ligada à conta de quem assumiu, não só ao nome: aparece "Com você" e continua sua se você mudar de nome.
- Botões à vista na linha: "Eu assumo" quando está livre, "Concluir" quando é sua.
- Tarefa de outra pessoa: um toque abre "Marcar como feita" ou "Assumir no meu lugar". O feed registra quem marcou ("Ligar para a Dona Isabel (de Rafael)").
- "Não vou conseguir": a tarefa volta a ficar livre para a família e o lembrete é cancelado.
- Migração `004_tarefa_ligada_a_conta.sql`.

## README com as telas atuais (novembro de 2026)

- 20 prints novos das telas como estão hoje, no README em destaque e numa galeria "O app, tela por tela". Saíram as capturas antigas e as do modo escuro, que o app não usa mais.
- README atualizado: funções, princípios, arquitetura com os agentes atuais (Diário, Passaporte, Conversa do dia, Ajudante e Apoio, Rede da Família), stack, como rodar a IA no aparelho e a avaliação do Apoio.
- Corrigido: na conversa do dia, nomes próprios não viram mais minúscula ("Roberto Carlos").

## Tela Hoje reorganizada (novembro de 2026)

- Resumo da semana no Hoje fechado em duas linhas, com quantas mudanças houve; abre ali mesmo com um toque.
- O mesmo visual em todas as telas: "Adicionar", "Ver tudo", "Convidar", "Trocar foto" e "Salvar PDF" no título das seções; ações principais em pílulas lado a lado; ações de lista (baixar cópia, apagar) como linhas, sem botões soltos.
- Memórias: "Contar memória" e "Enviar PDF" lado a lado; "Falta pouco" numa linha; seções com "Adicionar" no título; PDF e link juntos em "Compartilhar".
- Família: tarefas com "Pedir ajuda" no título, feed com "Ver tudo", "Convidar" no título de quem cuida; atalhos que já existem em Hoje e Ajustes saíram daqui.

- Ação principal no topo: contar o dia. Logo abaixo, "Pedir ajuda" e "192" lado a lado, no lugar de duas faixas inteiras.
- "Para hoje" junta numa lista só a conversa do dia (com miniatura da foto, ou "feita" com a reação) e as tarefas com "Eu assumo".
- Último relato e semana viram cartões que abrem o detalhe com um toque, com "Ver todos" e "Ver detalhes" no título da seção, no lugar de botões soltos.
- Avisos e o pedido de nome continuam no topo, só quando existem. Para quem mora longe, a semana vem primeiro.

## Ajudante e Ajustes (novembro de 2026)

**Para a família**
- Ajudante: a aba Ajuda virou um chat. Dá para perguntar "como ela está?", "como foi a semana?", "ela tem dormido bem?", "o que falta fazer?", "do que ela gosta?". Cada resposta diz de onde veio (Diário, semana, tarefas, Passaporte).
- Na hora difícil, o Ajudante responde com o Apoio completo: 192 e aviso à família no risco, recusa gentil para remédio e diagnóstico, o que costuma funcionar e a fonte oficial.
- Pergunta por voz. O campo fica fixo embaixo, como num app de mensagens, e sobe com o teclado. A conversa fica só no celular e dá para apagar.
- Ajustes, a 5ª aba, ao lado das outras: seu nome e papel, trocar a foto da família, dados dela, convite, IA no celular, privacidade, termo, fonte oficial e código aberto.

- Cada pessoa da família pode pôr a própria foto (Ajustes, em "Mudar nome, foto ou papel"). Ela aparece na lista da família e no feed.
- 192: na tela Hoje, logo abaixo de "Precisa de ajuda agora?", e como botão pequeno no cabeçalho do Ajudante. No chat, o botão grande só aparece quando a pergunta indica risco.

**Bastidores**
- `core/assistente.py` e rota `POST /assistente`: intenções reconhecidas por regras e respondidas com os dados da família, sem IA e sem custo. O que não reconhece volta com um contexto curto e verdadeiro; no iPhone com IA no aparelho, o modelo da Apple tenta responder só com esse contexto, e a resposta passa pelos guardrails.
- Campo `foto_familia` no Passaporte.

## Ciclos 5 e 6 e navegação mais simples (novembro de 2026)

**Apoio na Hora Difícil**
- Quem cuida conta a situação falando ou escrevendo e recebe o que costuma funcionar com ela, cada sugestão com a origem: o Passaporte ou o Diário, com as datas em que ajudou.
- Orientação geral com trechos literais do Guia Prático do Cuidador, do Ministério da Saúde, e link para a página citada.
- Risco: 192 primeiro e "Avisar a família agora", que aparece no topo do app de todos e abre o WhatsApp.
- Pergunta sobre remédio, dose ou diagnóstico: recusa gentil, encaminhamento à equipe de saúde e, mesmo assim, o apoio prático do dia a dia.
- Cansaço de quem cuida: atalho para pedir uma folga à família.

**Rede da Família**
- Convite pelo WhatsApp com código de 8 letras, válido por 7 dias. Quem recebe entra com o código ou tocando no link.
- Tarefas da semana: "Eu assumo" com um toque, também na tela Hoje. Quem assume recebe um lembrete no celular.
- Feed "O que aconteceu": resumos enviados, conversas do dia, tarefas assumidas e feitas, avisos. Cada item tem "Obrigado".
- Cada pessoa diz seu nome e papel, para todos saberem quem fez o quê.

**Navegação**
- Tela Hoje em ordem de urgência: aviso, gravar, "Precisa de ajuda agora?", conversa do dia, tarefas, último relato e semana. Para quem mora longe, a semana vem primeiro.
- Listas longas do Passaporte e do feed mostram poucos itens e "Ver mais".
- "Ver este relato" e "Ver todos os relatos" no lugar de um botão ambíguo.

**Bastidores**
- `core/apoio.py` e `core/fontes.py`, rotas `/apoio` e `/apoio/transcrever`.
- Migração `002_rede_da_familia.sql`: convites, feed e tarefas com responsável por nome. Rotas `/familia`, `/familia/convites`, `/familia/entrar`, `/tarefas`, `/feed`, `/feed/obrigado`, `/familia/avisos`.
- Tarefas de exemplo no seed da família de demonstração.
- Corrigido: criar o link do passaporte não apaga mais o passaporte da família.

## Ciclos 3 e 4 completos (novembro de 2026)

**Para a família**
- Contar uma memória falando ou escrevendo: a IA separa nas seções do Passaporte e a família marca o que entra. No iPhone com IA no aparelho, o que foi contado não sai do celular.
- Fotos da galeria ou da câmera nas lembranças, nas pessoas importantes e no retrato dela. Também vão para o PDF.
- "Falta pouco": as seções vazias aparecem com perguntas para responder por voz.
- Link somente leitura do passaporte para cuidador, centro-dia ou hospital. Nunca inclui o Diário; a família desliga quando quiser.
- Na conversa de hoje, a IA do celular reescreve as perguntas pensando nela. Cada pergunta passa por uma validação: nada de "lembra", "recorda" ou "esqueceu". Se falhar, ficam as perguntas revisadas.

**Bastidores**
- Rotas `POST /passaporte/fotos`, `GET /passaporte/fotos/{chave}`, `POST /passaporte/organizar`, `GET/POST/DELETE /passaporte/link` e a página pública `GET /p/{token}`.
- Fotos num bucket privado `fotos` do Supabase, por grupo, apagadas junto com a família.
- Página pública sem JavaScript, com texto escapado, `no-store`, `noindex` e só as fotos que estão no passaporte.
- Módulo nativo: `gerarMemoria` e `gerarPerguntas` com geração guiada.
- Testes: fotos isoladas por família, link desligado devolve 404, HTML escapado, sugestões filtradas pelos guardrails.

## Passaporte editável e Conversa de hoje (novembro de 2026)

**Para a família**
- Passaporte de Memória editável: quem ela é, como se comunica, pessoas importantes, rotina, o que acalma, o que agita, músicas (com link do YouTube), comidas e lembranças. Adicionar, editar e apagar com um toque, com Desfazer.
- O PDF do passaporte sai com o que a família preencheu.
- Conversa de hoje muda todo dia: o tema vem do Passaporte e as perguntas, de roteiros revisados que nunca testam a memória.
- "Outro tema hoje" troca a conversa na hora.
- No fim, a reação e uma anotação opcional ficam guardadas. "Gostou muito" traz o tema de volta mais vezes; "ficou desconfortável" tira o tema da roda por 3 semanas. Sem internet, a reação espera e vai depois.

**Bastidores**
- Rotas `GET/PUT /passaporte`, `GET /conversa/hoje`, `POST /conversas` e `GET /conversas`, no SQLite e no Supabase. O passaporte passa pelos guardrails de linguagem.
- `core/reminiscencia.py`: escolha de tema e de roteiro determinística por dia e família, sem IA e sem custo, com testes.
- IA do celular: regra fixa para o campo de remédios quando o relato não fala de remédio.
- Documentação da IA no aparelho para iOS e Android em `docs/ia-no-aparelho.md`.

## IA no próprio celular (novembro de 2026)

**Para a família**
- No iPhone com Apple Intelligence, o relato é transcrito e organizado no próprio celular. O áudio não sai do aparelho e o resultado aparece mesmo sem internet.
- O relato mostra "Organizado aqui no seu celular. O áudio não saiu dele."
- Chave para ligar ou desligar em Privacidade e dados, com a explicação quando o celular não tem suporte.
- Relato organizado sem internet pode ser enviado à família depois: vai sozinho quando a conexão volta.

**Bastidores**
- Módulo nativo `ia-local` (Swift): SpeechAnalyzer para a fala e Foundation Models com geração guiada pelo schema do Diário.
- Guardrails em TypeScript, espelho dos do backend, checados contra os mesmos 53 casos no CI.
- Rotas `POST /diario/relatos/do-aparelho`, `PUT /diario/relatos/{id}/resumo` e `GET /diario/correcoes`. O backend reaplica os guardrails e recalcula o risco.
- Correção num relato do celular não chama a IA da nuvem.

## Ciclo 2: Resumo da semana, login e LGPD (novembro de 2026)

**Para a família**
- Tela "Esta semana" com dados reais: resumo em linguagem humana, o que mudou em relação ao habitual, sono dia a dia e lista para a consulta.
- Mudanças de padrão detectadas por regras explícitas sobre a linha de base da própria pessoa: noites ruins seguidas, mais despertares que o habitual, remédios incompletos, agitação, situações de risco e cansaço de quem cuida.
- "Para levar na consulta" em PDF de uma página, para imprimir ou enviar.
- Quem mora longe vê a semana primeiro na tela Hoje.
- Privacidade e dados: baixar uma cópia de tudo (dados e áudios) e apagar tudo.

**Bastidores**
- Login anônimo do Supabase no app; a família vem do login, validado no backend.
- Consentimento registrado por finalidade e versão do termo.
- Seed com quatro semanas de histórico para a linha de base.
- Avaliação do Diário no modo texto com o modelo novo.
- Corrigido: a fila offline guardava caminhos absolutos que mudam entre execuções.

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
