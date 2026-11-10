/** Motivo de a IA no aparelho não estar disponível, vazio quando está. */
export type Disponibilidade = { transcricao: boolean; modelo: boolean; motivo: string };

export type IaLocalNativo = {
  disponibilidade(): Promise<Disponibilidade>;
  transcrever(uri: string): Promise<string>;
  gerarRegistro(instrucoes: string, prompt: string): Promise<string>;
  gerarTexto(instrucoes: string, prompt: string): Promise<string>;
  gerarMemoria(instrucoes: string, prompt: string): Promise<string>;
  gerarPerguntas(instrucoes: string, prompt: string): Promise<string[]>;
};

/** Download dos modelos abertos, só no Android. */
export type ModelosAndroid = {
  TAMANHO_TOTAL_MB: number;
  modelosBaixados(): boolean;
  baixarModelos(aoProgredir: (fracao: number) => void): Promise<void>;
  apagarModelos(): Promise<void>;
};
