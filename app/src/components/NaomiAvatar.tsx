import { View } from 'react-native';

import { useTema } from '@/theme';

import { Icon } from './Icon';

/** O rosto da Naomi na conversa: um círculo na cor do app com o brilho, o mesmo ícone da aba. */
export function NaomiAvatar({ tamanho = 28 }: { tamanho?: number }) {
  const { cores } = useTema();
  return (
    <View
      accessible={false}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: cores.accentStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon nome="naomi" cor={cores.onAccent} tamanho={Math.round(tamanho * 0.55)} />
    </View>
  );
}
