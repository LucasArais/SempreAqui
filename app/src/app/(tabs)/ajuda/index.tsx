import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Card,
  Coluna,
  EmergencyButton,
  EmptyState,
  Icon,
  mostrarToast,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Section,
  Skeleton,
  Text,
} from '@/components';
import { TextField } from '@/components/TextField';
import { apoio as exemploApoio } from '@/data/familia';
import { abrirLink, ligarEmergencia } from '@/lib/abrir';
import { ErroApi, api } from '@/lib/api';
import { type RespostaApoio, transcreverPedido } from '@/lib/apoio';
import { avisarFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { passaporteAtual } from '@/lib/passaporte';
import { espaco, useTema } from '@/theme';

type Estado = 'vazio' | 'gravando' | 'ouvindo' | 'pensando' | 'resposta' | 'erro';

export default function Ajuda() {
  const { exemplo } = useLocalSearchParams<{ exemplo?: string }>();
  // O link de demonstração (?exemplo=1) pode chegar com a aba já montada: a key recomeça a tela.
  return <ConteudoAjuda key={exemplo ?? 'normal'} exemplo={!!exemplo} />;
}

function ConteudoAjuda({ exemplo }: { exemplo: boolean }) {
  const { cores } = useTema();
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [texto, setTexto] = useState(exemplo ? exemploApoio.exemplo : '');
  const [estado, setEstado] = useState<Estado>('vazio');
  const [resposta, setResposta] = useState<RespostaApoio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisado, setAvisado] = useState(false);
  const chamada = passaporteAtual().como_gosta_de_ser_chamada || 'ela';

  useEffect(() => {
    if (exemplo) void pedirAjuda(exemploApoio.exemplo);
    // Só ao abrir pelo link de demonstração.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pedirAjuda(pedido = texto) {
    if (!pedido.trim()) return;
    setEstado('pensando');
    setErro(null);
    setAvisado(false);
    try {
      const r = await api.apoio(pedido.trim());
      setResposta(r);
      if (r.tipo === 'risco') haptic.aviso();
      else haptic.sucesso();
      setEstado('resposta');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não consegui buscar agora. Se for urgente, ligue 192.');
      setEstado('erro');
    }
  }

  async function voz() {
    if (estado === 'gravando') {
      await gravador.stop();
      setEstado('ouvindo');
      try {
        const falado = gravador.uri ? await transcreverPedido(gravador.uri) : '';
        setTexto(falado);
        if (falado) await pedirAjuda(falado);
        else setEstado('vazio');
      } catch {
        setErro('Não consegui ouvir agora. Pode escrever?');
        setEstado('erro');
      }
      return;
    }
    const permissao = await AudioModule.requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      setErro('Sem permissão para o microfone. Você pode escrever.');
      setEstado('erro');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await gravador.prepareToRecordAsync();
    gravador.record();
    haptic.toque();
    setEstado('gravando');
  }

  async function avisar() {
    try {
      await avisarFamilia(texto.trim());
      setAvisado(true);
      haptic.sucesso();
      mostrarToast('A família foi avisada no app.');
      await Share.share({ message: `Aviso sobre a ${chamada}: ${texto.trim()}` });
    } catch {
      mostrarToast('Não consegui avisar pelo app. Mande uma mensagem direto para a família.');
    }
  }

  return (
    <Screen>
      <EmergencyButton onPress={ligarEmergencia} />

      <Section titulo="O que está acontecendo?">
        <TextField
          valor={texto}
          onChange={(t) => {
            setTexto(t);
            if (estado === 'resposta') setEstado('vazio');
          }}
          placeholder={`Por exemplo: ${exemploApoio.exemplo}`}
          rotulo="Descreva a situação"
          onVoz={voz}
        />
        {estado === 'gravando' ? (
          <PrimaryButton titulo="Parar e usar o que eu falei" icone="parar" onPress={voz} />
        ) : (
          <PrimaryButton
            titulo={estado === 'ouvindo' ? 'Ouvindo...' : 'Pedir ajuda'}
            desativado={!texto.trim() || estado === 'pensando' || estado === 'ouvindo'}
            dica={`Procura o que já funcionou com a ${chamada}`}
            onPress={() => pedirAjuda()}
          />
        )}
      </Section>

      {estado === 'vazio' && (
        <EmptyState
          logo
          titulo="Você não está só nisso"
          texto={`Conte o que está acontecendo, falando ou escrevendo. Eu procuro o que já funcionou com a ${chamada} e o que dizem as fontes oficiais.`}
        />
      )}

      {estado === 'pensando' && (
        <Coluna gap="s2">
          <Skeleton linhas={2} />
          <Skeleton linhas={2} />
        </Coluna>
      )}

      {estado === 'erro' && erro && (
        <Text variante="callout" cor="emergency" accessibilityLiveRegion="polite">
          {erro}
        </Text>
      )}

      {estado === 'resposta' && resposta && (
        <Animated.View entering={FadeInDown.springify().damping(18).duration(300)} style={{ gap: espaco.secao }}>
          {resposta.tipo === 'risco' && (
            <Card>
              <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
                <Icon nome="atencao" cor={cores.emergency} />
                <Text variante="headline" style={{ flex: 1 }}>
                  {resposta.aviso}
                </Text>
              </View>
              <EmergencyButton onPress={ligarEmergencia} />
              <SecondaryButton
                titulo={avisado ? 'Família avisada' : 'Avisar a família agora'}
                icone="familia"
                desativado={avisado}
                dica="Aparece no topo do app para todos e abre o WhatsApp para mandar a mensagem"
                onPress={avisar}
              />
            </Card>
          )}

          {resposta.tipo === 'medica' && (
            <Card>
              <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
                <Icon nome="remedio" cor={cores.accentStrong} />
                <Text variante="body" style={{ flex: 1 }}>
                  {resposta.aviso}
                </Text>
              </View>
            </Card>
          )}

          {resposta.sugestoes.length > 0 && (
            <Section titulo={`O que costuma funcionar com a ${resposta.chamada}`}>
              {resposta.sugestoes.map((s) => (
                <Card key={s.titulo}>
                  <Text variante="headline">{s.titulo}</Text>
                  <Text variante="body">{s.texto}</Text>
                  <Text variante="footnote" cor="secondaryLabel">
                    {s.origem}
                  </Text>
                </Card>
              ))}
            </Section>
          )}

          {resposta.acoes.includes('pedir_ajuda_familia') && (
            <Card>
              <Text variante="headline">Você não precisa dar conta de tudo</Text>
              <Text variante="body">Peça para alguém da família assumir uma folga. Leva um toque para eles aceitarem.</Text>
              <SecondaryButton
                titulo="Pedir uma folga à família"
                icone="familia"
                alinhamento="inicio"
                onPress={() => router.push({ pathname: '/nova-tarefa', params: { tipo: 'cobrir_folga' } })}
              />
            </Card>
          )}

          <Section titulo="O que dizem as fontes oficiais">
            {resposta.fontes.map((f) => (
              <Card key={f.id}>
                <Text variante="body">“{f.texto}”</Text>
                <Text variante="footnote" cor="secondaryLabel">
                  {f.fonte}
                </Text>
                <SecondaryButton titulo="Abrir a fonte" icone="link" alinhamento="inicio" dica="Abre o guia oficial na página citada" onPress={() => abrirLink(f.url)} />
              </Card>
            ))}
            <Text variante="footnote" cor="secondaryLabel">
              Organizado a partir do Passaporte, do Diário e de fontes oficiais. Não substitui a equipe de saúde. Se houver risco, ligue 192.
            </Text>
          </Section>
        </Animated.View>
      )}
    </Screen>
  );
}
