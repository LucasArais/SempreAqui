import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Card } from './Card';
import { Icon, type NomeIcone } from './Icon';
import { Text } from './Text';

/**
 * Peças do visual "clean" usado em todas as telas:
 * - LinkDaSecao: "Ver todos", "Adicionar" no título da seção, no lugar de botões soltos.
 * - AcoesRapidas: duas ou três ações lado a lado, em pílulas, sem ocupar faixas inteiras.
 * - CartaoExpansivel: resumo fechado em poucas linhas que abre com um toque.
 */

export function LinkDaSecao({ titulo, onPress, icone }: { titulo: string; onPress: () => void; icone?: NomeIcone }) {
  const { cores } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {icone && <Icon nome={icone} cor={cores.accentStrong} tamanho={16} />}
      <Text variante="callout" style={{ color: cores.accentStrong }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

export type AcaoRapida = { titulo: string; icone: NomeIcone; onPress: () => void; dica?: string; cor?: string; desativado?: boolean };

export function AcoesRapidas({ acoes }: { acoes: AcaoRapida[] }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: espaco.s1 + espaco.meio }}>
      {acoes.map((a) => {
        const cor = a.cor ?? cores.accentStrong;
        return (
          <Pressable
            key={a.titulo}
            disabled={a.desativado}
            onPress={() => {
              haptic.toque();
              a.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={a.titulo}
            accessibilityHint={a.dica}
            accessibilityState={{ disabled: a.desativado }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: tamanho.botao,
              borderRadius: raio.botao,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderColor: cor,
              opacity: a.desativado ? 0.5 : 1,
              backgroundColor: pressed ? cores.secondaryBackground : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: espaco.s1,
              paddingHorizontal: espaco.s1,
            })}
          >
            <Icon nome={a.icone} cor={cor} tamanho={20} />
            <Text variante="headline" style={{ color: cor, flexShrink: 1 }} numberOfLines={1}>
              {a.titulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CartaoExpansivel({
  meta,
  texto,
  resumoFechado,
  linhas = 2,
  children,
}: {
  meta?: string;
  texto: string;
  /** O que mostrar embaixo quando fechado, por exemplo "2 mudanças em relação ao habitual". */
  resumoFechado?: string;
  linhas?: number;
  /** Conteúdo extra que só aparece aberto. */
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  return (
    <Pressable
      onPress={() => {
        haptic.selecao();
        setAberto((a) => !a);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      accessibilityHint={aberto ? 'Toque para recolher' : 'Toque para ver tudo'}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s1 }}>
          {meta && (
            <Text variante="footnote" cor="secondaryLabel" style={{ flex: 1 }}>
              {meta}
            </Text>
          )}
          <View style={{ transform: [{ rotate: aberto ? '-90deg' : '90deg' }] }}>
            <Icon nome="chevron" cor={cores.tertiaryLabel} tamanho={14} />
          </View>
        </View>
        <Text variante="body" numberOfLines={aberto ? undefined : linhas}>
          {texto}
        </Text>
        {aberto ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: espaco.s1 }}>
            {children}
          </Animated.View>
        ) : resumoFechado ? (
          <Text variante="footnote" cor="secondaryLabel">
            {resumoFechado}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
