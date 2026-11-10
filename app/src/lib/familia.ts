import AsyncStorage from './armazenamento-conta';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';

import { api } from './api';
import { aoTrocarConta, sessaoAtual } from './sessao';

/**
 * Rede da Família: quem faz parte, as tarefas da semana e o feed do que aconteceu.
 * Uma cópia fica no celular para as telas abrirem na hora, mesmo sem internet.
 * Lembretes de tarefa são notificações locais: ficam no celular de quem assumiu.
 */

export type Papel = 'quem_cuida' | 'familiar' | 'cuidador_profissional';
export type Membro = { nome: string; papel: Papel; foto?: string | null; eu: boolean };
export type Tarefa = {
  id: string;
  titulo: string;
  tipo: 'consulta' | 'visita' | 'cobrir_folga' | 'compra' | 'outro';
  responsavel_nome: string | null;
  criada_por: string | null;
  quando: string | null;
  concluida: boolean;
  /** Quem assumiu é a conta de quem está usando o app. */
  minha: boolean;
};
export type ItemFeed = {
  id: string;
  ref: string;
  tipo: 'aviso' | 'tarefa_assumida' | 'tarefa_concluida' | 'resumo' | 'conversa';
  autor: string;
  texto: string | null;
  quando: string;
  obrigados: string[];
  agradeci: boolean;
};

export const PAPEIS: Record<Papel, string> = {
  quem_cuida: 'Quem cuida',
  familiar: 'Familiar',
  cuidador_profissional: 'Cuidador profissional',
};

type Estado = {
  membros: Membro[];
  eu: { nome: string; papel: Papel | null; foto?: string | null } | null;
  tarefas: Tarefa[];
  feed: ItemFeed[];
  carregado: boolean;
};

const CHAVE = 'familia.v1';
let estado: Estado = { membros: [], eu: null, tarefas: [], feed: [], carregado: false };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
  void AsyncStorage.setItem(CHAVE, JSON.stringify(estado)).catch(() => undefined);
}

export function useFamilia() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

export function familiaAtual() {
  return estado;
}

/** Nome de quem está usando, ou vazio se ainda não disse. "Quem cuida" é o nome provisório. */
export function meuNome() {
  const nome = estado.eu?.nome ?? '';
  return nome && nome !== 'Quem cuida' && nome !== 'Alguém da família' ? nome : '';
}

export async function carregarFamilia() {
  if (!estado.carregado) {
    try {
      const copia = await AsyncStorage.getItem(CHAVE);
      if (copia) estado = { ...(JSON.parse(copia) as Estado), carregado: false };
    } catch {
      // Sem cópia.
    }
  }
  if (!sessaoAtual().pronta) return;
  const [familia, tarefas, feed] = await Promise.allSettled([api.familia(), api.tarefas(), api.feed()]);
  definir({
    ...(familia.status === 'fulfilled' ? { membros: familia.value.membros, eu: familia.value.eu } : {}),
    ...(tarefas.status === 'fulfilled' ? { tarefas: tarefas.value } : {}),
    ...(feed.status === 'fulfilled' ? { feed: feed.value } : {}),
    carregado: true,
  });
}

function trocarTarefa(tarefa: Tarefa) {
  definir({ tarefas: estado.tarefas.map((t) => (t.id === tarefa.id ? tarefa : t)) });
}

/** Assumir: a tarefa passa a ser minha e ganha um lembrete no meu celular. */
export async function assumirTarefa(id: string) {
  const tarefa = await api.mudarTarefa(id, { assumir: true });
  trocarTarefa(tarefa);
  await agendarLembrete(tarefa);
  void atualizarFeed();
  return tarefa;
}

/** Desistir de uma tarefa assumida: ela volta a ficar livre para a família. */
export async function largarTarefa(id: string) {
  const tarefa = await api.mudarTarefa(id, { largar: true });
  trocarTarefa(tarefa);
  await cancelarLembrete(id);
  void atualizarFeed();
  return tarefa;
}

export async function concluirTarefa(id: string, concluida: boolean) {
  const tarefa = await api.mudarTarefa(id, { concluida });
  trocarTarefa(tarefa);
  if (concluida) await cancelarLembrete(id);
  void atualizarFeed();
  return tarefa;
}

