import { Image, type ImageSource } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Card } from './Card';
import { Icon, type NomeIcone } from './Icon';
import { Text } from './Text';

/** Chip âmbar para mudanças de padrão. Diz o que mudou, sem alarme. */
export function AttentionBadge({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View
      accessible
      accessibilityLabel={`Vale prestar atenção: ${texto}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        alignSelf: 'flex-start',
        gap: espaco.s1,
        backgroundColor: cores.attentionSoft,
        borderRadius: raio.chip,
        paddingVertical: espaco.s1 - 2,
        paddingHorizontal: espaco.s1 + espaco.meio,
        maxWidth: '100%',
      }}
    >
      <Icon nome="atencao" cor={cores.attention} tamanho={16} />
      <Text variante="callout" cor="attention" style={{ flexShrink: 1 }}>
        {texto}
      </Text>
    </View>
  );
}

/**
 * Resumo feito pela IA. Mostra um rótulo discreto e honesto e deixa ver o que foi dito
 * de verdade. Transparência sobre o que a IA fez.
 */
export function SummaryCard({
  titulo,
  meta,
  texto,
  original,
  audio,
  children,
}: {
  titulo?: string;
  meta?: string;
  texto: string;
  original?: string;
  /** Player do áudio original, mostrado junto com a transcrição */
  audio?: ReactNode;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  const [mostrarOriginal, setMostrarOriginal] = useState(false);
  return (
    <Card>
      {(titulo || meta) && (
        <View style={{ gap: 2 }}>
          {titulo && <Text variante="headline">{titulo}</Text>}
          {meta && (
            <Text variante="footnote" cor="secondaryLabel">
              {meta}
            </Text>
          )}
        </View>
      )}
      <Text variante="body">{texto}</Text>
      {children}
      {mostrarOriginal && original && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          style={{ gap: espaco.s1 + espaco.meio }}
        >
          {audio}
          <View style={{ borderLeftWidth: 3, borderLeftColor: cores.separator, paddingLeft: espaco.s1 + espaco.meio }}>
            <Text variante="callout" cor="secondaryLabel">
              {`"${original}"`}
            </Text>
          </View>
        </Animated.View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco.s1 }}>
        <Text variante="footnote" cor="secondaryLabel">
          Organizado automaticamente
        </Text>
        {original && (
          <Pressable
            onPress={() => {
              haptic.selecao();
              setMostrarOriginal((v) => !v);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={mostrarOriginal ? 'Esconder o que foi dito' : 'Ver o que foi dito'}
            accessibilityHint="Mostra as palavras originais de quem contou"
            style={{ minHeight: tamanho.toqueMinimo, justifyContent: 'center' }}
          >
            <Text variante="footnote" cor="accentStrong" style={{ fontWeight: '600' }}>
              {mostrarOriginal ? 'Esconder' : 'Ver o que foi dito'}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/**
 * Foto da família. Sem foto ainda, mostra um espaço reservado em tom suave com um ícone,
 * nunca uma ilustração genérica.
 */
export function Photo({
  fonte,
  tom = 0,
  icone = 'foto',
  proporcao = 4 / 3,
  rotulo,
  style,
}: {
  fonte?: ImageSource;
  tom?: number;
  icone?: NomeIcone;
  proporcao?: number;
  rotulo: string;
  style?: ViewStyle;
}) {
  const { cores } = useTema();
  const base: ViewStyle = {
    width: '100%',
    aspectRatio: proporcao,
    borderRadius: raio.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: cores.tons[tom % cores.tons.length],
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={[base, style]} accessible accessibilityRole="image" accessibilityLabel={rotulo}>
      {fonte ? (
        <Image source={fonte} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      ) : (
        <Icon nome={icone} cor={cores.secondaryLabel} tamanho={32} />
      )}
    </View>
  );
}

/** Memória: foto grande com cantos arredondados e uma legenda curta embaixo. */
export function MemoryCard({
  legenda,
  detalhe,
  tom,
  icone,
  fonte,
  onPress,
  proporcao = 4 / 3,
}: {
  legenda: string;
  detalhe?: string;
  tom?: number;
  icone?: NomeIcone;
  fonte?: ImageSource;
  onPress?: () => void;
  proporcao?: number;
}) {
  const conteudo = (
    <View style={{ gap: espaco.s1 }}>
      <Photo fonte={fonte} tom={tom} icone={icone} rotulo={legenda} proporcao={proporcao} />
      <View style={{ gap: 2 }}>
        <Text variante="headline">{legenda}</Text>
        {detalhe && (
          <Text variante="callout" cor="secondaryLabel">
            {detalhe}
          </Text>
        )}
      </View>
    </View>
  );
  if (!onPress) return conteudo;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[legenda, detalhe].filter(Boolean).join('. ')}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {conteudo}
    </Pressable>
  );
}

/** Avatar com iniciais, enquanto a família não envia uma foto. */
export function Avatar({
  nome,
  tom = 0,
  grande,
  fonte,
}: {
  nome: string;
  tom?: number;
  grande?: boolean;
  fonte?: ImageSource;
}) {
  const { cores } = useTema();
  const lado = grande ? tamanho.avatarGrande : tamanho.avatar;
  return (
    <View
      accessible={false}
      style={{
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: cores.tons[tom % cores.tons.length],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {fonte ? (
        <Image source={fonte} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text variante={grande ? 'largeTitle' : 'headline'} cor="label" maxFontSizeMultiplier={1.4}>
          {nome.charAt(0)}
        </Text>
      )}
    </View>
  );
}

/** Estado vazio: ícone simples, uma frase gentil e um botão. */
export function EmptyState({
  icone,
  titulo,
  texto,
  children,
}: {
  icone: NomeIcone;
  titulo: string;
  texto?: string;
  children?: ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View style={{ alignItems: 'center', gap: espaco.s1 + espaco.meio, paddingVertical: espaco.s3 }}>
      <Icon nome={icone} cor={cores.secondaryLabel} tamanho={40} />
      <Text variante="headline" centro>
        {titulo}
      </Text>
      {texto && (
        <Text variante="callout" cor="secondaryLabel" centro>
          {texto}
        </Text>
      )}
      {children}
    </View>
  );
}
