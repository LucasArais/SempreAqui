import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Icon, type NomeIcone } from './Icon';
import { Text } from './Text';

/** Grupo de linhas no estilo inset grouped dos Ajustes do iOS. */
export function ListGroup({
  children,
  rodape,
  comAvatar,
}: {
  children: ReactNode;
  rodape?: string;
  /** Linhas com avatar: a divisória começa depois da foto */
  comAvatar?: boolean;
}) {
  const { cores } = useTema();
  const itens = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: espaco.s1 }}>
      <View
        style={{
          backgroundColor: cores.secondaryBackground,
          borderRadius: raio.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {itens.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <View
                style={{
                  height: 0.5,
                  backgroundColor: cores.separator,
                  marginLeft: espaco.s2 + (comAvatar ? tamanho.avatar : tamanho.icone) + espaco.s2,
                }}
              />
            )}
            {item}
          </Fragment>
        ))}
      </View>
      {rodape && (
        <Text variante="footnote" cor="secondaryLabel" style={{ paddingHorizontal: espaco.s2 }}>
          {rodape}
        </Text>
      )}
    </View>
  );
}

type CorIcone = 'accentStrong' | 'secondaryLabel' | 'success' | 'attention' | 'emergency';

/** Linha de lista: ícone ou avatar, título, subtítulo e chevron quando navega. */
export function ListRow({
  titulo,
  subtitulo,
  icone,
  corIcone = 'secondaryLabel',
  esquerda,
  direita,
  onPress,
  navega = !!onPress,
  dica,
  rotuloAcessivel,
  riscado,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: NomeIcone;
  corIcone?: CorIcone;
  esquerda?: ReactNode;
  direita?: ReactNode;
  onPress?: () => void;
  navega?: boolean;
  dica?: string;
  rotuloAcessivel?: string;
  riscado?: boolean;
}) {
  const { cores } = useTema();
  const conteudo = (pressionado: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.s2,
        paddingHorizontal: espaco.s2,
        paddingVertical: espaco.s1 + espaco.meio,
        minHeight: tamanho.toqueMinimo + 8,
        backgroundColor: pressionado ? cores.tertiaryBackground : 'transparent',
      }}
    >
      {esquerda ?? (icone && <Icon nome={icone} cor={cores[corIcone]} />)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variante="body"
          style={riscado ? { textDecorationLine: 'line-through', color: cores.secondaryLabel } : undefined}
        >
          {titulo}
        </Text>
        {subtitulo && (
          <Text variante="callout" cor="secondaryLabel">
            {subtitulo}
          </Text>
        )}
      </View>
      {direita}
      {navega && <Icon nome="chevron" cor={cores.tertiaryLabel} tamanho={16} />}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={rotuloAcessivel ?? [titulo, subtitulo].filter(Boolean).join('. ')}>
        {conteudo(false)}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic.selecao();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? [titulo, subtitulo].filter(Boolean).join('. ')}
      accessibilityHint={dica}
    >
      {({ pressed }) => conteudo(pressed)}
    </Pressable>
  );
}
