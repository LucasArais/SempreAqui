import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import IaLocal, { type Disponibilidade } from '../../modules/ia-local';
import { promptExtracao, promptResumo, SISTEMA } from '../../prompts/diario-aparelho';
import { promptMemoria, promptPerguntas } from '../../prompts/passaporte-aparelho';
import { api, type Registro, type Relato } from './api';
import {
  alertasDoRelato,
  normalizar,
  removerTravessoes,
  resumoSeguro,
  validarPerguntas,
  verificarTextoFamilia,
  violacoesDoResumo,
} from './guardrails';

/**
 * IA no próprio celular.
 *
 * No iPhone com Apple Intelligence, o relato é transcrito e organizado no aparelho: o áudio
 * nunca sai dele e não há custo de IA. Os guardrails rodam aqui (src/lib/guardrails.ts) e de
 * novo no backend quando o relato sincroniza. Sem suporte, ou se algo falhar, o app usa a nuvem
 * como antes, com os mesmos guardrails.
 *
 * Os prompts ficam em app/prompts/diario-aparelho.ts, versões compactas dos do backend.
 */

export const MODELO_APARELHO = 'apple-foundation-models';
export const VERSAO_PROMPT_APARELHO = 'extracao.aparelho.v1';
const MAX_TENTATIVAS_RESUMO = 2;

const CHAVE_ATIVA = 'ia.no_aparelho.ativa';
const CHAVE_CORRECOES = 'ia.no_aparelho.correcoes';

// Estado ---------------------------------------------------------------------

type Estado = { ativa: boolean; disponibilidade: Disponibilidade | null; carregado: boolean };
let estado: Estado = { ativa: true, disponibilidade: null, carregado: false };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function useIaLocal() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

/** O aparelho tem tudo para rodar a IA local e a família não desligou. */
export function iaLocalPronta() {
  const d = estado.disponibilidade;
  return Boolean(IaLocal && estado.ativa && d?.transcricao && d?.modelo);
}

export async function carregarIaLocal() {
  try {
    const salva = await AsyncStorage.getItem(CHAVE_ATIVA);
    if (salva !== null) definir({ ativa: salva === '1' });
  } catch {
    // Sem armazenamento: fica o padrão, ligada.
  }
  let disponibilidade: Disponibilidade = { transcricao: false, modelo: false, motivo: 'sem_modulo' };
  if (IaLocal) {
    disponibilidade = await IaLocal.disponibilidade().catch(() => ({ transcricao: false, modelo: false, motivo: 'indisponivel' }));
  }
  definir({ disponibilidade, carregado: true });
  void atualizarCorrecoes();
}

export async function definirIaLocalAtiva(ativa: boolean) {
  definir({ ativa });
  await AsyncStorage.setItem(CHAVE_ATIVA, ativa ? '1' : '0').catch(() => undefined);
}

/** Explica em palavras de gente por que a IA do celular não está ligada. */
export function motivoEmPalavras(motivo: string | undefined) {
  switch (motivo) {
    case 'aparelho':
    case 'ios_antigo':
    case 'sem_modulo':
      return 'Este celular não roda a IA da Apple. Os relatos são organizados na nuvem, por provedores que não guardam dados.';
    case 'apple_intelligence_desligada':
      return 'Ligue a Apple Intelligence nos Ajustes do iPhone para o relato ser organizado aqui no celular.';
    case 'baixando':
      return 'O iPhone ainda está baixando a IA da Apple. Enquanto isso, os relatos vão para a nuvem.';
    case 'idioma':
    case 'fala':
      return 'A IA da Apple ainda não está em português neste celular. Os relatos vão para a nuvem.';
    default:
      return 'A IA do celular não está disponível agora. Os relatos vão para a nuvem.';
  }
}

/** As correções da família, guardadas no celular para a IA local aprender mesmo sem internet. */
export async function atualizarCorrecoes() {
  try {
    const { texto } = await api.correcoes();
    await AsyncStorage.setItem(CHAVE_CORRECOES, texto);
  } catch {
    // Sem conexão: vale a última cópia guardada.
  }
}

