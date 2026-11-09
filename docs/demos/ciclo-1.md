# Demo do Ciclo 1: Diário Inteligente (1 minuto)

**Antes:** backend rodando, `uv run python -m demo.seed` executado, app aberto na tela Hoje. Saldo no OpenRouter para a gravação ao vivo.

| Tempo | O que fazer | O que dizer |
|---|---|---|
| 0:00 | Tela Hoje | "A Cláudia cuida da mãe, a Dona Isabel, que vive com Alzheimer. São 11 da noite. Ela não tem energia para preencher formulário." |
| 0:08 | Toca no microfone, toca de novo e fala 15 segundos: "A mãe dormiu mal, acordou três vezes, no almoço comeu pouco, tomou os remédios, à tarde ficou agitada e a música ajudou." Toca em Concluir | "Ela só fala, do jeito que mandaria um áudio para o irmão." |
| 0:25 | A tela mostra "Ouvindo o que você contou...", depois "Organizando..." | "A IA transcreve, organiza e escreve um resumo para a família. Em segundos." |
| 0:35 | Resultado: resumo e campos | "Sono, alimentação, humor, remédios. Sem diagnóstico, só o que ela contou." |
| 0:40 | Toca em Sono, escolhe outro valor, mostra o "Desfazer" | "Se a IA errou, um toque corrige. E a IA aprende: a próxima extração dessa família já leva essa correção." |
| 0:48 | Toca em "Ver o que foi dito" e dá play | "A IA não esconde nada: o áudio e as palavras originais estão sempre aqui." |
| 0:55 | Volta e abre o relato com o alerta vermelho | "E se ela contar uma queda com batida na cabeça, o app manda ligar 192. No nosso benchmark, o modelo que usávamos perdia essa queda. Trocamos por isso." |

**Se perguntarem**
- *E sem internet?* Grava igual. O áudio fica no celular e sobe sozinho quando a conexão volta, sem duplicar.
- *Como vocês sabem que a IA está boa?* Benchmark próprio de transcrição (3,4% de erro de palavras, queda captada 2 de 2), 53 casos adversariais de guardrail sem erro, e a taxa de correção dos campos medida em produção.
- *E os dados?* Isolados por família, provedores de IA que não guardam dados, chaves nunca no código, exportar e apagar tudo.
