import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { createDownloadResumable } from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';

import type { Disponibilidade } from './tipos';

/** Só a parte do whisper.rn que usamos (os tipos do pacote não passam no nosso typecheck). */
type WhisperContext = {
  transcribe(caminho: string, opcoes?: { language?: string }): { stop(): Promise<void>; promise: Promise<{ result: string }> };
  release(): Promise<void>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initWhisper } = require('whisper.rn/index') as { initWhisper(o: { filePath: string }): Promise<WhisperContext> };

/**
 * IA no aparelho no Android, com a mesma interface do módulo do iOS. O motor é escolhido pelo
 * próprio celular, sempre de graça:
 *
 * 1. Gemini Nano (ML Kit, AICore): o modelo do próprio Android, nos aparelhos que têm. Nada a
 *    baixar além da fala.
 * 2. Llama 3.2 3B Instruct (llama.cpp via llama.rn), nos celulares com 6 GB de RAM ou mais. Saída
 *    presa a um JSON Schema, o equivalente da geração guiada da Apple. Foi o melhor modelo aberto
 *    de até 3B na comparação do projeto (backend/evals/comparar_modelos_aparelho.py).
 * 3. Abaixo disso, a nuvem, com os mesmos guardrails: modelos menores erram demais o registro.
 *
 * A fala é sempre o Whisper small (whisper.cpp via whisper.rn), com o áudio convertido pelo
 * módulo nativo em Kotlin. Os modelos são baixados uma vez, com consentimento, numa versão fixa
 * (commit do Hugging Face) e conferidos pelo tamanho. Depois tudo funciona sem internet.
 *
 * Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright (c) Meta Platforms, Inc.
 * Built with Llama.
 */

type NativoAndroid = {
  paraWav16k(uri: string): Promise<string>;
  memoriaTotalMb(): number;
  nanoStatus(): Promise<'disponivel' | 'baixavel' | 'baixando' | 'indisponivel'>;
  nanoBaixar(): Promise<boolean>;
  nanoGerar(prompt: string, temperatura: number, maxTokens: number): Promise<string>;
};
const nativo = requireOptionalNativeModule<NativoAndroid>('IaLocal');

type Modelo = { id: string; nome: string; arquivo: string; url: string; bytes: number };

const FALA: Modelo = {
  id: 'fala',
  nome: 'Reconhecimento de fala (Whisper small)',
  arquivo: 'ggml-small-q5_1.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin',
  bytes: 190085487,
};
const LLAMA_3B: Modelo = {
  id: 'texto',
  nome: 'Modelo de linguagem (Llama 3.2 3B)',
  arquivo: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/5ab33fa94d1d04e903623ae72c95d1696f09f9e8/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  bytes: 2019377696,
};

/** Celulares de 6 GB informam pouco menos de 6000 MB: o Llama 3B (2 GB) roda com folga. */
const MEMORIA_LLAMA_MB = 5500;
const PASTA = new Directory(Paths.document, 'modelos');
const arquivo = (m: Modelo) => new File(PASTA, m.arquivo);
const baixado = (m: Modelo) => {
  const f = arquivo(m);
  return f.exists && f.size === m.bytes;
};

export type Motor = 'gemini-nano' | 'llama-3.2-3b' | 'nuvem';
let motor: Motor = 'nuvem';
let nano: Awaited<ReturnType<NativoAndroid['nanoStatus']>> = 'indisponivel';

async function escolherMotor(): Promise<Motor> {
  if (!nativo) return 'nuvem';
  nano = await nativo.nanoStatus().catch(() => 'indisponivel' as const);
  if (nano !== 'indisponivel') return 'gemini-nano';
  return nativo.memoriaTotalMb() >= MEMORIA_LLAMA_MB ? 'llama-3.2-3b' : 'nuvem';
}

const modelosDoMotor = (): Modelo[] => (motor === 'llama-3.2-3b' ? [FALA, LLAMA_3B] : motor === 'gemini-nano' ? [FALA] : []);

/** Nome do motor, para a tela e para o backend registrar quem organizou o relato. */
export function nomeDoMotor() {
  return motor === 'gemini-nano' ? 'Gemini Nano' : motor === 'llama-3.2-3b' ? 'Llama 3.2 3B' : 'nuvem';
}
export const idDoMotor = () => motor;

export function tamanhoDownloadMb() {
  return Math.round(modelosDoMotor().reduce((t, m) => t + m.bytes, 0) / (1024 * 1024));
}

export function modelosBaixados() {
  return motor !== 'nuvem' && modelosDoMotor().every(baixado) && (motor !== 'gemini-nano' || nano === 'disponivel');
}

