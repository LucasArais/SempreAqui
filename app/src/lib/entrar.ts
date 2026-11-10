import { api } from './api';
import { definirFamilia, garantirLogin, marcarErroSessao, marcarAbrindoSessao } from './sessao';

/** Restaura o login e mantém a criação/entrada na família já existente no backend. */
let emAndamento: Promise<void> | null = null;
export function entrar(): Promise<void> {
  if (emAndamento) return emAndamento;
  const promessa = restaurar().finally(() => { if (emAndamento === promessa) emAndamento = null; });
  emAndamento = promessa;
  return promessa;
}

async function restaurar() {
  marcarAbrindoSessao();
  try {
    if (!(await garantirLogin())) return;
    const { familia, papel } = await api.sessao();
    definirFamilia(familia, papel);
  } catch {
    marcarErroSessao('Não consegui abrir sua família agora. Confira sua conexão e tente de novo.');
  }
}
