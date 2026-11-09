import { router, Stack } from 'expo-router';
import { useState } from 'react';

import {
  AttentionBadge,
  Card,
  EmptyState,
  Icon,
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
import { quemUsa, semana, sessao, tarefas as tarefasIniciais } from '@/data/familia';
import { atualizarRelatos, useAtualizarAoFocar, useDiario } from '@/lib/diario';
import { haptic } from '@/lib/haptics';
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
  const [tarefas, setTarefas] = useState(tarefasIniciais.filter((t) => t.hoje));
  const { relatos, pendentes, carregado } = useDiario();
  useAtualizarAoFocar();
  const ultimo = relatos[0];

  function alternar(id: string) {
    setTarefas((lista) =>
      lista.map((t) => {
        if (t.id !== id) return t;
        if (!t.feita) haptic.sucesso();
        return { ...t, feita: !t.feita };
      }),
    );
  }

  return (
    <Screen aoAtualizar={atualizarRelatos}>
      <Stack.Screen options={{ title: `${saudacao()}, ${quemUsa.nome}` }} />

      <Card style={{ paddingVertical: espaco.s3 }}>
        <RecordButton gravando={false} onPress={() => router.push('/gravar')} apoio="Toque e fale do seu jeito" />
        {pendentes.length > 0 && (
          <Text variante="footnote" cor="secondaryLabel" centro accessibilityLiveRegion="polite">
            {pendentes.length === 1 ? '1 relato esperando internet' : `${pendentes.length} relatos esperando internet`}
          </Text>
        )}
      </Card>

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
          <SecondaryButton
            titulo={ultimo ? 'Ver o relato e todos os outros' : 'Ver o Diário'}
            alinhamento="inicio"
            onPress={() =>
              ultimo
                ? router.push({ pathname: '/hoje/diario/[id]', params: { id: ultimo.id } })
                : router.push('/hoje/diario')
            }
          />
        )}
      </Section>

      <Section titulo="Esta semana">
        <SummaryCard meta={semana.periodo} texto={semana.resumo} original={semana.original}>
          {semana.mudancas.map((m) => (
            <AttentionBadge key={m} texto={m} />
          ))}
        </SummaryCard>
        <SecondaryButton
          titulo="Ver a semana e a lista da consulta"
          alinhamento="inicio"
          onPress={() => router.push('/hoje/semana')}
        />
      </Section>

      <Section titulo="Família hoje">
        <ListGroup>
          {tarefas.map((t) => (
            <ListRow
              key={t.id}
              titulo={t.titulo}
              subtitulo={`${t.quem}, ${t.quando.toLowerCase()}`}
              riscado={t.feita}
              esquerda={
                <Icon nome={t.feita ? 'feito' : 'pendente'} cor={t.feita ? cores.success : cores.tertiaryLabel} />
              }
              onPress={() => alternar(t.id)}
              navega={false}
              rotuloAcessivel={`${t.titulo}. ${t.quem}. ${t.feita ? 'Concluída' : 'Pendente'}`}
              dica={t.feita ? 'Toque para marcar como pendente' : 'Toque para marcar como feita'}
            />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Uma conversa para hoje">
        <MemoryCard
          legenda={sessao.tema}
          detalhe={`${sessao.duracao}, com foto e música`}
          tom={sessao.foto.tom}
          icone={sessao.foto.icone}
          fonte={sessao.foto.fonte}
          proporcao={16 / 9}
          onPress={() => router.push('/sessao')}
        />
        <SecondaryButton titulo="Começar a conversa" icone="tocar" alinhamento="inicio" onPress={() => router.push('/sessao')} />
        <Text variante="footnote" cor="secondaryLabel">
          Sugerida a partir do Passaporte de Memória
        </Text>
      </Section>
    </Screen>
  );
}
