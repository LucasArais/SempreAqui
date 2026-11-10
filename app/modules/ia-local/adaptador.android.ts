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
 * IA no aparelho no Android: Whisper (whisper.cpp) para a fala e um modelo aberto pequeno
 * (Qwen2.5 1.5B Instruct, via llama.cpp) para organizar, com saída presa a um JSON Schema,
 * o equivalente da geração guiada da Apple no iPhone. Mesma interface do módulo do iOS.
 *
 * Os modelos são baixados uma vez, com consentimento, numa versão fixa (commit do Hugging Face)
 * e conferidos pelo tamanho. Depois tudo funciona sem internet e nada sai do celular.
 */

type NativoAndroid = { paraWav16k(uri: string): Promise<string>; memoriaTotalMb(): number };
const nativo = requireOptionalNativeModule<NativoAndroid>('IaLocal');

export const MODELOS = [
  {
    id: 'fala',
    nome: 'Reconhecimento de fala (Whisper small)',
    arquivo: 'ggml-small-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin',
    bytes: 190085487,
  },
  {
    id: 'texto',
    nome: 'Modelo de linguagem (Qwen2.5 1.5B)',
    arquivo: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    bytes: 1117320736,
  },
] as const;

/** Abaixo disso, o modelo de 1,1 GB deixa o celular lento demais: melhor usar a nuvem. */
const MEMORIA_MINIMA_MB = 3500;
const PASTA = new Directory(Paths.document, 'modelos');
const arquivo = (m: (typeof MODELOS)[number]) => new File(PASTA, m.arquivo);

export const TAMANHO_TOTAL_MB = Math.round(MODELOS.reduce((t, m) => t + m.bytes, 0) / (1024 * 1024));

export function modelosBaixados() {
  return MODELOS.every((m) => {
    const f = arquivo(m);
    return f.exists && f.size === m.bytes;
  });
}

/** Baixa os modelos que faltam. Retoma de onde parou se a conexão cair. */
export async function baixarModelos(aoProgredir: (fracao: number) => void) {
  PASTA.create({ idempotent: true, intermediates: true });
  const total = MODELOS.reduce((t, m) => t + m.bytes, 0);
  let jaBaixado = 0;
  for (const m of MODELOS) {
    const destino = arquivo(m);
    if (destino.exists && destino.size === m.bytes) {
      jaBaixado += m.bytes;
      aoProgredir(jaBaixado / total);
      continue;
    }
    if (destino.exists) destino.delete();
    const base = jaBaixado;
    const download = createDownloadResumable(m.url, destino.uri, {}, (p) => aoProgredir((base + p.totalBytesWritten) / total));
    await download.downloadAsync();
    if (!destino.exists || destino.size !== m.bytes) {
      if (destino.exists) destino.delete();
      throw new Error(`O download de ${m.nome} não terminou certo. Tente de novo no Wi-Fi.`);
    }
    jaBaixado += m.bytes;
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
  whisper ??= await initWhisper({ filePath: arquivo(MODELOS[0]).uri });
  return whisper;
}

async function contextoTexto() {
  llama ??= await initLlama({ model: arquivo(MODELOS[1]).uri, n_ctx: 4096, use_mlock: false });
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

async function gerar(instrucoes: string, prompt: string, esquema?: object, opcoesExtras: object = {}) {
  const ctx = await contextoTexto();
  const resultado = await ctx.completion({
    messages: [
      { role: 'system', content: instrucoes },
      { role: 'user', content: prompt },
    ],
    n_predict: esquema ? 900 : 350,
    temperature: esquema ? 0 : 0.3,
    ...(esquema ? { response_format: { type: 'json_schema', json_schema: { strict: true, schema: esquema } } } : {}),
    ...opcoesExtras,
  });
  const bruto = (resultado.text ?? '').trim();
  if (!esquema) return bruto;
  // O modelo às vezes devolve marcas do template de chat em volta do JSON: fica só o objeto.
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) {
    console.warn(`[ia-local] resposta sem JSON: ${bruto.slice(0, 300)}`);
    throw new Error('O modelo do celular não devolveu um registro.');
  }
  return bruto.slice(inicio, fim + 1);
}

// A mesma interface do módulo do iOS -------------------------------------------

const iaAndroid = {
  async disponibilidade(): Promise<Disponibilidade> {
    if (!nativo) return { transcricao: false, modelo: false, motivo: 'sem_modulo' };
    if (nativo.memoriaTotalMb() < MEMORIA_MINIMA_MB) return { transcricao: false, modelo: false, motivo: 'aparelho' };
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

export default { ia: iaAndroid, modelos: { TAMANHO_TOTAL_MB, modelosBaixados, baixarModelos, apagarModelos } };
