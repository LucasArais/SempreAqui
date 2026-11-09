import type { ReactNode } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { type Cores, tipografia, useTema } from '@/theme';
import type { VarianteTexto } from '@/theme/typography';

type CorTexto = 'label' | 'secondaryLabel' | 'accentStrong' | 'onAccent' | 'success' | 'attention' | 'emergency' | 'onEmergency';

/** Texto com os estilos da escala tipográfica. Use sempre este em vez do Text do React Native. */
export function Text({
  variante = 'body',
  cor = 'label',
  centro,
  children,
  ...props
}: TextProps & {
  variante?: VarianteTexto;
  cor?: CorTexto;
  centro?: boolean;
  children: ReactNode;
}) {
  const { cores } = useTema();
  return (
    <RNText
      {...props}
      style={[
        tipografia[variante],
        { color: cores[cor as keyof Cores] as string },
        centro && { textAlign: 'center' },
        props.style,
      ]}
    >
      {children}
    </RNText>
  );
}
