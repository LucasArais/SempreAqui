import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

/**
 * Abre a folha de compartilhamento completa do sistema para um arquivo (WhatsApp, Gmail, Mail,
 * AirDrop, Salvar em Arquivos, Imprimir...). No iOS, a do React Native mostra todos os apps;
 * no Android, o expo-sharing é quem consegue compartilhar arquivos.
 */
export async function compartilharArquivo(uri: string, titulo: string, mimeType: string) {
  if (Platform.OS === 'ios') {
    await Share.share({ url: uri, title: titulo });
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: titulo });
}
