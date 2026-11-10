import AsyncStorage from '@/lib/armazenamento-conta';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Coluna, Icon, ListGroup, ListRow, Logo, Photo, PrimaryButton, SecondaryButton, Text } from '@/components';
import { fotos } from '@/data/familia';
import { api } from '@/lib/api';
import { CHAVE_ONBOARDING } from '@/lib/chaves';
import { entrar } from '@/lib/entrar';
import { sessaoAtual } from '@/lib/sessao';
import { haptic } from '@/lib/haptics';
import { useMargensSeguras } from '@/lib/insets';
import { espaco, raio, tamanho, useTema } from '@/theme';

const PASSOS = 3;

/** Onboarding: no máximo 3 telas, uma ideia por tela, consentimento claro. */
export default function Onboarding() {
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const [passo, setPasso] = useState(0);
  const [aceito, setAceito] = useState(false);

  // A conta já está autenticada quando o onboarding começa.
  async function terminar() {
    await AsyncStorage.setItem(CHAVE_ONBOARDING, new Date().toISOString()).catch(() => undefined);
    // Depois de apagar tudo, a pessoa entra de novo do zero.
    if (!sessaoAtual().familia) await entrar();
    // Consentimento explícito, por finalidade e com a versão do termo (LGPD).
    void api.consentir('1', ['dados_de_saude_diario', 'audio_e_fotos']).catch(() => undefined);
    router.replace('/hoje');
    setTimeout(() => router.push('/gravar'), 400);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.background, paddingTop: topo, paddingBottom: base }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: margem, gap: espaco.s3 }}>
        <View
          style={{ flexDirection: 'row', gap: espaco.s1, justifyContent: 'center', paddingTop: espaco.s1 }}
          accessible
          accessibilityLabel={`Passo ${passo + 1} de ${PASSOS}`}
        >
          {Array.from({ length: PASSOS }, (_, i) => (
            <View
              key={i}
              style={{
                width: i === passo ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === passo ? cores.accentStrong : cores.tertiaryBackground,
              }}
            />
          ))}
        </View>

        <Animated.View key={passo} entering={FadeIn.duration(280)} style={{ flex: 1, justifyContent: 'center', gap: espaco.s3 }}>
          {passo === 0 && (
            <Coluna gap="s2" centro>
              <Photo fonte={fotos.familiaReunida} rotulo="Uma família reunida em volta da avó" proporcao={4 / 3} />
              <Logo tamanho={44} />
              <Text variante="largeTitle" centro accessibilityRole="header">
                Ninguém cuida sozinho
              </Text>
              <Text variante="body" cor="secondaryLabel" centro>
                O SempreAqui junta a família em volta do cuidado de quem vive com Alzheimer. Quem mora
                longe acompanha. Quem está perto divide as tarefas do dia.
              </Text>
            </Coluna>
          )}

          {passo === 1 && (
            <Coluna gap="s2" centro>
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: cores.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon nome="gravar" cor={cores.onAccent} tamanho={48} />
              </View>
              <Text variante="largeTitle" centro accessibilityRole="header">
                Você fala, a gente organiza
              </Text>
              <Text variante="body" cor="secondaryLabel" centro>
                Mande um áudio contando o dia. O app separa sono, comida, humor e remédios, e escreve um
                resumo para a família. Você sempre confere antes de enviar.
              </Text>
            </Coluna>
          )}

          {passo === 2 && (
            <Coluna gap="s2">
              <Text variante="largeTitle" accessibilityRole="header">
                Seus dados são da sua família
              </Text>
              <ListGroup>
                <ListRow icone="cadeado" titulo="Só o grupo da família vê" subtitulo="Ninguém de fora acessa os relatos" />
                <ListRow icone="remedio" titulo="Guardamos relatos de saúde" subtitulo="Sono, alimentação, humor e remédios, para acompanhar o dia a dia" />
                <ListRow icone="mao" titulo="O app não faz diagnóstico" subtitulo="Ele organiza o que vocês contam. Quem interpreta é a equipe de saúde" />
                <ListRow icone="fechar" titulo="Você pode apagar tudo" subtitulo="Ou baixar uma cópia, quando quiser" />
              </ListGroup>
              <Pressable
                onPress={() => {
                  haptic.selecao();
                  setAceito((a) => !a);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: aceito }}
                accessibilityLabel="Concordo em guardar os relatos de saúde para a minha família acompanhar"
                style={{
                  flexDirection: 'row',
                  gap: espaco.s2,
                  alignItems: 'center',
                  minHeight: tamanho.toqueMinimo + 12,
                  padding: espaco.s2,
                  borderRadius: raio.card,
                  backgroundColor: aceito ? cores.accentSoft : cores.secondaryBackground,
                }}
              >
                <Icon nome={aceito ? 'feito' : 'pendente'} cor={aceito ? cores.accentStrong : cores.secondaryLabel} tamanho={26} />
                <Text variante="body" style={{ flex: 1 }}>
                  Concordo em guardar os relatos de saúde para a minha família acompanhar.
                </Text>
              </Pressable>
              <SecondaryButton
                titulo="Ler o termo completo"
                icone="documento"
                alinhamento="inicio"
                onPress={() => router.push('/termo')}
              />
            </Coluna>
          )}
        </Animated.View>

        <Coluna gap="s1">
          <PrimaryButton
            titulo={passo < PASSOS - 1 ? 'Continuar' : 'Gravar o primeiro relato'}
            desativado={passo === PASSOS - 1 && !aceito}
            dica={passo === PASSOS - 1 && !aceito ? 'Marque o consentimento para começar' : undefined}
            onPress={() => (passo < PASSOS - 1 ? setPasso(passo + 1) : terminar())}
          />
          {passo > 0 && <SecondaryButton titulo="Voltar" onPress={() => setPasso(passo - 1)} />}
        </Coluna>
      </ScrollView>
    </View>
  );
}
