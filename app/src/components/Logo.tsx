import { Image } from 'expo-image';

/**
 * Símbolo do SempreAqui com fundo transparente: funciona no modo claro e no escuro.
 * Usado com moderação, em momentos de acolhimento (boas-vindas, agradecimento, estados vazios).
 */
export function Logo({ tamanho = 44, decorativa = false }: { tamanho?: number; decorativa?: boolean }) {
  return (
    <Image
      source={require('../../assets/simbolo.png')}
      style={{ width: tamanho, height: tamanho }}
      contentFit="contain"
      accessible={!decorativa}
      accessibilityLabel={decorativa ? undefined : 'SempreAqui'}
    />
  );
}
