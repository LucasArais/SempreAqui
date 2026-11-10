import AsyncStorage from './armazenamento-conta';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { api, enviarRelato, ErroApi, type EnvioRelato, type Relato } from './api';
import {
  type EtapaLocal,
  iaLocalPronta,
  MODELO_APARELHO,
  processarNoAparelho,
  type ResultadoLocal,
  VERSAO_PROMPT_APARELHO,
} from './ia-local';
import { aoTrocarConta, sessaoAtual } from './sessao';

/**
 * Estado do Diário compartilhado entre as telas.
 *
 * Gravar funciona sem internet: o áudio vai para a pasta de documentos do app e entra numa fila
 * guardada no celular. A fila tenta enviar quando a conexão volta, ao abrir o app e a cada 20 s.
 * O envio é idempotente pelo id, então tentar de novo nunca duplica um relato.
 *
 * Com a IA no próprio celular (ia-local.ts), o relato é organizado aqui mesmo: o resultado
 * aparece na hora, sem internet, e só ele vai para a fila. O áudio fica no aparelho.
 */

/**
 * Guardamos só o nome do arquivo: o caminho absoluto da pasta do app muda entre execuções
 * (e entre atualizações no iOS). O caminho é montado na hora de enviar.
 */
export type Pendente = Omit<EnvioRelato, 'uri'> & {
  arquivo: string;
  tentativas: number;
  /** Organizar com a IA do celular. O áudio não é enviado. */
  noAparelho?: boolean;
  resultado?: ResultadoLocal;
  /** Quem cuida pediu para enviar à família antes de o relato sincronizar. */
  enviarAFamilia?: boolean;
};

/** Relato organizado no celular e ainda não sincronizado, no formato que as telas usam. */
function relatoDoPendente(p: Pendente): Relato | null {
  if (!p.resultado) return null;
  return {
    id: p.id,
    etapa: 'pronto',
    gravado_em: p.gravado_em,
    duracao_s: p.duracao_s,
    ...p.resultado,
    enviado_familia: false,
    tem_audio: false,
    corrigidos: [],
    no_aparelho: true,
  };
}

/** Junta o histórico do servidor com os relatos do celular que ainda não sincronizaram. */
function mesclar(servidor: Relato[], pendentes: Pendente[]) {
  const ids = new Set(servidor.map((r) => r.id));
  const locais = pendentes.map(relatoDoPendente).filter((r): r is Relato => r !== null && !ids.has(r.id));
  return [...locais, ...servidor].sort((a, b) => b.gravado_em.localeCompare(a.gravado_em));
}

/** Áudio que ficou só no celular (relatos organizados aqui), para ouvir de novo. */
export function audioNoAparelho(id: string) {
  const arquivo = new File(pastaDaConta(), `${id}.m4a`);
  return arquivo.exists ? arquivo.uri : undefined;
}

function arquivoDoPendente(p: Pendente & { uri?: string }) {
  const nome = p.arquivo ?? p.uri?.split('/').pop() ?? `${p.id}.m4a`;
  return new File(pastaDaConta(), nome);
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
function pastaDaConta() {
  return new Directory(Paths.document, `relatos-${sessaoAtual().usuario ?? 'sem-conta'}`);
}

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
  try {
    const audio = new File(pastaDaConta(), `${id}.m4a`);
    if (audio.exists) audio.delete();
  } catch {
    // Já não existe.
  }
}

