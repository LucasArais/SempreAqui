import AsyncStorage from './armazenamento-conta';
import { useSyncExternalStore } from 'react';

import { api } from './api';
import { personalizarPerguntas } from './ia-local';
import { type Musica, passaporteAtual } from './passaporte';
import { aoTrocarConta, sessaoAtual } from './sessao';

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
  /** Perguntas reescritas pela IA do celular a partir do roteiro revisado. */
  personalizada?: boolean;
};

export type ConversaHoje = { roteiro: Roteiro | null; feitas_hoje: number; ultima_reacao: string | null };

export type SessaoFeita = Omit<Roteiro, 'tipo_rotulo' | 'detalhe' | 'foto' | 'musica' | 'personalizada'> & {
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
  const usuario = sessaoAtual().usuario;
  definir({ carregando: true });
  try {
    void enviarFila().catch(() => undefined);
    const c = await api.conversaHoje(pulados);
    if (usuario !== sessaoAtual().usuario) return false;
    definir({ conversa: c, pulados });
    await AsyncStorage.setItem(CHAVE_ROTEIRO, JSON.stringify(c)).catch(() => undefined);
    // A conversa base aparece imediatamente; a personalização local vem depois.
    if (c.roteiro) void comPerguntasDoCelular(c.roteiro).then((roteiro) => {
      if (usuario !== sessaoAtual().usuario || estado.conversa !== c) return;
      const conversa = { ...c, roteiro };
      definir({ conversa });
      void AsyncStorage.setItem(CHAVE_ROTEIRO, JSON.stringify(conversa)).catch(() => undefined);
    }).catch(() => undefined);
    return true;
  } catch {
    // Sem conexão: fica o roteiro guardado.
    return false;
  } finally {
    definir({ carregando: false });
  }
}

/**
 * Com a IA do celular, as perguntas do roteiro revisado viram perguntas pensadas para ela,
 * guardadas por dia e tema (a mesma conversa não muda ao reabrir). O fechamento é mantido.
 */
async function comPerguntasDoCelular(roteiro: Roteiro): Promise<Roteiro> {
  const chave = `conversa.perguntas.${roteiro.data}.${roteiro.tema_chave}`;
  try {
    const guardadas = await AsyncStorage.getItem(chave);
    if (guardadas) return { ...roteiro, perguntas: JSON.parse(guardadas) as string[], personalizada: true };
  } catch {
    // Sem cópia: gera de novo.
  }
  const p = passaporteAtual();
  const novas = await personalizarPerguntas({
    chamada: p.como_gosta_de_ser_chamada || 'a senhora',
    tema: roteiro.tema,
    detalhe: roteiro.detalhe,
    comoSeComunica: p.como_se_comunica,
    exemplos: roteiro.perguntas.slice(0, 3),
  });
  if (!novas) return roteiro;
  const perguntas = [...novas, roteiro.perguntas[roteiro.perguntas.length - 1]];
  await AsyncStorage.setItem(chave, JSON.stringify(perguntas)).catch(() => undefined);
  return { ...roteiro, perguntas, personalizada: true };
}

/** Ao voltar para a tela: se o dia virou, busca a conversa nova. */
export function atualizarSeMudouODia() {
  const data = estado.conversa?.roteiro?.data;
  if (!estado.carregando && (!estado.conversa || (data && data !== hojeLocal()))) {
    definir({ pulados: [] });
    void carregarConversa([]);
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
  const usuario = sessaoAtual().usuario;
  const fila = await lerFila();
  if (!fila.length) return;
  const restantes: SessaoFeita[] = [];
  for (const s of fila) {
    if (usuario !== sessaoAtual().usuario) return;
    try {
      await api.registrarConversa(s);
    } catch {
      restantes.push(s);
    }
  }
  if (usuario !== sessaoAtual().usuario) return;
  await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(restantes)).catch(() => undefined);
}

aoTrocarConta(() => definir({ conversa: null, pulados: [], carregando: false }));
