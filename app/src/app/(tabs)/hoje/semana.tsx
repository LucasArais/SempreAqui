import { Share, View } from 'react-native';

import {
  AttentionBadge,
  Card,
  Icon,
  ListGroup,
  ListRow,
  PrimaryButton,
  Screen,
  Section,
  SummaryCard,
  Text,
} from '@/components';
import { pessoa, semana } from '@/data/familia';
import { espaco, useTema } from '@/theme';

const ALTURA = 120;
const MAXIMO = 10;

/** Gráfico de sono simples. Cada barra tem número e dia escritos; a cor nunca é a única pista. */
function GraficoSono() {
  const { cores } = useTema();
  const descricao = semana.sono.map((d) => `${d.dia}, ${d.horas} horas`).join('; ');
  return (
    <View accessible accessibilityLabel={`Horas de sono por noite: ${descricao}. O habitual é ${semana.habitualSono} horas.`}>
      <View style={{ height: ALTURA + 48, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {semana.sono.map((d) => {
          const abaixo = d.horas < semana.habitualSono - 1;
          return (
            <View key={d.dia} style={{ flex: 1, alignItems: 'center', gap: espaco.meio }}>
              {abaixo ? (
                <Icon nome="atencao" cor={cores.attention} tamanho={14} />
              ) : (
                <View style={{ height: 14 }} />
              )}
              <Text variante="footnote" cor="secondaryLabel" maxFontSizeMultiplier={1.3}>
                {String(d.horas).replace('.', ',')}
              </Text>
              <View
                style={{
                  width: 20,
                  height: (d.horas / MAXIMO) * ALTURA,
                  borderRadius: 6,
                  backgroundColor: abaixo ? cores.attention : cores.tertiaryLabel,
                }}
              />
              <Text variante="footnote" maxFontSizeMultiplier={1.3}>
                {d.dia}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function Semana() {
  const lista = semana.paraConsulta.map((p) => `• ${p}`).join('\n');
  return (
    <Screen>
      <SummaryCard meta={semana.periodo} texto={semana.resumo} original={semana.original} />

      <Section titulo="Sono">
        <Card>
          <GraficoSono />
          <Text variante="footnote" cor="secondaryLabel">
            Horas por noite. O habitual da {pessoa.comoGostaDeSerChamada} é cerca de {semana.habitualSono} horas. O triângulo marca as noites abaixo disso.
          </Text>
        </Card>
      </Section>

      <Section titulo="O que mudou">
        {semana.mudancas.map((m) => (
          <AttentionBadge key={m} texto={m} />
        ))}
      </Section>

      <Section titulo="Para levar na consulta">
        <ListGroup rodape="Só fatos registrados pela família. Quem interpreta é a equipe de saúde.">
          {semana.paraConsulta.map((p) => (
            <ListRow key={p} titulo={p} icone="consulta" />
          ))}
        </ListGroup>
      </Section>

      <PrimaryButton
        titulo="Compartilhar a lista"
        icone="compartilhar"
        dica="Abre as opções para enviar a lista da consulta"
        onPress={() =>
          Share.share({ message: `Para levar na consulta da ${pessoa.comoGostaDeSerChamada} (${semana.periodo}):\n${lista}` })
        }
      />
    </Screen>
  );
}
