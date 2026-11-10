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

/** Modelos do Android: o motor escolhido pelo celular e o download, com consentimento. */
export type ModelosAndroid = {
  tamanhoDownloadMb(): number;
  nomeDoMotor(): string;
  idDoMotor(): string;
  modelosBaixados(): boolean;
  baixarModelos(aoProgredir: (fracao: number) => void): Promise<void>;
  apagarModelos(): Promise<void>;
};
