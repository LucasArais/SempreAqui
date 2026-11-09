import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { api, enviarRelato, ErroApi, type EnvioRelato, type Relato } from './api';
import { sessaoAtual } from './sessao';

/**
 * Estado do Diário compartilhado entre as telas.
 *
 * Gravar funciona sem internet: o áudio vai para a pasta de documentos do app e entra numa fila
 * guardada no celular. A fila tenta enviar quando a conexão volta, ao abrir o app e a cada 20 s.
 * O envio é idempotente pelo id, então tentar de novo nunca duplica um relato.
 */

/**
 * Guardamos só o nome do arquivo: o caminho absoluto da pasta do app muda entre execuções
 * (e entre atualizações no iOS). O caminho é montado na hora de enviar.
 */
export type Pendente = Omit<EnvioRelato, 'uri'> & { arquivo: string; tentativas: number };

function arquivoDoPendente(p: Pendente & { uri?: string }) {
  const nome = p.arquivo ?? p.uri?.split('/').pop() ?? `${p.id}.m4a`;
  return new File(PASTA, nome);
}

export function uriDoPendente(p: Pendente) {
  return arquivoDoPendente(p).uri;
}

type Estado = {
  pendentes: Pendente[];
  relatos: Relato[];
  online: boolean;
  carregado: boolean;
};

const CHAVE_FILA = 'diario.fila.v1';
const CHAVE_INSTALADO = 'app.instalado_em';
const CHAVE_PRIMEIRO = 'diario.primeiro_enviado';
const PASTA = new Directory(Paths.document, 'relatos');

let estado: Estado = { pendentes: [], relatos: [], online: true, carregado: false };
const ouvintes = new Set<() => void>();
let iniciado = false;
let sincronizando = false;

function definir(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((ouvir) => ouvir());
}

function assinar(ouvir: () => void) {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}

/** Leitura pontual do estado, fora de componentes. */
export function estadoAtual() {
  return estado;
}

export function useDiario() {
  return useSyncExternalStore(assinar, () => estado);
}

export function useRelato(id: string | undefined) {
  const { relatos, pendentes } = useDiario();
  return {
    relato: relatos.find((r) => r.id === id),
    pendente: pendentes.find((p) => p.id === id),
  };
}

async function salvarFila(pendentes: Pendente[]) {
  definir({ pendentes });
  try {
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(pendentes));
  } catch {
    // Se o armazenamento falhar, a fila continua em memória até o app fechar.
  }
}

export function substituirRelato(relato: Relato) {
  const outros = estado.relatos.filter((r) => r.id !== relato.id);
  const relatos = [relato, ...outros].sort((a, b) => b.gravado_em.localeCompare(a.gravado_em));
  definir({ relatos });
}

export function removerRelatoLocal(id: string) {
  definir({ relatos: estado.relatos.filter((r) => r.id !== id) });
}

/** Começa a fila, a escuta da rede e carrega o histórico. Pode ser chamado várias vezes. */
export async function iniciarDiario() {
  if (iniciado) return;
  iniciado = true;
  try {
    PASTA.create({ idempotent: true, intermediates: true });
  } catch {
    // A pasta já existe.
  }
  try {
    if (!(await AsyncStorage.getItem(CHAVE_INSTALADO))) {
      await AsyncStorage.setItem(CHAVE_INSTALADO, new Date().toISOString());
    }
    const salva = await AsyncStorage.getItem(CHAVE_FILA);
    if (salva) definir({ pendentes: JSON.parse(salva) as Pendente[] });
  } catch {
    // Sem armazenamento: segue só em memória.
  }
  const rede = await Network.getNetworkStateAsync().catch(() => null);
  definir({ online: rede?.isInternetReachable ?? rede?.isConnected ?? true });
  Network.addNetworkStateListener((novo) => {
    const online = novo.isInternetReachable ?? novo.isConnected ?? false;
    definir({ online });
    if (online) void sincronizar();
  });
  setInterval(() => {
    if (estado.pendentes.length) void sincronizar();
    const emAndamento = estado.relatos.some((r) => !['pronto', 'erro'].includes(r.etapa));
    if (emAndamento) void atualizarRelatos();
  }, 20000);
  await atualizarRelatos();
  definir({ carregado: true });
  void sincronizar();
}

