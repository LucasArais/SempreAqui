import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { espaco, raio, useTema } from '@/theme';

/** Card: fundo secundário, raio 16, padding 16, sem borda e sem sombra. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { cores } = useTema();
  return (
    <View
      style={[
        {
          backgroundColor: cores.secondaryBackground,
          borderRadius: raio.card,
          borderCurve: 'continuous',
          padding: espaco.s2,
          gap: espaco.s1 + espaco.meio,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
