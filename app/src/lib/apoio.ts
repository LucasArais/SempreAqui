import { api } from './api';
import IaLocal from '../../modules/ia-local';
import { iaLocalPronta } from './ia-local';

/** Resposta do Apoio na Hora Difícil (backend/core/apoio.py). */
export type RespostaApoio = {
  tipo: 'risco' | 'medica' | 'geral';
  situacoes: string[];
  aviso: string | null;
  sugestoes: { titulo: string; texto: string; origem: string }[];
  fontes: { id: string; texto: string; fonte: string; url: string }[];
  acoes: ('ligar_192' | 'avisar_familia' | 'pedir_ajuda_familia' | 'ligar_unidade')[];
  chamada: string;
};

/** Pedido por voz: transcreve no celular quando dá; senão, na nuvem. O áudio não é guardado. */
export async function transcreverPedido(uri: string) {
  if (IaLocal && iaLocalPronta()) {
    try {
      const texto = (await IaLocal.transcrever(uri)).trim();
      if (texto) return texto;
    } catch {
      // Segue pela nuvem.
    }
  }
  return (await api.transcreverApoio(uri)).texto;
}
