import type { Registro } from './api';

/**
 * Guardrails determinísticos no próprio celular, espelho de backend/core/guardrails.py.
 *
 * Com a IA rodando no aparelho, o texto para a família precisa ser conferido aqui também,
 * inclusive sem internet. Quando o relato sincroniza, o backend confere de novo e tem a palavra
 * final. scripts/guardrails.ts roda os mesmos casos adversariais do backend contra este arquivo.
 */

export const MENSAGEM_RISCO =
  'Se houver risco agora, ligue 192 (SAMU). Em caso de violência, ligue 190. Para denunciar violência contra a pessoa idosa, Disque 100.';

const TERMOS_DESRESPEITOSOS = [
  /\bpacientes?\b/,
  /\bfardos?\b/,
  /\b(e|eh|virou|vira|se tornou|tornou-se|tem sido|esta sendo|sendo) (um|uma) peso\b/,
  /\bdementes?\b/,
  /\bcaduc[oa]s?\b/,
  /\bcaducando\b/,
];

const ORIENTACAO_MEDICA = [
  /\bdiagnostic/,
  /\b(aumente|aumentar|reduza|reduzir|diminua|diminuir|suspenda|suspender|pare de dar|troque|trocar|ajuste|ajustar|dobre|dobrar)\b.{0,40}\b(dose|doses|remedio|remedios|medicacao|medicamento|medicamentos|comprimido)/,
  /\b(de|dar|ofereca|administre|administrar)\b.{0,15}\b(\d+ ?mg|comprimidos? de|dipirona|paracetamol|rivotril|clonazepam|haloperidol|quetiapina|risperidona|donepezila|memantina|rivastigmina|galantamina)\b/,
  /\bprovavelmente (e|tem|esta com|seja|sejam)\b/,
  /\b(sinal|sinais|sintoma|sintomas|indicio|indicios) de (piora|progressao|avanco|infeccao|avc|delirium|depressao)\b/,
  /\b(estagio|fase) (inicial|moderad[oa]|avancad[oa]|grave|final)\b/,
  /\bpiora (da doenca|do alzheimer|da demencia|cognitiva)\b/,
  /\ba doenca (esta )?(avancando|progredindo)\b/,
];

const RISCO = [
  /\bcai[ru]\b/,
  /\bcaiu\b/,
  /\bqueda\b/,
  /\bbateu a cabeca\b/,
  /\bengasg/,
  /\bfalta de ar\b/,
  /\bnao (consegue|conseguia) respirar\b/,
  /\bdesmai/,
  /\bsangr/,
  /\bconvuls/,
  /\b(sumiu|desapareceu|nao (encontro|acho) (ela|ele))\b/,
  /\bagred/,
  /\bviolencia\b/,
  /\bme bateu\b/,
  /\bnao acorda\b/,
  /\binconscien/,
  /\bdor no peito\b/,
];

const TRAVESSOES = /[\u2014\u2013]/;

export type Violacao = { regra: 'linguagem_desrespeitosa' | 'orientacao_medica' | 'travessao'; trecho: string };

/** Minúsculas e sem acentos, para casar os padrões do mesmo jeito que o backend. */
export function normalizar(texto: string) {
  return texto.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function buscar(padroes: RegExp[], texto: string) {
  const base = normalizar(texto);
  return padroes.flatMap((p) => {
    const achado = base.match(p);
    return achado ? [achado[0]] : [];
  });
}

export function removerTravessoes(texto: string) {
  return texto.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/,\s*,/g, ',');
}

export function verificarTextoFamilia(texto: string): Violacao[] {
  const violacoes: Violacao[] = [
    ...buscar(TERMOS_DESRESPEITOSOS, texto).map((t) => ({ regra: 'linguagem_desrespeitosa' as const, trecho: t })),
    ...buscar(ORIENTACAO_MEDICA, texto).map((t) => ({ regra: 'orientacao_medica' as const, trecho: t })),
  ];
  if (TRAVESSOES.test(texto)) violacoes.push({ regra: 'travessao', trecho: 'travessão' });
  return violacoes;
}

/** Palavras de emergência no relato. Prefere falso positivo a falso negativo. */
export function detectarRisco(texto: string) {
  return buscar(RISCO, texto);
}

/** O que a IA marcou como alerta, mais a checagem por palavras quando ela não marcou nada. */
export function alertasDoRelato(registro: Registro, transcricao: string) {
  const alertas = [...registro.sinais_de_alerta];
  if (!alertas.length) {
    const palavras = detectarRisco(transcricao);
    if (palavras.length) alertas.push(`relato menciona '${palavras[0]}', vale verificar`);
  }
  return alertas;
}

/** Problemas do resumo para a família. Lista vazia significa aprovado. */
export function violacoesDoResumo(resumo: string, alertas: string[]) {
  const violacoes = verificarTextoFamilia(resumo).map((v) => `${v.regra} (${v.trecho})`);
  if (alertas.length && !resumo.includes('192')) violacoes.push('alerta de risco sem orientação de ligar 192');
  if (!resumo.trim()) violacoes.push('resumo vazio');
  return violacoes;
}

/** Resumo montado sem IA, igual ao do backend, usado quando a IA não passa nos guardrails. */
export function resumoSeguro(registro: Registro, alertas: string[]) {
  const partes: string[] = [];
  if (alertas.length) partes.push(`Atenção: ${alertas[0]}. ${MENSAGEM_RISCO}`);
  const rotulos: [string, string][] = [
    ['sono', registro.sono.qualidade],
    ['alimentação', registro.alimentacao.qualidade],
    ['humor', registro.humor.predominante],
    ['remédios tomados', registro.medicacao.tomou],
  ];
  const itens = rotulos.filter(([, v]) => v !== 'nao_informado').map(([k, v]) => `${k}: ${v.replace(/_/g, ' ')}`);
  if (itens.length) partes.push(`Resumo do dia. ${itens.join('; ')}.`);
  if (registro.o_que_ajudou.length) partes.push(`O que ajudou: ${registro.o_que_ajudou.join(', ')}.`);
  if (registro.quem_cuida.cansaco === 'muito') {
    partes.push('Quem cuida relatou muito cansaço hoje. Que tal combinar quem pode ajudar?');
  }
  return partes.join(' ') || 'Registro do dia salvo.';
}

/** Perguntas que testam a memória ou corrigem a pessoa. Espelho de core/reminiscencia.py. */
const TESTA_MEMORIA = /\b(lembra|lembrar|lembrou|recorda|recordar|esqueceu|esquecer|nao e isso)\b/;

/**
 * Confere as perguntas que a IA do celular escreveu para a conversa de hoje. Devolve só as
 * aprovadas: sem testar a memória, sem guardrail violado, curtas e terminando em pergunta.
 */
export function validarPerguntas(perguntas: string[]) {
  return perguntas
    .map((p) => removerTravessoes(p.trim().replace(/^[-*\d.)\s]+/, '')))
    .filter(
      (p) =>
        p.length >= 8 &&
        p.length <= 140 &&
        p.endsWith('?') &&
        !TESTA_MEMORIA.test(normalizar(p)) &&
        verificarTextoFamilia(p).length === 0,
    );
}
