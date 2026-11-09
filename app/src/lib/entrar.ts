import { api } from './api';
import { definirFamilia, garantirLogin, marcarErroSessao, marcarSemSupabase, supabase } from './sessao';

/** Login anônimo (se preciso) e entrada na família. Usado ao abrir o app e depois de apagar tudo. */
export async function entrar() {
  try {
    if (!supabase) {
      marcarSemSupabase();
      return;
    }
    await garantirLogin();
    const { familia, papel } = await api.sessao();
    definirFamilia(familia, papel);
  } catch {
    marcarErroSessao('Não consegui entrar agora. Seus relatos ficam guardados no celular.');
  }
}
