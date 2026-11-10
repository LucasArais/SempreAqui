import AsyncStorage from '@react-native-async-storage/async-storage';

import { sessaoAtual } from './sessao';

function chaveDaConta(chave: string) {
  const usuario = sessaoAtual().usuario;
  if (!usuario) throw new Error('Entre para acessar os dados salvos.');
  return `conta.${usuario}.${chave}`;
}

/** Cópias e filas offline nunca são compartilhadas entre contas no mesmo celular. */
export default {
  getItem: async (chave: string) => {
    const usuario = sessaoAtual().usuario;
    const valor = await AsyncStorage.getItem(chaveDaConta(chave));
    if (usuario !== sessaoAtual().usuario) throw new Error('A conta foi alterada.');
    return valor;
  },
  setItem: async (chave: string, valor: string) => AsyncStorage.setItem(chaveDaConta(chave), valor),
  removeItem: async (chave: string) => AsyncStorage.removeItem(chaveDaConta(chave)),
  multiRemove: async (chaves: string[]) => AsyncStorage.multiRemove(chaves.map(chaveDaConta)),
};
