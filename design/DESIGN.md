# Design

O SempreAqui segue as Human Interface Guidelines da Apple como referência: limpo, calmo, com bastante espaço em branco e nada disputando atenção. Pensamos em uma filha cansada, às 23h, com o celular numa mão. Cada tela precisa ser entendida em 2 segundos e usada com um polegar.

Três palavras guiam tudo: **calmo, claro, acolhedor**.

## Conteúdo da pasta

- `logo.png`: logo completa. Duas pessoas formam um coração em volta de uma casa, com uma mão que acolhe.
- `simbolo.png`: só o símbolo, usado como ícone do app.
- `screens/`: capturas de todas as telas no iPhone 17 Pro (iOS 26). O app usa sempre o modo claro.

## Princípios

- **Clareza acima de decoração.** A hierarquia vem da tipografia e do espaço, não de gradientes ou sombras.
- **Uma ação principal por tela.** O botão coral é sempre o mais importante. Na tela Hoje, é o botão de gravar.
- **Conteúdo é o herói.** Fotos e memórias da família ocupam espaço. A interface some.
- **A IA não aparece como robô.** Nada de mascote ou brilho. Quando algo foi organizado pela IA, um rótulo discreto diz isso ("Organizado automaticamente"), e sempre dá para ver o que foi dito de verdade.
- **Voz em primeiro lugar.** Gravar é sempre a ação mais fácil de alcançar.

## Tokens

Todos em [app/src/theme](../app/src/theme).

| Arquivo | Conteúdo |
|---|---|
| `colors.ts` | Cores do modo claro e escuro, com os pares de contraste validados |
| `typography.ts` | Escala baseada no iOS: Large Title 34, Title 2 22, Headline 17, Body 17, Callout 16, Footnote 13 |
| `spacing.ts` | Grade de 8 pt, margem lateral de 16 pt (20 pt em telas grandes), 32 pt entre seções, raios de 16 (cards), 14 (botões) e total (chips) |
| `navigation.ts` | Cabeçalho com large title que encolhe ao rolar |

### Cores

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| Destaque | `#E0664C` | `#FF8A70` | Botão de gravar |
| Destaque forte | `#B8462F` | `#FF8A70` | Botão principal, links, estados ativos |
| Fundo | `#FFFFFF` | `#000000` | Telas |
| Fundo secundário | `#F2F2F7` | `#1C1C1E` | Cards e listas |
| Atenção | `#7A4A00` sobre `#FFF2D6` | `#FFD25A` sobre `#3A2F12` | Mudanças de padrão no diário |
| Concluído | `#1F7A35` | `#4CD267` | Tarefas feitas |
| Emergência | `#C4291C` | `#FF6961` | Só o botão de ligar 192 |

O coral sugerido no briefing (`#E8735A`) ficava em 2,99:1 com o ícone branco. Escurecemos um pouco, para `#E0664C`, e chegamos a 3,4:1. Para texto e para o fundo do botão principal usamos `#B8462F`, que passa no AA (5,3:1 sobre branco). Para conferir todos os pares:

```bash
cd app
node scripts/contraste.ts
```

## Acessibilidade

- Contraste WCAG AA em modo claro e escuro, validado por script e no CI.
- Dynamic Type: nenhum texto trava o tamanho. Testado no maior tamanho de acessibilidade do iOS.
- Áreas de toque de no mínimo 44 pt. O botão de gravar tem 88 pt, e 112 pt na tela de gravação.
- Todos os elementos interativos têm rótulo e dica em português para VoiceOver e TalkBack.
- Nenhuma informação só por cor: avisos têm ícone e texto, e o gráfico de sono tem número, triângulo e descrição em texto.
- Animações curtas com física de mola, que respeitam o Reduzir Movimento do sistema.

## Fotos

Todas as fotos do app foram **geradas por IA**: os retratos da família (Dona Isabel, Cláudia, Rafael, a neta, o marido e o cuidador profissional) e as memórias do Passaporte (o ateliê em 1978, São João em 1965, a Cláudia pequena, a casa da Rua das Flores, o aniversário de 81 anos e a família reunida). São pessoas e lugares fictícios. Nunca usamos fotos de pessoas reais em exemplos.
