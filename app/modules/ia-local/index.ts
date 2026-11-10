import { requireOptionalNativeModule } from 'expo';

/** Motivo de a IA no aparelho não estar disponível, vazio quando está. */
export type Disponibilidade = { transcricao: boolean; modelo: boolean; motivo: string };

type IaLocalNativo = {
  disponibilidade(): Promise<Disponibilidade>;
  transcrever(uri: string): Promise<string>;
  gerarRegistro(instrucoes: string, prompt: string): Promise<string>;
  gerarTexto(instrucoes: string, prompt: string): Promise<string>;
};

/** null no Android, no simulador sem o módulo e em builds antigos: o app usa a nuvem. */
export default requireOptionalNativeModule<IaLocalNativo>('IaLocal');
