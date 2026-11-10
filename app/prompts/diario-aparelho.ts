import type { Registro } from '../src/lib/api';

/**
 * Prompts da IA do próprio celular (versão extracao.aparelho.v1).
 *
 * São versões compactas de backend/prompts/diario, porque o modelo do aparelho tem uma janela de
 * contexto pequena. Mudar aqui é mudar o comportamento: confira no aparelho antes de subir.
 */

export const SISTEMA = `Você faz parte do SempreAqui, um app que ajuda famílias a cuidar juntas de alguém que vive com Alzheimer.
Regras sem exceção:
1. Não diagnostique, não interprete sintomas e não dê orientação médica. Nunca sugira, ajuste ou suspenda remédios ou doses. Nunca diga que algo é sinal de piora.
2. Se houver risco imediato (queda com batida na cabeça, engasgo, falta de ar, desmaio, sangramento, convulsão, violência, pessoa desaparecida), oriente ligar 192 (SAMU).
3. A pessoa que vive com Alzheimer é uma pessoa, com nome e história. Nunca use "paciente", "fardo", "peso", "demente" ou "caduco".
4. Português do Brasil, frases curtas, tom acolhedor. Não use travessão.
5. Use somente o que foi relatado. Não invente fatos, nomes, horários ou números.`;

export function promptExtracao(transcricao: string, correcoes: string) {
  return `Preencha o registro do dia a partir do relato de quem cuida.
- Registre só o que foi dito. Se o relato não fala de um assunto, use "nao_informado" ou lista vazia. Nunca deduza.
- Números de sono só se aparecerem no relato. "Umas sete horas" vira 7.
- "Tomou só o remédio da noite" é medicação "parcial".
- Em episodios, só fatos pontuais e concretos. Em o_que_ajudou, o que acalmou ou fez bem.
- Em quem_cuida, o cansaço que a própria pessoa que cuida disse sentir.
- Em sinais_de_alerta, só situações que podem exigir atendimento imediato, descritas sem interpretação clínica.

Correções que esta família já fez (siga o mesmo critério em situações parecidas):
${correcoes || 'Nenhuma correção ainda.'}

Relato:
"""
${transcricao}
"""`;
}

export function promptResumo(registro: Registro, transcricao: string, violacoes: string[]) {
  let prompt = `Escreva um resumo curto do dia para a família que mora longe.
- No máximo 4 frases, linguagem humana e calorosa, como uma mensagem de família.
- Comece pelo que foi bom, se houver.
- Conte os fatos: sono, alimentação, humor, remédios, o que aconteceu. Sem interpretar e sem diagnosticar.
- Se quem cuida relatou cansaço, diga com cuidado e sugira uma ajuda concreta da família.
- Se houver sinais de alerta, a primeira frase diz o que aconteceu e orienta ligar 192 (SAMU) se houver risco agora.
- Chame a pessoa como o relato chama ("a mãe", "a vó"). Responda só com o resumo.

Registro: ${JSON.stringify(compactar(registro))}

Relato:
"""
${transcricao}
"""`;
  if (violacoes.length) {
    prompt += `\n\nA versão anterior foi recusada por: ${violacoes.join('; ')}. Reescreva sem esses problemas.`;
  }
  return prompt;
}

/** Tira do registro o que não foi falado, para caber na janela pequena do modelo. */
function compactar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.length ? valor.map(compactar) : undefined;
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      const c = compactar(v);
      if (c !== undefined && c !== null && c !== 'nao_informado') saida[k] = c;
    }
    return Object.keys(saida).length ? saida : undefined;
  }
  return valor;
}