/** Começa a fila, a escuta da rede e carrega o histórico. Pode ser chamado várias vezes. */
export async function iniciarDiario() {
  if (!sessaoAtual().pronta) return;
  if (iniciado) {
    const salva = await AsyncStorage.getItem(CHAVE_FILA).catch(() => null);
    const pendentes = salva ? JSON.parse(salva) as Pendente[] : [];
    definir({ pendentes, relatos: mesclar([], pendentes) });
    await atualizarRelatos();
    void sincronizar();
    return;
  }
  iniciado = true;
  try {
    pastaDaConta().create({ idempotent: true, intermediates: true });
  } catch {
    // A pasta já existe.
  }
  try {
    if (!(await AsyncStorage.getItem(CHAVE_INSTALADO))) {
      await AsyncStorage.setItem(CHAVE_INSTALADO, new Date().toISOString());
    }
    const salva = await AsyncStorage.getItem(CHAVE_FILA);
    if (salva) {
      const pendentes = JSON.parse(salva) as Pendente[];
      definir({ pendentes, relatos: mesclar([], pendentes) });
    }
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
    definir({ relatos: mesclar(relatos, estado.pendentes), online: true });
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
export async function guardarGravacao(
  uriTemporaria: string,
  duracaoS: number,
  opcoes: { noAparelho?: boolean } = {},
): Promise<string> {
  const id = Crypto.randomUUID();
  const origem = new File(uriTemporaria);
  const destino = new File(pastaDaConta(), `${id}.m4a`);
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
    noAparelho: opcoes.noAparelho,
  };
  await salvarFila([pendente, ...estado.pendentes]);
  // Com a IA do celular, quem chama organiza primeiro (organizarNoAparelho) e depois sincroniza.
  if (!opcoes.noAparelho) void sincronizar();
  return id;
}

const emProcessamento = new Set<string>();

/**
 * Organiza um relato da fila com a IA do celular. Mostra o resultado na hora, guarda na fila
 * e sincroniza quando der. Se a IA do celular falhar, o relato volta para o caminho da nuvem.
 */
export async function organizarNoAparelho(id: string, aoMudarEtapa?: (etapa: EtapaLocal) => void) {
  const pendente = estado.pendentes.find((p) => p.id === id);
  if (!pendente) return undefined;
  if (pendente.resultado) return relatoDoPendente(pendente) ?? undefined;
  if (emProcessamento.has(id)) return undefined;
  emProcessamento.add(id);
  try {
    const resultado = await processarNoAparelho(arquivoDoPendente(pendente).uri, (e) => aoMudarEtapa?.(e));
    await salvarFila(estado.pendentes.map((p) => (p.id === id ? { ...p, resultado } : p)));
    const relato = relatoDoPendente({ ...pendente, resultado })!;
    substituirRelato(relato);
    return relato;
  } catch (erro) {
    if (__DEV__) console.warn(`[ia-local] falhou, usando a nuvem: ${String(erro)}`);
    await salvarFila(estado.pendentes.map((p) => (p.id === id ? { ...p, noAparelho: false } : p)));
    return undefined;
  } finally {
    emProcessamento.delete(id);
    void sincronizar();
  }
}

/** Envia o que está na fila. Para no primeiro sinal de falta de conexão. */
export async function sincronizar() {
  if (sincronizando || !estado.pendentes.length || !sessaoAtual().pronta) return;
  const usuario = sessaoAtual().usuario;
  sincronizando = true;
  try {
    for (const pendente of [...estado.pendentes]) {
      if (usuario !== sessaoAtual().usuario) return;
      if (pendente.noAparelho) {
        if (!(await sincronizarDoAparelho(pendente))) break;
        continue;
      }
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
        if (usuario !== sessaoAtual().usuario) return;
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

/**
 * Envia só o resultado de um relato organizado no celular. O áudio continua no aparelho.
 * Devolve false quando falta conexão, para a fila parar e tentar depois.
 */
async function sincronizarDoAparelho(pendente: Pendente): Promise<boolean> {
  if (!pendente.resultado) {
    // O app fechou no meio: organiza de novo, se o celular ainda puder. Se não, vai pela nuvem.
    if (emProcessamento.has(pendente.id)) return true;
    if (iaLocalPronta()) void organizarNoAparelho(pendente.id);
    else await salvarFila(estado.pendentes.map((p) => (p.id === pendente.id ? { ...p, noAparelho: false } : p)));
    return true;
  }
  const { transcricao, registro, resumo } = pendente.resultado;
  try {
    const relato = await api.relatoDoAparelho({
      id: pendente.id,
      duracao_s: pendente.duracao_s,
      gravado_em: pendente.gravado_em,
      enviado_offline: pendente.tentativas > 0,
      segundos_desde_instalacao: pendente.segundos_desde_instalacao,
      transcricao,
      registro,
      resumo,
      modelo: MODELO_APARELHO,
      versao_prompt: VERSAO_PROMPT_APARELHO,
    });
    const pedido = estado.pendentes.find((p) => p.id === pendente.id)?.enviarAFamilia;
    substituirRelato(pedido ? await api.enviarParaFamilia(pendente.id).catch(() => relato) : relato);
    await salvarFila(estado.pendentes.filter((p) => p.id !== pendente.id));
    if (pendente.segundos_desde_instalacao !== undefined) {
      await AsyncStorage.setItem(CHAVE_PRIMEIRO, '1').catch(() => undefined);
    }
    definir({ online: true });
    return true;
  } catch (erro) {
    await salvarFila(
      estado.pendentes.map((p) => (p.id === pendente.id ? { ...p, tentativas: p.tentativas + 1 } : p)),
    );
    if (erro instanceof ErroApi && erro.semConexao) {
      definir({ online: false });
      return false;
    }
    return true;
  }
}

export async function marcarParaEnviar(id: string) {
  await salvarFila(estado.pendentes.map((p) => (p.id === id ? { ...p, enviarAFamilia: true } : p)));
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

/** Depois de apagar todos os dados: esvazia a fila, o histórico e a pasta de áudios do celular. */
export async function limparTudoLocal() {
  try {
    if (pastaDaConta().exists) pastaDaConta().delete();
    pastaDaConta().create({ idempotent: true, intermediates: true });
  } catch {
    // Se não der para apagar a pasta, os arquivos ficam órfãos e somem com o app.
  }
  await AsyncStorage.multiRemove([CHAVE_FILA, CHAVE_PRIMEIRO]).catch(() => undefined);
  definir({ pendentes: [], relatos: [] });
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

aoTrocarConta(() => definir({ pendentes: [], relatos: [], online: true, carregado: false }));
