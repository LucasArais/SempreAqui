import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { meuNome, useFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { tamanho, useTema } from '@/theme';

import { Text } from './Text';

/** Inicial de quem está usando, no canto do cabeçalho: abre os Ajustes (perfil, foto, privacidade). */
export function HeaderPerfil() {
  const { cores } = useTema();
  useFamilia();
  const nome = meuNome();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        router.push('/ajustes');
      }}
      accessibilityRole="button"
      accessibilityLabel="Ajustes e perfil"
      hitSlop={8}
      style={{ width: tamanho.toqueMinimo, height: tamanho.toqueMinimo, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: cores.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text variante="callout" style={{ color: cores.accentStrong, fontWeight: '700' }}>
          {nome ? nome[0].toUpperCase() : '?'}
        </Text>
      </View>
    </Pressable>
  );
}
