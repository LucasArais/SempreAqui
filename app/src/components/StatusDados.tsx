import { ActivityIndicator, View } from 'react-native';

import { atualizarDados, useCarregamento } from '@/lib/carregamento';
import { espaco, useTema } from '@/theme';

import { Card } from './Card';
import { SecondaryButton } from './Buttons';
import { Text } from './Text';

/** Mostra progresso sem esconder o conteúdo já disponível, e oferece recuperação da falha. */
export function StatusDados() {
  const { cores } = useTema();
  const { carregando, carregado, erro } = useCarregamento();
  if (carregando || (!carregado && !erro)) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s1 }} accessible accessibilityRole="progressbar" accessibilityLabel="Atualizando informações">
      <ActivityIndicator color={cores.accentStrong} />
      <Text variante="callout" cor="secondaryLabel" style={{ flex: 1 }}>Atualizando informações…</Text>
    </View>
  );
  if (!erro) return null;
  return (
    <Card>
      <Text variante="callout" cor="secondaryLabel" accessibilityLiveRegion="polite">{erro} Os dados já salvos continuam aqui.</Text>
      <SecondaryButton titulo="Tentar de novo" alinhamento="inicio" onPress={() => { void atualizarDados(); }} />
    </Card>
  );
}
