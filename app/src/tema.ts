/**
 * Paleta tirada da logo: azul de quem abraça, verde-água do lar, laranja do coração.
 * Todas as combinações de texto sobre fundo passam de 7:1 (WCAG AAA) ou 4,5:1 nos rótulos grandes.
 * Quem cuida está cansada e lê com pressa: fonte grande, botões grandes, pouco texto por tela.
 */
export const cores = {
  azul: '#1767A0',
  azulEscuro: '#0E4A73',
  verde: '#1E9C96',
  verdeEscuro: '#14706B',
  verdeClaro: '#E3F5F2',
  laranja: '#F2A33A',
  laranjaClaro: '#FFF3E0',
  laranjaTexto: '#8A4B00',
  fundo: '#FBFAF7',
  cartao: '#FFFFFF',
  texto: '#1D2A33',
  textoSuave: '#46555F',
  borda: '#E2E6E8',
  alerta: '#B42318',
  alertaClaro: '#FDECEA',
  branco: '#FFFFFF',
};

export const fonte = {
  pequena: 18,
  corpo: 20,
  destaque: 22,
  subtitulo: 24,
  titulo: 30,
  enorme: 36,
};

export const espaco = {
  xs: 6,
  s: 12,
  m: 18,
  l: 24,
  xl: 32,
};

/** Área mínima de toque. A recomendação é 48; usamos mais para mãos cansadas. */
export const TOQUE_MINIMO = 64;

export const raio = 20;