/** Baixa o que falta (e pede ao Android o Gemini Nano, se for ele). Retoma se a conexão cair. */
export async function baixarModelos(aoProgredir: (fracao: number) => void) {
  PASTA.create({ idempotent: true, intermediates: true });
  const modelos = modelosDoMotor();
  // Modelos de versões anteriores do app (por exemplo, o Qwen 1.5B) não servem mais: libera o espaço.
  for (const item of PASTA.list()) {
    if (item instanceof File && !modelos.some((m) => m.arquivo === item.name)) item.delete();
  }
  const total = modelos.reduce((t, m) => t + m.bytes, 0) || 1;
  let jaBaixado = 0;
  for (const m of modelos) {
    const destino = arquivo(m);
    if (baixado(m)) {
      jaBaixado += m.bytes;
      aoProgredir(jaBaixado / total);
      continue;
    }
    if (destino.exists) destino.delete();
    const base = jaBaixado;
    const download = createDownloadResumable(m.url, destino.uri, {}, (p) => aoProgredir((base + p.totalBytesWritten) / total));
    await download.downloadAsync();
    if (!baixado(m)) {
      if (destino.exists) destino.delete();
      throw new Error(`O download de ${m.nome} não terminou certo. Tente de novo no Wi-Fi.`);
    }
    jaBaixado += m.bytes;
  }
  if (motor === 'gemini-nano' && nano !== 'disponivel' && nativo) {
    if (!(await nativo.nanoBaixar())) throw new Error('O Android não conseguiu baixar o Gemini Nano agora. Tente de novo no Wi-Fi.');
    nano = 'disponivel';
  }
  aoProgredir(1);
}

export async function apagarModelos() {
  await liberar();
  if (PASTA.exists) PASTA.delete();
}

// Contextos (carregados sob demanda e reaproveitados) -------------------------

let whisper: WhisperContext | null = null;
let llama: LlamaContext | null = null;

async function contextoFala() {
  whisper ??= await initWhisper({ filePath: arquivo(FALA).uri });
  return whisper;
}

async function contextoTexto() {
  llama ??= await initLlama({ model: arquivo(LLAMA_3B).uri, n_ctx: 4096, use_mlock: false });
  return llama;
}

export async function liberar() {
  await whisper?.release().catch(() => undefined);
  await llama?.release().catch(() => undefined);
  whisper = null;
  llama = null;
}

// Esquemas: espelho de backend/core/schemas (o JSON gerado é validado pelo Pydantic) -----

const opcoes = (...v: string[]) => ({ type: 'string', enum: v });
const texto = { type: 'string' };
const textoOpcional = { type: ['string', 'null'] };
const lista = (itens: object, max = 5) => ({ type: 'array', items: itens, maxItems: max });
const objeto = (props: Record<string, object>, obrigatorios = Object.keys(props)) => ({
  type: 'object',
  properties: props,
  required: obrigatorios,
  additionalProperties: false,
});

const ESQUEMA_REGISTRO = objeto({
  sono: objeto({
    qualidade: opcoes('boa', 'regular', 'ruim', 'nao_informado'),
    horas_aproximadas: { type: ['number', 'null'] },
    despertares_noturnos: { type: ['integer', 'null'] },
    observacao: textoOpcional,
  }),
  alimentacao: objeto({
    qualidade: opcoes('boa', 'regular', 'pouca', 'recusou', 'nao_informado'),
    hidratacao: opcoes('boa', 'pouca', 'nao_informado'),
    observacao: textoOpcional,
  }),
  humor: objeto({
    predominante: opcoes('calmo', 'alegre', 'triste', 'ansioso', 'irritado', 'apatico', 'variado', 'nao_informado'),
    observacao: textoOpcional,
  }),
  agitacao: objeto({
    nivel: opcoes('nenhuma', 'leve', 'moderada', 'intensa', 'nao_informado'),
    periodos: lista(opcoes('manha', 'tarde', 'noite', 'madrugada'), 4),
    gatilhos: lista(texto, 4),
  }),
  episodios: lista(
    objeto({
      tipo: opcoes('queda', 'desorientacao', 'tentativa_de_sair', 'agressividade', 'alucinacao', 'recusa_de_cuidado', 'engasgo', 'outro'),
      descricao: texto,
    }),
    6,
  ),
  medicacao: objeto({ tomou: opcoes('sim', 'nao', 'parcial', 'nao_informado'), observacao: textoOpcional }),
  o_que_ajudou: lista(texto),
  momentos_bons: lista(texto),
  quem_cuida: objeto({ cansaco: opcoes('nenhum', 'algum', 'muito', 'nao_informado'), observacao: textoOpcional }),
  observacoes: lista(texto),
  sinais_de_alerta: lista(texto, 4),
});

