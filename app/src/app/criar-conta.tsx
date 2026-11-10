import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Coluna, Icon, PrimaryButton, SecondaryButton, Text } from '@/components';
import { LoginField } from '@/components/LoginField';
import { api, ErroApi } from '@/lib/api';
import { entrar } from '@/lib/entrar';
import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { entrarComSenha, supabase } from '@/lib/sessao';
import { normalizarEmail, requisitosSenha, validarCadastro, VERSAO_TERMOS } from '@/lib/validar-login';
import { espaco, raio, tamanho, useTema } from '@/theme';

export default function CriarConta() {
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const senhaRef = useRef<ComponentRef<typeof TextInput>>(null);
  const ocupado = useRef(false);
  const criadaRef = useRef(false);
  const [contaCriada, setContaCriada] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [validou, setValidou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState(false);
  const erros = validarCadastro(nome, email, senha, aceito);
  const regras = requisitosSenha(senha);
  const requisitos = [
    { valido: regras.tamanho, texto: 'Pelo menos 8 caracteres' },
    { valido: regras.letra, texto: 'Uma letra' },
    { valido: regras.numero, texto: 'Um número' },
  ];

  async function enviar() {
    if (ocupado.current || !supabase) return;
    setValidou(true);
    if (Object.values(erros).some(Boolean)) { haptic.erro(); return; }
    ocupado.current = true;
    setEnviando(true);
    setErro(null);
    setDuplicado(false);
    Keyboard.dismiss();
    try {
      if (!criadaRef.current) {
        await api.cadastrar({ nome: nome.trim(), email: normalizarEmail(email), senha, aceite_termos: true, versao_termos: VERSAO_TERMOS });
        criadaRef.current = true;
        setContaCriada(true);
      }
      await entrarComSenha(email, senha);
      setSenha('');
      await entrar();
      haptic.sucesso();
    } catch (e) {
      haptic.erro();
      const mensagem = e instanceof Error ? e.message : 'Não consegui criar sua conta agora. Tente de novo.';
      setDuplicado(e instanceof ErroApi && e.status === 409);
      setErro(criadaRef.current ? `Sua conta foi criada. ${mensagem}` : mensagem);
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: cores.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: margem, paddingTop: topo + espaco.s3, paddingBottom: base + espaco.s3, gap: espaco.s3 }}>
        <Text variante="largeTitle" accessibilityRole="header">Criar conta</Text>
        <Text cor="secondaryLabel">Para que ninguém cuide sozinho.</Text>
        <LoginField rotulo="Seu nome" value={nome} onChangeText={setNome} placeholder="Como você gosta de ser chamado?" autoCapitalize="words" textContentType="name" autoComplete="name" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} editable={!enviando && !contaCriada} maxLength={60} erro={validou ? erros.nome : null} />
        <LoginField ref={emailRef} rotulo="E-mail" value={email} onChangeText={(v) => { setEmail(v); setDuplicado(false); }} placeholder="seu@email.com" keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => senhaRef.current?.focus()} editable={!enviando && !contaCriada} maxLength={254} erro={validou ? erros.email : null} />
        <Coluna gap="s1">
          <LoginField ref={senhaRef} rotulo="Senha" senha value={senha} onChangeText={setSenha} textContentType="newPassword" autoComplete="new-password" returnKeyType="done" onSubmitEditing={() => void enviar()} editable={!enviando} maxLength={128} erro={validou ? erros.senha : null} />
          {requisitos.map(({ valido, texto }) => (
            <View key={texto} style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }} accessible accessibilityLabel={`${texto}: ${valido ? 'atendido' : 'ainda não atendido'}`}>
              <Icon nome={valido ? 'feito' : 'pendente'} cor={valido ? cores.success : cores.secondaryLabel} tamanho={18} />
              <Text variante="footnote" cor={valido ? 'success' : 'secondaryLabel'} style={{ flex: 1 }}>{texto}</Text>
            </View>
          ))}
        </Coluna>
        <Coluna gap="s1">
          <Pressable disabled={enviando || contaCriada} onPress={() => { haptic.selecao(); setAceito(!aceito); }} accessibilityRole="checkbox" accessibilityState={{ checked: aceito, disabled: enviando || contaCriada }} accessibilityLabel="Concordo com os Termos de Uso e a Política de Privacidade" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espaco.s2, minHeight: tamanho.toqueMinimo, padding: espaco.s2, borderRadius: raio.card, backgroundColor: aceito ? cores.accentSoft : cores.secondaryBackground }}>
            <Icon nome={aceito ? 'feito' : 'pendente'} cor={aceito ? cores.accentStrong : cores.secondaryLabel} />
            <Text variante="callout" style={{ flex: 1 }}>Concordo com os Termos de Uso e a Política de Privacidade. Entendo que o SempreAqui guarda informações de saúde da minha família com segurança e que posso apagar tudo quando quiser.</Text>
          </Pressable>
          {validou && erros.aceite && <Text variante="footnote" cor="attention" accessibilityLiveRegion="polite">{erros.aceite}</Text>}
          <SecondaryButton titulo="Ler Termos de Uso" alinhamento="inicio" onPress={() => router.push({ pathname: '/documento-conta', params: { tipo: 'termos' } })} />
          <SecondaryButton titulo="Ler Política de Privacidade" alinhamento="inicio" onPress={() => router.push({ pathname: '/documento-conta', params: { tipo: 'privacidade' } })} />
        </Coluna>
        {erro && <Text variante="callout" cor="attention" accessibilityLiveRegion="polite">{erro}</Text>}
        {duplicado && <SecondaryButton titulo="Entrar com esse e-mail" onPress={() => router.replace('/entrar')} />}
        {!supabase && <Text cor="secondaryLabel">O cadastro ainda não está configurado neste app.</Text>}
        <PrimaryButton titulo={enviando ? 'Criando sua conta…' : contaCriada ? 'Entrar na minha conta' : 'Criar conta'} onPress={() => void enviar()} desativado={enviando || !nome.trim() || !email.trim() || !senha || !aceito || !supabase} />
        {enviando && <ActivityIndicator color={cores.accentStrong} accessibilityLabel="Criando sua conta" />}
        {!enviando && <SecondaryButton titulo="Já tenho conta. Entrar" onPress={() => router.replace('/entrar')} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
