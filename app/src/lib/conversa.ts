import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { api } from './api';
import type { Musica } from './passaporte';
import { sessaoAtual } from './sessao';

/**
 * Conversa de hoje (reminiscência). O roteiro vem do backend (core/reminiscencia.py): um tema do
 * Passaporte e perguntas que mudam todo dia. A reação da família volta para o backend e pesa na
 * escolha dos próximos temas. Sem internet, vale o roteiro guardado e a reação espera na fila.
 */

export type Roteiro = {
  data: string;
  tema_chave: string;
  tipo: string;
  tipo_rotulo: string;
  tema: string;
  detalhe?: string | null;
  foto?: string | null;
  musica?: Musica | null;
  conjunto: number;
  perguntas: string[];
};

export type ConversaHoje = { roteiro: Roteiro | null; feitas_hoje: number; ultima_reacao: string | null };

export type SessaoFeita = Omit<Roteiro, 'tipo_rotulo' | 'detalhe' | 'foto' | 'musica'> & {
  reacao: string;
  nota?: string;
};

const CHAVE_ROTEIRO = 'conversa.hoje.v1';
const CHAVE_FILA = 'conversa.fila.v1';

type Estado = { conversa: ConversaHoje | null; pulados: string[]; carregando: boolean };
let estado: Estado = { conversa: null, pulados: [], carregando: false };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function useConversa() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function carregarConversa(pulados: string[] = estado.pulados) {
  if (!estado.conversa) {
    try {
      const salva = await AsyncStorage.getItem(CHAVE_ROTEIRO);
      const c = salva ? (JSON.parse(salva) as ConversaHoje) : null;
      if (c?.roteiro?.data === hojeLocal()) definir({ conversa: c });
    } catch {
      // Sem cópia.
    }
  }
  if (!sessaoAtual().pronta) return;
  definir({ carregando: true });
  try {
    await enviarFila();
    const c = await api.conversaHoje(pulados);
    definir({ conversa: c, pulados });
    await AsyncStorage.setItem(CHAVE_ROTEIRO, JSON.stringify(c)).catch(() => undefined);
  } catch {
    // Sem conexão: fica o roteiro guardado.
  } finally {
    definir({ carregando: false });
  }
}

/** Outra conversa hoje: pula o tema atual e pede o próximo. */
export async function outraConversa() {
  const atual = estado.conversa?.roteiro?.tema_chave;
  if (!atual) return;
  await carregarConversa([...estado.pulados, atual]);
}

/** Guarda como foi. Sem internet, a reação fica na fila e vai depois. */
export async function registrarConversa(roteiro: Roteiro, reacao: string, nota?: string) {
  const sessao: SessaoFeita = {
    data: roteiro.data,
    tema_chave: roteiro.tema_chave,
    tipo: roteiro.tipo,
    tema: roteiro.tema,
    conjunto: roteiro.conjunto,
    perguntas: roteiro.perguntas,
    reacao,
    nota: nota?.trim() || undefined,
  };
  try {
    await api.registrarConversa(sessao);
  } catch {
    const fila = await lerFila();
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify([...fila, sessao])).catch(() => undefined);
  }
  if (estado.conversa) {
    definir({ conversa: { ...estado.conversa, feitas_hoje: estado.conversa.feitas_hoje + 1, ultima_reacao: reacao } });
  }
}

async function lerFila(): Promise<SessaoFeita[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CHAVE_FILA)) ?? '[]') as SessaoFeita[];
  } catch {
    return [];
  }
}

async function enviarFila() {
  const fila = await lerFila();
  if (!fila.length) return;
  const restantes: SessaoFeita[] = [];
  for (const s of fila) {
    try {
      await api.registrarConversa(s);
    } catch {
      restantes.push(s);
    }
  }
  await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(restantes)).catch(() => undefined);
}
