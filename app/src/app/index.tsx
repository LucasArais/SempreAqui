import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Cartao, type NomeIcone, Paragrafo, Subtitulo } from '@/components/ui';
import { familia, passaporte } from '@/dados/mock';
import { cores, espaco, fonte, raio, TOQUE_MINIMO } from '@/tema';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

const atalhos: { titulo: string; descricao: string; icone: NomeIcone; rota: Href; cor: string }[] =
  [
    {
      titulo: 'Passaporte de Memória',
      descricao: `Quem é a ${passaporte.comoGostaDeSerChamada}`,
      icone: 'book-outline',
      rota: '/passaporte',
      cor: cores.verdeClaro,
    },
    {
      titulo: 'Conversa de lembranças',
      descricao: 'Sessão de 5 a 10 minutos',
      icone: 'images-outline',
      rota: '/reminiscencia',
      cor: cores.laranjaClaro,
    },
    {
      titulo: 'Resumo da semana',
      descricao: 'Para a família e para a consulta',
      icone: 'calendar-outline',
      rota: '/semana',
      cor: '#E8F0F8',
    },
  ];

export default function Inicio() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.topo}>
          <Image
            source={require('../../assets/icon.png')}
            style={estilos.logo}
            accessibilityLabel="Logo do SempreAqui"
          />
          <View style={{ flex: 1 }}>
            <Text style={estilos.ola}>
              {saudacao()}, {familia.quemCuida.nome}
            </Text>
            <Text style={estilos.subOla}>Você não está cuidando sozinha.</Text>
          </View>
        </View>

        <Botao
          titulo="Contar como foi o dia"
          icone="mic"
          onPress={() => router.push('/diario')}
          dica="Abre a gravação de voz do diário"
        />

        <View style={{ gap: espaco.m }}>
          {atalhos.map((a) => (
            <Pressable
              key={a.titulo}
              onPress={() => router.push(a.rota)}
              accessibilityRole="button"
              accessibilityLabel={`${a.titulo}. ${a.descricao}`}
              style={({ pressed }) => [
                estilos.atalho,
                { backgroundColor: a.cor, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name={a.icone} size={36} color={cores.azulEscuro} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.atalhoTitulo}>{a.titulo}</Text>
                <Text style={estilos.atalhoDescricao}>{a.descricao}</Text>
              </View>
              <Ionicons name="chevron-forward" size={28} color={cores.azulEscuro} />
            </Pressable>
          ))}
        </View>

        <Cartao>
          <Subtitulo>Rede da família</Subtitulo>
          {familia.proximasTarefas.map((t) => (
            <View key={t.titulo} style={estilos.tarefa}>
              <Ionicons name="people-outline" size={26} color={cores.verdeEscuro} />
              <View style={{ flex: 1 }}>
                <Paragrafo>
                  <Text style={{ fontWeight: '700' }}>{t.titulo}</Text>, {t.quando}
                </Paragrafo>
                <Paragrafo suave>{t.responsavel}</Paragrafo>
              </View>
            </View>
          ))}
        </Cartao>

        <Cartao cor={cores.alertaClaro} style={{ borderColor: '#F5C2BD' }}>
          <Subtitulo>Hora difícil?</Subtitulo>
          <Paragrafo>Se houver risco agora, como queda, falta de ar ou engasgo, ligue para o SAMU.</Paragrafo>
          <Botao
            titulo="Ligar 192"
            icone="call"
            variante="alerta"
            onPress={() => Linking.openURL('tel:192')}
          />
        </Cartao>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xl * 2 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, marginTop: espaco.s },
  logo: { width: 72, height: 72, borderRadius: 18 },
  ola: { fontSize: fonte.titulo, fontWeight: '700', color: cores.azulEscuro },
  subOla: { fontSize: fonte.corpo, color: cores.textoSuave, marginTop: 2 },
  atalho: {
    minHeight: TOQUE_MINIMO + 24,
    borderRadius: raio,
    padding: espaco.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
  },
  atalhoTitulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  atalhoDescricao: { fontSize: fonte.pequena, color: cores.textoSuave, marginTop: 2 },
  tarefa: { flexDirection: 'row', gap: espaco.s, alignItems: 'flex-start' },
});
