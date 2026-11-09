import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

/**
 * Login anônimo: cada celular entra sozinho, sem cadastro, e o backend coloca a pessoa numa
 * família. A sessão fica guardada no celular e o token é renovado automaticamente.
 *
 * Só valores públicos aqui (URL e chave publishable). O RLS do banco protege os dados.
 * Sem Supabase configurado, o app cai no modo de demonstração local (cabeçalho X-Familia).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && chavePublica
    ? createClient(url, chavePublica, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export type EstadoSessao = {
  pronta: boolean;
  token: string | null;
  familia: string | null;
  papel: string | null;
  erro: string | null;
};

let estado: EstadoSessao = { pronta: false, token: null, familia: null, papel: null, erro: null };
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<EstadoSessao>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((o) => o());
}

export function sessaoAtual() {
  return estado;
}

export function useSessao() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
  );
}

supabase?.auth.onAuthStateChange((_evento, sessao) => {
  definir({ token: sessao?.access_token ?? null });
});

/** Garante um usuário (anônimo, se for a primeira vez) e devolve o token. */
export async function garantirLogin(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    definir({ token: data.session.access_token });
    return data.session.access_token;
  }
  const { data: novo, error } = await supabase.auth.signInAnonymously();
  if (error || !novo.session) throw new Error(error?.message ?? 'login anônimo falhou');
  definir({ token: novo.session.access_token });
  return novo.session.access_token;
}

export function definirFamilia(familia: string, papel: string) {
  definir({ familia, papel, pronta: true, erro: null });
}

export function marcarSemSupabase() {
  definir({ pronta: true });
}

export function marcarErroSessao(erro: string) {
  definir({ erro, pronta: true });
}

/** Sai do usuário atual (usado depois de apagar todos os dados). */
export async function sair() {
  await supabase?.auth.signOut().catch(() => undefined);
  definir({ token: null, familia: null, papel: null });
}