export async function atualizarRelatos() {
  if (!sessaoAtual().pronta) return;
  try {
    const relatos = await api.relatos();
    definir({ relatos, online: true });
  } catch (erro) {
    if (erro instanceof ErroApi && erro.semConexao) definir({ online: false });
  }
}

async function segundosDesdeInstalacao(): Promise<number | undefined> {
  try {
    if (await AsyncStorage.getItem(CHAVE_PRIMEIRO)) return undefined;
    const instalado = await AsyncStorage.getItem(CHAVE_INSTALADO);
    return instalado ? (Date.now() - new Date(instalado).getTime()) / 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** Guarda a gravação no celular, coloca na fila e tenta enviar. Devolve o id do relato. */
export async function guardarGravacao(uriTemporaria: string, duracaoS: number): Promise<string> {
  const id = Crypto.randomUUID();
  const origem = new File(uriTemporaria);
  const destino = new File(PASTA, `${id}.m4a`);
  try {
    origem.move(destino);
  } catch {
    origem.copy(destino);
  }
  const pendente: Pendente = {
    id,
    arquivo: `${id}.m4a`,
    mime: 'audio/mp4',
    duracao_s: Math.round(duracaoS * 10) / 10,
    gravado_em: new Date().toISOString(),
    enviado_offline: false,
    segundos_desde_instalacao: await segundosDesdeInstalacao(),
    tentativas: 0,
  };
  await salvarFila([pendente, ...estado.pendentes]);
  void sincronizar();
  return id;
}

/** Envia o que está na fila. Para no primeiro sinal de falta de conexão. */
export async function sincronizar() {
  if (sincronizando || !estado.pendentes.length || !sessaoAtual().pronta) return;
  sincronizando = true;
  try {
    for (const pendente of [...estado.pendentes]) {
      const arquivo = arquivoDoPendente(pendente);
      if (!arquivo.exists) {
        // Sem o áudio no celular não há o que reenviar. Se o servidor já tem o relato, ótimo.
        await salvarFila(estado.pendentes.filter((p) => p.id !== pendente.id));
        continue;
      }
      try {
        const relato = await enviarRelato({
          ...pendente,
          uri: arquivo.uri,
          enviado_offline: pendente.tentativas > 0,
        });
        substituirRelato(relato);
        await salvarFila(estado.pendentes.filter((p) => p.id !== pendente.id));
        try {
          arquivo.delete();
        } catch {
          // O servidor já tem o áudio; se não der para apagar a cópia local, tudo bem.
        }
        if (pendente.segundos_desde_instalacao !== undefined) {
          await AsyncStorage.setItem(CHAVE_PRIMEIRO, '1').catch(() => undefined);
        }
        definir({ online: true });
      } catch (erro) {
        await salvarFila(
          estado.pendentes.map((p) => (p.id === pendente.id ? { ...p, tentativas: p.tentativas + 1 } : p)),
        );
        if (erro instanceof ErroApi && erro.semConexao) {
          definir({ online: false });
          break;
        }
      }
    }
  } finally {
    sincronizando = false;
  }
}

/** Acompanha um relato até ficar pronto ou dar erro, atualizando a store. */
export async function acompanhar(id: string, aoAtualizar?: (relato: Relato) => void) {
  for (let i = 0; i < 90; i++) {
    try {
      const relato = await api.relato(id);
      substituirRelato(relato);
      aoAtualizar?.(relato);
      if (relato.etapa === 'pronto' || relato.etapa === 'erro') return relato;
    } catch (erro) {
      if (erro instanceof ErroApi && erro.semConexao) return undefined;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return undefined;
}

/** Descarta uma gravação que ainda não foi enviada. */
export function descartarArquivo(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // Já não existe.
  }
}

/** Atualiza o histórico sempre que a tela volta a ficar visível. */
export function useAtualizarAoFocar() {
  useFocusEffect(
    useCallback(() => {
      void atualizarRelatos();
      void sincronizar();
    }, []),
  );
}
