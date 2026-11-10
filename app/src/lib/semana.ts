import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { api } from './api';
import { aoTrocarConta, sessaoAtual } from './sessao';

export type DiaSemana = {
  data: string;
  dia: string;
  tem_relato: boolean;
  sono_qualidade: string | null;
  sono_horas: number | null;
  alerta: boolean;
};

export type Mudanca = { tipo: string; texto: string; datas: string[] };

export type Semana = {
  inicio: string;
  fim: string;
  periodo: string;
  dias: DiaSemana[];
  dias_com_relato: number;
  linha_de_base_dias: number;
  habitual_sono_horas: number | null;
  mudancas: Mudanca[];
  para_consulta: string[];
  o_que_ajudou: string[];
  resumo: string;
  resumo_seguro: boolean;
};

type Estado = { semana: Semana | null; erro: string | null };
let estado: Estado = { semana: null, erro: null };
const ouvintes = new Set<() => void>();
let emAndamento: Promise<boolean> | null = null;
function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function atualizarSemana(): Promise<boolean> {
  if (!sessaoAtual().pronta) return Promise.resolve(false);
  if (emAndamento) return emAndamento;
  const usuario = sessaoAtual().usuario;
  const promessa = api.semana().then((semana) => {
    if (usuario !== sessaoAtual().usuario) return false;
    definir({ semana, erro: null });
    return true;
  }).catch(() => {
    if (usuario === sessaoAtual().usuario) definir({ erro: 'Não consegui carregar a semana agora.' });
    return false;
  }).finally(() => { if (emAndamento === promessa) emAndamento = null; });
  emAndamento = promessa;
  return promessa;
}

/** Compartilha dados entre Hoje e Esta semana e mantém a última cópia ao atualizar. */
export function useSemana() {
  const dados = useSyncExternalStore((o) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; }, () => estado);
  useFocusEffect(useCallback(() => { void atualizarSemana(); }, []));
  return { ...dados, carregar: atualizarSemana };
}

aoTrocarConta(() => {
  emAndamento = null;
  definir({ semana: null, erro: null });
});
