import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import {
  AcoesRapidas,
  AttentionBadge,
  Avatar,
  CartaoExpansivel,
  Card,
  EmptyState,
  Icon,
  LinhaTarefa,
  ListGroup,
  LinkDaSecao,
  ListRow,
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
import { fotoDaChave } from '@/lib/passaporte';
import { formatarData, MENSAGEM_ETAPA } from '@/lib/rotulos';
import { useSemana } from '@/lib/semana';
import { espaco, useTema } from '@/theme';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Hoje: a ação principal no topo (contar o dia), ajuda e 192 a um toque, depois o que há para
 * fazer hoje, o último relato e a semana. Cada seção tem um "Ver" no título em vez de botões
 * soltos.
 */
export default function Hoje() {
  const { cores } = useTema();
  const { tarefas, feed, carregado: familiaCarregada } = useFamilia();
  const { relatos, pendentes, carregado } = useDiario();
  const { semana } = useSemana();
  const { conversa } = useConversa();
  useAtualizarAoFocar();
  useFocusEffect(useCallback(() => atualizarSeMudouODia(), []));

  const avisoRecente = avisoDasUltimas24h(feed);
  // O que é para hoje e o que ainda ninguém assumiu (quem mora longe assume daqui).
  const tarefasHoje = tarefas.filter((t) => !t.concluida && (ehHoje(t.quando) || !t.responsavel_nome)).slice(0, 3);
  const ultimo = relatos[0];
  const roteiro = conversa?.roteiro;
  const feitaHoje = (conversa?.feitas_hoje ?? 0) > 0;
  const reacaoDeHoje = reacoes.find((r) => r.id === conversa?.ultima_reacao);

  const secaoSemana = semana && semana.dias_com_relato > 0 && (
    <Section titulo="Esta semana" acao={<LinkDaSecao titulo="Ver detalhes" onPress={() => router.push('/hoje/semana')} />}>
      <CartaoExpansivel
        meta={`${semana.periodo}, ${semana.dias_com_relato} de 7 dias com relato`}
        texto={semana.resumo}
        resumoFechado={
          semana.mudancas.length
            ? `${semana.mudancas.length} ${semana.mudancas.length === 1 ? 'mudança' : 'mudanças'} em relação ao habitual. Toque para ver`
            : 'Nada diferente do habitual. Toque para ler tudo'
        }
      >
        {semana.mudancas.map((m) => (
          <AttentionBadge key={m.texto} texto={m.texto} />
        ))}
      </CartaoExpansivel>
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

      <View style={{ gap: espaco.s1 + espaco.meio }}>
        <Card style={{ paddingVertical: espaco.s3 }}>
          <RecordButton gravando={false} onPress={() => router.push('/gravar')} apoio="Toque e fale do seu jeito" />
          {pendentes.length > 0 && (
            <Text variante="footnote" cor="secondaryLabel" centro accessibilityLiveRegion="polite">
              {pendentes.length === 1 ? '1 relato esperando internet' : `${pendentes.length} relatos esperando internet`}
            </Text>
          )}
        </Card>
        <AcoesRapidas
          acoes={[
            { titulo: 'Pedir ajuda', icone: 'texto', dica: 'Abre o Ajudante: agitação, recusa, noite difícil', onPress: () => router.push('/ajuda') },
            { titulo: '192', icone: 'telefone', cor: cores.emergency, dica: 'Liga para o SAMU', onPress: () => void ligarEmergencia() },
          ]}
        />
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

      {secaoSemana}

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
    </Screen>
  );
}
