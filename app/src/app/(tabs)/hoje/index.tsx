import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import {
  AttentionBadge,
  Card,
  EmptyState,
  EmergencyButton,
  Icon,
  LinhaTarefa,
  ListGroup,
  ListRow,
  MemoryCard,
  RecordButton,
  Screen,
  SecondaryButton,
  Section,
  SummaryCard,
  Text,
} from '@/components';
import { reacoes } from '@/data/familia';
import { avisoDasUltimas24h, ehHoje, meuNome, useFamilia } from '@/lib/familia';
import { atualizarSeMudouODia, useConversa } from '@/lib/conversa';
import { fotoDaChave } from '@/lib/passaporte';
import { ligarEmergencia } from '@/lib/abrir';
import { useSemana } from '@/lib/semana';
import { useSessao } from '@/lib/sessao';
import { atualizarRelatos, useAtualizarAoFocar, useDiario } from '@/lib/diario';
import { formatarData, MENSAGEM_ETAPA } from '@/lib/rotulos';
import { espaco, useTema } from '@/theme';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Hoje() {
  const { cores } = useTema();
  const { tarefas, feed, carregado: familiaCarregada } = useFamilia();
  // Hoje: o que é para hoje e o que ainda ninguém assumiu (quem mora longe assume daqui).
  const tarefasHoje = tarefas.filter((t) => !t.concluida && (ehHoje(t.quando) || !t.responsavel_nome)).slice(0, 4);
  const avisoRecente = avisoDasUltimas24h(feed);
  const { relatos, pendentes, carregado } = useDiario();
  useAtualizarAoFocar();
  const ultimo = relatos[0];
  const { semana } = useSemana();
  const { conversa } = useConversa();
  const roteiro = conversa?.roteiro;
  const feitaHoje = (conversa?.feitas_hoje ?? 0) > 0;
  const reacaoDeHoje = reacoes.find((r) => r.id === conversa?.ultima_reacao);
  useFocusEffect(useCallback(() => atualizarSeMudouODia(), []));
  // Quem mora longe (Rafael) quer saber como a mãe está: a semana vem primeiro.
  const quemCuida = (useSessao().papel ?? 'quem_cuida') === 'quem_cuida';

  const secaoSemana = semana && semana.dias_com_relato > 0 && (
    <Section titulo="Esta semana">
      <SummaryCard meta={`${semana.periodo}, ${semana.dias_com_relato} de 7 dias com relato`} texto={semana.resumo}>
        {semana.mudancas.slice(0, 2).map((m) => (
          <AttentionBadge key={m.texto} texto={m.texto} />
        ))}
      </SummaryCard>
      <SecondaryButton
        titulo="Ver a semana e a lista da consulta"
        alinhamento="inicio"
        onPress={() => router.push('/hoje/semana')}
      />
    </Section>
  );

  return (
    <Screen aoAtualizar={atualizarRelatos}>
      <Stack.Screen options={{ title: meuNome() ? `${saudacao()}, ${meuNome()}` : saudacao() }} />

      {avisoRecente && (
        <Card>
          <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
            <Icon nome="atencao" cor={cores.emergency} />
            <Text variante="headline" style={{ flex: 1 }}>
              Aviso de {avisoRecente.autor}: {avisoRecente.texto}
            </Text>
          </View>
        </Card>
      )}


      {!quemCuida && secaoSemana}

      {familiaCarregada && !meuNome() && (
        <ListGroup>
          <ListRow titulo="Como a família te chama?" subtitulo="Diga seu nome uma vez e pronto" icone="familia" corIcone="accentStrong" onPress={() => router.push('/eu')} />
        </ListGroup>
      )}

      <Card style={{ paddingVertical: espaco.s3 }}>
        <RecordButton gravando={false} onPress={() => router.push('/gravar')} apoio="Toque e fale do seu jeito" />
        {pendentes.length > 0 && (
          <Text variante="footnote" cor="secondaryLabel" centro accessibilityLiveRegion="polite">
            {pendentes.length === 1 ? '1 relato esperando internet' : `${pendentes.length} relatos esperando internet`}
          </Text>
        )}
      </Card>

      <ListGroup>
        <ListRow
          titulo="Precisa de ajuda agora?"
          subtitulo="Pergunte ao Ajudante: agitação, recusa, noite difícil"
          icone="ajuda"
          corIcone="accentStrong"
          onPress={() => router.push('/ajuda')}
        />
      </ListGroup>
      <EmergencyButton onPress={ligarEmergencia} />

      {roteiro && feitaHoje && (
        <Section titulo="Uma conversa para hoje">
          <Card>
            <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }}>
              <Icon nome="feito" cor={cores.success} />
              <Text variante="headline" style={{ flex: 1 }}>
                Conversa de hoje feita
              </Text>
            </View>
            <Text variante="callout" cor="secondaryLabel">
              {reacaoDeHoje ? `${reacaoDeHoje.rotulo}. ` : ''}Amanhã tem uma conversa nova, com outro tema.
            </Text>
          </Card>
        </Section>
      )}

      {roteiro && !feitaHoje && (
        <Section titulo="Uma conversa para hoje">
          <MemoryCard
            legenda={roteiro.tema}
            detalhe={`${roteiro.tipo_rotulo}. De 5 a 10 minutos${roteiro.musica ? ', com música' : ''}`}
            tom={roteiro.conjunto % 5}
            icone={roteiro.foto ? 'foto' : 'coracao'}
            fonte={fotoDaChave(roteiro.foto)}
            proporcao={16 / 9}
            onPress={() => router.push('/sessao')}
          />
          <SecondaryButton titulo="Começar a conversa" icone="tocar" alinhamento="inicio" onPress={() => router.push('/sessao')} />
          <Text variante="footnote" cor="secondaryLabel">
            Muda todo dia, a partir do Passaporte de Memória
          </Text>
        </Section>
      )}
      {tarefasHoje.length > 0 && (
        <Section titulo="Família hoje">
          <ListGroup>
            {tarefasHoje.map((t) => (
              <LinhaTarefa key={t.id} tarefa={t} />
            ))}
            <ListRow titulo="Ver todas as tarefas" icone="familia" onPress={() => router.push('/familia')} />
          </ListGroup>
        </Section>
      )}

      <Section titulo="Último relato">
        {ultimo?.etapa === 'pronto' && ultimo.resumo ? (
          <SummaryCard meta={formatarData(ultimo.gravado_em)} texto={ultimo.resumo} original={ultimo.transcricao ?? undefined}>
            {ultimo.alertas.length > 0 && <AttentionBadge texto="Este relato fala de uma situação de risco" />}
          </SummaryCard>
        ) : ultimo ? (
          <Card>
            <Text variante="headline">{formatarData(ultimo.gravado_em)}</Text>
            <Text variante="callout" cor="secondaryLabel">
              {MENSAGEM_ETAPA[ultimo.etapa]}
            </Text>
          </Card>
        ) : carregado ? (
          <Card>
            <EmptyState
              logo
              titulo="Seu primeiro relato aparece aqui"
              texto="Toque no microfone e conte como foi o dia. Em segundos a família recebe um resumo."
            />
          </Card>
        ) : null}
        {(relatos.length > 0 || pendentes.length > 0) && (
          <ListGroup>
            {ultimo && (
              <ListRow titulo="Ver este relato" icone="texto" onPress={() => router.push({ pathname: '/hoje/diario/[id]', params: { id: ultimo.id } })} />
            )}
            <ListRow titulo="Ver todos os relatos" icone="historico" onPress={() => router.push('/hoje/diario')} />
          </ListGroup>
        )}
      </Section>

      {quemCuida && secaoSemana}


    </Screen>
  );
}
