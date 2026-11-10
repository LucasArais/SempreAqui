import AsyncStorage from './armazenamento-conta';
import * as Crypto from 'expo-crypto';
import type { ImageSource } from 'expo-image';
import { useSyncExternalStore } from 'react';

import { fotos } from '@/data/familia';

import { API_BASE, api, cabecalhos, ErroApi } from './api';
import { aoTrocarConta, sessaoAtual } from './sessao';

/**
 * Passaporte de Memória da família, no formato de backend/core/schemas/passaporte.py.
 *
 * A tela edita item por item; cada mudança salva o passaporte inteiro (PUT /passaporte).
 * Uma cópia fica no celular, então o passaporte abre e a conversa do dia funciona sem internet.
 */

export type Item = { id: string; titulo: string; detalhe?: string | null };
export type Lembranca = Item & { foto?: string | null };
export type PessoaImportante = { id: string; nome: string; relacao?: string | null; foto?: string | null };
export type Musica = { id: string; titulo: string; artista?: string | null; link?: string | null };

export type Passaporte = {
  nome: string;
  como_gosta_de_ser_chamada: string;
  idade: number | null;
  quem_ela: string;
  como_se_comunica: string;
  foto?: string | null;
  foto_familia?: string | null;
  cartao_sus?: string | null;
  ubs_referencia?: string | null;
  pessoas_importantes: PessoaImportante[];
  rotina: Item[];
  acalma: Item[];
  agita: Item[];
  musicas: Musica[];
  comidas: Item[];
  lembrancas: Lembranca[];
};

export type SecaoLista = 'pessoas_importantes' | 'rotina' | 'acalma' | 'agita' | 'musicas' | 'comidas' | 'lembrancas';
export type ItemDe<S extends SecaoLista> = Passaporte[S][number];

export const VAZIO: Passaporte = {
  nome: '',
  como_gosta_de_ser_chamada: '',
  idade: null,
  quem_ela: '',
  como_se_comunica: '',
  pessoas_importantes: [],
  rotina: [],
  acalma: [],
  agita: [],
  musicas: [],
  comidas: [],
  lembrancas: [],
};

/** Títulos das seções, usados nas telas de lista e de edição. */
export const SECOES: Record<SecaoLista, { titulo: string; novo: string; exemplo: string }> = {
  pessoas_importantes: { titulo: 'Pessoas importantes', novo: 'Nova pessoa', exemplo: 'A irmã mais nova' },
  rotina: { titulo: 'Rotina', novo: 'Novo momento da rotina', exemplo: 'Acorda por volta das 7h' },
  acalma: { titulo: 'O que acalma', novo: 'Algo que acalma', exemplo: 'Ouvir música da igreja' },
  agita: { titulo: 'O que agita', novo: 'Algo que agita', exemplo: 'TV muito alta' },
  musicas: { titulo: 'Músicas', novo: 'Nova música', exemplo: 'Detalhes' },
  comidas: { titulo: 'Comidas', novo: 'Nova comida', exemplo: 'Bolo de fubá' },
  lembrancas: { titulo: 'Lembranças', novo: 'Nova lembrança', exemplo: 'A viagem para a praia em 1980' },
};

/** Foto guardada no app a partir da chave do passaporte. Upload de fotos vem depois. */
export function fotoDaChave(chave?: string | null): ImageSource | undefined {
  if (!chave) return undefined;
  if (chave.startsWith('up-')) return { uri: `${API_BASE}/passaporte/fotos/${chave}`, headers: cabecalhos(), cacheKey: chave };
  return fotos[chave];
}

/** Envia uma foto escolhida pela família e devolve a chave para guardar no passaporte. */
export async function enviarFoto(uri: string) {
  const { chave } = await api.enviarFoto(uri);
  return chave;
}

export function novoId(prefixo: string) {
  return `${prefixo}-${Crypto.randomUUID().slice(0, 8)}`;
}

// Estado ---------------------------------------------------------------------

const CHAVE = 'passaporte.v1';
type Estado = { passaporte: Passaporte | null; carregado: boolean };
let estado: Estado = { passaporte: null, carregado: false };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function usePassaporte() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

export function passaporteAtual() {
  return estado.passaporte ?? VAZIO;
}

