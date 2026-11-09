import { useColorScheme, useWindowDimensions } from 'react-native';

import { claro, escuro, type Cores } from './colors';
import { espaco, margemLateral, raio, tamanho } from './spacing';
import { tipografia } from './typography';

export { claro, escuro, espaco, raio, tamanho, tipografia, type Cores };

/** Tema atual, seguindo o modo claro ou escuro do sistema. */
export function useTema() {
  const esquema = useColorScheme();
  const { width } = useWindowDimensions();
  const escuroAtivo = esquema === 'dark';
  return {
    cores: escuroAtivo ? escuro : claro,
    escuro: escuroAtivo,
    margem: margemLateral(width),
  };
}
