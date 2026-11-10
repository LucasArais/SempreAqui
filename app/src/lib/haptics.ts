import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptics leves. No web não fazem nada. Nunca deixam a ação falhar. */
const ativo = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  toque() {
    if (ativo) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  sucesso() {
    if (ativo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  selecao() {
    if (ativo) Haptics.selectionAsync().catch(() => {});
  },
  aviso() {
    if (ativo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
