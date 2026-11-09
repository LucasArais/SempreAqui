import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { espaco, useTema } from '@/theme';

import { Text } from './Text';

/**
 * Tela padrão: um ScrollView que é o primeiro filho da rota, para o large title encolher
 * ao rolar e o conteúdo passar por baixo do cabeçalho e da tab bar translúcidos.
 */
export function Screen({ children, fundo }: { children: ReactNode; fundo?: 'secundario' }) {
  const { cores, margem } = useTema();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{
        flex: 1,
        backgroundColor: fundo === 'secundario' ? cores.secondaryBackground : cores.background,
      }}
      contentContainerStyle={{
        paddingHorizontal: margem,
        paddingTop: espaco.s1,
        paddingBottom: espaco.s5,
        gap: espaco.secao,
      }}
    >
      {children}
    </ScrollView>
  );
}

/** Seção com título opcional. Seções ficam a 32 pt umas das outras. */
export function Section({
  titulo,
  acao,
  children,
}: {
  titulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: espaco.s1 + espaco.meio }}>
      {(titulo || acao) && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: espaco.s1, flexWrap: 'wrap' }}>
          {titulo && (
            <Text variante="title2" accessibilityRole="header">
              {titulo}
            </Text>
          )}
          {acao}
        </View>
      )}
      {children}
    </View>
  );
}

/** Empilha filhos na vertical com espaçamento da grade. */
export function Coluna({
  gap = 's1',
  centro,
  children,
  style,
}: {
  gap?: keyof typeof espaco;
  centro?: boolean;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap: espaco[gap] }, centro && { alignItems: 'center' }, style]}>{children}</View>
  );
}

/** Coloca filhos lado a lado, quebrando linha quando a fonte do sistema está grande. */
export function Linha({
  gap = 's1',
  children,
  style,
}: {
  gap?: keyof typeof espaco;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco[gap] }, style]}>
      {children}
    </View>
  );
}
