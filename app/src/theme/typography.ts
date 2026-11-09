import { Platform, type TextStyle } from 'react-native';

/**
 * Escala tipográfica baseada no iOS.
 * iOS usa a fonte do sistema (SF Pro). Android usa Inter, carregada em app/_layout.tsx.
 *
 * Não definimos lineHeight fixo: no React Native ele não acompanha o Dynamic Type e
 * corta o texto quando a pessoa aumenta a fonte do sistema. A altura natural da linha escala junto.
 * Nunca use allowFontScaling={false}.
 */

type Peso = 'regular' | 'semibold' | 'bold';

const familiaAndroid: Record<Peso, string> = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const pesoIOS: Record<Peso, TextStyle['fontWeight']> = {
  regular: '400',
  semibold: '600',
  bold: '700',
};

function estilo(fontSize: number, peso: Peso, extra: TextStyle = {}): TextStyle {
  return {
    fontSize,
    ...Platform.select<TextStyle>({
      android: { fontFamily: familiaAndroid[peso] },
      default: { fontWeight: pesoIOS[peso] },
    }),
    ...extra,
  };
}

export const tipografia = {
  /** Título principal da tela */
  largeTitle: estilo(34, 'bold', { letterSpacing: 0.37 }),
  /** Seções */
  title2: estilo(22, 'bold', { letterSpacing: -0.26 }),
  /** Títulos de card e itens de lista */
  headline: estilo(17, 'semibold', { letterSpacing: -0.41 }),
  /** Texto padrão. Conteúdo nunca fica menor que isso */
  body: estilo(17, 'regular', { letterSpacing: -0.41 }),
  /** Textos de apoio */
  callout: estilo(16, 'regular', { letterSpacing: -0.32 }),
  /** Metadados, datas, rótulos de IA */
  footnote: estilo(13, 'regular', { letterSpacing: -0.08 }),
  /** Sessão de reminiscência: mostrada para a pessoa, então ainda maior */
  sessaoPergunta: estilo(30, 'bold', { letterSpacing: 0.2 }),
  sessaoTexto: estilo(20, 'regular'),
  /** Texto de botões */
  botao: estilo(17, 'semibold', { letterSpacing: -0.41 }),
} as const;

export type VarianteTexto = keyof typeof tipografia;

/** Fontes a carregar no Android */
export const fontesAndroid = familiaAndroid;
