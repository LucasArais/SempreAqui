import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { EmergencyButton, Icon, Logo, mostrarToast, SecondaryButton, Text } from '@/components';
import { apoio as exemploApoio } from '@/data/familia';
import { abrirLink, ligarEmergencia } from '@/lib/abrir';
import { apagarConversa, carregarAjudante, type Mensagem, perguntar, type RespostaAjudante, useAjudante } from '@/lib/ajudante';
import { transcreverPedido, type RespostaApoio } from '@/lib/apoio';
import { avisarFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { passaporteAtual } from '@/lib/passaporte';
import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

const INICIAIS = ['Como ela está hoje?', 'Como foi a semana?', 'Ela está agitada, o que eu faço?', 'O que falta fazer esta semana?'];

const ACOES: Record<NonNullable<RespostaAjudante['acao']>, { titulo: string; ir: () => void }> = {
  ver_semana: { titulo: 'Ver a semana', ir: () => router.push('/hoje/semana') },
  ver_tarefas: { titulo: 'Ver as tarefas', ir: () => router.push('/familia') },
  nova_tarefa: { titulo: 'Pedir ajuda com uma tarefa', ir: () => router.push('/nova-tarefa') },
  ver_passaporte: { titulo: 'Abrir o Passaporte', ir: () => router.push('/memorias') },
  abrir_conversa: { titulo: 'Começar a conversa', ir: () => router.push('/sessao') },
};

function Chips({ itens, onEscolher }: { itens: string[]; onEscolher: (t: string) => void }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s1 }}>
      {itens.map((t) => (
        <Pressable
          key={t}
          onPress={() => {
            haptic.selecao();
            onEscolher(t);
          }}
          accessibilityRole="button"
          style={{ minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.s2, borderRadius: raio.botao, borderWidth: 1.5, borderColor: cores.accentStrong, justifyContent: 'center' }}
        >
          <Text variante="callout" style={{ color: cores.accentStrong }}>
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A resposta do Apoio dentro do chat: risco, recusa médica, sugestões com origem e fontes. */
function BlocoApoio({ r, pedido }: { r: RespostaApoio; pedido: string }) {
  const { cores } = useTema();
  const [avisado, setAvisado] = useState(false);
  return (
    <View style={{ gap: espaco.s2 }}>
      {r.aviso && (
        <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
          <Icon nome={r.tipo === 'risco' ? 'atencao' : 'remedio'} cor={r.tipo === 'risco' ? cores.emergency : cores.accentStrong} />
          <Text variante={r.tipo === 'risco' ? 'headline' : 'body'} style={{ flex: 1 }}>
            {r.aviso}
          </Text>
        </View>
      )}
      {r.tipo === 'risco' && (
        <>
          <EmergencyButton onPress={ligarEmergencia} />
          <SecondaryButton
            titulo={avisado ? 'Família avisada' : 'Avisar a família agora'}
            icone="familia"
            desativado={avisado}
            onPress={async () => {
              try {
                await avisarFamilia(pedido);
                setAvisado(true);
                haptic.sucesso();
                await Share.share({ message: `Aviso sobre a ${r.chamada}: ${pedido}` });
              } catch {
                mostrarToast('Não consegui avisar pelo app. Mande uma mensagem direto para a família.');
              }
            }}
          />
        </>
      )}
      {r.sugestoes.length > 0 && (
        <View style={{ gap: espaco.s1 }}>
          <Text variante="headline">O que costuma funcionar com a {r.chamada}</Text>
          {r.sugestoes.map((s) => (
            <View key={s.titulo} style={{ gap: 2 }}>
              <Text variante="body">
                <Text variante="body" style={{ fontWeight: '600' }}>
                  {s.titulo}.
                </Text>{' '}
                {s.texto}
              </Text>
              <Text variante="footnote" cor="secondaryLabel">
                {s.origem}
              </Text>
            </View>
          ))}
        </View>
      )}
      {r.acoes.includes('pedir_ajuda_familia') && (
        <SecondaryButton titulo="Pedir uma folga à família" icone="familia" alinhamento="inicio" onPress={() => router.push({ pathname: '/nova-tarefa', params: { tipo: 'cobrir_folga' } })} />
      )}
      {r.fontes.map((f) => (
        <View key={f.id} style={{ gap: espaco.meio, borderLeftWidth: 3, borderLeftColor: cores.accentStrong, paddingLeft: espaco.s1 + 2 }}>
          <Text variante="callout">“{f.texto}”</Text>
          <Pressable onPress={() => abrirLink(f.url)} accessibilityRole="link" hitSlop={8}>
            <Text variante="footnote" style={{ color: cores.accentStrong }}>
              {f.fonte}. Abrir a fonte
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Balao({ m, pedido, onPerguntar }: { m: Mensagem; pedido: string; onPerguntar: (t: string) => void }) {
  const { cores } = useTema();
  if (m.de === 'eu') {
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: cores.accent, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: espaco.s2, paddingVertical: espaco.s1 + 2 }}>
        <Text variante="body" style={{ color: cores.onAccent }}>
          {m.texto}
        </Text>
      </View>
    );
  }
  const r = m.resposta;
  const acao = r?.acao ? ACOES[r.acao] : null;
  return (
    <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start', maxWidth: '100%' }}>
      <Logo tamanho={28} decorativa />
      <View style={{ flex: 1, gap: espaco.s1, backgroundColor: cores.secondaryBackground, borderRadius: 20, borderTopLeftRadius: 6, padding: espaco.s2 }}>
        {m.texto && <Text variante="body">{m.texto}</Text>}
        {r?.tipo === 'apoio' && r.apoio ? (
          <BlocoApoio r={r.apoio} pedido={pedido} />
        ) : r ? (
          <>
            {r.texto && <Text variante="body">{r.texto}</Text>}
            {r.origem && (
              <Text variante="footnote" cor="secondaryLabel">
                {r.origem}
              </Text>
            )}
            {acao && <SecondaryButton titulo={acao.titulo} alinhamento="inicio" onPress={acao.ir} />}
            {r.relato_id && (
              <SecondaryButton titulo="Ver o relato" alinhamento="inicio" onPress={() => router.push({ pathname: '/hoje/diario/[id]', params: { id: r.relato_id! } })} />
            )}
            {r.sugestoes && <Chips itens={r.sugestoes} onEscolher={onPerguntar} />}
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Ajudante: o chat da família sobre o cuidado. Responde com o que está registrado e diz de onde
 * veio; na hora difícil, vira o Apoio, com 192, fontes oficiais e o que costuma funcionar.
 */
export default function Ajudante() {
  const { exemplo } = useLocalSearchParams<{ exemplo?: string }>();
  const { cores, margem } = useTema();
  const { mensagens, pensando } = useAjudante();
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  useEffect(() => {
    const abre = Keyboard.addListener('keyboardWillShow', () => setTecladoAberto(true));
    const fecha = Keyboard.addListener('keyboardWillHide', () => setTecladoAberto(false));
    return () => {
      abre.remove();
      fecha.remove();
    };
  }, []);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const chamada = passaporteAtual().como_gosta_de_ser_chamada || 'ela';

  useEffect(() => {
    void carregarAjudante().then(() => {
      if (exemplo) void perguntar(exemploApoio.exemplo);
    });
  }, [exemplo]);

  function enviar(t = texto) {
    if (!t.trim()) return;
    setTexto('');
    haptic.toque();
    void perguntar(t);
  }

  async function voz() {
    if (gravando) {
      setGravando(false);
      await gravador.stop();
      try {
        const falado = gravador.uri ? await transcreverPedido(gravador.uri) : '';
        if (falado) enviar(falado);
      } catch {
        mostrarToast('Não consegui ouvir agora. Pode escrever?');
      }
      return;
    }
    const permissao = await AudioModule.requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      mostrarToast('Sem permissão para o microfone. Você pode escrever.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await gravador.prepareToRecordAsync();
    gravador.record();
    haptic.toque();
    setGravando(true);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: cores.background }}>
      <ScrollView
        ref={rolagem}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: margem, paddingBottom: espaco.s2, gap: espaco.s2 }}
      >
        <EmergencyButton onPress={ligarEmergencia} />

        <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
          <Logo tamanho={28} decorativa />
          <View style={{ flex: 1, gap: espaco.s1, backgroundColor: cores.secondaryBackground, borderRadius: 20, borderTopLeftRadius: 6, padding: espaco.s2 }}>
            <Text variante="body">
              Oi! Eu sou o Ajudante. Respondo com o que a família registrou sobre a {chamada} e, na hora difícil, digo o que costuma funcionar com ela. Não dou diagnóstico nem indico remédio.
            </Text>
            {mensagens.length === 0 && <Chips itens={INICIAIS} onEscolher={enviar} />}
          </View>
        </View>

        {mensagens.map((m, i) => (
          <Animated.View key={m.id} entering={FadeInUp.duration(250)}>
            <Balao m={m} pedido={mensagens[i - 1]?.texto ?? ''} onPerguntar={enviar} />
          </Animated.View>
        ))}

        {pensando && (
          <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }}>
            <Logo tamanho={28} decorativa />
            <Text variante="callout" cor="secondaryLabel" accessibilityLiveRegion="polite">
              Procurando no que a família registrou...
            </Text>
          </View>
        )}

        {mensagens.length > 0 && !pensando && (
          <Pressable onPress={apagarConversa} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: tamanho.toqueMinimo, justifyContent: 'center' }}>
            <Text variante="footnote" cor="secondaryLabel">
              Apagar a conversa deste celular
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Campo fixo embaixo, como num app de mensagens. Teclado fechado: acima das abas (área
          segura nativa). Teclado aberto: sobe junto com o teclado. */}
      <SafeAreaView
        edges={tecladoAberto ? [] : ['bottom']}
        style={{ backgroundColor: cores.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.separator }}
      >
        <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-end', paddingHorizontal: margem, paddingVertical: espaco.s1 }}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={gravando ? 'Ouvindo... toque no quadrado para enviar' : 'Pergunte ao Ajudante'}
            placeholderTextColor={cores.tertiaryLabel}
            multiline
            accessibilityLabel="Sua pergunta"
            style={[tipografia.body, { flex: 1, color: cores.label, backgroundColor: cores.secondaryBackground, borderRadius: 22, paddingHorizontal: espaco.s2, paddingTop: 12, paddingBottom: 12, minHeight: 46, maxHeight: 120 }]}
          />
          {texto.trim() ? (
            <Pressable onPress={() => enviar()} accessibilityRole="button" accessibilityLabel="Enviar" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: cores.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon nome="seguir" cor={cores.onAccent} />
            </Pressable>
          ) : (
            <Pressable
              onPress={voz}
              accessibilityRole="button"
              accessibilityLabel={gravando ? 'Parar e enviar' : 'Falar a pergunta'}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: gravando ? cores.emergency : cores.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon nome={gravando ? 'parar' : 'gravar'} cor={cores.onAccent} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