async function correcoesGuardadas() {
  try {
    const texto = (await AsyncStorage.getItem(CHAVE_CORRECOES)) ?? '';
    // A janela do modelo é pequena: as 6 correções mais recentes bastam.
    return texto.split('\n').slice(0, 6).join('\n');
  } catch {
    return '';
  }
}

// Processamento --------------------------------------------------------------

export type EtapaLocal = 'transcrevendo' | 'organizando' | 'resumindo';

export type ResultadoLocal = {
  transcricao: string;
  registro: Registro;
  alertas: string[];
  resumo: string;
  resumo_seguro: boolean;
};

const OPCOES: Record<string, string[]> = {
  'sono.qualidade': ['boa', 'regular', 'ruim', 'nao_informado'],
  'alimentacao.qualidade': ['boa', 'regular', 'pouca', 'recusou', 'nao_informado'],
  'alimentacao.hidratacao': ['boa', 'pouca', 'nao_informado'],
  'humor.predominante': ['calmo', 'alegre', 'triste', 'ansioso', 'irritado', 'apatico', 'variado', 'nao_informado'],
  'agitacao.nivel': ['nenhuma', 'leve', 'moderada', 'intensa', 'nao_informado'],
  'medicacao.tomou': ['sim', 'nao', 'parcial', 'nao_informado'],
  'quem_cuida.cansaco': ['nenhum', 'algum', 'muito', 'nao_informado'],
};
const PERIODOS = ['manha', 'tarde', 'noite', 'madrugada'];
const EPISODIOS = ['queda', 'desorientacao', 'tentativa_de_sair', 'agressividade', 'alucinacao', 'recusa_de_cuidado', 'engasgo', 'outro'];

type Bruto = Record<string, Record<string, unknown> | unknown[] | undefined>;

const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const escolha = (campo: string, v: unknown) => (typeof v === 'string' && OPCOES[campo].includes(v) ? v : 'nao_informado');
function numero(v: unknown, max: number, inteiro = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return inteiro ? Math.round(v) : v;
}

// Palavras que precisam aparecer no relato para o campo de remédios valer alguma coisa.
const FALA_DE_REMEDIO = /\b(remedi|medica|comprimid|capsul|dose|pilul|gotas?\b|insulina)/;

/**
 * Garante o formato exato do RegistroDiario, mesmo se o modelo pular um campo.
 * Regra fixa: o modelo pequeno às vezes chuta o campo de remédios. Se o relato não fala de
 * remédio, o campo é "nao_informado", não importa o que o modelo disse.
 */
export function normalizarRegistro(bruto: Bruto, transcricao = ''): Registro {
  const registro = montarRegistro(bruto);
  if (transcricao && !FALA_DE_REMEDIO.test(normalizar(transcricao))) {
    registro.medicacao = { tomou: 'nao_informado', observacao: null };
  }
  return registro;
}