const item = objeto({ titulo: texto, detalhe: textoOpcional });
const ESQUEMA_MEMORIA = objeto({
  quem_ela: textoOpcional,
  como_se_comunica: textoOpcional,
  pessoas_importantes: lista(objeto({ nome: texto, relacao: textoOpcional }), 6),
  rotina: lista(item, 6),
  acalma: lista(item, 6),
  agita: lista(item, 6),
  musicas: lista(objeto({ titulo: texto, artista: textoOpcional }), 6),
  comidas: lista(item, 6),
  lembrancas: lista(item, 6),
});

const ESQUEMA_PERGUNTAS = objeto({ perguntas: { type: 'array', items: texto, minItems: 3, maxItems: 3 } });

/** Molde legível do JSON para o Gemini Nano, que recebe o formato no próprio texto do pedido. */
function moldeJson(esquema: unknown): unknown {
  const e = esquema as { type?: unknown; enum?: string[]; properties?: Record<string, unknown>; items?: unknown };
  if (e.enum) return e.enum.join(' | ');
  if (e.properties) return Object.fromEntries(Object.entries(e.properties).map(([k, v]) => [k, moldeJson(v)]));
  if (e.type === 'array') return [moldeJson(e.items)];
  if (Array.isArray(e.type)) return e.type.includes('number') || e.type.includes('integer') ? 'número ou null' : 'texto ou null';
  return e.type === 'string' ? 'texto' : e.type;
}

function soJson(bruto: string) {
  // Os modelos às vezes devolvem marcas do template de chat ou texto em volta do JSON.
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) {
    console.warn(`[ia-local] resposta sem JSON: ${bruto.slice(0, 300)}`);
    throw new Error('O modelo do celular não devolveu um registro.');
  }
  return bruto.slice(inicio, fim + 1);
}

async function gerar(instrucoes: string, prompt: string, esquema?: object, opcoesExtras: { temperature?: number } = {}) {
  const temperatura = opcoesExtras.temperature ?? (esquema ? 0 : 0.3);
  const maximo = esquema ? 900 : 350;
  if (motor === 'gemini-nano' && nativo) {
    const formato = esquema
      ? `\n\nResponda só com um JSON neste formato, sem nenhum texto antes ou depois (use null ou lista vazia quando o relato não falar do assunto):\n${JSON.stringify(moldeJson(esquema))}`
      : '';
    const bruto = (await nativo.nanoGerar(`${instrucoes}\n\n${prompt}${formato}`, temperatura, maximo)).trim();
    return esquema ? soJson(bruto) : bruto;
  }
  const ctx = await contextoTexto();
  const resultado = await ctx.completion({
    messages: [
      { role: 'system', content: instrucoes },
      { role: 'user', content: prompt },
    ],
    n_predict: maximo,
    temperature: temperatura,
    ...(esquema ? { response_format: { type: 'json_schema', json_schema: { strict: true, schema: esquema } } } : {}),
  });
  const bruto = (resultado.text ?? '').trim();
  return esquema ? soJson(bruto) : bruto;
}

// A mesma interface do módulo do iOS -------------------------------------------

const iaAndroid = {
  async disponibilidade(): Promise<Disponibilidade> {
    if (!nativo) return { transcricao: false, modelo: false, motivo: 'sem_modulo' };
    motor = await escolherMotor();
    if (motor === 'nuvem') return { transcricao: false, modelo: false, motivo: 'aparelho' };
    if (!modelosBaixados()) return { transcricao: false, modelo: false, motivo: 'baixar_modelos' };
    return { transcricao: true, modelo: true, motivo: '' };
  },

  async transcrever(uri: string) {
    if (!nativo) throw new Error('IA do aparelho indisponível');
    const wav = await nativo.paraWav16k(uri);
    try {
      const ctx = await contextoFala();
      const { promise } = ctx.transcribe(wav, { language: 'pt' });
      const { result } = await promise;
      return result.trim();
    } finally {
      try {
        new File(wav.startsWith('file://') ? wav : `file://${wav}`).delete();
      } catch {
        // Arquivo temporário: some com o cache.
      }
    }
  },

  gerarRegistro: (instrucoes: string, prompt: string) => gerar(instrucoes, prompt, ESQUEMA_REGISTRO),
  gerarMemoria: (instrucoes: string, prompt: string) => gerar(instrucoes, prompt, ESQUEMA_MEMORIA),
  gerarTexto: (instrucoes: string, prompt: string) => gerar(instrucoes, prompt),

  async gerarPerguntas(instrucoes: string, prompt: string) {
    const json = await gerar(instrucoes, prompt, ESQUEMA_PERGUNTAS, { temperature: 0.7 });
    const { perguntas } = JSON.parse(json) as { perguntas: string[] };
    return perguntas;
  },
};

export default {
  ia: iaAndroid,
  modelos: { tamanhoDownloadMb, nomeDoMotor, idDoMotor, modelosBaixados, baixarModelos, apagarModelos },
};
