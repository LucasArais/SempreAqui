import { Pressable, TextInput, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

import { Icon } from './Icon';

/** Campo grande de texto com botão de voz ao lado. Voz sempre à mão. */
export function TextField({
  valor,
  onChange,
  placeholder,
  rotulo,
  onVoz,
}: {
  valor: string;
  onChange: (texto: string) => void;
  placeholder: string;
  rotulo: string;
  onVoz?: () => void;
}) {
  const { cores } = useTema();
  return (
    <View
      style={{
        backgroundColor: cores.secondaryBackground,
        borderRadius: raio.card,
        borderCurve: 'continuous',
        padding: espaco.s2,
        gap: espaco.s1,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={cores.secondaryLabel}
        multiline
        accessibilityLabel={rotulo}
        style={[tipografia.body, { flex: 1, minHeight: 96, color: cores.label, textAlignVertical: 'top', paddingTop: 0 }]}
      />
      {onVoz && (
        <Pressable
          onPress={() => {
            haptic.toque();
            onVoz();
          }}
          accessibilityRole="button"
          accessibilityLabel="Falar em vez de escrever"
          accessibilityHint="Grava um áudio descrevendo a situação"
          style={({ pressed }) => ({
            width: tamanho.toqueMinimo,
            height: tamanho.toqueMinimo,
            borderRadius: tamanho.toqueMinimo / 2,
            backgroundColor: cores.accent,
            opacity: pressed ? 0.8 : 1,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icon nome="gravar" cor={cores.onAccent} tamanho={20} />
        </Pressable>
      )}
    </View>
  );
}