function montarRegistro(bruto: Bruto): Registro {
  const o = (k: string) => (bruto[k] && !Array.isArray(bruto[k]) ? (bruto[k] as Record<string, unknown>) : {});
  const episodios = Array.isArray(bruto.episodios) ? (bruto.episodios as Record<string, unknown>[]) : [];
  return {
    sono: {
      qualidade: escolha('sono.qualidade', o('sono').qualidade),
      horas_aproximadas: numero(o('sono').horas_aproximadas, 24),
      despertares_noturnos: numero(o('sono').despertares_noturnos, 50, true),
      observacao: texto(o('sono').observacao),
    },
    alimentacao: {
      qualidade: escolha('alimentacao.qualidade', o('alimentacao').qualidade),
      hidratacao: escolha('alimentacao.hidratacao', o('alimentacao').hidratacao),
      observacao: texto(o('alimentacao').observacao),
    },
    humor: { predominante: escolha('humor.predominante', o('humor').predominante), observacao: texto(o('humor').observacao) },
    agitacao: {
      nivel: escolha('agitacao.nivel', o('agitacao').nivel),
      periodos: lista(o('agitacao').periodos).filter((p) => PERIODOS.includes(p)),
      gatilhos: lista(o('agitacao').gatilhos),
    },
    episodios: episodios
      .filter((e) => e && typeof e.descricao === 'string' && e.descricao.trim())
      .map((e) => ({
        tipo: typeof e.tipo === 'string' && EPISODIOS.includes(e.tipo) ? e.tipo : 'outro',
        descricao: String(e.descricao).trim(),
      })),
    medicacao: { tomou: escolha('medicacao.tomou', o('medicacao').tomou), observacao: texto(o('medicacao').observacao) },
    o_que_ajudou: lista(bruto.o_que_ajudou),
    momentos_bons: lista(bruto.momentos_bons),
    quem_cuida: { cansaco: escolha('quem_cuida.cansaco', o('quem_cuida').cansaco), observacao: texto(o('quem_cuida').observacao) },
    observacoes: lista(bruto.observacoes),
    sinais_de_alerta: lista(bruto.sinais_de_alerta),
  };
}

/** Resumo para a família com a IA do celular: até duas tentativas, depois o resumo seguro. */
export async function escreverResumo(registro: Registro, transcricao: string, alertas: string[]) {
  let violacoes: string[] = [];
  for (let i = 0; i < MAX_TENTATIVAS_RESUMO; i++) {
    try {
      const texto = removerTravessoes((await IaLocal!.gerarTexto(SISTEMA, promptResumo(registro, transcricao, violacoes))).trim());
      violacoes = violacoesDoResumo(texto, alertas);
      if (!violacoes.length) return { resumo: texto, resumo_seguro: false };
    } catch {
      // O modelo da Apple tem filtros próprios e pode recusar relatos de violência ou queda.
      break;
    }
  }
  return { resumo: resumoSeguro(registro, alertas), resumo_seguro: true };
}

/** Transcreve e organiza um relato inteiro no celular. Lança erro se algo falhar. */
export async function processarNoAparelho(uri: string, aoMudarEtapa: (etapa: EtapaLocal) => void): Promise<ResultadoLocal> {
  if (!IaLocal) throw new Error('IA do aparelho indisponível');
  aoMudarEtapa('transcrevendo');
  const transcricao = (await IaLocal.transcrever(uri)).trim();
  if (!transcricao) throw new Error('Transcrição vazia');
  aoMudarEtapa('organizando');
  const json = await IaLocal.gerarRegistro(SISTEMA, promptExtracao(transcricao, await correcoesGuardadas()));
  const registro = normalizarRegistro(JSON.parse(json) as Bruto, transcricao);
  const alertas = alertasDoRelato(registro, transcricao);
  aoMudarEtapa('resumindo');
  const { resumo, resumo_seguro } = await escreverResumo(registro, transcricao, alertas);
  return { transcricao, registro, alertas, resumo, resumo_seguro };
}

/** Depois de uma correção num relato do celular: novo resumo com a IA local, conferido no backend. */
export async function reescreverResumoNoAparelho(relato: Relato): Promise<Relato | undefined> {
  if (!relato.registro || !relato.transcricao) return undefined;
  const { resumo, resumo_seguro } = await escreverResumo(relato.registro, relato.transcricao, relato.alertas);
  if (resumo_seguro) return undefined; // o backend já gravou o resumo seguro com a correção
  return api.resumoDoAparelho(relato.id, resumo);
}

// Passaporte e conversa -------------------------------------------------------

export type ItemSugerido = { titulo: string; detalhe?: string | null };
export type MemoriaOrganizada = {
  quem_ela?: string | null;
  como_se_comunica?: string | null;
  pessoas_importantes: { nome: string; relacao?: string | null }[];
  rotina: ItemSugerido[];
  acalma: ItemSugerido[];
  agita: ItemSugerido[];
  musicas: { titulo: string; artista?: string | null }[];
  comidas: ItemSugerido[];
  lembrancas: ItemSugerido[];
};

