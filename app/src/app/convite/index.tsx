import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { Coluna, Logo, PrimaryButton, Text } from '@/components';
import { api, ErroApi } from '@/lib/api';
import { carregarConversa } from '@/lib/conversa';
import { atualizarRelatos } from '@/lib/diario';
import { carregarFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { carregarPassaporte } from '@/lib/passaporte';
import { espaco, raio, tipografia, useTema } from '@/theme';

/** Entrar na família de alguém com o código do convite (ou pelo link sempreaqui://convite/CODIGO). */
export default function Convite() {
  const { cores, margem } = useTema();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const [codigo, setCodigo] = useState(params.codigo ?? '');
  const [nome, setNome] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setEntrando(true);
    setErro(null);
    try {
      await api.entrarComConvite(codigo, nome.trim());
      await Promise.all([carregarFamilia(), carregarPassaporte(), atualizarRelatos(), carregarConversa([])]);
      haptic.sucesso();
      router.replace('/familia');
    } catch (e) {
      setEntrando(false);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui entrar agora. Tente de novo.');
    }
  }

  const campo = [tipografia.body, { color: cores.label, backgroundColor: cores.secondaryBackground, borderRadius: raio.card, paddingHorizontal: espaco.s2, minHeight: 52 }];

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: margem, paddingTop: espaco.secao, gap: espaco.s3 }}>
      <Coluna gap="s1">
        <Logo tamanho={48} decorativa />
        <Text variante="title2" accessibilityRole="header">
          Entrar na família
        </Text>
        <Text variante="callout" cor="secondaryLabel">
          Digite o código que mandaram no WhatsApp. Depois disso você vê os resumos, as tarefas e o passaporte da família.
        </Text>
      </Coluna>
      <Coluna gap="s1">
        <Text variante="footnote" cor="secondaryLabel">
          Código do convite
        </Text>
        <TextInput value={codigo} onChangeText={(t) => setCodigo(t.toUpperCase())} placeholder="ABCD-2345" placeholderTextColor={cores.tertiaryLabel} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Código do convite" style={campo} />
        <Text variante="footnote" cor="secondaryLabel">
          Seu nome, como a família te chama
        </Text>
        <TextInput value={nome} onChangeText={setNome} placeholder="Rafael" placeholderTextColor={cores.tertiaryLabel} accessibilityLabel="Seu nome" style={campo} />
      </Coluna>
      {erro && (
        <Text variante="callout" cor="emergency">
          {erro}
        </Text>
      )}
      <PrimaryButton titulo={entrando ? 'Entrando...' : 'Entrar'} desativado={codigo.replace(/[^A-Z0-9]/g, '').length < 6 || !nome.trim() || entrando} onPress={entrar} />
    </ScrollView>
  );
}
