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
import { quemUsa, tarefas as tarefasIniciais } from '@/data/familia';
import { useConversa } from '@/lib/conversa';
import { fotoDaChave } from '@/lib/passaporte';
import { useSemana } from '@/lib/semana';
import { useSessao } from '@/lib/sessao';
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
  const { semana } = useSemana();
  const roteiro = useConversa().conversa?.roteiro;
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

      {!quemCuida && secaoSemana}

      {quemCuida && secaoSemana}

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

      {roteiro && (
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
    </Screen>
  );
}
