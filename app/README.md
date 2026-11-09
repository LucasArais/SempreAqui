# App

App do SempreAqui em React Native com Expo (SDK 58) e Expo Router.

```bash
npm install
npx expo start      # abra o Expo Go no celular e escaneie o QR code
npm run typecheck
```

Na Fase 0, as telas usam dados fictícios ([src/dados/mock.ts](src/dados/mock.ts)) no mesmo formato dos schemas do backend.

| Tela | Arquivo |
|---|---|
| Início | [src/app/index.tsx](src/app/index.tsx) |
| Passaporte de Memória | [src/app/passaporte.tsx](src/app/passaporte.tsx) |
| Contar o dia (Diário) | [src/app/diario.tsx](src/app/diario.tsx) |
| Conversa de lembranças | [src/app/reminiscencia.tsx](src/app/reminiscencia.tsx) |
| Resumo da semana | [src/app/semana.tsx](src/app/semana.tsx) |

## Acessibilidade

- Corpo de texto em 20 pt, títulos em 30 pt, e a fonte respeita o tamanho escolhido no sistema.
- Área de toque mínima de 64 pt em todos os botões.
- Cores da logo com contraste alto sobre fundo claro ([src/tema.ts](src/tema.ts)).
- Todos os botões têm rótulo de acessibilidade para leitores de tela, e o gráfico de sono tem descrição em texto.
- Voz como entrada principal: o botão mais visível da tela inicial é "Contar como foi o dia".
