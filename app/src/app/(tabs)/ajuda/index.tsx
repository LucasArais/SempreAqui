import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Card,
  Coluna,
  EmergencyButton,
  EmptyState,
  Icon,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Section,
  Skeleton,
  Text,
} from '@/components';
import { TextField } from '@/components/TextField';
import { apoio, pessoa } from '@/data/familia';
import { abrirLink, ligarEmergencia } from '@/lib/abrir';
import { haptic } from '@/lib/haptics';
import { espaco, useTema } from '@/theme';

type Estado = 'vazio' | 'pensando' | 'resposta';

export default function Ajuda() {
  const { exemplo } = useLocalSearchParams<{ exemplo?: string }>();
  // O link de demonstração (?exemplo=1) pode chegar com a aba já montada: a key recomeça a tela.
  return <ConteudoAjuda key={exemplo ?? 'normal'} exemplo={!!exemplo} />;
}

function ConteudoAjuda({ exemplo }: { exemplo: boolean }) {
  const { cores } = useTema();
  const [texto, setTexto] = useState(exemplo ? apoio.exemplo : '');
  const [estado, setEstado] = useState<Estado>(exemplo ? 'resposta' : 'vazio');

  function pedirAjuda() {
    setEstado('pensando');
    // Fase 0: resposta fictícia. Na semana 2, o agente de Apoio cruza Passaporte, Diário e fontes oficiais.
    setTimeout(() => {
      haptic.sucesso();
      setEstado('resposta');
    }, 1400);
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
          placeholder={`Por exemplo: ${apoio.exemplo}`}
          rotulo="Descreva a situação"
          onVoz={() => setTexto(apoio.exemplo)}
        />
        <PrimaryButton
          titulo="Pedir ajuda"
          desativado={!texto.trim() || estado === 'pensando'}
          dica={`Procura o que já funcionou com a ${pessoa.comoGostaDeSerChamada}`}
          onPress={pedirAjuda}
        />
      </Section>

      {estado === 'vazio' && (
        <EmptyState
          logo
          titulo="Você não está só nisso"
          texto={`Conte o que está acontecendo. Eu procuro o que já funcionou com a ${pessoa.comoGostaDeSerChamada}.`}
        />
      )}

      {estado === 'pensando' && (
        <Coluna gap="s2">
          <Skeleton linhas={2} />
          <Skeleton linhas={2} />
        </Coluna>
      )}

      {estado === 'resposta' && (
        <Animated.View entering={FadeInDown.springify().damping(18).duration(300)} style={{ gap: espaco.secao }}>
          <Section titulo={`O que costuma funcionar com a ${pessoa.comoGostaDeSerChamada}`}>
            {apoio.sugestoes.map((s) => (
              <Card key={s.titulo}>
                <Text variante="headline">{s.titulo}</Text>
                <Text variante="body">{s.texto}</Text>
                <Text variante="footnote" cor="secondaryLabel">
                  {s.origem}
                </Text>
              </Card>
            ))}
          </Section>

          <Section titulo="Orientação geral">
            <Card>
              <Text variante="body">{apoio.orientacaoGeral}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s1 }}>
                <Icon nome="link" cor={cores.accentStrong} tamanho={16} />
                <SecondaryButton
                  titulo={apoio.fonte.titulo}
                  alinhamento="inicio"
                  dica="Abre a fonte oficial no navegador"
                  onPress={() => abrirLink(apoio.fonte.url)}
                />
              </View>
            </Card>
            <Text variante="footnote" cor="secondaryLabel">
              Organizado automaticamente a partir do histórico da família e de fontes oficiais. Não substitui a equipe de saúde.
            </Text>
          </Section>
        </Animated.View>
      )}
    </Screen>
  );
}
