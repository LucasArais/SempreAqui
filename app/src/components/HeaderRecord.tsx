import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { haptic } from '@/lib/haptics';
import { tamanho, useTema } from '@/theme';

import { Icon } from './Icon';

/** Microfone no cabeçalho de todas as abas: gravar o dia fica a 2 toques de qualquer lugar. */
export function HeaderRecord() {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        router.push('/gravar');
      }}
      accessibilityRole="button"
      accessibilityLabel="Contar como foi o dia"
      accessibilityHint="Abre a gravação do diário"
      hitSlop={8}
      style={{ width: tamanho.toqueMinimo, height: tamanho.toqueMinimo, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon nome="gravar" cor={cores.accentStrong} tamanho={20} />
    </Pressable>
  );
}
