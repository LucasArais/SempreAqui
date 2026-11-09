/** Grade de 8 pt. */
export const espaco = {
  /** 4: só para ajustes finos dentro de um componente */
  meio: 4,
  s1: 8,
  s2: 16,
  s3: 24,
  /** Entre seções */
  secao: 32,
  s5: 40,
} as const;

/** Margem lateral: 16 pt, ou 20 pt em telas a partir de 414 pt de largura */
export function margemLateral(larguraTela: number) {
  return larguraTela >= 414 ? 20 : 16;
}

export const raio = {
  card: 16,
  botao: 14,
  chip: 999,
  foto: 12,
} as const;

export const tamanho = {
  /** Área mínima de toque (HIG) */
  toqueMinimo: 44,
  botao: 52,
  gravar: 88,
  avatar: 44,
  avatarGrande: 96,
  icone: 22,
} as const;
