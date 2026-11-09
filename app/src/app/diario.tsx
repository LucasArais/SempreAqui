import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AvisoIA, Botao, Cartao, Paragrafo, Subtitulo, Tela, Titulo } from '@/components/ui';
import { diarioExemplo, familia } from '@/dados/mock';
import { cores, espaco, fonte } from '@/tema';

type Etapa = 'pronto' | 'gravando' | 'processando' | 'resultado';

function formatarTempo(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Diario() {
  const [etapa, setEtapa] = useState<Etapa>('pronto');
  const [segundos, setSegundos] = useState(0);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (relogio.current) clearInterval(relogio.current);
  }, []);

  function alternarGravacao() {
    if (etapa === 'pronto') {
      setSegundos(0);
      setEtapa('gravando');
      relogio.current = setInterval(() => setSegundos((s) => s + 1), 1000);
      return;
    }
    if (relogio.current) clearInterval(relogio.current);
    setEtapa('processando');
    // Fase 0: simula a resposta da API. A Fase 1 envia o áudio para POST /diario/relatos.
    setTimeout(() => setEtapa('resultado'), 1800);
  }

  if (etapa === 'processando') {
    return (
      <Tela>
        <View style={estilos.centro}>
          <ActivityIndicator size="large" color={cores.azul} />
          <Titulo>Organizando o seu relato</Titulo>
          <Paragrafo suave>Transcrevendo o áudio e separando sono, comida, humor e remédios.</Paragrafo>
        </View>
      </Tela>
    );
  }

  if (etapa === 'resultado') {
    return (
      <Tela>
        <Titulo>Pronto, {familia.quemCuida.nome}. Obrigado por contar.</Titulo>

        <Cartao cor={cores.verdeClaro}>
          <Subtitulo>O que vai para a família</Subtitulo>
          <Paragrafo>{diarioExemplo.resumoFamilia}</Paragrafo>
        </Cartao>

        <Cartao>
          <Subtitulo>O que ficou registrado</Subtitulo>
          {diarioExemplo.campos.map((c) => (
            <View key={c.rotulo} style={estilos.campo}>
              <Ionicons name={c.icone} size={28} color={cores.verdeEscuro} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.campoRotulo}>{c.rotulo}</Text>
                <Paragrafo>{c.valor}</Paragrafo>
              </View>
            </View>
          ))}
        </Cartao>

        <Cartao>
          <Subtitulo>O que você disse</Subtitulo>
          <Paragrafo suave>{diarioExemplo.transcricao}</Paragrafo>
        </Cartao>

        <AvisoIA texto="A IA organiza o que você contou. Ela não faz avaliação médica. Se algo estiver errado, toque no campo para corrigir." />

        <Botao titulo="Enviar para a família" icone="send" onPress={() => router.back()} />
        <Botao
          titulo="Gravar de novo"
          icone="refresh"
          variante="claro"
          onPress={() => setEtapa('pronto')}
        />
      </Tela>
    );
  }

  const gravando = etapa === 'gravando';
  return (
    <Tela>
      <Titulo>Como foi o dia hoje?</Titulo>
      <Paragrafo>
        Fale do seu jeito, como se estivesse mandando um áudio para alguém da família. Se puder,
        conte do sono, da comida, do humor, dos remédios e do que ajudou.
      </Paragrafo>

      <View style={estilos.centro}>
        <Pressable
          onPress={alternarGravacao}
          accessibilityRole="button"
          accessibilityLabel={gravando ? 'Parar gravação' : 'Começar a gravar'}
          style={({ pressed }) => [
            estilos.microfone,
            { backgroundColor: gravando ? cores.alerta : cores.azul, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name={gravando ? 'stop' : 'mic'} size={72} color={cores.branco} />
        </Pressable>
        <Text style={estilos.estado}>
          {gravando ? `Gravando ${formatarTempo(segundos)}` : 'Toque para gravar'}
        </Text>
        {gravando && <Paragrafo suave>Toque de novo quando terminar.</Paragrafo>}
      </View>

      <AvisoIA texto="Seu áudio fica só com a sua família. Você pode apagar tudo quando quiser." />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', gap: espaco.m, paddingVertical: espaco.xl },
  microfone: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  estado: { fontSize: fonte.subtitulo, fontWeight: '700', color: cores.texto },
  campo: { flexDirection: 'row', gap: espaco.m, alignItems: 'flex-start' },
  campoRotulo: { fontSize: fonte.pequena, fontWeight: '700', color: cores.textoSuave },
});
