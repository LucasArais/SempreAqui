import { ActivityIndicator, View } from 'react-native';

import { entrar } from '@/lib/entrar';
import { sair, useSessao } from '@/lib/sessao';
import { espaco, useTema } from '@/theme';

import { SecondaryButton, PrimaryButton } from './Buttons';
import { Logo } from './Logo';
import { Text } from './Text';

/** Enquanto a sessão é restaurada, nenhuma tela vazia ou formulário de login pisca. */
export function CarregamentoSessao() {
  const { cores, margem } = useTema();
  const { erro } = useSessao();
  return (
    <View style={{ flex: 1, backgroundColor: cores.background, justifyContent: 'center', alignItems: 'center', padding: margem, gap: espaco.s3 }}>
      <Logo tamanho={64} />
      {!erro && <ActivityIndicator color={cores.accentStrong} accessibilityLabel="Abrindo sua conta" />}
      <Text cor="secondaryLabel" centro accessibilityLiveRegion="polite">{erro ?? 'Abrindo sua conta…'}</Text>
      {erro && <View style={{ alignSelf: 'stretch', gap: espaco.s1 }}>
        <PrimaryButton titulo="Tentar de novo" onPress={() => { void entrar(); }} />
        <SecondaryButton titulo="Voltar para entrar" onPress={() => { void sair().catch(() => undefined); }} />
      </View>}
    </View>
  );
}
