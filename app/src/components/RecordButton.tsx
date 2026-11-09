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
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ALTURAS = [0.45, 0.8, 1, 0.7, 0.5];

function Barra({ indice, ativa, cor }: { indice: number; ativa: boolean; cor: string }) {
  const reduzir = useReducedMotion();
  const escala = useSharedValue(ALTURAS[indice]);

  useEffect(() => {
    if (ativa && !reduzir) {
      const alvo = ALTURAS[(indice + 2) % ALTURAS.length];
      escala.value = withDelay(
        indice * 70,
        withRepeat(
          withSequence(
            withTiming(Math.max(0.25, alvo * 0.4), { duration: 260 }),
            withTiming(Math.min(1, alvo + 0.2), { duration: 300 }),
          ),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(escala);
      escala.value = withTiming(ALTURAS[indice], { duration: 200 });
    }
  }, [ativa, reduzir, indice, escala]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ scaleY: escala.value }] }));
  return (
    <Animated.View
      style={[{ width: 5, height: 34, borderRadius: 3, backgroundColor: cor }, estilo]}
    />
  );
}

/**
 * Botão de gravar: círculo grande com microfone. Enquanto grava, vira uma onda de áudio
 * e mostra o tempo. Confirma início e fim com haptic.
 */
export function RecordButton({
  gravando,
  segundos,
  onPress,
  rotulo = 'Como foi o dia?',
  apoio,
  tamanho = tamanhos.gravar,
}: {
  gravando: boolean;
  segundos?: number;
  onPress: () => void;
  rotulo?: string;
  apoio?: string;
  tamanho?: number;
}) {
  const { cores } = useTema();
  const reduzir = useReducedMotion();
  const escala = useSharedValue(1);
  const estiloBotao = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

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
        accessibilityLabel={gravando ? `Parar gravação. ${formatarTempo(segundos ?? 0)} gravados` : rotulo}
        accessibilityHint={gravando ? 'Toque para terminar e organizar o relato' : 'Toque para começar a gravar um áudio'}
        hitSlop={12}
      >
        <Animated.View
          style={[
            {
              width: tamanho,
              height: tamanho,
              borderRadius: tamanho / 2,
              backgroundColor: cores.accent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            estiloBotao,
          ]}
        >
          {gravando ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {ALTURAS.map((_, i) => (
                <Barra key={i} indice={i} ativa={gravando} cor={cores.onAccent} />
              ))}
            </View>
          ) : (
            <Icon nome="gravar" cor={cores.onAccent} tamanho={Math.round(tamanho * 0.4)} />
          )}
        </Animated.View>
      </Pressable>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variante="headline" centro accessibilityLiveRegion="polite">
          {gravando ? formatarTempo(segundos ?? 0) : rotulo}
        </Text>
        {(apoio || gravando) && (
          <Text variante="callout" cor="secondaryLabel" centro>
            {gravando ? 'Toque de novo quando terminar' : apoio}
          </Text>
        )}
      </View>
    </View>
  );
}
