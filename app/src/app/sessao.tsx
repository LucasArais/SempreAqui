import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Coluna, EmptyState, Icon, Logo, type NomeIcone, Photo, PrimaryButton, SecondaryButton, Skeleton, Text, TextField } from '@/components';
import { reacoes } from '@/data/familia';
import { abrirMusica } from '@/lib/abrir';
import { carregarConversa, outraConversa, registrarConversa, useConversa } from '@/lib/conversa';
import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { fotoDaChave, passaporteAtual } from '@/lib/passaporte';
import { espaco, raio, tamanho, useTema } from '@/theme';

const ICONE_DO_TIPO: Record<string, NomeIcone> = {
  lembranca: 'foto',
  pessoa: 'familia',
  musica: 'musica',
  comida: 'comida',
  gosto: 'calma',
  historia: 'livro',
};

/**
 * Conversa de hoje em foco total. É mostrada para a pessoa, então é ainda mais simples:
 * uma foto ou um tema grande, uma pergunta gentil em letra grande, a música e dois botões.
 * O roteiro muda todo dia; no fim, a reação registrada escolhe as próximas conversas.
 */
export default function Sessao() {
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const params = useLocalSearchParams<{ passo?: string }>();
  const { conversa, carregando } = useConversa();
  const [passo, setPasso] = useState(Number(params.passo ?? 0));
  const [reacao, setReacao] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const roteiro = conversa?.roteiro ?? null;
  const total = roteiro?.perguntas.length ?? 0;
  const terminou = roteiro !== null && passo >= total;
  const chamada = passaporteAtual().como_gosta_de_ser_chamada || 'ela';

  useEffect(() => {
    if (!conversa) void carregarConversa();
  }, [conversa]);

  async function trocar() {
    haptic.selecao();
    await outraConversa();
    setPasso(0);
  }

  async function salvar() {
    if (!roteiro || !reacao) return;
    setSalvando(true);
    await registrarConversa(roteiro, reacao, nota);
    haptic.sucesso();
    router.back();
  }

  const cabecalho = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: margem, minHeight: tamanho.toqueMinimo }}>
      <Text variante="footnote" cor="secondaryLabel">
        {!roteiro ? 'Conversa de hoje' : terminou ? roteiro.tema : `${passo + 1} de ${total}`}
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
  );

  let corpo;
  if (!roteiro && (carregando || !conversa)) {
    corpo = (
      <View style={{ padding: margem }}>
        <Skeleton linhas={5} />
      </View>
    );
  } else if (!roteiro) {
    corpo = (
      <View style={{ padding: margem }}>
        <EmptyState
          logo
          titulo="Ainda não há temas para conversar"
          texto="Conte no Passaporte de Memória algumas lembranças, pessoas, músicas ou comidas. Cada uma vira uma conversa."
        >
          <PrimaryButton
            titulo="Abrir o Passaporte"
            onPress={() => {
              router.back();
              router.push('/memorias');
            }}
          />
        </EmptyState>
      </View>
    );
  } else if (!terminou) {
    const foto = fotoDaChave(roteiro.foto);
    corpo = (
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: margem, paddingBottom: espaco.s2, gap: espaco.s3 }}>
        <View style={{ gap: espaco.s1 }}>
          <Photo rotulo={roteiro.tema} fonte={foto} icone={ICONE_DO_TIPO[roteiro.tipo] ?? 'coracao'} tom={roteiro.conjunto % 5} proporcao={foto ? 4 / 3 : 2} />
          <Text variante="footnote" cor="secondaryLabel">
            {roteiro.tipo_rotulo}: {roteiro.tema}
            {roteiro.personalizada ? '. Perguntas pensadas para ela aqui no celular.' : ''}
          </Text>
        </View>
        <Animated.View key={passo} entering={FadeIn.duration(300)} style={{ flexGrow: 1, gap: espaco.s2 }}>
          <Text variante="sessaoPergunta">{roteiro.perguntas[passo]}</Text>
        </Animated.View>
        <Coluna gap="s1">
          {roteiro.musica && (
            <SecondaryButton
              titulo={`Ouvir "${roteiro.musica.titulo}" no YouTube`}
              icone="musica"
              dica="Abre o YouTube. Depois é só voltar para o SempreAqui e continuar a conversa"
              onPress={() => abrirMusica({ titulo: roteiro.musica!.titulo, artista: roteiro.musica!.artista ?? '', link: roteiro.musica!.link ?? undefined })}
            />
          )}
          <PrimaryButton titulo={passo === total - 1 ? 'Terminar' : 'Próxima'} onPress={() => setPasso((p) => p + 1)} />
          {passo === 0 ? (
            <SecondaryButton
              titulo={carregando ? 'Escolhendo outro tema...' : 'Outro tema hoje'}
              icone="historico"
              dica="Troca o tema desta conversa por outro do Passaporte"
              onPress={trocar}
            />
          ) : (
            <SecondaryButton titulo="Encerrar" onPress={() => setPasso(total)} />
          )}
        </Coluna>
      </ScrollView>
    );
  } else {
    corpo = (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: margem, paddingBottom: espaco.s3, gap: espaco.s3 }}>
        <Coluna gap="s1">
          <Logo tamanho={48} decorativa />
          <Text variante="largeTitle" accessibilityRole="header">
            Como foi?
          </Text>
          <Text variante="sessaoTexto" cor="secondaryLabel">
            Isso ajuda a escolher as próximas conversas com a {chamada}.
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
        <TextField
          valor={nota}
          onChange={setNota}
          rotulo="Quer anotar algo? Opcional"
          placeholder="Quer anotar algo? Por exemplo: sorriu quando falamos do ateliê."
        />
        <PrimaryButton titulo={salvando ? 'Salvando...' : 'Salvar'} desativado={!reacao || salvando} onPress={salvar} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.background, paddingTop: topo, paddingBottom: base }}>
      {cabecalho}
      {corpo}
    </View>
  );
}
