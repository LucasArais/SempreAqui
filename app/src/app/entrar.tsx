import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';

import { Coluna, Logo, PrimaryButton, SecondaryButton, Text } from '@/components';
import { LoginField } from '@/components/LoginField';
import { entrar } from '@/lib/entrar';
import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { entrarComSenha, sessaoAtual, supabase, useSessao } from '@/lib/sessao';
import { validarEmail } from '@/lib/validar-login';
import { espaco, useTema } from '@/theme';

export default function Entrar() {
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const sessao = useSessao();
  const senhaRef = useRef<ComponentRef<typeof TextInput>>(null);
  const enviandoRef = useRef(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (enviandoRef.current || !email.trim() || !senha || !supabase) return;
    const invalido = validarEmail(email);
    setErroEmail(invalido);
    if (invalido) { haptic.erro(); return; }
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    Keyboard.dismiss();
    try {
      await entrarComSenha(email, senha);
      setSenha('');
      await entrar();
      if (!sessaoAtual().pronta) throw new Error(sessaoAtual().erro ?? 'Não consegui abrir sua família agora.');
      haptic.sucesso();
    } catch (e) {
      haptic.erro();
      setErro(e instanceof Error ? e.message : 'Não consegui entrar agora. Tente de novo.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: cores.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: margem, paddingTop: topo + espaco.secao, paddingBottom: base + espaco.s3, gap: espaco.secao, justifyContent: 'center' }}>
        <Coluna centro gap="s2">
          <Logo tamanho={72} />
          <Text variante="title2" centro>SempreAqui</Text>
          <Text cor="secondaryLabel" centro>Para que ninguém cuide sozinho.</Text>
        </Coluna>
        <Coluna gap="s3">
          <Text variante="largeTitle" accessibilityRole="header">Entrar</Text>
          <LoginField rotulo="E-mail" value={email} onChangeText={(v) => { setEmail(v); setErroEmail(null); setErro(null); }} placeholder="seu@email.com" keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => senhaRef.current?.focus()} editable={!enviando} erro={erroEmail} />
          <LoginField ref={senhaRef} rotulo="Senha" senha value={senha} onChangeText={(v) => { setSenha(v); setErro(null); }} textContentType="password" autoComplete="current-password" returnKeyType="go" onSubmitEditing={() => void enviar()} editable={!enviando} />
          {(erro || sessao.erro) && <Text variante="callout" cor="attention" accessibilityLiveRegion="polite">{erro || sessao.erro}</Text>}
          {!supabase && <Text variante="callout" cor="secondaryLabel">O login ainda não está configurado neste app.</Text>}
          <View style={{ gap: espaco.s1 }}>
            <PrimaryButton titulo={enviando ? 'Entrando…' : 'Entrar'} onPress={() => void enviar()} desativado={!email.trim() || !senha || enviando || !supabase} />
            {!enviando && <SecondaryButton tom="azul" titulo="Criar nova conta" onPress={() => router.push('/criar-conta')} />}
            {enviando && <ActivityIndicator color={cores.accentStrong} accessibilityLabel="Entrando na sua conta" />}
          </View>
        </Coluna>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
