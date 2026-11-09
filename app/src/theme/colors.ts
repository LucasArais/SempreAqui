/**
 * Cores do SempreAqui. Base neutra no estilo do iOS e uma única cor de destaque, um coral quente.
 *
 * Regras:
 * - Destaque só no botão principal, no botão de gravar e em estados ativos.
 * - Vermelho (emergency) só para emergência. Âmbar (attention) para "vale prestar atenção".
 * - Nunca usar cor sozinha para passar informação: sempre com ícone ou texto.
 * - Todo par de texto e fundo passa no WCAG AA (4,5:1). Confira com:
 *   node scripts/contraste.ts
 *
 * Este arquivo não importa nada do React Native para poder ser lido pelo script de contraste.
 */

export type Cores = {
  /** Fundo da tela (systemBackground) */
  background: string;
  /** Fundo de cards e listas agrupadas (secondarySystemBackground) */
  secondaryBackground: string;
  /** Estados pressionados e skeleton (tertiarySystemBackground) */
  tertiaryBackground: string;
  separator: string;
  /** Texto principal */
  label: string;
  /** Texto de apoio. Passa AA sobre os dois fundos */
  secondaryLabel: string;
  /** Só para elementos decorativos: chevrons, divisórias, ícones inativos. Nunca para texto */
  tertiaryLabel: string;
  /** Coral de destaque para superfícies grandes (botão de gravar) com ícone */
  accent: string;
  /** Coral para texto e para o fundo do botão principal. Passa AA */
  accentStrong: string;
  /** Texto e ícone sobre accent e accentStrong */
  onAccent: string;
  /** Fundo suave de estados ativos */
  accentSoft: string;
  success: string;
  successSoft: string;
  attention: string;
  attentionSoft: string;
  emergency: string;
  onEmergency: string;
  /** Tons para fotos de exemplo e avatares */
  tons: readonly string[];
};

export const claro: Cores = {
  background: '#FFFFFF',
  secondaryBackground: '#F2F2F7',
  tertiaryBackground: '#E5E5EA',
  separator: '#D1D1D6',
  label: '#1C1C1E',
  secondaryLabel: '#5E5E63',
  tertiaryLabel: '#AEAEB2',
  accent: '#E0664C',
  accentStrong: '#B8462F',
  onAccent: '#FFFFFF',
  accentSoft: '#FCEAE5',
  success: '#1F7A35',
  successSoft: '#E3F4E7',
  attention: '#7A4A00',
  attentionSoft: '#FFF2D6',
  emergency: '#C4291C',
  onEmergency: '#FFFFFF',
  tons: ['#F6E3D7', '#E2ECE6', '#E4E6F2', '#F3E6EC', '#EFEBDD'],
};

export const escuro: Cores = {
  background: '#000000',
  secondaryBackground: '#1C1C1E',
  tertiaryBackground: '#2C2C2E',
  separator: '#38383A',
  label: '#FFFFFF',
  secondaryLabel: '#AEAEB2',
  tertiaryLabel: '#636366',
  accent: '#FF8A70',
  accentStrong: '#FF8A70',
  onAccent: '#1C1C1E',
  accentSoft: '#3D2620',
  success: '#4CD267',
  successSoft: '#17301D',
  attention: '#FFD25A',
  attentionSoft: '#3A2F12',
  emergency: '#FF6961',
  onEmergency: '#1C1C1E',
  tons: ['#3A2B24', '#24302A', '#272A38', '#352830', '#33302A'],
};

/** Pares texto/fundo que precisam passar no AA. Usado pelo script de contraste. */
export const paresDeContraste: [keyof Cores, keyof Cores][] = [
  ['label', 'background'],
  ['label', 'secondaryBackground'],
  ['secondaryLabel', 'background'],
  ['secondaryLabel', 'secondaryBackground'],
  ['accentStrong', 'background'],
  ['accentStrong', 'secondaryBackground'],
  ['onAccent', 'accentStrong'],
  ['success', 'background'],
  ['success', 'secondaryBackground'],
  ['success', 'successSoft'],
  ['attention', 'attentionSoft'],
  ['attention', 'background'],
  ['emergency', 'background'],
  ['emergency', 'secondaryBackground'],
  ['onEmergency', 'emergency'],
  ['label', 'accentSoft'],
  ['accentStrong', 'accentSoft'],
];

/** Pares de elementos não textuais (ícones grandes, bordas de foco): mínimo 3:1. */
export const paresNaoTextuais: [keyof Cores, keyof Cores][] = [
  ['onAccent', 'accent'],
  ['accent', 'background'],
];