async function guardarCopia(p: Passaporte) {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(p)).catch(() => undefined);
}

export async function carregarPassaporte() {
  if (!estado.passaporte) {
    try {
      const copia = await AsyncStorage.getItem(CHAVE);
      if (copia) definir({ passaporte: { ...VAZIO, ...(JSON.parse(copia) as Passaporte) } });
    } catch {
      // Sem cópia: espera o servidor.
    }
  }
  if (!sessaoAtual().pronta) return;
  try {
    const p = await api.passaporte();
    definir({ passaporte: p, carregado: true });
    await guardarCopia(p);
    return true;
  } catch {
    definir({ carregado: true });
    return false;
  }
}

/** Salva o passaporte inteiro. Mostra a mudança na hora e desfaz se o servidor recusar. */
export async function salvarPassaporte(novo: Passaporte) {
  const anterior = estado.passaporte;
  definir({ passaporte: novo });
  try {
    const salvo = await api.salvarPassaporte(novo);
    definir({ passaporte: salvo });
    await guardarCopia(salvo);
  } catch (erro) {
    definir({ passaporte: anterior });
    throw erro instanceof ErroApi ? erro : new ErroApi('Não consegui salvar agora. Quer tentar de novo?');
  }
}

export async function salvarItem<S extends SecaoLista>(secao: S, item: ItemDe<S>) {
  const p = passaporteAtual();
  const lista = p[secao] as ItemDe<S>[];
  const existe = lista.some((i) => i.id === item.id);
  const nova = existe ? lista.map((i) => (i.id === item.id ? item : i)) : [...lista, item];
  await salvarPassaporte({ ...p, [secao]: nova });
}

/** Apaga um item e devolve a função de desfazer (volta na mesma posição). */
export async function apagarItem(secao: SecaoLista, id: string) {
  const p = passaporteAtual();
  const lista = p[secao] as { id: string }[];
  const posicao = lista.findIndex((i) => i.id === id);
  const item = lista[posicao];
  await salvarPassaporte({ ...p, [secao]: lista.filter((i) => i.id !== id) });
  return async () => {
    const atual = passaporteAtual()[secao] as { id: string }[];
    const devolvida = [...atual.slice(0, posicao), item, ...atual.slice(posicao)];
    await salvarPassaporte({ ...passaporteAtual(), [secao]: devolvida });
  };
}

// O que falta ------------------------------------------------------------------

const QUE_FALTAM: { chave: keyof Passaporte; titulo: string; pergunta: string }[] = [
  { chave: 'quem_ela', titulo: 'Quem ela é', pergunta: 'O que ela fazia? Do que mais gosta de conversar?' },
  { chave: 'pessoas_importantes', titulo: 'Pessoas importantes', pergunta: 'Quem são as pessoas que ela mais ama?' },
  { chave: 'acalma', titulo: 'O que acalma', pergunta: 'O que costuma acalmar ela num momento difícil?' },
  { chave: 'agita', titulo: 'O que agita', pergunta: 'O que costuma deixar ela agitada ou com medo?' },
  { chave: 'como_se_comunica', titulo: 'Como se comunica', pergunta: 'Qual é o melhor jeito de falar com ela?' },
  { chave: 'rotina', titulo: 'Rotina', pergunta: 'Como é um dia normal dela, do café até a hora de dormir?' },
  { chave: 'musicas', titulo: 'Músicas', pergunta: 'Que músicas ela gosta de cantar ou ouvir?' },
  { chave: 'comidas', titulo: 'Comidas', pergunta: 'Qual é a comida favorita dela?' },
  { chave: 'lembrancas', titulo: 'Lembranças', pergunta: 'Que história ela mais gosta de contar?' },
];

/** Seções vazias, com uma pergunta para a família responder falando. Sem IA: sempre funciona. */
export function oQueFalta(p: Passaporte) {
  const vazias = QUE_FALTAM.filter(({ chave }) => {
    const valor = p[chave];
    return Array.isArray(valor) ? valor.length === 0 : !String(valor ?? '').trim();
  });
  return { vazias, preenchidas: QUE_FALTAM.length - vazias.length, total: QUE_FALTAM.length };
}

aoTrocarConta(() => definir({ passaporte: null, carregado: false }));
