import AsyncStorage from './armazenamento-conta';
import { aoTrocarConta, sessaoAtual } from './sessao';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { api } from './api';
import type { RespostaApoio } from './apoio';
import { responderNoAparelho } from './ia-local';

/**
 * Ajudante: o chat da família (backend/core/assistente.py). A conversa fica só neste celular;
 * o servidor responde e não guarda a pergunta.
 */

export type RespostaAjudante = {
  tipo: 'resposta' | 'apoio' | 'nao_entendi';
  texto: string | null;
  origem: string | null;
  sugestoes?: string[];
  acao?: 'ver_semana' | 'ver_tarefas' | 'nova_tarefa' | 'ver_passaporte' | 'abrir_conversa' | 'ver_sus' | 'ver_perto' | 'ver_naomi';
  relato_id?: string;
  apoio?: RespostaApoio;
  contexto?: string;
  /** 'ia' quando a resposta veio da IA (com fontes conferidas); 'regras' quando veio das regras. */
  motor?: string;
  /** Trechos do Guia Prático do Cuidador usados na resposta. */
  links?: { fonte: string; url: string }[];
};

/** Padrão que a Naomi percebeu sozinha nos relatos (backend/core/avisos.py). */
export type AvisoNaomi = {
  titulo: string;
  texto: string;
  tipo: 'levar_a_consulta' | 'cuidar_de_quem_cuida' | 'o_que_funciona';
  evidencias: string[];
  acao: 'ver_semana' | 'nova_tarefa' | 'ver_passaporte' | null;
};

export type Mensagem = {
  id: string;
  de: 'eu' | 'ajudante';
  texto?: string;
  resposta?: RespostaAjudante;
  erro?: boolean;
};

const CHAVE = 'ajudante.mensagens.v1';
type Estado = { mensagens: Mensagem[]; pensando: boolean; carregado: boolean };
let estado: Estado = { mensagens: [], pensando: false, carregado: false };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
  if ('mensagens' in parcial) {
    void AsyncStorage.setItem(CHAVE, JSON.stringify(estado.mensagens.slice(-40))).catch(() => undefined);
  }
}

export function useAjudante() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

export async function carregarAjudante() {
  if (estado.carregado) return;
  try {
    const salvas = await AsyncStorage.getItem(CHAVE);
    definir({ mensagens: salvas ? (JSON.parse(salvas) as Mensagem[]) : [], carregado: true });
  } catch {
    definir({ carregado: true });
  }
}

export function apagarConversa() {
  definir({ mensagens: [] });
}

export async function perguntar(texto: string) {
  const usuario = sessaoAtual().usuario;
  const pergunta = texto.trim();
  if (!pergunta || estado.pensando) return;
  // As últimas mensagens vão junto, para a Naomi entender "e de música?" depois de "do que ela gosta de comer?".
  const historico = estado.mensagens
    .filter((m) => !m.erro)
    .slice(-6)
    .map((m) => ({ de: m.de === 'eu' ? ('eu' as const) : ('naomi' as const), texto: (m.texto ?? m.resposta?.texto ?? '').slice(0, 1000) }))
    .filter((m) => m.texto);
  const minha: Mensagem = { id: Crypto.randomUUID(), de: 'eu', texto: pergunta };
  definir({ mensagens: [...estado.mensagens, minha], pensando: true });
  let resposta: Mensagem;
  try {
    const r = await api.assistente(pergunta, historico);
    if (r.tipo === 'nao_entendi' && r.contexto) {
      // A IA do celular tenta com os fatos verdadeiros que o servidor mandou.
      const local = await responderNoAparelho(pergunta, r.contexto);
      if (local) {
        r.tipo = 'resposta';
        r.texto = local;
        r.origem = 'Respondido aqui no seu celular, só com o que está registrado';
      }
    }
    resposta = { id: Crypto.randomUUID(), de: 'ajudante', resposta: r };
  } catch {
    resposta = {
      id: Crypto.randomUUID(),
      de: 'ajudante',
      texto: 'Estou sem conexão agora. Se for urgente, ligue 192. Tente de novo em instantes.',
      erro: true,
    };
  }
  if (usuario !== sessaoAtual().usuario) return;
  definir({ mensagens: [...estado.mensagens, resposta], pensando: false });
}

aoTrocarConta(() => { estado = { mensagens: [], pensando: false, carregado: false }; ouvintes.forEach((o) => o()); });
