# Ética e segurança

O SempreAqui lida com dados de saúde de pessoas em situação de vulnerabilidade e com famílias cansadas. Errar aqui machuca gente. Este documento define limites que nenhuma funcionalidade, prompt ou contribuição pode ultrapassar.

## O que a IA faz

- **Organiza** o que a família conta: transforma áudios, fotos e textos em um Passaporte de Memória e em registros do Diário.
- **Resume** em linguagem humana para quem mora longe.
- **Aponta mudanças de padrão** em relação ao habitual da própria pessoa ("acordou 4 vezes, o habitual é 1"), sem dizer o que isso significa clinicamente.
- **Sugere o que já funcionou** para aquela pessoa, com base no histórico que a própria família registrou.
- **Responde dúvidas gerais** apenas com base em fontes oficiais, sempre com o link.
- **Encaminha**: em risco, orienta ligar 192 e avisa a família. Em dúvida clínica, orienta procurar a equipe de saúde.

## O que a IA não faz, nunca

- Não diagnostica. Não diz que alguém "tem" ou "provavelmente tem" alguma condição.
- Não interpreta sintomas nem diz que algo é "sinal de piora" ou que a doença "está avançando".
- Não diz em que fase ou estágio a pessoa está.
- Não sugere, ajusta, suspende ou troca remédios ou doses.
- Não substitui a equipe de saúde, e diz isso de forma clara na interface.
- Não inventa fatos que não foram relatados.

## Como garantimos

| Camada | O que faz | Onde |
|---|---|---|
| Prompt base | Regras inegociáveis em todas as chamadas | [`backend/prompts/base/guardrails.v1.md`](../backend/prompts/base/guardrails.v1.md) |
| Teste do prompt | Falha se alguém remover as regras do prompt | [`backend/tests/test_prompts.py`](../backend/tests/test_prompts.py) |
| Guardrail determinístico | Confere todo texto voltado à família antes de mostrar | [`backend/core/guardrails.py`](../backend/core/guardrails.py) |
| Refazer e cair para texto seguro | Se a IA violar uma regra, refaz uma vez. Se violar de novo, usa um resumo montado sem IA | [`backend/agents/diario.py`](../backend/agents/diario.py) |
| Detecção de risco dupla | IA e palavras-chave. Basta uma das duas para gerar alerta com 192 | `avaliar_risco` no grafo |
| Conjunto adversarial | Frases que devem ser bloqueadas e relatos de risco, medidos no CI | [`backend/evals/guardrails/casos.yaml`](../backend/evals/guardrails/casos.yaml) |
| Fontes oficiais | O RAG só indexa materiais de órgãos oficiais, com URL em cada trecho | [`backend/rag/fontes_oficiais.yaml`](../backend/rag/fontes_oficiais.yaml) |

## Linguagem

A pessoa que vive com Alzheimer continua sendo uma pessoa, com nome, história e gostos. A interface e os textos da IA:

- dizem "pessoa que vive com Alzheimer", "quem cuida", "família", e chamam a pessoa pelo nome ou apelido;
- nunca dizem "paciente", "fardo", "peso", "demente" ou "caduco";
- nas Conversas de Reminiscência, nunca perguntam "você lembra?". Perguntas que testam a memória geram frustração. O foco é conversa e afeto;
- reconhecem o cansaço de quem cuida sem julgamento e convidam a família a dividir tarefas.

## Privacidade e LGPD

Dados de saúde são dados pessoais sensíveis (LGPD, art. 5º, II, e art. 11).

