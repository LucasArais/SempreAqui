# RAG de fontes oficiais

Usado pelo **Apoio na Hora Difícil** para responder dúvidas gerais sobre cuidado. A IA só responde com base nesses trechos e sempre mostra o link da fonte. Se a resposta não estiver nas fontes, ela diz que não sabe e sugere conversar com a equipe de saúde.

## Pipeline (semana 2 da aceleração)

1. `fontes_oficiais.yaml` lista as fontes aprovadas.
2. `ingerir.py` baixa cada fonte, extrai o texto, divide em trechos de cerca de 800 caracteres com sobreposição e gera embeddings (`GEMINI_EMBEDDING_MODEL`, 768 dimensões).
3. Cada trecho vai para a tabela `fontes_trechos` (pgvector) com `fonte_id`, `titulo`, `orgao` e `url`.
4. Na pergunta, buscamos os trechos mais próximos por similaridade de cosseno e passamos ao modelo com a instrução de citar a URL.
5. O guardrail confere que toda resposta com informação de saúde contém ao menos uma URL da lista.

## Por que só fontes oficiais

Quem cuida está cansada e precisa confiar no que lê. Uma resposta sem fonte, ou com fonte duvidosa, pode causar dano. Restringir o RAG a fontes oficiais também facilita a auditoria por qualquer pessoa: basta abrir o link.