const LISTAS_MEMORIA = ['pessoas_importantes', 'rotina', 'acalma', 'agita', 'musicas', 'comidas', 'lembrancas'] as const;

/** Formato garantido e sem nada que viole os guardrails de linguagem, como no backend. */
export function normalizarMemoria(bruto: Record<string, unknown>): MemoriaOrganizada {
  const textoOk = (v: unknown) =>
    typeof v === 'string' && v.trim() && verificarTextoFamilia(v).length === 0 ? v.trim() : null;
  const saida = { quem_ela: textoOk(bruto.quem_ela), como_se_comunica: textoOk(bruto.como_se_comunica) } as MemoriaOrganizada;
  for (const secao of LISTAS_MEMORIA) {
    const lista = Array.isArray(bruto[secao]) ? (bruto[secao] as Record<string, unknown>[]) : [];
    const principal = secao === 'pessoas_importantes' ? 'nome' : 'titulo';
    (saida as Record<string, unknown>)[secao] = lista
      .filter((i) => i && typeof i[principal] === 'string' && String(i[principal]).trim())
      .filter((i) => verificarTextoFamilia(Object.values(i).filter(Boolean).join(' ')).length === 0)
      .map((i) => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : null])));
  }
  return saida;
}

/** Organiza no celular o que a família contou (áudio ou texto). O áudio não sai do aparelho. */
export async function organizarMemoriaNoAparelho(entrada: { uri?: string; texto?: string }) {
  if (!IaLocal) throw new Error('IA do aparelho indisponível');
  const relato = entrada.uri ? (await IaLocal.transcrever(entrada.uri)).trim() : (entrada.texto ?? '').trim();
  if (!relato) throw new Error('Relato vazio');
  const json = await IaLocal.gerarMemoria(SISTEMA, promptMemoria(relato));
  return { relato, memoria: normalizarMemoria(JSON.parse(json) as Record<string, unknown>) };
}

/**
 * Perguntas da conversa de hoje escritas pela IA do celular, a partir do roteiro revisado.
 * Só valem se as 3 passarem na validação; senão, ficam as revisadas.
 */
export async function personalizarPerguntas(contexto: {
  chamada: string;
  tema: string;
  detalhe?: string | null;
  comoSeComunica?: string;
  exemplos: string[];
}): Promise<string[] | null> {
  if (!IaLocal || !iaLocalPronta()) return null;
  try {
    const geradas = await IaLocal.gerarPerguntas(SISTEMA, promptPerguntas(contexto));
    const aprovadas = validarPerguntas(geradas);
    return aprovadas.length === 3 ? aprovadas : null;
  } catch {
    return null;
  }
}

/**
 * Pergunta que o Ajudante do servidor não reconheceu: a IA do celular tenta responder só com o
 * contexto verdadeiro que o servidor mandou. A resposta passa pelos guardrails; se falhar, nada.
 */
export async function responderNoAparelho(pergunta: string, contexto: string): Promise<string | null> {
  if (!IaLocal || !iaLocalPronta()) return null;
  try {
    const prompt = `Responda à pergunta da família usando SOMENTE os fatos abaixo. Se os fatos não respondem, diga exatamente: "Não sei responder isso com o que está registrado." No máximo 3 frases curtas. Não dê diagnóstico, não fale de remédio ou dose, não interprete sintomas.

Fatos registrados:
${contexto}

Pergunta: ${pergunta}`;
    const texto = removerTravessoes((await IaLocal.gerarTexto(SISTEMA, prompt)).trim());
    if (!texto || texto.length > 600 || verificarTextoFamilia(texto).length) return null;
    if (normalizar(texto).includes('nao sei responder')) return null;
    return texto;
  } catch {
    return null;
  }
}
