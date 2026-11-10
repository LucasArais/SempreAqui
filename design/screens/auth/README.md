# Login básico

`entrar-claro.png`: captura real no Expo Go, iPhone 17 Pro (iOS 26.3), em 10 de novembro de 2026. Revisada contra os componentes existentes e `design/DESIGN.md`: fundo branco, coral, tipografia e espaçamento dos tokens. O app continua configurado para modo claro nesta etapa.

Verificados: abertura da tela no simulador e oito testes de lógica com serviços simulados, incluindo restauração, credenciais incorretas, saída e isolamento das cópias offline. TypeScript e lint passaram. Entrada real com conta Supabase, VoiceOver/TalkBack e preenchimento automático em ambos os sistemas ainda precisam de validação manual.

A instalação do SecureStore concluiu o download, mas o postinstall apontou falha no patch preexistente `expo-modules-jsi+58.0.22.patch`. O patch não foi alterado nesta etapa. A tela foi aberta no Expo Go; uma nova compilação nativa não foi validada.


Atualização de cadastro: `criar-conta-claro.png` registra a tela com nome, e-mail, senha e aceite; o botão fica no fim da rolagem. Cadastro real e login imediato foram verificados com uma conta fictícia no Supabase, removida ao final. Nome e aceite versionado foram conferidos. A compilação Release foi instalada no iPhone conectado.
