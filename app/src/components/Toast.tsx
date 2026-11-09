import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { escuro as coresEscuras, espaco, raio, tamanho, useTema } from '@/theme';

import { Text } from './Text';

/**
 * Aviso curto na parte de baixo da tela, com "Desfazer" quando faz sentido.
 * Preferimos desfazer depois a pedir "tem certeza?" antes.
 */
type Aviso = { id: number; mensagem: string; acao?: { titulo: string; onPress: () => void } };

let atual: Aviso | null = null;
let contador = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());

export function mostrarToast(mensagem: string, acao?: Aviso['acao']) {
  atual = { id: ++contador, mensagem, acao };
  avisar();
}

export function esconderToast() {
  atual = null;
  avisar();
}

export function ToastHost() {
  const aviso = useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => atual,
  );
  const { cores, escuro, margem } = useTema();
  const { base } = useMargensSeguras();

  useEffect(() => {
    if (!aviso) return;
    const prazo = setTimeout(() => {
      if (atual?.id === aviso.id) esconderToast();
    }, aviso.acao ? 6000 : 3500);
    return () => clearTimeout(prazo);
  }, [aviso]);

  if (!aviso) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: base + 72 }}>
      <Animated.View
        key={aviso.id}
        entering={FadeInDown.springify().damping(18).duration(260)}
        exiting={FadeOutDown.duration(180)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          marginHorizontal: margem,
          borderRadius: raio.card,
          backgroundColor: escuro ? cores.tertiaryBackground : cores.label,
          paddingHorizontal: espaco.s2,
          paddingVertical: espaco.s1 + espaco.meio,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espaco.s2,
        }}
      >
        <Text variante="callout" style={{ flex: 1, color: escuro ? cores.label : cores.background }}>
          {aviso.mensagem}
        </Text>
        {aviso.acao && (
          <Pressable
            onPress={() => {
              haptic.toque();
              aviso.acao?.onPress();
              esconderToast();
            }}
            accessibilityRole="button"
            accessibilityLabel={aviso.acao.titulo}
            hitSlop={10}
            style={{ minHeight: tamanho.toqueMinimo, justifyContent: 'center' }}
          >
            <Text variante="botao" style={{ color: coresEscuras.accent }}>
              {aviso.acao.titulo}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