export async function criarTarefa(dados: { titulo: string; tipo: Tarefa['tipo']; quando?: string | null; paraMim?: boolean }) {
  let tarefa = await api.criarTarefa({ titulo: dados.titulo, tipo: dados.tipo, quando: dados.quando ?? null });
  definir({ tarefas: [...estado.tarefas, tarefa] });
  if (dados.paraMim) tarefa = await assumirTarefa(tarefa.id);
  return tarefa;
}

export async function apagarTarefa(id: string) {
  await api.apagarTarefa(id);
  await cancelarLembrete(id);
  definir({ tarefas: estado.tarefas.filter((t) => t.id !== id) });
}

export async function atualizarFeed() {
  try {
    definir({ feed: await api.feed() });
  } catch {
    // Fica o feed guardado.
  }
}

export async function agradecer(ref: string) {
  definir({
    feed: estado.feed.map((i) =>
      i.ref === ref && !i.agradeci ? { ...i, agradeci: true, obrigados: [...i.obrigados, meuNome() || 'Você'] } : i,
    ),
  });
  await api.agradecer(ref).catch(() => undefined);
}

export async function avisarFamilia(texto: string) {
  await api.avisarFamilia(texto);
  void atualizarFeed();
}

export async function atualizarEu(nome: string, papel: Papel, foto: string | null) {
  const eu = await api.atualizarEu(nome, papel, foto);
  definir({ eu, membros: estado.membros.map((m) => (m.eu ? { ...m, nome: eu.nome, papel: eu.papel, foto: eu.foto } : m)) });
  void atualizarFeed();
}

/** Foto de quem aparece pelo nome (no feed, nas tarefas). */
export function fotoDoMembro(nome: string | null | undefined) {
  if (!nome) return undefined;
  return estado.membros.find((m) => m.nome === nome)?.foto ?? undefined;
}

// Lembretes ------------------------------------------------------------------

const chaveLembrete = (id: string) => `lembrete.${id}`;

/** Uma hora antes, ou às 9h do dia se a tarefa não tem hora. Só no celular de quem assumiu. */
async function agendarLembrete(tarefa: Tarefa) {
  if (!tarefa.quando) return;
  const quando = new Date(tarefa.quando);
  let alvo = new Date(quando.getTime() - 60 * 60 * 1000);
  if (quando.getHours() === 0 && quando.getMinutes() === 0) alvo = new Date(quando.setHours(9));
  if (alvo.getTime() <= Date.now()) return;
  try {
    const permissao = await Notifications.requestPermissionsAsync();
    if (!permissao.granted) return;
    await cancelarLembrete(tarefa.id);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Lembrete do SempreAqui', body: `${tarefa.titulo}. Obrigado por assumir.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alvo },
    });
    await AsyncStorage.setItem(chaveLembrete(tarefa.id), id);
  } catch {
    // Sem lembrete: a tarefa continua no app.
  }
}

async function cancelarLembrete(tarefaId: string) {
  try {
    const id = await AsyncStorage.getItem(chaveLembrete(tarefaId));
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(chaveLembrete(tarefaId));
  } catch {
    // Já não existe.
  }
}

/** Quando a tarefa acontece, em palavras de gente: "Hoje, 10h", "Sábado, 14h". */
export function quandoEmPalavras(iso: string | null) {
  if (!iso) return 'Sem data';
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 86400000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const hora = d.getMinutes() ? `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours()}h`;
  if (mesmoDia(d, hoje)) return `Hoje, ${hora}`;
  if (mesmoDia(d, amanha)) return `Amanhã, ${hora}`;
  const dias = (d.getTime() - hoje.getTime()) / 86400000;
  if (dias > 0 && dias < 6) {
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0];
    return `${semana[0].toUpperCase()}${semana.slice(1)}, ${hora}`;
  }
  return `${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}, ${hora}`;
}

export function ehHoje(iso: string | null) {
  return !!iso && new Date(iso).toDateString() === new Date().toDateString();
}

/** Aviso urgente das últimas 24 horas, para ficar no topo da tela Hoje. */
export function avisoDasUltimas24h(feed: ItemFeed[]) {
  return feed.find((i) => i.tipo === 'aviso' && Date.now() - new Date(i.quando).getTime() < 86400000);
}

aoTrocarConta(() => { estado = { membros: [], eu: null, tarefas: [], feed: [], carregado: false }; ouvintes.forEach((o) => o()); });
