import { useState, type Ref, type ComponentRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export function LoginField({ rotulo, erro, senha, ref, ...props }: TextInputProps & {
  rotulo: string;
  erro?: string | null;
  senha?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const { cores } = useTema();
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={{ gap: espaco.s1 }}>
      <Text variante="headline">{rotulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cores.secondaryBackground, borderRadius: raio.botao }}>
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={rotulo}
          accessibilityHint={erro ?? undefined}
          autoCapitalize={props.autoCapitalize ?? "none"}
          autoCorrect={props.autoCorrect ?? false}
          secureTextEntry={senha && !visivel}
          placeholderTextColor={cores.secondaryLabel}
          style={[tipografia.body, { flex: 1, minHeight: tamanho.botao, padding: espaco.s2, color: cores.label }]}
        />
        {senha && (
          <Pressable onPress={() => setVisivel(!visivel)} accessibilityRole="button" accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'} style={{ minWidth: tamanho.toqueMinimo, minHeight: tamanho.toqueMinimo, alignItems: 'center', justifyContent: 'center', marginRight: espaco.s1 }}>
            <Icon nome={visivel ? 'ocultar' : 'olho'} cor={cores.secondaryLabel} />
          </Pressable>
        )}
      </View>
      {erro && <Text variante="footnote" cor="attention" accessibilityLiveRegion="polite">{erro}</Text>}
    </View>
  );
}