- **Consentimento explícito e por finalidade.** Diário, Passaporte, áudios e fotos, e link compartilhável têm consentimentos separados, com versão do termo e data. Revogar é tão fácil quanto aceitar.
- **Isolamento por grupo familiar.** Row Level Security no Postgres: cada membro só enxerga o próprio grupo, garantido no banco e não só na API.
- **Mínimo necessário.** O Passaporte compartilhado é somente leitura, pode ser desligado a qualquer momento e não inclui o Diário. O link é um token aleatório longo; a página não é indexada, não fica em cache e só mostra as fotos que estão no passaporte. Antes de criar o link, o app explica o que quem receber vai ver.
- **Fotos.** Ficam num armazenamento privado por família, só acessível pelo backend, e são apagadas junto com tudo quando a família pede.
- **Apoio na Hora Difícil.** O texto do pedido não é guardado: só um evento anônimo com o tipo da resposta. Pergunta médica recebe recusa gentil e encaminhamento; risco recebe 192 antes de tudo. As orientações gerais são trechos literais de fonte oficial, nunca texto escrito por nós ou pela IA.
- **Ajudante.** Responde só com o que a família registrou e mostra de onde veio. A conversa fica no celular; o servidor não guarda a pergunta, só um evento anônimo com o tipo da resposta. Risco e perguntas médicas seguem as mesmas regras do Apoio. Quando a IA do celular responde algo que as regras não reconheceram, ela recebe só fatos verdadeiros e a resposta passa pelos guardrails.
- **Rede da Família.** Convites expiram em 7 dias. Avisos e obrigados ficam só no grupo da família, com o mesmo isolamento (RLS) dos outros dados, e são apagados junto com tudo.
- **Sugestões da IA no Passaporte.** Nada entra sozinho: a IA sugere, a família marca o que fica.
- **Nada de dado real em logs.** Logs registram rotas, tempos, contagens e erros. Nunca transcrições, nomes, áudios ou conteúdo de prompts.
- **Exportar e apagar tudo.** A família pode baixar todos os seus dados em formato aberto e apagar o grupo inteiro, o que remove tudo em cascata (LGPD, art. 18).
- **IA no próprio celular.** No iPhone com Apple Intelligence, o áudio é transcrito e organizado no aparelho e nunca é enviado. Para o backend vai só a transcrição e o registro organizado, que a família precisa compartilhar. Correções nesses relatos também são processadas no aparelho. Os guardrails rodam no celular e de novo no backend. A família pode desligar isso em Privacidade e dados.
- **Provedor de IA.** Quando o celular não tem suporte, usamos modelos pelo OpenRouter com a opção `data_collection: deny` em toda chamada: o pedido só vai para provedores que não guardam os dados nem os usam para treinar modelos. Se nenhum provedor do modelo atender, a chamada falha em vez de cair num provedor que guarda dados. Isso é informado à família no termo de consentimento.
- **Chaves e segredos.** Ficam só no `.env`, ignorado pelo git. Um hook de pre-commit e o gitleaks no CI bloqueiam qualquer commit com algo parecido com uma chave. O app nunca recebe chave secreta.
- **Correções da família.** Quando alguém corrige um campo, a correção fica guardada no grupo da própria família e só é usada para melhorar os próximos relatos dessa mesma família.
- **Desenvolvimento sem dado real.** Testes, exemplos e avaliações usam somente relatos fictícios. Segredos ficam apenas em `.env`.

## A pessoa que vive com Alzheimer

Ela não é a usuária do app, mas é a razão dele. Sempre que possível, a família é incentivada a incluir a pessoa nas decisões e a registrar suas preferências no Passaporte enquanto ela pode expressá-las.

## Limitações conhecidas

- A transcrição pode errar nomes próprios e falas muito rápidas. Por isso a tela mostra a transcrição e permite corrigir.
- O conjunto de avaliação ainda é pequeno e foi escrito pela própria equipe. Ampliar com casos cegos e com revisão de profissionais de saúde é prioridade da aceleração.
- O modelo do celular é menor que o da nuvem e ainda não foi medido com o conjunto de avaliação do Diário. O risco continua coberto pela checagem por palavras-chave no celular e no backend, que não depende do modelo.
- O detector de risco por palavras-chave gera falsos positivos de propósito. Preferimos um alerta a mais do que um a menos.
