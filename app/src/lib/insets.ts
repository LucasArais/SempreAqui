import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Margens seguras (notch, Dynamic Island, barra inferior).
 * Em modais de tela cheia o provedor às vezes devolve zero no primeiro quadro;
 * nesse caso usamos as medidas da janela.
 */
export function useMargensSeguras() {
  const atuais = useSafeAreaInsets();
  const janela = initialWindowMetrics?.insets;
  return {
    topo: Math.max(atuais.top, janela?.top ?? 0),
    base: Math.max(atuais.bottom, janela?.bottom ?? 0),
  };
}
