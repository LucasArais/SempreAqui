import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import {
  AttentionBadge,
  Avatar,
  Card,
  EmptyState,
  Icon,
  LinhaTarefa,
  ListGroup,
  ListRow,
  type NomeIcone,
  RecordButton,
  Screen,
  Section,
  SummaryCard,
  Text,
} from '@/components';
import { reacoes } from '@/data/familia';
import { ligarEmergencia } from '@/lib/abrir';
import { atualizarSeMudouODia, useConversa } from '@/lib/conversa';
import { atualizarRelatos, useAtualizarAoFocar, useDiario } from '@/lib/diario';
import { avisoDasUltimas24h, ehHoje, meuNome, useFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { fotoDaChave } from '@/lib/passaporte';
import { formatarData, MENSAGEM_ETAPA } from '@/lib/rotulos';
import { useSemana } from '@/lib/semana';
import { useSessao } from '@/lib/sessao';
import { espaco, raio, tamanho, useTema } from '@/theme';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Link discreto no título de uma seção ("Ver todos"), no padrão dos apps da Apple. */
function LinkDaSecao({ titulo, onPress }: { titulo: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={10}>
      <Text variante="callout" style={{ color: cores.accentStrong }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/** Ação rápida em pílula: duas lado a lado, sem ocupar a tela. */
function AcaoRapida({ titulo, icone, cor, onPress, dica }: { titulo: string; icone: NomeIcone; cor: string; onPress: () => void; dica: string }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={() => {
        haptic.toque();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tamanho.botao,
        borderRadius: raio.botao,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: cor,
        backgroundColor: pressed ? cores.secondaryBackground : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: espaco.s1,
        paddingHorizontal: espaco.s1,
      })}
    >
      <Icon nome={icone} cor={cor} tamanho={20} />
      <Text variante="headline" style={{ color: cor }} numberOfLines={1}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/**
 * Hoje: a ação principal no topo (contar o dia), ajuda e 192 a um toque, depois o que há para
 * fazer hoje, o último relato e a semana. Cada seção tem um "Ver" no título em vez de botões
 * soltos. Para quem mora longe, a semana vem primeiro.
 */
export default function Hoje() {
  const { cores } = useTema();
  const { tarefas, feed, carregado: familiaCarregada } = useFamilia();
  const { relatos, pendentes, carregado } = useDiario();
  const { semana } = useSemana();
  const { conversa } = useConversa();
  useAtualizarAoFocar();
  useFocusEffect(useCallback(() => atualizarSeMudouODia(), []));

  const quemCuida = (useSessao().papel ?? 'quem_cuida') === 'quem_cuida';
  const avisoRecente = avisoDasUltimas24h(feed);
  // O que é para hoje e o que ainda ninguém assumiu (quem mora longe assume daqui).
  const tarefasHoje = tarefas.filter((t) => !t.concluida && (ehHoje(t.quando) || !t.responsavel_nome)).slice(0, 3);
  const ultimo = relatos[0];
  const roteiro = conversa?.roteiro;
  const feitaHoje = (conversa?.feitas_hoje ?? 0) > 0;
  const reacaoDeHoje = reacoes.find((r) => r.id === conversa?.ultima_reacao);

  const secaoSemana = semana && semana.dias_com_relato > 0 && (
    <Section titulo="Esta semana" acao={<LinkDaSecao titulo="Ver detalhes" onPress={() => router.push('/hoje/semana')} />}>
      <Pressable onPress={() => router.push('/hoje/semana')} accessibilityRole="button" accessibilityHint="Abre a semana e a lista para a consulta">
        <SummaryCard meta={`${semana.periodo}, ${semana.dias_com_relato} de 7 dias com relato`} texto={semana.resumo}>
          {semana.mudancas.slice(0, 2).map((m) => (
            <AttentionBadge key={m.texto} texto={m.texto} />
          ))}
        </SummaryCard>
      </Pressable>
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

      {familiaCarregada && !meuNome() && (
        <ListGroup>
          <ListRow titulo="Como a família te chama?" subtitulo="Diga seu nome uma vez e pronto" icone="familia" corIcone="accentStrong" onPress={() => router.push('/eu')} />
        </ListGroup>
      )}

      {!quemCuida && secaoSemana}

      <View style={{ gap: espaco.s1 + espaco.meio }}>
        <Card style={{ paddingVertical: espaco.s3 }}>
          <RecordButton gravando={false} onPress={() => router.push('/gravar')} apoio="Toque e fale do seu jeito" />
          {pendentes.length > 0 && (
            <Text variante="footnote" cor="secondaryLabel" centro accessibilityLiveRegion="polite">
              {pendentes.length === 1 ? '1 relato esperando internet' : `${pendentes.length} relatos esperando internet`}
            </Text>
          )}
        </Card>
        <View style={{ flexDirection: 'row', gap: espaco.s1 + espaco.meio }}>
          <AcaoRapida titulo="Pedir ajuda" icone="texto" cor={cores.accentStrong} dica="Abre o Ajudante: agitação, recusa, noite difícil" onPress={() => router.push('/ajuda')} />
          <AcaoRapida titulo="192" icone="telefone" cor={cores.emergency} dica="Liga para o SAMU" onPress={() => void ligarEmergencia()} />
        </View>
      </View>

      {(roteiro || tarefasHoje.length > 0) && (
        <Section titulo="Para hoje" acao={<LinkDaSecao titulo="Ver tudo" onPress={() => router.push('/familia')} />}>
          <ListGroup comAvatar>
            {roteiro &&
              (feitaHoje ? (
                <ListRow
                  titulo="Conversa de hoje feita"
                  subtitulo={`${reacaoDeHoje ? `${reacaoDeHoje.rotulo}. ` : ''}Amanhã tem outra, com outro tema`}
                  esquerda={<Icon nome="feito" cor={cores.success} />}
                  navega={false}
                />
              ) : (
                <ListRow
                  titulo={`Conversa: ${roteiro.tema}`}
                  subtitulo={`De 5 a 10 minutos${roteiro.musica ? ', com música' : ''}. Muda todo dia`}
                  esquerda={<Avatar nome={roteiro.tema} tom={roteiro.conjunto % 5} fonte={fotoDaChave(roteiro.foto)} />}
                  dica="Abre a conversa em tela cheia"
                  onPress={() => router.push('/sessao')}
                />
              ))}
            {tarefasHoje.map((t) => (
              <LinhaTarefa key={t.id} tarefa={t} />
            ))}
          </ListGroup>
        </Section>
      )}

      <Section
        titulo="Último relato"
        acao={relatos.length > 0 ? <LinkDaSecao titulo="Ver todos" onPress={() => router.push('/hoje/diario')} /> : undefined}
      >
        {ultimo?.etapa === 'pronto' && ultimo.resumo ? (
          <Pressable
            onPress={() => router.push({ pathname: '/hoje/diario/[id]', params: { id: ultimo.id } })}
            accessibilityRole="button"
            accessibilityHint="Abre o relato completo, com o áudio e a transcrição"
          >
            <SummaryCard meta={formatarData(ultimo.gravado_em)} texto={ultimo.resumo}>
              {ultimo.alertas.length > 0 && <AttentionBadge texto="Este relato fala de uma situação de risco" />}
            </SummaryCard>
          </Pressable>
        ) : ultimo ? (
          <Pressable onPress={() => router.push({ pathname: '/hoje/diario/[id]', params: { id: ultimo.id } })} accessibilityRole="button">
            <Card>
              <Text variante="headline">{formatarData(ultimo.gravado_em)}</Text>
              <Text variante="callout" cor="secondaryLabel">
                {MENSAGEM_ETAPA[ultimo.etapa]}
              </Text>
            </Card>
          </Pressable>
        ) : carregado ? (
          <Card>
            <EmptyState logo titulo="Seu primeiro relato aparece aqui" texto="Toque no microfone e conte como foi o dia. Em segundos a família recebe um resumo." />
          </Card>
        ) : null}
      </Section>

      {quemCuida && secaoSemana}
    </Screen>
  );
}
