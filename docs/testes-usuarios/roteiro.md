# Roteiro de teste com quem cuida

Duração: 20 minutos. Uma pessoa por vez. Quem conduz: Laércio.

## Antes de começar (3 min)

**Preparação**
- Celular com o SempreAqui aberto na família de demonstração (Dona Isabel). Rode `uv run python -m demo.seed` no backend antes de cada sessão, para começar sempre igual.
- Cronômetro no seu celular e o [modelo de registro](registro.md) aberto.
- Peça autorização para anotar e, se a pessoa quiser, para usar uma frase dela (sem nome) no Demo Day.

**O que dizer**

> Obrigado por vir. Estamos testando o aplicativo, não você. Se algo for difícil, a culpa é nossa, e é exatamente isso que queremos descobrir. Pense em voz alta enquanto usa: o que você espera que aconteça, o que te confunde. Não vou ajudar durante as tarefas, mas no fim conversamos sobre tudo.

> Imagine que você cuida da Dona Isabel, 81 anos, que vive com Alzheimer. Use o app como se fosse no fim de um dia comum.

**Perguntas antes**
1. Você cuida ou já cuidou de alguém? Há quanto tempo? Mora junto?
2. Como você conta para a família como foi o dia hoje? (WhatsApp, ligação, não conta)
3. Você usa áudio no WhatsApp? Com que frequência?
4. Numa escala de 1 a 5, quanto você se sente sozinha ou sozinho no cuidado?

## As 5 tarefas (12 min)

Leia a tarefa, entregue o celular e não ajude. Cronometre do momento em que a pessoa toca no celular até concluir ou desistir. Se travar por mais de 60 segundos, conte como "não concluiu" e siga.

| # | Tarefa (o que você fala) | Sucesso é | Tempo-alvo |
|---|---|---|---|
| 1 | "Conte para o app como foi o dia da Dona Isabel hoje. Pode inventar." | Gravou, concluiu e viu o resultado organizado | 1 min |
| 2 | "O app entendeu algo errado sobre o sono. Corrija." | Mudou o campo Sono para o valor certo | 30 s |
| 3 | "Seu irmão mora longe. Mostre para ele como foi a semana da mãe." | Chegou ao resumo da semana | 30 s |
| 4 | "Você lembrou de uma música que acalma a Dona Isabel. Guarde isso no app." | Chegou em Adicionar memória | 45 s |
| 5 | "Faça uma conversa de lembranças com a Dona Isabel." | Chegou ao fim da sessão e marcou a reação | 3 min |

**O que observar em cada tarefa**
- Onde o dedo vai primeiro. Se não for o lugar certo, anote para onde foi.
- Hesitação: pausas maiores que 3 segundos olhando a tela.
- Leitura: a pessoa lê os textos ou só procura botões?
- Na tarefa 1: entende que pode pausar? Confere o resultado ou envia direto? Abre "Ver o que foi dito"?
- Na tarefa 2: percebe que os itens são tocáveis? Nota o "Desfazer"?
- Na tarefa 5: fica à vontade com as perguntas? Comenta algo sobre o tom?
- Expressões: alívio, frustração, riso, desconfiança. Anote a frase exata.

## Depois (5 min)

1. Qual foi a parte mais fácil? E a mais difícil?
2. Você confiaria no resumo que o app escreveu para mandar para a família? Por quê?
3. Teve alguma palavra ou frase que soou estranha, fria ou ofensiva?
4. Você usaria isso às 11 da noite, cansada ou cansado? O que faria você desistir?
5. De 0 a 10, quanto recomendaria para alguém que cuida? Por quê?
6. Se pudesse mudar uma coisa, o que seria?

**Encerramento:** agradeça, explique que nada do que foi gravado é guardado e que os dados são de uma família fictícia. Apague o relato de teste no app (Diário, abrir o relato, Apagar).

## Métricas que levamos ao Demo Day

- **Tempo até o primeiro diário:** tarefa 1, do toque inicial até ver o resultado.
- **Taxa de sucesso por tarefa:** concluídas sem ajuda / total de pessoas.
- **Correção encontrada:** quantas pessoas acharam sozinhas como corrigir (tarefa 2).
- **NPS simples:** média da pergunta 5.
- **Uma frase real**, com autorização e sem nome.
