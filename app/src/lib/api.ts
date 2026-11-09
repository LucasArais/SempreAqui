import Constants from 'expo-constants';
import { File } from 'expo-file-system';

import { sessaoAtual, supabase } from './sessao';

/**
 * Cliente da API do SempreAqui.
 *
 * Endereço: EXPO_PUBLIC_API_URL, se existir. Em desenvolvimento, o app usa o mesmo IP do Metro
 * na porta 8000, então funciona no simulador e no celular da mesma rede sem configurar nada.
 *
 * Família: por enquanto a família de demonstração. Com o login do Supabase, o id vem do token.
 * Nenhuma chave secreta mora no app.
 */
export const FAMILIA_DEMO = 'familia-demo';

function descobrirBase(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL;
  if (configurada) return configurada.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:8000`;
}

export const API_BASE = descobrirBase();

/** Com login: o token. Sem Supabase configurado: a família de demonstração local. */
export function cabecalhos(): Record<string, string> {
  const { token } = sessaoAtual();
  if (token) return { Authorization: `Bearer ${token}` };
  return supabase ? {} : { 'X-Familia': FAMILIA_DEMO };
}

export type Etapa = 'recebido' | 'transcrevendo' | 'organizando' | 'resumindo' | 'pronto' | 'erro';

export type Registro = {
  sono: { qualidade: string; horas_aproximadas?: number | null; despertares_noturnos?: number | null; observacao?: string | null };
  alimentacao: { qualidade: string; hidratacao: string; observacao?: string | null };
  humor: { predominante: string; observacao?: string | null };
  agitacao: { nivel: string; periodos: string[]; gatilhos: string[] };
  episodios: { tipo: string; descricao: string; periodo?: string | null }[];
  medicacao: { tomou: string; observacao?: string | null };
  o_que_ajudou: string[];
  momentos_bons: string[];
  quem_cuida: { cansaco: string; observacao?: string | null };
  observacoes: string[];
  sinais_de_alerta: string[];
};

export type Relato = {
  id: string;
  etapa: Etapa;
  erro?: string | null;
  gravado_em: string;
  duracao_s?: number | null;
  transcricao?: string | null;
  registro?: Registro | null;
  alertas: string[];
  resumo?: string | null;
  resumo_seguro: boolean;
  enviado_familia: boolean;
  tem_audio: boolean;
  corrigidos: string[];
};

export type CampoEditavel = { campo: string; rotulo: string; opcoes: string[] | null };

/** Erro com mensagem já pronta para mostrar na tela. */
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly semConexao = false,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE}${caminho}`, {
      ...init,
      headers: { ...cabecalhos(), ...(init.headers ?? {}) },
    });
  } catch (erro) {
    // Só em desenvolvimento, e só o motivo técnico: nunca conteúdo do relato.
    if (__DEV__) console.warn(`[api] ${init.method ?? 'GET'} ${caminho} falhou: ${String(erro)}`);
    throw new ErroApi('Sem conexão agora. Seu relato fica guardado no celular.', true);
  }
  if (resposta.status === 204) return undefined as T;
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const detalhe = typeof corpo?.detail === 'string' ? corpo.detail : null;
    throw new ErroApi(detalhe ?? 'Algo não saiu como esperado. Quer tentar de novo?');
  }
  return corpo as T;
}

export type EnvioRelato = {
  id: string;
  uri: string;
  mime: string;
  duracao_s: number;
  gravado_em: string;
  enviado_offline: boolean;
  segundos_desde_instalacao?: number;
};

export function enviarRelato(envio: EnvioRelato) {
  const form = new FormData();
  // O fetch do Expo SDK 58 só aceita Blob no FormData; o File do expo-file-system é um Blob.
  form.append('audio', new File(envio.uri) as unknown as Blob, `${envio.id}.m4a`);
  form.append('id', envio.id);
  form.append('duracao_s', String(envio.duracao_s));
  form.append('gravado_em', envio.gravado_em);
  form.append('enviado_offline', String(envio.enviado_offline));
  if (envio.segundos_desde_instalacao !== undefined) {
    form.append('segundos_desde_instalacao', String(Math.round(envio.segundos_desde_instalacao)));
  }
  return chamar<Relato>('/diario/relatos', { method: 'POST', body: form });
}

export const api = {
  relato: (id: string) => chamar<Relato>(`/diario/relatos/${id}`),
  relatos: () => chamar<Relato[]>('/diario/relatos'),
  campos: () => chamar<CampoEditavel[]>('/diario/campos'),
  corrigir: (id: string, campo: string, valor: unknown) =>
    chamar<{ relato: Relato; correcao_id: string }>(`/diario/relatos/${id}/campos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo, valor }),
    }),
  desfazer: (id: string, correcaoId: string) =>
    chamar<Relato>(`/diario/relatos/${id}/correcoes/${correcaoId}`, { method: 'DELETE' }),
  tentarDeNovo: (id: string) => chamar<Relato>(`/diario/relatos/${id}/tentar-de-novo`, { method: 'POST' }),
  enviarParaFamilia: (id: string) => chamar<Relato>(`/diario/relatos/${id}/enviar`, { method: 'POST' }),
  apagar: (id: string) => chamar<void>(`/diario/relatos/${id}`, { method: 'DELETE' }),
  evento: (tipo: string, valor?: number, rotulo?: string) =>
    chamar<void>('/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor, rotulo }),
    }).catch(() => undefined),
  fonteAudio: (id: string) => ({ uri: `${API_BASE}/diario/relatos/${id}/audio`, headers: cabecalhos() }),
  sessao: (nome_exibicao?: string) =>
    chamar<{ familia: string; papel: string }>('/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nome_exibicao ? { nome_exibicao } : {}),
    }),
  consentir: (versao_termo: string, finalidades: string[]) =>
    chamar<void>('/consentimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versao_termo, finalidades }),
    }),
};
