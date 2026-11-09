import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { espaco, tamanho as tamanhos, useTema } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export function formatarTempo(segundos: number) {
  const total = Math.floor(segundos);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Converte o nível do microfone (dBFS, de -60 a 0) para 0..1. */
export function nivelDoMetering(db: number | undefined) {
  if (db === undefined || Number.isNaN(db)) return undefined;
  return Math.min(1, Math.max(0, (db + 55) / 50));
}

const ALTURAS = [0.45, 0.8, 1, 0.7, 0.5];

function Barra({
  indice,
  ativa,
  nivel,
  cor,
}: {
  indice: number;
  ativa: boolean;
  nivel?: number;
  cor: string;
}) {
  const reduzir = useReducedMotion();
  const escala = useSharedValue(ALTURAS[indice]);

  // Sem medição do microfone (ou com Reduzir Movimento), a onda é uma animação suave e fixa.
  useEffect(() => {
    if (nivel !== undefined || !ativa || reduzir) {
      cancelAnimation(escala);
      if (!ativa || reduzir) escala.set(withTiming(ALTURAS[indice], { duration: 200 }));
      return;
    }
    const alvo = ALTURAS[(indice + 2) % ALTURAS.length];
    escala.set(
      withDelay(
        indice * 70,
        withRepeat(
          withSequence(
            withTiming(Math.max(0.25, alvo * 0.4), { duration: 260 }),
            withTiming(Math.min(1, alvo + 0.2), { duration: 300 }),
          ),
          -1,
          true,
        ),
      ),
    );
  }, [ativa, reduzir, indice, escala, nivel === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // Com medição, cada barra acompanha a voz.
  useEffect(() => {
    if (nivel === undefined || !ativa || reduzir) return;
    escala.set(withTiming(0.2 + nivel * (0.35 + ALTURAS[indice] * 0.45), { duration: 120 }));
  }, [nivel, ativa, reduzir, indice, escala]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scaleY: escala.get() }] }));
  return <Animated.View style={[{ width: 5, height: 34, borderRadius: 3, backgroundColor: cor }, estilo]} />;
}

/**
 * Botão de gravar: círculo grande com microfone. Enquanto grava, vira uma onda de áudio que
 * acompanha a voz e mostra o tempo. Tocar de novo pausa; tocar pausado continua.
 */
export function RecordButton({
  gravando,
  pausado = false,
  segundos,
  nivel,
  onPress,
  rotulo = 'Como foi o dia?',
  apoio,
  tamanho = tamanhos.gravar,
}: {
  gravando: boolean;
  pausado?: boolean;
  segundos?: number;
  nivel?: number;
  onPress: () => void;
  rotulo?: string;
  apoio?: string;
  tamanho?: number;
}) {
  const { cores } = useTema();
  const reduzir = useReducedMotion();
  const escala = useSharedValue(1);
  const estiloBotao = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  const ativo = gravando && !pausado;

  const rotuloAcessivel = !gravando
    ? rotulo
    : pausado
      ? `Gravação pausada em ${formatarTempo(segundos ?? 0)}. Toque para continuar`
      : `Gravando, ${formatarTempo(segundos ?? 0)}. Toque para pausar`;

  return (
    <View style={{ alignItems: 'center', gap: espaco.s2 }}>
      <Pressable
        onPressIn={() => {
          if (!reduzir) escala.set(withSpring(0.94, { damping: 18, stiffness: 300 }));
        }}
        onPressOut={() => {
          escala.set(withSpring(1, { damping: 14, stiffness: 260 }));
        }}
        onPress={() => {
          haptic.toque();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={rotuloAcessivel}
        accessibilityHint={gravando ? undefined : 'Toque para começar a gravar um áudio'}
        hitSlop={12}
      >
        <Animated.View
          style={[
            {
              width: tamanho,
              height: tamanho,
              borderRadius: tamanho / 2,
              backgroundColor: pausado ? cores.tertiaryBackground : cores.accent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            estiloBotao,
          ]}
        >
          {gravando && !pausado ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {ALTURAS.map((_, i) => (
                <Barra key={i} indice={i} ativa={ativo} nivel={nivel} cor={cores.onAccent} />
              ))}
            </View>
          ) : (
            <Icon
              nome="gravar"
              cor={pausado ? cores.accentStrong : cores.onAccent}
              tamanho={Math.round(tamanho * 0.4)}
            />
          )}
        </Animated.View>
      </Pressable>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variante="headline" centro accessibilityLiveRegion="polite">
          {gravando ? formatarTempo(segundos ?? 0) : rotulo}
        </Text>
        {(apoio || gravando) && (
          <Text variante="callout" cor="secondaryLabel" centro>
            {gravando ? (pausado ? 'Pausado. Toque para continuar' : 'Toque para pausar') : apoio}
          </Text>
        )}
      </View>
    </View>
  );
}
