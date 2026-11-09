import { type AudioSource, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Icon } from './Icon';
import { formatarTempo } from './RecordButton';
import { Text } from './Text';

/** Player simples para ouvir o áudio original: tocar, pausar e ver o tempo. */
export function AudioPlayer({ fonte, rotulo = 'Ouvir o áudio' }: { fonte: AudioSource; rotulo?: string }) {
  const { cores } = useTema();
  const player = useAudioPlayer(fonte);
  const status = useAudioPlayerStatus(player);
  const duracao = status.duration || 0;
  const progresso = duracao ? Math.min(1, status.currentTime / duracao) : 0;

  function alternar() {
    haptic.toque();
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (duracao && status.currentTime >= duracao - 0.2)) {
      void player.seekTo(0);
    }
    player.play();
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s2 }}>
      <Pressable
        onPress={alternar}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pausar o áudio' : rotulo}
        style={({ pressed }) => ({
          width: tamanho.toqueMinimo,
          height: tamanho.toqueMinimo,
          borderRadius: tamanho.toqueMinimo / 2,
          backgroundColor: cores.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon nome={status.playing ? 'pausar' : 'tocar'} cor={cores.accentStrong} tamanho={18} />
      </Pressable>
      <View style={{ flex: 1, gap: espaco.meio }}>
        <View
          style={{ height: 4, borderRadius: raio.chip, backgroundColor: cores.tertiaryBackground, overflow: 'hidden' }}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progresso * 100) }}
        >
          <View style={{ width: `${progresso * 100}%`, height: '100%', backgroundColor: cores.accentStrong }} />
        </View>
        <Text variante="footnote" cor="secondaryLabel">
          {status.isLoaded ? `${formatarTempo(status.currentTime)} de ${formatarTempo(duracao)}` : 'Carregando o áudio...'}
        </Text>
      </View>
    </View>
  );
}
