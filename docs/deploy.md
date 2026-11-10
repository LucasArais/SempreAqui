# Deploy

## Hoje: Cloudflare Tunnel (testes com a família e com cuidadores)

O backend roda no computador de quem desenvolve e fica acessível por HTTPS através de um Cloudflare Tunnel. Custo zero.

```bash
cd backend
uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
cloudflared tunnel --no-autoupdate --url http://localhost:8000   # mostra um endereço https://...trycloudflare.com
```

Depois, `EXPO_PUBLIC_API_URL` no `app/.env` recebe esse endereço e o app é recompilado.

- **O túnel não abre portas** no roteador nem no computador: só a porta do backend fica acessível, por HTTPS.
- **O endereço `trycloudflare.com` muda** a cada vez que o túnel liga. Com uma conta Cloudflare e um domínio, o túnel nomeado tem endereço fixo.
- **Só funciona com o computador ligado.** Deixe o túnel ligado só durante os testes.
- **A Cloudflare mantém o HTTPS** e por isso é operadora de dados para fins da LGPD. Com a IA no iPhone, o áudio nem sai do celular.

## Proteções para o servidor público

- **Toda rota com dados da família exige login** (token do Supabase validado no servidor). A família vem do banco, nunca do celular. O cabeçalho `X-Familia` só funciona no modo local de desenvolvimento.
- **Documentação automática da API desligada** fora do modo local (`EXPOR_DOCS`).
- **`/metricas` exige login.**
- **Limite de uso por pessoa** nas rotas que gastam IA na nuvem ou consultam serviços de fora: relatos, organizar memória, transcrever, Apoio, Ajudante, unidades do SUS e fotos. Acima do limite, a resposta é 429 com uma mensagem simples.
- **Contas novas criam a própria família** (`FAMILIA_DEMO_PARA_NOVOS` desligado). Testadores entram na família certa por convite.
- **Chaves só nas variáveis de ambiente**, nunca no repositório.

## Próximo passo: Google Cloud Run (Demo Day)

Para não depender do computador ligado: o backend num contêiner no Cloud Run, que tem plano gratuito de 2 milhões de requisições por mês e desliga sozinho sem uso. Banco, armazenamento e login continuam no Supabase. A Cloudflare pode ficar na frente, de graça, com um domínio próprio.

Cloudflare Workers não servem para este backend: o Python de lá não aceita bibliotecas que ele usa (driver do Postgres, LangGraph, threads).
