import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

import { mensagemLogin, normalizarEmail } from './validar-login';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chavePublica = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Na web a sessão fica apenas em memória. No celular, Keychain/Keystore.
const memoria = new Map<string, string>();
const storage = {
  getItem: (chave: string) => Platform.OS === 'web' ? Promise.resolve(memoria.get(chave) ?? null) : SecureStore.getItemAsync(chave),
  setItem: async (chave: string, valor: string) => {
    if (Platform.OS === 'web') memoria.set(chave, valor);
    else await SecureStore.setItemAsync(chave, valor);
  },
  removeItem: async (chave: string) => {
    if (Platform.OS === 'web') memoria.delete(chave);
    else await SecureStore.deleteItemAsync(chave);
  },
};

export const supabase: SupabaseClient | null = url && chavePublica
  ? createClient(url, chavePublica, {
      auth: { storage, storageKey: 'sempreaqui.auth.v2', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

export type EstadoSessao = {
  pronta: boolean;
  restaurada: boolean;
  usuario: string | null;
  token: string | null;
  familia: string | null;
  papel: string | null;
  erro: string | null;
};

let estado: EstadoSessao = { pronta: false, restaurada: false, usuario: null, token: null, familia: null, papel: null, erro: null };
const ouvintes = new Set<() => void>();
const trocas = new Set<() => void>();
export function aoTrocarConta(limpar: () => void) { trocas.add(limpar); }

function definir(parcial: Partial<EstadoSessao>) {
  const anterior = estado.usuario;
  estado = { ...estado, ...parcial };
  if (anterior !== estado.usuario) trocas.forEach((limpar) => limpar());
  ouvintes.forEach((o) => o());
}

export function sessaoAtual() { return estado; }
export function useSessao() {
  return useSyncExternalStore((o) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; }, () => estado);
}

supabase?.auth.onAuthStateChange((_evento, sessao) => {
  if (sessao && !sessao.user.is_anonymous) {
    definir({ token: sessao.access_token, usuario: sessao.user.id });
  } else {
    definir({ token: null, usuario: null, familia: null, papel: null, pronta: false });
  }
});
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Restaura somente uma conta com e-mail e senha; não cria usuários anônimos. */
export async function garantirLogin(): Promise<string | null> {
  if (!supabase) { definir({ restaurada: true }); return null; }
  // Remove somente a sessão antiga do SDK, antes armazenada em texto no AsyncStorage.
  // Dados offline do fluxo anterior são preservados, sem atribuí-los a outra conta.
  if (url) {
    const referencia = new URL(url).hostname.split('.')[0];
    await AsyncStorage.removeItem(`sb-${referencia}-auth-token`);
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(mensagemLogin(error));
  if (!data.session || data.session.user.is_anonymous) {
    definir({ restaurada: true });
    return null;
  }
  definir({ token: data.session.access_token, usuario: data.session.user.id, restaurada: true });
  return data.session.access_token;
}

export async function entrarComSenha(email: string, senha: string) {
  if (!supabase) throw new Error('O login ainda não está configurado neste app.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizarEmail(email), password: senha });
  if (error) throw new Error(mensagemLogin(error));
  definir({ token: data.session.access_token, usuario: data.user.id, restaurada: true, erro: null });
}

export function definirFamilia(familia: string, papel: string) {
  definir({ familia, papel, pronta: true, erro: null });
}
export function marcarErroSessao(erro: string) { definir({ erro, restaurada: true, pronta: false }); }

export async function sair() {
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Não consegui sair agora. Tente de novo.');
  }
  definir({ token: null, usuario: null, familia: null, papel: null, pronta: false, restaurada: true, erro: null });
}
