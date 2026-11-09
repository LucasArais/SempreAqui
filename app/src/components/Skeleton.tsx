import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { espaco, raio, useTema } from '@/theme';

/** Carregamento suave: blocos que respiram devagar. Nunca um spinner no meio da tela vazia. */
export function Skeleton({ linhas = 3, comTitulo = true }: { linhas?: number; comTitulo?: boolean }) {
  const { cores } = useTema();
  const reduzir = useReducedMotion();
  const opacidade = useSharedValue(1);

  useEffect(() => {
    if (!reduzir) opacidade.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
  }, [reduzir, opacidade]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  const bloco = (largura: `${number}%`, altura: number, chave: string) => (
    <View
      key={chave}
      style={{
        width: largura,
        height: altura,
        borderRadius: 6,
        backgroundColor: cores.tertiaryBackground,
      }}
    />
  );

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      style={[
        {
          backgroundColor: cores.secondaryBackground,
          borderRadius: raio.card,
          padding: espaco.s2,
          gap: espaco.s1 + espaco.meio,
        },
        estilo,
      ]}
    >
      {comTitulo && bloco('45%', 20, 'titulo')}
      {Array.from({ length: linhas }, (_, i) =>
        bloco(i === linhas - 1 ? '65%' : '100%', 14, `l${i}`),
      )}
    </Animated.View>
  );
}
