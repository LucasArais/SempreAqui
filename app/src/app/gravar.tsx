import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Coluna,
  Icon,
  ListGroup,
  ListRow,
  PrimaryButton,
  RecordButton,
  SecondaryButton,
  Skeleton,
  SummaryCard,
  Text,
} from '@/components';
import { diarioDeHoje, pessoa } from '@/data/familia';
import { haptic } from '@/lib/haptics';
import { espaco, useTema } from '@/theme';

type Etapa = 'pronto' | 'gravando' | 'organizando' | 'pronto_para_enviar';

/** Sheet do Diário: gravar o dia, ver o que a IA organizou e enviar para a família. */
export default function Gravar() {
  const { cores, margem } = useTema();
  const params = useLocalSearchParams<{ iniciar?: string; estado?: string }>();
  const [etapa, setEtapa] = useState<Etapa>(
    params.estado === 'resultado' ? 'pronto_para_enviar' : params.iniciar ? 'gravando' : 'pronto',
  );
  const [segundos, setSegundos] = useState(0);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (etapa === 'gravando') {
      relogio.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    }
    return () => {
      if (relogio.current) clearInterval(relogio.current);
    };
  }, [etapa]);

  function alternarGravacao() {
    if (etapa === 'pronto') {
      setSegundos(0);
      setEtapa('gravando');
      return;
    }
    setEtapa('organizando');
    // Fase 0: resposta fictícia. Na Fase 1, o áudio vai para POST /diario/relatos.
    setTimeout(() => {
      haptic.sucesso();
      setEtapa('pronto_para_enviar');
    }, 1600);
  }

  return (
    <ScrollView
      style={{ backgroundColor: cores.background }}
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, gap: espaco.s3 }}
    >
      {(etapa === 'pronto' || etapa === 'gravando') && (
        <Coluna gap="s3">
          <Coluna gap="s1">
            <Text variante="largeTitle" accessibilityRole="header">
              Como foi o dia?
            </Text>
            <Text variante="body" cor="secondaryLabel">
              Fale do seu jeito, como num áudio para alguém da família. Se lembrar, conte do sono, da
              comida, do humor e dos remédios.
            </Text>
          </Coluna>
          <View style={{ paddingVertical: espaco.s3 }}>
            <RecordButton
              gravando={etapa === 'gravando'}
              segundos={segundos}
              onPress={alternarGravacao}
              rotulo="Toque para gravar"
              tamanho={112}
            />
          </View>
          <AvisoPrivacidade />
        </Coluna>
      )}

      {etapa === 'organizando' && (
        <Coluna gap="s2">
          <Text variante="title2" accessibilityRole="header">
            Organizando o que você contou
          </Text>
          <Skeleton linhas={3} />
          <Skeleton linhas={4} comTitulo={false} />
        </Coluna>
      )}

      {etapa === 'pronto_para_enviar' && (
        <Animated.View entering={FadeInDown.springify().damping(18).duration(300)} style={{ gap: espaco.s3 }}>
          <Coluna gap="s1">
            <Text variante="largeTitle" accessibilityRole="header">
              Obrigado por contar
            </Text>
            <Text variante="body" cor="secondaryLabel">
              Confira antes de enviar. Toque em um item para corrigir.
            </Text>
          </Coluna>

          <SummaryCard titulo="O que vai para a família" texto={diarioDeHoje.resumo} original={diarioDeHoje.original} />

          <ListGroup rodape={`Comparado com o habitual da ${pessoa.comoGostaDeSerChamada}. Não é avaliação médica.`}>
            {diarioDeHoje.campos.map((c) => (
              <ListRow
                key={c.rotulo}
                titulo={c.rotulo}
                subtitulo={c.valor}
                icone={c.icone}
                onPress={() => {}}
                dica="Toque para corrigir"
              />
            ))}
          </ListGroup>

          <Coluna gap="s1">
            <PrimaryButton
              titulo="Enviar para a família"
              icone="seguir"
              onPress={() => {
                haptic.sucesso();
                router.back();
              }}
            />
            <SecondaryButton titulo="Gravar de novo" onPress={() => setEtapa('pronto')} />
          </Coluna>
        </Animated.View>
      )}
    </ScrollView>
  );
}

/** Lembrete de privacidade, discreto, no pé da tela de gravação. */
function AvisoPrivacidade() {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center', justifyContent: 'center' }}>
      <Icon nome="cadeado" cor={cores.secondaryLabel} tamanho={14} />
      <Text variante="footnote" cor="secondaryLabel">
        Só a sua família vê. Você pode apagar quando quiser.
      </Text>
    </View>
  );
}
