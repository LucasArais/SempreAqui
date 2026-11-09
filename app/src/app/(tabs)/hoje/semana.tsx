import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AttentionBadge,
  Card,
  EmptyState,
  Icon,
  ListGroup,
  ListRow,
  mostrarToast,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Section,
  Skeleton,
  Text,
} from '@/components';
import { pessoa } from '@/data/familia';
import { api, cabecalhos } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { type Semana, useSemana } from '@/lib/semana';
import { espaco, useTema } from '@/theme';

const ALTURA = 120;
const MAXIMO = 10;

/** Sono dia a dia. Número, dia e ícone escritos: a cor nunca é a única pista. */
function GraficoSono({ semana }: { semana: Semana }) {
  const { cores } = useTema();
  const habitual = semana.habitual_sono_horas;
  const descricao = semana.dias
    .map((d) => (d.tem_relato ? `${d.dia}, ${d.sono_horas ?? 'sem horário'} horas` : `${d.dia}, sem relato`))
    .join('; ');
  return (
    <View accessible accessibilityLabel={`Sono por noite: ${descricao}.${habitual ? ` O habitual é ${habitual} horas.` : ''}`}>
      <View style={{ height: ALTURA + 48, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {semana.dias.map((d) => {
          const ruim = d.sono_qualidade === 'ruim';
          const horas = d.sono_horas ?? 0;
          return (
            <View key={d.data} style={{ flex: 1, alignItems: 'center', gap: espaco.meio }}>
              {ruim ? <Icon nome="atencao" cor={cores.attention} tamanho={14} /> : <View style={{ height: 14 }} />}
              <Text variante="footnote" cor="secondaryLabel" maxFontSizeMultiplier={1.3}>
                {d.tem_relato ? (d.sono_horas ? String(d.sono_horas).replace('.', ',') : '?') : '-'}
              </Text>
              <View
                style={{
                  width: 20,
                  height: d.tem_relato ? Math.max(8, (horas / MAXIMO) * ALTURA) : 8,
                  borderRadius: 6,
                  backgroundColor: d.tem_relato ? (ruim ? cores.attention : cores.tertiaryLabel) : 'transparent',
                  borderWidth: d.tem_relato ? 0 : 1,
                  borderStyle: 'dashed',
                  borderColor: cores.tertiaryLabel,
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

export default function SemanaTela() {
  const { semana, erro, carregar } = useSemana();
  const [gerando, setGerando] = useState(false);

  async function salvarPdf() {
    setGerando(true);
    try {
      const destino = new File(Paths.cache, 'para-levar-na-consulta.pdf');
      if (destino.exists) destino.delete();
      const arquivo = await File.downloadFileAsync(api.urlConsultaPdf(pessoa.comoGostaDeSerChamada), destino, {
        headers: cabecalhos(),
      });
      haptic.sucesso();
      await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/pdf', dialogTitle: 'Para levar na consulta' });
    } catch {
      mostrarToast('Não consegui gerar o PDF agora. Tente de novo em instantes.');
    } finally {
      setGerando(false);
    }
  }

  if (!semana) {
    return (
      <Screen aoAtualizar={carregar}>
        {erro ? <EmptyState icone="nuvem" titulo={erro} texto="Puxe a tela para baixo para tentar de novo." /> : <Skeleton linhas={4} />}
      </Screen>
    );
  }

  if (!semana.dias_com_relato) {
    return (
      <Screen aoAtualizar={carregar}>
        <EmptyState
          logo
          titulo="A semana aparece aqui"
          texto="Com alguns relatos, a família vê como foi a semana e o que mudou em relação ao habitual."
        >
          <PrimaryButton titulo="Contar como foi o dia" icone="gravar" onPress={() => router.push('/gravar')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen aoAtualizar={carregar}>
      <Card>
        <Text variante="footnote" cor="secondaryLabel">
          {semana.periodo}, {semana.dias_com_relato} de 7 dias com relato
        </Text>
        <Text variante="body">{semana.resumo}</Text>
        <Text variante="footnote" cor="secondaryLabel">
          Organizado automaticamente a partir dos relatos da família
        </Text>
      </Card>

      <Section titulo="O que mudou">
        {semana.mudancas.length ? (
          semana.mudancas.map((m) => <AttentionBadge key={m.texto} texto={m.texto} />)
        ) : (
          <Text variante="body" cor="secondaryLabel">
            Nada diferente do habitual nesta semana.
          </Text>
        )}
        {semana.linha_de_base_dias < 5 && (
          <Text variante="footnote" cor="secondaryLabel">
            Com mais algumas semanas de relatos, o app passa a comparar com o habitual dela.
          </Text>
        )}
      </Section>

      <Section titulo="Sono">
        <Card>
          <GraficoSono semana={semana} />
          <Text variante="footnote" cor="secondaryLabel">
            Horas por noite.{semana.habitual_sono_horas ? ` O habitual dela é cerca de ${String(semana.habitual_sono_horas).replace('.', ',')} horas.` : ''} O triângulo marca as noites ruins. Tracejado: dia sem relato.
          </Text>
        </Card>
      </Section>

      <Section titulo="Para levar na consulta">
        <ListGroup rodape="Só fatos registrados pela família. Quem interpreta é a equipe de saúde.">
          {semana.para_consulta.map((p) => (
            <ListRow key={p} titulo={p} icone="consulta" />
          ))}
        </ListGroup>
      </Section>

      <PrimaryButton
        titulo={gerando ? 'Gerando o PDF...' : 'Salvar PDF para a consulta'}
        icone="documento"
        desativado={gerando}
        dica="Gera uma página para imprimir ou enviar à equipe de saúde"
        onPress={salvarPdf}
      />
      <SecondaryButton titulo="Ver os relatos da semana" onPress={() => router.push('/hoje/diario')} />
    </Screen>
  );
}
