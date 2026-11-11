import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { haptic } from '@/lib/haptics';
import { espaco, useTema } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/** Título da tela da Naomi com o (i) ao lado: um toque abre a história do nome. */
export function TituloNaomi() {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        router.push('/naomi');
      }}
      accessibilityRole="button"
      accessibilityLabel="Naomi. Saiba por que a assistente tem esse nome"
      hitSlop={10}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: espaco.meio, opacity: pressed ? 0.6 : 1 })}
    >
      <Text variante="headline">Naomi</Text>
      <Icon nome="info" cor={cores.secondaryLabel} tamanho={16} />
    </Pressable>
  );
}
