import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import adaptador from './adaptador';
import type { IaLocalNativo, ModelosAndroid } from './tipos';

export type { Disponibilidade, IaLocalNativo, ModelosAndroid } from './tipos';

/**
 * IA no próprio aparelho, com a mesma interface nas duas plataformas:
 * - iPhone: módulo nativo em Swift (SpeechAnalyzer e Apple Foundation Models).
 * - Android: Whisper e um modelo aberto pequeno via llama.cpp (adaptador.android.ts), com o
 *   conversor de áudio nativo em Kotlin.
 * null quando não há módulo (Expo Go, web, builds antigos): o app usa a nuvem.
 */
const ia: IaLocalNativo | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<IaLocalNativo>('IaLocal')
    : requireOptionalNativeModule('IaLocal')
      ? adaptador.ia
      : null;

export const modelosAndroid: ModelosAndroid | null = ia ? adaptador.modelos : null;
export default ia;
