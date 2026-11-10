import { api } from './api';
import { definirFamilia, garantirLogin, marcarErroSessao } from './sessao';

/** Restaura o login e mantém a criação/entrada na família já existente no backend. */
export async function entrar() {
  try {
    if (!(await garantirLogin())) return;
    const { familia, papel } = await api.sessao();
    definirFamilia(familia, papel);
  } catch {
    marcarErroSessao('Não consegui abrir sua família agora. Confira sua conexão e tente de novo.');
  }
}
