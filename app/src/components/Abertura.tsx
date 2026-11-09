import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { claro, tipografia } from '@/theme';

const TAMANHO = 160; // igual ao imageWidth da tela de abertura nativa: a transição não "pula"

/**
 * Abertura do app: o símbolo respira com uma mola, o nome aparece embaixo e tudo se dissolve
 * revelando o app. Cerca de 1,5 s. Com Reduzir Movimento, só um fade curto.
 */
export function Abertura({ aoTerminar }: { aoTerminar: () => void }) {
  const reduzir = useReducedMotion();
  const escala = useSharedValue(1);
  const nome = useSharedValue(0);
  const tela = useSharedValue(1);

  useEffect(() => {
    if (reduzir) {
      tela.set(withDelay(300, withTiming(0, { duration: 250 }, (fim) => fim && runOnJS(aoTerminar)())));
      return;
    }
    escala.set(
      withSequence(
        withTiming(0.92, { duration: 180, easing: Easing.out(Easing.quad) }),
        withSpring(1.06, { damping: 9, stiffness: 160 }),
        withSpring(1, { damping: 14, stiffness: 180 }),
      ),
    );
    nome.set(withDelay(380, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })));
    tela.set(
      withDelay(1150, withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }, (fim) => fim && runOnJS(aoTerminar)())),
    );
  }, [reduzir, escala, nome, tela, aoTerminar]);

  const estiloTela = useAnimatedStyle(() => ({
    opacity: tela.get(),
    transform: [{ scale: 1 + (1 - tela.get()) * 0.06 }],
  }));
  const estiloSimbolo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  const estiloNome = useAnimatedStyle(() => ({
    opacity: nome.get(),
    transform: [{ translateY: (1 - nome.get()) * 10 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilos.fundo, estiloTela]} pointerEvents="none" accessibilityLabel="SempreAqui">
      <View style={estilos.centro}>
        <Animated.View style={estiloSimbolo}>
          <Image source={require('../../assets/simbolo.png')} style={{ width: TAMANHO, height: TAMANHO }} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[estilos.nome, estiloNome]}>
          <RNText style={[tipografia.largeTitle, { color: claro.label }]}>
            <RNText style={{ color: claro.marcaAzul }}>Sempre</RNText>
            <RNText style={{ color: claro.marcaVerde }}>Aqui</RNText>
          </RNText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  fundo: { backgroundColor: claro.background, zIndex: 100 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // O nome fica abaixo do símbolo sem tirar o símbolo do centro exato da tela.
  nome: { position: 'absolute', top: '50%', marginTop: TAMANHO / 2 + 12 },
});
