/**
 * Prompts da IA do celular para o Passaporte e a Conversa de hoje.
 *
 * - organizar.aparelho.v1: espelho compacto de backend/prompts/passaporte/organizar.v1.md.
 * - perguntas.aparelho.v1: reescreve as perguntas do roteiro revisado para a pessoa, sem nunca
 *   testar a memória. O resultado passa por validarPerguntas (src/lib/guardrails.ts); se falhar,
 *   ficam as perguntas revisadas do backend.
 */

export function promptMemoria(relato: string) {
  return `Separe nas seções do Passaporte de Memória o que a família contou sobre uma pessoa que vive com Alzheimer.
- Registre só o que foi dito. Nunca invente nomes, datas, gostos ou fatos.
- Use as palavras da família. Títulos curtos.
- pessoas_importantes: pessoas com vínculo afetivo. acalma: o que acalma. agita: o que agita ou incomoda.
- rotina: horários e hábitos. lembrancas: histórias, lugares, épocas e fatos marcantes.
- quem_ela e como_se_comunica só se o relato falar disso.
- Nada de diagnóstico.

Relato da família:
"""
${relato}
"""`;
}

export function promptPerguntas(contexto: {
  chamada: string;
  tema: string;
  detalhe?: string | null;
  comoSeComunica?: string;
  exemplos: string[];
}) {
  return `Escreva 3 perguntas para uma conversa de reminiscência com ${contexto.chamada}, que vive com Alzheimer.
Tema de hoje: ${contexto.tema}${contexto.detalhe ? ` (${contexto.detalhe})` : ''}.
${contexto.comoSeComunica ? `Como ela se comunica: ${contexto.comoSeComunica}` : ''}

Regras:
- Perguntas abertas, curtas e gentis, uma ideia por pergunta. Trate por "a senhora".
- Convide a contar, sentir e descrever: cores, cheiros, pessoas, lugares.
- Nunca teste a memória: nada de "lembra", "recorda" ou "esqueceu". Nunca corrija.
- Use só o que está no tema. Não invente nomes nem fatos.

Exemplos do tom certo:
${contexto.exemplos.map((e) => `- ${e}`).join('\n')}`;
}
