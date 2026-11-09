import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Coluna,
  EmptyState,
  Icon,
  mostrarToast,
  nivelDoMetering,
  PrimaryButton,
  RecordButton,
  RelatoView,
  SecondaryButton,
  Skeleton,
  Text,
} from '@/components';
import { api, type Relato } from '@/lib/api';
import {
  acompanhar,
  descartarArquivo,
  estadoAtual,
  guardarGravacao,
  sincronizar,
  substituirRelato,
  useDiario,
} from '@/lib/diario';
import { haptic } from '@/lib/haptics';
import { MENSAGEM_ETAPA } from '@/lib/rotulos';
import { espaco, useTema } from '@/theme';

type Fase =
  | 'pronto'
  | 'gravando'
  | 'pausado'
  | 'organizando'
  | 'guardado'
  | 'resultado'
  | 'erro'
  | 'demorando'
  | 'sem_permissao';

const OPCOES = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** Sheet do Diário: gravar, pausar, concluir, acompanhar a IA e conferir o resultado. */
export default function Gravar() {
  const { cores, margem } = useTema();
  const gravador = useAudioRecorder(OPCOES);
  const estadoGravador = useAudioRecorderState(gravador, 120);
  const { online } = useDiario();
  const [fase, setFase] = useState<Fase>('pronto');
  const [relato, setRelato] = useState<Relato | null>(null);
  const [etapa, setEtapa] = useState<string>(MENSAGEM_ETAPA.recebido);
  const idAtual = useRef<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }, []);

  async function comecar() {
    const permissao = await AudioModule.requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      setFase('sem_permissao');
      return;
    }
    await gravador.prepareToRecordAsync();
    gravador.record();
    setFase('gravando');
  }

  function alternarPausa() {
    if (fase === 'gravando') {
      gravador.pause();
      setFase('pausado');
    } else {
      gravador.record();
      setFase('gravando');
    }
  }

  async function concluir() {
    const duracao = estadoGravador.durationMillis / 1000;
    await gravador.stop();
    const uri = gravador.uri;
    if (!uri) {
      setFase('erro');
      return;
    }
    await enviar(uri, duracao);
  }

  async function enviar(uri: string, duracao: number) {
    haptic.sucesso();
    const id = await guardarGravacao(uri, duracao);
    idAtual.current = id;
    setEtapa(MENSAGEM_ETAPA.recebido);
    setFase('organizando');
    await sincronizar();
    // Se o relato ainda está na fila, não houve conexão: fica guardado no celular.
    if (estadoAtual().pendentes.some((p) => p.id === id)) {
      setFase('guardado');
      return;
    }
    await acompanharRelato(id);
  }

  async function acompanharRelato(id: string) {
    const final = await acompanhar(id, (r) => setEtapa(MENSAGEM_ETAPA[r.etapa]));
    if (!final) {
      setFase('demorando');
      return;
    }
    setRelato(final);
    if (final.etapa === 'pronto') {
      haptic.sucesso();
      setFase('resultado');
    } else {
      setFase('erro');
    }
  }

  async function descartar() {
    const duracao = estadoGravador.durationMillis / 1000;
    await gravador.stop();
    const uri = gravador.uri;
    setFase('pronto');
    if (!uri) return;
    // Desfazer em vez de "tem certeza?": o áudio só some se a pessoa não desfizer.
    let desfeito = false;
    mostrarToast('Gravação descartada.', {
      titulo: 'Desfazer',
      onPress: () => {
        desfeito = true;
        void enviar(uri, duracao);
      },
    });
    setTimeout(() => {
      if (!desfeito) descartarArquivo(uri);
    }, 6500);
  }

  async function tentarDeNovo() {
    if (!idAtual.current) return;
    setFase('organizando');
    try {
      substituirRelato(await api.tentarDeNovo(idAtual.current));
      await acompanharRelato(idAtual.current);
    } catch {
      setFase('erro');
    }
  }

  async function enviarParaFamilia() {
    if (!relato) return;
    try {
      substituirRelato(await api.enviarParaFamilia(relato.id));
      haptic.sucesso();
      router.back();
      mostrarToast('Enviado para a família.');
    } catch {
      mostrarToast('Não consegui enviar agora. Tento de novo quando a internet voltar.');
    }
  }

  // Relato corrigido em outra tela: mantém o resultado atualizado.
  const { relatos } = useDiario();
  const relatoAtual = relato ? (relatos.find((r) => r.id === relato.id) ?? relato) : null;
  const segundos = estadoGravador.durationMillis / 1000;

  return (
    <ScrollView
      style={{ backgroundColor: cores.background }}
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.s3 }}
    >
      {(fase === 'pronto' || fase === 'gravando' || fase === 'pausado') && (
        <Coluna gap="s3">
          <Coluna gap="s1">
            <Text variante="largeTitle" accessibilityRole="header">
              Como foi o dia?
            </Text>
            <Text variante="body" cor="secondaryLabel">
              Fale do seu jeito, como num áudio para alguém da família. Se lembrar, conte do sono, da comida,
              do humor e dos remédios.
            </Text>
          </Coluna>
          <View style={{ paddingVertical: espaco.s2 }}>
            <RecordButton
              gravando={fase !== 'pronto'}
              pausado={fase === 'pausado'}
              segundos={segundos}
              nivel={fase === 'gravando' ? nivelDoMetering(estadoGravador.metering) : undefined}
              onPress={fase === 'pronto' ? comecar : alternarPausa}
              rotulo="Toque para gravar"
              tamanho={112}
            />
          </View>
          {fase !== 'pronto' ? (
            <Coluna gap="s1">
              <PrimaryButton titulo="Concluir" icone="feito" onPress={concluir} dica="Termina a gravação e organiza o relato" />
              <SecondaryButton titulo="Descartar" onPress={descartar} dica="Apaga esta gravação. Dá para desfazer logo depois" />
            </Coluna>
          ) : (
            <AvisoPrivacidade online={online} />
          )}
        </Coluna>
      )}

      {fase === 'organizando' && (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: espaco.s2 }}>
          <Text variante="title2" accessibilityRole="header" accessibilityLiveRegion="polite">
            {etapa}
          </Text>
          <Text variante="callout" cor="secondaryLabel">
            Leva alguns segundos. Pode fechar se quiser: o relato aparece no Diário quando ficar pronto.
          </Text>
          <Skeleton linhas={3} />
          <Skeleton linhas={4} comTitulo={false} />
        </Animated.View>
      )}

      {fase === 'guardado' && (
        <EmptyState
          icone="nuvem"
          titulo="Guardado no celular"
          texto="Sem internet agora. Envio sozinho quando a conexão voltar, e o resumo aparece no Diário."
        >
          <PrimaryButton titulo="Ok" onPress={() => router.back()} />
        </EmptyState>
      )}

      {fase === 'demorando' && (
        <EmptyState
          icone="relogio"
          titulo="Está demorando mais que o normal"
          texto="Seu relato está guardado. Pode fechar: ele aparece no Diário quando ficar pronto."
        >
          <PrimaryButton titulo="Fechar" onPress={() => router.back()} />
        </EmptyState>
      )}

      {fase === 'erro' && (
        <EmptyState
          icone="atencao"
          titulo="Não consegui organizar agora"
          texto={relato?.erro ?? 'Seu áudio está guardado. Quer tentar de novo?'}
        >
          <PrimaryButton titulo="Tentar de novo" onPress={tentarDeNovo} />
          <SecondaryButton titulo="Fechar" onPress={() => router.back()} />
        </EmptyState>
      )}

      {fase === 'sem_permissao' && (
        <EmptyState
          icone="gravar"
          titulo="Preciso do microfone"
          texto="Para gravar o dia, permita o microfone nos Ajustes do celular. Leva 10 segundos."
        >
          <PrimaryButton titulo="Abrir os Ajustes" onPress={() => Linking.openSettings()} />
        </EmptyState>
      )}

      {fase === 'resultado' && relatoAtual && (
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: espaco.s3 }}>
          <Coluna gap="s1">
            <Text variante="largeTitle" accessibilityRole="header">
              Obrigado por contar
            </Text>
            <Text variante="body" cor="secondaryLabel">
              Confira antes de enviar. Se algo estiver errado, toque para corrigir.
            </Text>
          </Coluna>
          <RelatoView relato={relatoAtual} />
          <Coluna gap="s1">
            <PrimaryButton titulo="Enviar para a família" icone="seguir" onPress={enviarParaFamilia} />
            <SecondaryButton titulo="Fechar sem enviar" onPress={() => router.back()} />
          </Coluna>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function AvisoPrivacidade({ online }: { online: boolean }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center', justifyContent: 'center' }}>
      <Icon nome={online ? 'cadeado' : 'nuvem'} cor={cores.secondaryLabel} tamanho={14} />
      <Text variante="footnote" cor="secondaryLabel">
        {online ? 'Só a sua família vê. Você pode apagar quando quiser.' : 'Sem internet: dá para gravar, eu envio depois.'}
      </Text>
    </View>
  );
}
