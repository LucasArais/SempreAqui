# IA no próprio celular

O relato de quem cuida é o dado mais sensível do SempreAqui: a voz de uma pessoa cansada, contando o dia de alguém que vive com Alzheimer. A melhor forma de proteger esse dado é não mandá-lo para lugar nenhum. Por isso, sempre que o aparelho aguenta, a IA do SempreAqui roda **dentro do celular**.

Estado hoje:
- **iPhone:** construído e testado num iPhone 17 Pro Max.
- **Android:** desenhado, com a mesma interface, ainda não construído.
- **Nuvem:** continua como reserva para qualquer aparelho sem suporte.

## Por que isso importa

| | Na nuvem | No celular |
|---|---|---|
| O que sai do aparelho | O áudio inteiro | Só a transcrição e o registro organizado |
| Quem processa a voz | Um provedor de IA externo, mesmo com `data_collection: deny` | Ninguém além do próprio celular |
| Custo por relato | Tokens de áudio e texto pagos a cada relato | Zero |
| Sem internet | O áudio espera na fila | O resultado aparece na hora |
| Escala | Custo cresce com cada família | Custo de IA não cresce |

**LGPD:**
- **Minimização (art. 6º, III):** o áudio, que é o dado mais rico e mais identificável, não é coletado pelo servidor.
- **Dado sensível de saúde (art. 11):** menos dado sensível trafegando e menos operadores envolvidos.
- **Transferência internacional (art. 33):** sem envio a provedores de IA no exterior no caminho principal.

**Inclusão:**
- O app funciona no interior, no hospital ou com o plano de dados no fim.
- O custo zero de IA permite manter o app gratuito para as famílias, que é o que o SempreAqui precisa para chegar a quem cuida sozinho.

## Arquitetura

```mermaid
flowchart LR
    A[Gravação] --> F[(Áudio salvo<br/>no celular)]
    F --> D{Aparelho tem<br/>IA local?}
    D -- sim --> T[Transcrever<br/>no aparelho]
    T --> E[Extrair registro<br/>geração guiada pelo schema]
    E --> N[Normalizar e<br/>regras fixas]
    N --> R[Risco por palavras<br/>+ alertas do modelo]
    R --> S[Resumo para a família<br/>até 2 tentativas]
    S --> G{{Guardrails no app}}
    G -- reprovado --> SS[Resumo seguro<br/>sem IA]
    G -- aprovado --> Q[(Fila offline)]
    SS --> Q
    Q -- "POST /diario/relatos/do-aparelho<br/>sem áudio" --> B{{Backend: valida schema,<br/>recalcula risco,<br/>reaplica guardrails}}
    B --> DB[(Supabase)]
    D -- não --> C[Envia o áudio<br/>caminho da nuvem]
    T -. falhou .-> C
    E -. falhou .-> C
```

Princípios:

1. **Uma interface, duas plataformas.** O módulo nativo expõe quatro funções:
   - `disponibilidade()`: o aparelho consegue transcrever e rodar o modelo? Se não, por quê.
   - `transcrever(uri)`: áudio para texto, no aparelho.
   - `gerarRegistro(instrucoes, prompt)`: JSON no formato exato do `RegistroDiario`.
   - `gerarTexto(instrucoes, prompt)`: texto livre, para o resumo.

   Os prompts, a normalização, os guardrails e a sincronização ficam em TypeScript e são os mesmos no iOS e no Android. Trocar de plataforma é trocar só o módulo nativo.
2. **O servidor tem a palavra final.** O app aplica os guardrails para mostrar um resultado seguro na hora, mesmo offline. Quando o relato sincroniza, o backend valida o registro com Pydantic, recalcula o risco por palavras-chave e reaplica os guardrails. Se o resumo violar qualquer regra, ele é trocado pelo resumo seguro montado sem IA.
3. **Falhar para o lado seguro.** Pode acontecer de:
   - o aparelho não ter suporte;
   - o modelo recusar o pedido;
   - a transcrição vir vazia;
   - o JSON vir quebrado.

   Em qualquer desses casos, o relato segue pelo caminho da nuvem, com o mesmo fluxo de antes. Quem cuida nunca fica sem resultado.
