import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon, PrimaryButton, Text } from '@/components';
import { ErroApi } from '@/lib/api';
import { atualizarEu, familiaAtual, meuNome, type Papel, PAPEIS } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

/** Seu nome e seu papel na família. Aparece nas tarefas, nos avisos e nos obrigados. */
export default function Eu() {
  const { cores, margem } = useTema();
  const [nome, setNome] = useState(meuNome());
  const [papel, setPapel] = useState<Papel>(familiaAtual().eu?.papel ?? 'familiar');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    try {
      await atualizarEu(nome.trim(), papel);
      haptic.sucesso();
      router.back();
    } catch (e) {
      setSalvando(false);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui salvar agora.');
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, gap: espaco.s3 }}>
      <Text variante="title2" accessibilityRole="header">
        Você na família
      </Text>
      <View style={{ gap: espaco.s1 }}>
        <Text variante="footnote" cor="secondaryLabel">
          Seu nome, como a família te chama
        </Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Cláudia"
          placeholderTextColor={cores.tertiaryLabel}
          autoFocus={!nome}
          accessibilityLabel="Seu nome"
          style={[tipografia.body, { color: cores.label, backgroundColor: cores.secondaryBackground, borderRadius: raio.card, paddingHorizontal: espaco.s2, minHeight: 52 }]}
        />
      </View>
      <View style={{ gap: espaco.s1 }} accessibilityRole="radiogroup">
        <Text variante="footnote" cor="secondaryLabel">
          Seu papel
        </Text>
        {(Object.keys(PAPEIS) as Papel[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              haptic.selecao();
              setPapel(p);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: papel === p }}
            style={{ minHeight: tamanho.toqueMinimo + 8, borderRadius: raio.botao, backgroundColor: papel === p ? cores.accentSoft : cores.secondaryBackground, borderWidth: 2, borderColor: papel === p ? cores.accentStrong : 'transparent', flexDirection: 'row', alignItems: 'center', gap: espaco.s2, paddingHorizontal: espaco.s2 }}
          >
            <Text variante="headline" style={{ flex: 1 }}>
              {PAPEIS[p]}
            </Text>
            {papel === p && <Icon nome="feito" cor={cores.accentStrong} />}
          </Pressable>
        ))}
      </View>
      {erro && (
        <Text variante="callout" cor="emergency">
          {erro}
        </Text>
      )}
      <PrimaryButton titulo={salvando ? 'Salvando...' : 'Salvar'} desativado={!nome.trim() || salvando} onPress={salvar} />
    </ScrollView>
  );
}
