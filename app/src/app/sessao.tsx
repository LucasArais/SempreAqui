import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Coluna, Icon, Photo, PrimaryButton, SecondaryButton, Text } from '@/components';
import { pessoa, reacoes, sessao } from '@/data/familia';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { espaco, raio, tamanho, useTema } from '@/theme';

/**
 * Sessão de reminiscência em foco total. É mostrada para a pessoa, então é ainda mais simples:
 * uma foto grande, uma pergunta gentil em letra grande, a música e dois botões.
 */
export default function Sessao() {
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const params = useLocalSearchParams<{ passo?: string }>();
  const [passo, setPasso] = useState(Number(params.passo ?? 0));
  const [tocando, setTocando] = useState(false);
  const [reacao, setReacao] = useState<string | null>(null);
  const terminou = passo >= sessao.passos.length;

  return (
    <View style={{ flex: 1, backgroundColor: cores.background, paddingTop: topo, paddingBottom: base }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: margem, minHeight: tamanho.toqueMinimo }}>
        <Text variante="footnote" cor="secondaryLabel">
          {terminou ? sessao.tema : `${passo + 1} de ${sessao.passos.length}`}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fechar a conversa"
          hitSlop={12}
          style={{ width: tamanho.toqueMinimo, height: tamanho.toqueMinimo, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Icon nome="fechar" cor={cores.secondaryLabel} />
        </Pressable>
      </View>

      {!terminou ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: margem, paddingBottom: espaco.s2, gap: espaco.s3 }}
        >
          <Photo rotulo={sessao.foto.legenda} tom={sessao.foto.tom} icone={sessao.foto.icone} proporcao={1.1} />
          <Animated.View key={passo} entering={FadeIn.duration(300)} style={{ flexGrow: 1, gap: espaco.s2 }}>
            <Text variante="sessaoPergunta">{sessao.passos[passo]}</Text>
          </Animated.View>
          <Coluna gap="s1">
            <SecondaryButton
              titulo={tocando ? 'Pausar a música' : `Tocar ${sessao.musica}`}
              icone={tocando ? 'parar' : 'musica'}
              onPress={() => setTocando((t) => !t)}
            />
            <PrimaryButton
              titulo={passo === sessao.passos.length - 1 ? 'Terminar' : 'Próxima'}
              onPress={() => setPasso((p) => p + 1)}
            />
            <SecondaryButton titulo="Encerrar" onPress={() => setPasso(sessao.passos.length)} />
          </Coluna>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: margem, paddingBottom: espaco.s3, gap: espaco.s3 }}>
          <Coluna gap="s1">
            <Text variante="largeTitle" accessibilityRole="header">
              Como foi?
            </Text>
            <Text variante="sessaoTexto" cor="secondaryLabel">
              Isso ajuda a escolher as próximas conversas com a {pessoa.comoGostaDeSerChamada}.
            </Text>
          </Coluna>
          <View style={{ gap: espaco.s1 + espaco.meio }} accessibilityRole="radiogroup">
            {reacoes.map((r) => {
              const marcado = reacao === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    haptic.selecao();
                    setReacao(r.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={r.rotulo}
                  style={{
                    minHeight: tamanho.botao + 4,
                    borderRadius: raio.botao,
                    borderCurve: 'continuous',
                    backgroundColor: marcado ? cores.accentSoft : cores.secondaryBackground,
                    borderWidth: 2,
                    borderColor: marcado ? cores.accentStrong : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: espaco.s2,
                    paddingHorizontal: espaco.s2,
                  }}
                >
                  <Icon nome={r.icone} cor={marcado ? cores.accentStrong : cores.secondaryLabel} />
                  <Text variante="headline" style={{ flex: 1 }}>
                    {r.rotulo}
                  </Text>
                  {marcado && <Icon nome="feito" cor={cores.accentStrong} />}
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            titulo="Salvar"
            desativado={!reacao}
            onPress={() => {
              haptic.sucesso();
              if (reacao) void api.evento('sessao_concluida', undefined, reacao);
              router.back();
            }}
          />
        </ScrollView>
      )}
    </View>
  );
}
