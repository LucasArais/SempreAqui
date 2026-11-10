import { useSyncExternalStore } from 'react';

import { carregarConversa } from './conversa';
import { iniciarDiario } from './diario';
import { carregarFamilia } from './familia';
import { carregarPassaporte } from './passaporte';
import { atualizarSemana } from './semana';
import { aoTrocarConta, sessaoAtual } from './sessao';

type Estado = { carregando: boolean; carregado: boolean; erro: string | null };
let estado: Estado = { carregando: false, carregado: false, erro: null };
const ouvintes = new Set<() => void>();
let emAndamento: { usuario: string; promessa: Promise<void> } | null = null;

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function useCarregamento() {
  return useSyncExternalStore((o) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; }, () => estado);
}

/** Atualiza sem apagar o conteúdo visível; chamadas simultâneas compartilham o mesmo trabalho. */
export function atualizarDados(): Promise<void> {
  const { usuario, pronta } = sessaoAtual();
  if (!usuario || !pronta) return Promise.resolve();
  if (emAndamento?.usuario === usuario) return emAndamento.promessa;
  definir({ carregando: true, erro: null });
  const promessa = Promise.allSettled([
    carregarPassaporte(), carregarFamilia(), iniciarDiario(), carregarConversa(), atualizarSemana(),
  ]).then((resultados) => {
    if (sessaoAtual().usuario !== usuario) return;
    const falhou = resultados.some((r) => r.status === 'rejected' || r.value === false);
    definir({ carregando: false, carregado: true, erro: falhou
      ? 'Não consegui atualizar todas as informações. Confira sua conexão e tente de novo.' : null });
  }).finally(() => {
    if (emAndamento?.promessa === promessa) emAndamento = null;
  });
  emAndamento = { usuario, promessa };
  return promessa;
}

aoTrocarConta(() => {
  emAndamento = null;
  definir({ carregando: false, carregado: false, erro: null });
});
