import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Avatar, Icon, PrimaryButton, SecondaryButton, Text } from '@/components';
import { ErroApi } from '@/lib/api';
import { atualizarEu, familiaAtual, meuNome, type Papel, PAPEIS } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { enviarFoto, fotoDaChave } from '@/lib/passaporte';
import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

/** Seu nome e seu papel na família. Aparece nas tarefas, nos avisos e nos obrigados. */
export default function Eu() {
  const { cores, margem } = useTema();
  const [nome, setNome] = useState(meuNome());
  const [papel, setPapel] = useState<Papel>(familiaAtual().eu?.papel ?? 'familiar');
  const [foto, setFoto] = useState<string | null>(familiaAtual().eu?.foto ?? null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolherFoto(camera: boolean) {
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const r = camera ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
    if (r.canceled || !r.assets[0]) return;
    setEnviando(true);
    try {
      setFoto(await enviarFoto(r.assets[0].uri));
      haptic.sucesso();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não consegui enviar a foto agora.');
    } finally {
      setEnviando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      await atualizarEu(nome.trim(), papel, foto);
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
      <View style={{ alignItems: 'center', gap: espaco.s1 }}>
        <Avatar nome={nome || '?'} tom={1} grande fonte={fotoDaChave(foto)} />
        <View style={{ flexDirection: 'row', gap: espaco.s1 }}>
          <SecondaryButton titulo={enviando ? 'Enviando...' : foto ? 'Trocar foto' : 'Pôr uma foto'} icone="foto" onPress={() => escolherFoto(false)} />
          <SecondaryButton titulo="Tirar foto" icone="foto" onPress={() => escolherFoto(true)} />
        </View>
      </View>
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
