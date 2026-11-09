import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Icon, type NomeIcone } from './Icon';
import { Text } from './Text';

type PropsBotao = {
  titulo: string;
  onPress: () => void;
  icone?: NomeIcone;
  dica?: string;
  desativado?: boolean;
};

/** A ação principal da tela. Uma por tela. Largura total, coral, altura 52. */
export function PrimaryButton({ titulo, onPress, icone, dica, desativado }: PropsBotao) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        onPress();
      }}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: desativado }}
      style={({ pressed }) => ({
        minHeight: tamanho.botao,
        borderRadius: raio.botao,
        borderCurve: 'continuous',
        backgroundColor: desativado ? cores.tertiaryBackground : cores.accentStrong,
        opacity: pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: espaco.s1,
        paddingHorizontal: espaco.s2,
        paddingVertical: espaco.s1 + espaco.meio,
      })}
    >
      {icone && <Icon nome={icone} cor={desativado ? cores.secondaryLabel : cores.onAccent} tamanho={20} />}
      <Text variante="botao" cor={desativado ? 'secondaryLabel' : 'onAccent'} centro>
        {titulo}
      </Text>
    </Pressable>
  );
}

/** Ação secundária: sem fundo, texto na cor de destaque. */
export function SecondaryButton({
  titulo,
  onPress,
  icone,
  dica,
  alinhamento = 'centro',
}: PropsBotao & { alinhamento?: 'centro' | 'inicio' }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.selecao();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: tamanho.toqueMinimo,
        opacity: pressed ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: alinhamento === 'centro' ? 'center' : 'flex-start',
        alignSelf: alinhamento === 'centro' ? 'stretch' : 'flex-start',
        gap: espaco.s1 - 2,
      })}
    >
      {icone && <Icon nome={icone} cor={cores.accentStrong} tamanho={18} />}
      <Text variante="botao" cor="accentStrong">
        {titulo}
      </Text>
    </Pressable>
  );
}

/**
 * Emergência: sempre à vista na aba Ajuda, mas sóbria.
 * É o único lugar do app que usa vermelho.
 */
export function EmergencyButton({ onPress }: { onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Emergência. Ligar 192, SAMU"
      accessibilityHint="Abre o telefone para ligar para o SAMU"
      style={({ pressed }) => ({
        minHeight: tamanho.botao,
        borderRadius: raio.botao,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: cores.emergency,
        backgroundColor: pressed ? cores.secondaryBackground : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.s2,
        paddingHorizontal: espaco.s2,
        paddingVertical: espaco.s1 + espaco.meio,
      })}
    >
      <Icon nome="telefone" cor={cores.emergency} />
      <View style={{ flex: 1 }}>
        <Text variante="headline" cor="emergency">
          Emergência: ligar 192
        </Text>
        <Text variante="footnote" cor="secondaryLabel">
          Queda, falta de ar, engasgo ou desmaio
        </Text>
      </View>
    </Pressable>
  );
}