4. **Regras fixas onde o modelo pequeno erra.** O modelo do celular é menor que o da nuvem. Onde ele chuta, uma regra determinística corrige. Exemplo real do primeiro teste: o modelo marcou "tomou só parte dos remédios" num relato que não falava de remédio. Agora, se a transcrição não cita remédio, o campo é "não foi falado", diga o modelo o que disser.
5. **A família decide.** Em Família → Privacidade e dados há uma chave "Organizar os relatos aqui no celular", com a explicação de por que ela está indisponível quando for o caso.

## iPhone (construído)

**Requisitos:**
- iOS 26 ou mais novo.
- Aparelho compatível com Apple Intelligence: iPhone 15 Pro, a linha 16 ou mais novo.
- Apple Intelligence ligada nos Ajustes.
- Na primeira transcrição, o iOS baixa o modelo de fala em português uma única vez. Depois funciona sem internet.

**Peças:**

| Etapa | Tecnologia | Onde |
|---|---|---|
| Transcrição | `SpeechAnalyzer` com `SpeechTranscriber` em pt-BR; `DictationTranscriber` se o primeiro não tiver o idioma | [app/modules/ia-local/ios/IaLocalModule.swift](../app/modules/ia-local/ios/IaLocalModule.swift) |
| Extração | Apple Foundation Models (modelo de linguagem da Apple que roda no aparelho), com `@Generable` espelhando o `RegistroDiario` e `@Guide(.anyOf)` limitando cada campo aos valores aceitos | mesmo arquivo |
| Resumo | Foundation Models, texto livre, temperatura baixa e limite de tokens | mesmo arquivo |
| Prompts | Versões compactas dos prompts do backend, porque a janela de contexto é pequena (`extracao.aparelho.v1`) | [app/prompts/diario-aparelho.ts](../app/prompts/diario-aparelho.ts) |
| Orquestração, normalização, regras fixas | TypeScript | [app/src/lib/ia-local.ts](../app/src/lib/ia-local.ts) |
| Guardrails | Espelho de `backend/core/guardrails.py` | [app/src/lib/guardrails.ts](../app/src/lib/guardrails.ts) |
| Fila e sincronização | Só o resultado entra na fila; o áudio fica na pasta do app | [app/src/lib/diario.ts](../app/src/lib/diario.ts) |

**Geração guiada.** O modelo não "escreve um JSON": ele preenche uma estrutura que o próprio sistema garante. Por isso:
- nunca vem um campo fora do formato;
- nunca vem um valor como "mais ou menos" no lugar de `regular`.

O JSON gerado tem os mesmos nomes de campo do schema Pydantic, e o backend valida sem conversão.

**Filtros da Apple.** O modelo da Apple tem filtros de conteúdo próprios e pode recusar relatos de violência ou queda. Nesse caso:
- o registro pode ir pela nuvem;
- o resumo vira o resumo seguro, que já inclui a orientação de ligar 192.

O alerta de risco não depende do modelo: a checagem por palavras-chave roda no app e no backend.

## Android (planejado)

Mesma interface do módulo, mesma lógica em TypeScript. O que muda é o motor por baixo. O mercado de Android no Brasil é muito variado, então o plano tem degraus.

| Etapa | Aparelhos com Gemini Nano | Intermediários (6 GB de RAM ou mais) | Aparelhos de entrada |
|---|---|---|---|
| Transcrição | `SpeechRecognizer` no aparelho (`createOnDeviceSpeechRecognizer`, Android 13+), pacote de idioma pt-BR | Whisper pequeno quantizado via whisper.cpp (`whisper.rn`), baixado pelo Wi-Fi | Nuvem |
| Extração e resumo | Gemini Nano pelas APIs de IA generativa do ML Kit, no AICore | Modelo aberto pequeno (Gemma ou Qwen, quantizado) via llama.cpp (`llama.rn`), com gramática JSON gerada do schema | Nuvem |
| Guardrails | No app e no backend | No app e no backend | No backend |

