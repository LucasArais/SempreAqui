import { Pressable } from 'react-native';

import { ligarEmergencia } from '@/lib/abrir';
import { haptic } from '@/lib/haptics';
import { espaco, tamanho, useTema } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/** 192 sempre a um toque no cabeçalho da Naomi, sem ocupar a conversa. */
export function Header192() {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        void ligarEmergencia();
      }}
      accessibilityRole="button"
      accessibilityLabel="Emergência. Ligar 192, SAMU"
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: tamanho.toqueMinimo - 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.meio,
        paddingHorizontal: espaco.s1 + 2,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: cores.emergency,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon nome="telefone" cor={cores.emergency} tamanho={14} />
      <Text variante="callout" cor="emergency" style={{ fontWeight: '700' }}>
        192
      </Text>
    </Pressable>
  );
}
