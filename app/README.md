# App

App do SempreAqui em React Native com Expo (SDK 58) e Expo Router. O visual segue as Human Interface Guidelines da Apple. Veja [design/DESIGN.md](../design/DESIGN.md).

```bash
npm install
npx expo start          # abra o Expo Go no celular e escaneie o QR code
npm run typecheck
npx expo lint
node scripts/contraste.ts   # valida o contraste das cores
```

Na Fase 0, as telas usam a família fictícia de [src/data/familia.ts](src/data/familia.ts), no mesmo formato dos schemas do backend.

## Estrutura

```
src/
  app/                    rotas (Expo Router)
    (tabs)/               tab bar nativa: Hoje, Memórias, Família, Ajuda
      hoje/               Hoje e Esta semana (push)
      memorias/           Passaporte de Memória
      familia/            membros, tarefas e resumos
      ajuda/              Apoio na hora difícil
    gravar.tsx            sheet do Diário: gravar, conferir, enviar
    nova-memoria.tsx      sheet para adicionar memória
    sessao.tsx            sessão de reminiscência em tela cheia
    onboarding.tsx        3 telas com consentimento
  components/             todos os componentes visuais
  theme/                  tokens de cor, tipografia, espaço e navegação
  data/                   dados fictícios
  lib/                    haptics, links e margens seguras
```

## Componentes

| Componente | Uso |
|---|---|
| `Card` | Fundo secundário, raio 16, padding 16, sem borda |
| `ListGroup` e `ListRow` | Lista agrupada no estilo Ajustes do iOS |
| `PrimaryButton` | Ação principal, largura total, altura 52 |
| `SecondaryButton` | Ação secundária, só texto na cor de destaque |
| `EmergencyButton` | Ligar 192, sóbrio, único lugar com vermelho |
| `RecordButton` | Círculo de 88 pt que vira onda de áudio animada, com tempo e haptic |
| `MemoryCard` e `Photo` | Foto grande com legenda curta |
| `SummaryCard` | Resumo da IA com "Organizado automaticamente" e "Ver o que foi dito" |
| `AttentionBadge` | Chip âmbar para mudanças de padrão, sem alarme |
| `EmptyState` | Ícone, frase gentil e ação |
| `Skeleton` | Carregamento suave, sem spinner |
| `Text`, `Icon`, `Screen`, `Section` | Base: escala tipográfica, SF Symbols no iOS e Lucide no Android, tela com large title |

## Plataformas

- **iOS:** fonte do sistema (SF Pro), SF Symbols, tab bar e cabeçalhos nativos com o material translúcido do sistema.
- **Android:** fonte Inter (carregada com expo-font) e ícones Lucide, com traço equivalente.

## Login com e-mail e senha

Configure `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `app/.env` e mantenha o backend configurado para o mesmo projeto Supabase. Em Authentication → Providers, habilite Email. Para esta etapa, crie uma conta de teste em Authentication → Users → Add user, com e-mail confirmado e senha. O app usa contas existentes; cadastro e recuperação ficam para a próxima etapa.

Ao abrir, a tela Entrar pede e-mail e senha. Depois da autenticação, `POST /sessao` mantém a entrada/criação da família já existente; o primeiro acesso segue o onboarding. As próximas aberturas restauram a sessão. Ajustes → Conta → Sair da conta pede confirmação.

Tokens ficam no `expo-secure-store` no celular, com renovação do Supabase. Na web, a sessão fica somente em memória. O app não cria mais usuários anônimos nem usa o cabeçalho de demonstração sem login. Contas anônimas antigas não são convertidas automaticamente; seus dados continuam no backend. Cópias e filas locais novas ficam separadas por conta.

Verificação automatizada: `npm run test:login`, `npm run typecheck` e `npm run lint`. Os testes de login usam serviços simulados; a entrada real depende de uma conta e do backend acessível.