**Decisões do desenho:**
- **Gramática JSON no llama.cpp:** é o equivalente da geração guiada da Apple. O modelo só consegue emitir tokens que formam um `RegistroDiario` válido.
- **Download só com consentimento e pelo Wi-Fi.** Modelos abertos têm centenas de MB a alguns GB. O app pergunta antes, mostra o tamanho e baixa em segundo plano. Até terminar, usa a nuvem.
- **`disponibilidade()` decide o degrau sozinho:** verifica a versão do Android, a RAM, se o Gemini Nano existe e se o modelo aberto já foi baixado.
- **Sem mudança no backend.** O Android usa a mesma rota `POST /diario/relatos/do-aparelho`. O campo `modelo` registra qual motor organizou o relato (por exemplo `aparelho:gemini-nano` ou `aparelho:qwen-1.5b-q4`), para medir a qualidade por motor.

**Ordem de construção:**
1. Transcrição com `SpeechRecognizer`, que é grátis e sem download.
2. Gemini Nano nos aparelhos com suporte.
3. llama.cpp para os intermediários.

Cada passo só entra se passar nas avaliações abaixo.

## Contrato de sincronização

`POST /diario/relatos/do-aparelho`, autenticado como as demais rotas:

```json
{
  "id": "uuid gerado no celular",
  "duracao_s": 42.0,
  "gravado_em": "2026-11-10T21:30:00-03:00",
  "transcricao": "texto transcrito no aparelho",
  "registro": { "...": "RegistroDiario completo" },
  "resumo": "resumo escrito no aparelho",
  "modelo": "apple-foundation-models",
  "versao_prompt": "extracao.aparelho.v1"
}
```

- **Idempotente pelo id:** reenviar da fila não duplica.
- **O backend recalcula os alertas:** soma o que o modelo marcou com a checagem por palavras-chave.
- **O backend confere o resumo:** se violar um guardrail ou faltar o 192 num alerta, ele é trocado pelo resumo seguro.
- **Marcação de origem:** o relato fica com `modelo = "aparelho:..."`, e a resposta traz `no_aparelho: true`.
- **Correções nesses relatos não chamam a nuvem:**
  1. O backend grava o resumo seguro na hora.
  2. O celular reescreve o resumo com a IA local e manda só o texto (`PUT /diario/relatos/{id}/resumo`).
  3. O backend confere esse texto de novo.
- **A IA do celular aprende com a família:** as correções recentes (`GET /diario/correcoes`) ficam guardadas no aparelho e entram no prompt de extração, como na nuvem.

## Como avaliamos

A troca de nuvem para aparelho só vale com evidência. Os critérios são os mesmos do Diário na nuvem ([avaliacao.md](avaliacao.md)):

| Critério | Meta | iPhone |
|---|---|---|
| Guardrails do app iguais aos do backend | 100% dos casos adversariais | 53 de 53, no CI |
| Risco detectado nos relatos de risco | 3 de 3 | coberto pela checagem por palavras, independente do modelo; falta medir o modelo |
| Violações de guardrail no texto para a família | zero | garantido pelo resumo seguro; falta medir a taxa de reprovação |
| Acurácia por campo do registro | igual ou próxima da nuvem | a medir |
| Tempo do relato até o resultado | menos de 15 s para 2 min de áudio | a medir |

Primeiro teste real, num iPhone 17 Pro Max: transcrição e organização corretas em todos os campos, exceto o de remédios num dos relatos. Esse erro levou à regra fixa descrita acima.

Próximo passo: rodar o conjunto de avaliação do Diário no próprio aparelho e publicar os números aqui, separados por motor.

## Limitações conhecidas

- **Modelo menor:** o modelo do celular é menor que o da nuvem e erra mais em relatos longos e confusos. A tela mostra a transcrição e cada campo é corrigível com um toque.
- **Contexto curto:** a janela de contexto é pequena, por isso os prompts do aparelho são compactos e só as 6 correções mais recentes entram.
- **Áudio não sincroniza:** o áudio de um relato organizado no celular fica só naquele celular. Outros membros da família veem a transcrição e o registro, não ouvem o áudio. É a escolha certa para privacidade, e a família sabe disso pelo aviso no relato.
- **Android ainda não tem IA local:** até lá, usa a nuvem com provedores que não guardam dados.
