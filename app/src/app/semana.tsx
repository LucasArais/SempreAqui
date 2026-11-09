import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  AvisoIA,
  Botao,
  Cartao,
  LinhaIcone,
  Paragrafo,
  Subtitulo,
  Tela,
  Titulo,
} from '@/components/ui';
import { semana } from '@/dados/mock';
import { cores, espaco, fonte } from '@/tema';

const ALTURA_MAXIMA = 140;
const HORAS_MAXIMAS = 10;
// altura do rótulo do dia (24) + espaço entre barra e rótulo (4)
const ALTURA_ROTULO_DIA = 28;

function GraficoSono() {
  const descricao = semana.sonoHoras.map((d) => `${d.dia} ${d.horas} horas`).join(', ');
  const alturaBase = (semana.linhaDeBaseSono / HORAS_MAXIMAS) * ALTURA_MAXIMA;
  return (
    <View accessible accessibilityLabel={`Horas de sono na semana: ${descricao}`}>
      <View style={estilos.grafico}>
        <View style={[estilos.linhaBase, { bottom: alturaBase + ALTURA_ROTULO_DIA }]} />
        {semana.sonoHoras.map((d) => {
          const abaixo = d.horas < semana.linhaDeBaseSono - 1;
          return (
            <View key={d.dia} style={estilos.coluna}>
              <Text style={estilos.valor}>{d.horas}</Text>
              <View
                style={[
                  estilos.barra,
                  {
                    height: (d.horas / HORAS_MAXIMAS) * ALTURA_MAXIMA,
                    backgroundColor: abaixo ? cores.laranja : cores.verde,
                  },
                ]}
              />
              <Text style={estilos.dia}>{d.dia}</Text>
            </View>
          );
        })}
      </View>
      <Paragrafo suave>
        Linha tracejada: o habitual dela, cerca de {semana.linhaDeBaseSono} horas. Em laranja, noites
        abaixo do habitual.
      </Paragrafo>
    </View>
  );
}

export default function Semana() {
  return (
    <Tela>
      <Paragrafo suave>{semana.periodo}</Paragrafo>
      <Titulo>Como foi a semana</Titulo>

      <Cartao cor={cores.verdeClaro}>
        <Paragrafo>{semana.resumo}</Paragrafo>
      </Cartao>

      <Cartao>
        <Subtitulo>Sono</Subtitulo>
        <GraficoSono />
      </Cartao>

      <Cartao>
        <Subtitulo>O que mudou em relação ao habitual</Subtitulo>
        {semana.mudancas.map((m) => (
          <LinhaIcone key={m} icone="swap-vertical-outline" texto={m} />
        ))}
      </Cartao>

      <Cartao cor={cores.laranjaClaro}>
        <Subtitulo>Para levar na consulta</Subtitulo>
        {semana.paraConsulta.map((m) => (
          <LinhaIcone key={m} icone="clipboard-outline" texto={m} />
        ))}
      </Cartao>

      <AvisoIA texto="Este resumo organiza o que a família registrou no Diário e compara com o habitual da própria Dona Cida. Não é avaliação médica. Quem interpreta é a equipe de saúde." />

      <Botao
        titulo="Compartilhar com a família"
        icone="share-social-outline"
        onPress={() => Alert.alert('Enviado', 'O resumo foi para o feed da família.')}
      />
      <Botao
        titulo="Salvar lista da consulta"
        icone="download-outline"
        variante="claro"
        onPress={() => Alert.alert('Em breve', 'Na versão final, gera um PDF para levar na consulta.')}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  grafico: {
    height: ALTURA_MAXIMA + 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: espaco.s,
  },
  linhaBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: cores.textoSuave,
  },
  coluna: { alignItems: 'center', flex: 1, gap: 4 },
  barra: { width: 26, borderRadius: 8 },
  valor: { fontSize: 16, color: cores.textoSuave, fontWeight: '600' },
  dia: { fontSize: 16, color: cores.texto, fontWeight: '700', height: 24 },
});
