import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores, espaco, fonte, raio, TOQUE_MINIMO } from '@/tema';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

export function Tela({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.tela} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return (
    <Text style={estilos.titulo} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <Text style={estilos.subtitulo} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Paragrafo({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[estilos.paragrafo, suave && { color: cores.textoSuave }]}>{children}</Text>;
}

export function Cartao({
  children,
  cor = cores.cartao,
  style,
}: {
  children: ReactNode;
  cor?: string;
  style?: ViewStyle;
}) {
  return <View style={[estilos.cartao, { backgroundColor: cor }, style]}>{children}</View>;
}

type VarianteBotao = 'principal' | 'secundario' | 'alerta' | 'claro';

export function Botao({
  titulo,
  icone,
  onPress,
  variante = 'principal',
  dica,
}: {
  titulo: string;
  icone?: NomeIcone;
  onPress: () => void;
  variante?: VarianteBotao;
  dica?: string;
}) {
  const fundo = {
    principal: cores.azul,
    secundario: cores.verdeEscuro,
    alerta: cores.alerta,
    claro: cores.cartao,
  }[variante];
  const corTexto = variante === 'claro' ? cores.azulEscuro : cores.branco;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, opacity: pressed ? 0.85 : 1 },
        variante === 'claro' && { borderWidth: 2, borderColor: cores.azul },
      ]}
    >
      {icone && <Ionicons name={icone} size={30} color={corTexto} />}
      <Text style={[estilos.botaoTexto, { color: corTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Etiqueta({ texto, cor = cores.verdeClaro }: { texto: string; cor?: string }) {
  return (
    <View style={[estilos.etiqueta, { backgroundColor: cor }]}>
      <Text style={estilos.etiquetaTexto}>{texto}</Text>
    </View>
  );
}

export function LinhaIcone({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={estilos.linhaIcone}>
      <Ionicons name={icone} size={26} color={cores.verdeEscuro} style={{ marginTop: 2 }} />
      <Text style={[estilos.paragrafo, { flex: 1 }]}>{texto}</Text>
    </View>
  );
}

export function AvisoIA({ texto }: { texto: string }) {
  return (
    <View style={estilos.avisoIA} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={24} color={cores.textoSuave} />
      <Text style={estilos.avisoTexto}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xl * 2 },
  titulo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.azulEscuro, lineHeight: 38 },
  subtitulo: { fontSize: fonte.subtitulo, fontWeight: '700', color: cores.texto, lineHeight: 30 },
  paragrafo: { fontSize: fonte.corpo, color: cores.texto, lineHeight: 30 },
  cartao: {
    borderRadius: raio,
    padding: espaco.l,
    gap: espaco.s,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botao: {
    minHeight: TOQUE_MINIMO,
    borderRadius: raio,
    paddingHorizontal: espaco.l,
    paddingVertical: espaco.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
  },
  botaoTexto: { fontSize: fonte.destaque, fontWeight: '700', flexShrink: 1 },
  etiqueta: {
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.xs,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  etiquetaTexto: { fontSize: fonte.pequena, color: cores.texto, fontWeight: '600' },
  linhaIcone: { flexDirection: 'row', gap: espaco.s, alignItems: 'flex-start' },
  avisoIA: {
    flexDirection: 'row',
    gap: espaco.s,
    alignItems: 'flex-start',
    padding: espaco.m,
    borderRadius: raio,
    backgroundColor: '#F1F3F4',
  },
  avisoTexto: { fontSize: fonte.pequena, color: cores.textoSuave, lineHeight: 26, flex: 1 },
});
