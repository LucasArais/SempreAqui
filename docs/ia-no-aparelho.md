# IA no próprio celular

O relato de quem cuida é o dado mais sensível do SempreAqui: a voz de uma pessoa cansada, contando o dia de alguém que vive com Alzheimer. A melhor forma de proteger esse dado é não mandá-lo para lugar nenhum. Por isso, sempre que o aparelho aguenta, a IA do SempreAqui roda **dentro do celular**.

Estado hoje:
- **iPhone:** construído e testado num iPhone 17 Pro Max.
- **Android:** construído e testado no emulador, com Whisper e um modelo aberto pequeno.
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

## Android (construído)

Mesma interface do módulo e mesma lógica em TypeScript (prompts, normalização, regras fixas, guardrails, fila). O que muda é o motor, escolhido pelo próprio celular, sempre de graça:

| Ordem | Motor | Quando | O que o app baixa |
|---|---|---|---|
| 1 | **Gemini Nano** (ML Kit GenAI, pelo app AICore do Android) | O aparelho tem o Nano | Só o Whisper (190 MB). O Nano vem com o Android e o Google cuida dele |
| 2 | **Llama 3.2 3B Instruct** (llama.cpp via llama.rn, Q4_K_M) | Sem Nano e com 6 GB de RAM ou mais | Whisper e Llama (2,2 GB no total) |
| 3 | Nuvem, com os mesmos guardrails | Os demais | Nada |

| Etapa | Tecnologia | Onde |
|---|---|---|
| Converter o áudio | O app grava em m4a; o Whisper só lê WAV de 16 kHz. O módulo nativo em Kotlin decodifica com o MediaCodec, junta os canais e reamostra | [app/modules/ia-local/android](../app/modules/ia-local/android) |
| Transcrição | Whisper `small` quantizado (whisper.cpp via whisper.rn) | [app/modules/ia-local/adaptador.android.ts](../app/modules/ia-local/adaptador.android.ts) |
| Organizar com o Llama | Saída presa a um JSON Schema que espelha o `RegistroDiario`, com todos os campos obrigatórios: o equivalente da geração guiada da Apple | mesmo arquivo |
| Organizar com o Gemini Nano | O pedido leva as instruções e um molde do JSON; a resposta passa pela mesma normalização e pelas mesmas regras fixas. A saída estruturada nativa do Nano exige um compilador de esquema ainda em versão alpha | Kotlin (`nanoStatus`, `nanoBaixar`, `nanoGerar`) e o adaptador |

**Download com consentimento.** Em Família → Privacidade e dados, com o tamanho, o motor escolhido e o progresso na tela. Versão fixa (commit do Hugging Face) e tamanho conferido; modelos de versões anteriores do app são apagados para liberar espaço. Dá para apagar a qualquer momento, e os relatos voltam para a nuvem.

**Testar a IA do celular.** Um botão em Privacidade roda um relato fictício já gravado pelo caminho inteiro, sem internet, e mostra a transcrição, o registro, o resumo e o tempo.

**O iPhone não carrega nada disso.** O Metro escolhe `adaptador.android.ts` só no Android, e `react-native.config.js` tira o llama.rn e o whisper.rn do build do iOS. O Android mínimo passou a ser o 8.0 (API 26), que o Gemini Nano exige.

**Por que esses modelos.** Veja a comparação em [avaliacao.md](avaliacao.md): o Llama 3.2 3B acertou 83% dos campos do gabarito; os modelos menores, de 4% a 42%. O Qwen2.5 3B ficou de fora pela licença, que é só para pesquisa.

**Licenças.** Whisper: MIT. Llama 3.2: Llama 3.2 Community License (uso gratuito, inclusive comercial, abaixo de 700 milhões de usuários por mês), com o crédito "Built with Llama" no app e no README. Gemini Nano: termos do ML Kit; só pode ser usado com o app em primeiro plano.

**O que modelos menores erram, e como o app se protege:**
- Deixar campos como "não foi falado" mesmo quando o relato fala deles. A família corrige com um toque, e a correção entra no prompt seguinte.
- Escrever "Não há sinais de alerta" dentro da lista de alertas. O app e o backend descartam frases que negam o alerta.
- Devolver o relato inteiro no lugar do resumo, ou abrir com "Aqui está um resumo". Resumo acima de 500 caracteres é refeito; aberturas são removidas; sem nada concreto registrado, entra o resumo seguro montado sem IA.
- Copiar o código interno do episódio ("desorientacao") para os alertas. O app troca pelo nome escrito certo.
- O risco não depende do modelo: a checagem por palavras-chave roda no app e no backend.

**Teste no emulador (10/11/2026).** Android 16, 6 GB de RAM, só CPU, relato de exemplo de 1 minuto: 117 s do áudio ao resumo com Whisper small e Llama 3.2 3B. Acertou o sono e registrou remédios e cansaço (o Qwen 1.5B deixava esses dois em branco), mas exagerou: remédios "só parte" e cansaço "muito", onde o gabarito diz "sim" e "algum". A família corrige com um toque. Celular de verdade, com processador mais rápido, tende a levar menos tempo.

**Próximos passos:** medir em celulares reais de faixas diferentes, inclusive num aparelho com Gemini Nano (o emulador não tem), e testar o Whisper `large-v3-turbo` nos celulares mais fortes.

## Além do Diário: Passaporte e Conversa de hoje

A mesma IA do celular é usada em mais dois lugares, com as mesmas regras:

| Onde | O que o celular faz | Reserva na nuvem | Proteção |
|---|---|---|---|
| Contar uma memória | Transcreve e separa o relato da família nas seções do Passaporte (`gerarMemoria`, espelho de `MemoriaOrganizada`) | `POST /passaporte/organizar`, sem guardar o áudio | Guardrails de linguagem em cada sugestão; nada entra sem a família marcar |
| Conversa de hoje | Reescreve as perguntas do roteiro revisado pensando na pessoa (`gerarPerguntas`, exatamente 3) | Não precisa: ficam as perguntas revisadas | `validarPerguntas`: nada de "lembra", "recorda", "esqueceu", guardrails, tamanho e formato. Se uma falhar, nenhuma é usada |

Os roteiros revisados vêm do backend (`core/reminiscencia.py`) e funcionam sem IA. A IA do celular só melhora o que já é seguro.

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
- **Android:** o modelo aberto pequeno erra mais que o da Apple em campos do registro; veja a seção do Android.
