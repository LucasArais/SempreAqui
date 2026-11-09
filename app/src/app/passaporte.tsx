import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  AvisoIA,
  Botao,
  Cartao,
  LinhaIcone,
  type NomeIcone,
  Paragrafo,
  Subtitulo,
  Tela,
  Titulo,
} from '@/components/ui';
import { passaporte as p } from '@/dados/mock';
import { cores, espaco, fonte } from '@/tema';

function Secao({ titulo, itens, icone }: { titulo: string; itens: string[]; icone: NomeIcone }) {
  return (
    <Cartao>
      <Subtitulo>{titulo}</Subtitulo>
      {itens.map((item) => (
        <LinhaIcone key={item} icone={icone} texto={item} />
      ))}
    </Cartao>
  );
}

export default function Passaporte() {
  return (
    <Tela>
      <View style={estilos.cabecalho}>
        <View style={estilos.avatar} accessibilityLabel={`Foto de ${p.comoGostaDeSerChamada}`}>
          <Text style={estilos.avatarTexto}>C</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Titulo>{p.comoGostaDeSerChamada}</Titulo>
          <Paragrafo suave>
            {p.nome}, {p.idade} anos
          </Paragrafo>
        </View>
      </View>

      <Cartao cor={cores.verdeClaro}>
        <Subtitulo>Como gosta de ser chamada</Subtitulo>
        <Paragrafo>{p.comoGostaDeSerChamada}</Paragrafo>
        <Subtitulo>Como se comunica</Subtitulo>
        <Paragrafo>{p.comoSeComunica}</Paragrafo>
      </Cartao>

      <Cartao>
        <Subtitulo>História de vida</Subtitulo>
        <Paragrafo>{p.historia}</Paragrafo>
      </Cartao>

      <Cartao>
        <Subtitulo>Pessoas importantes</Subtitulo>
        {p.pessoasImportantes.map((pessoa) => (
          <View key={pessoa.nome} style={estilos.pessoa}>
            <View style={estilos.avatarPequeno}>
              <Text style={estilos.avatarPequenoTexto}>{pessoa.inicial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={estilos.pessoaNome}>{pessoa.nome}</Text>
              <Paragrafo suave>{pessoa.relacao}</Paragrafo>
            </View>
          </View>
        ))}
      </Cartao>

      <Secao titulo="O que acalma" itens={p.oQueAcalma} icone="leaf-outline" />
      <Secao titulo="O que agita" itens={p.oQueAgita} icone="alert-circle-outline" />
      <Secao titulo="Rotina" itens={p.rotina} icone="time-outline" />
      <Secao titulo="Músicas favoritas" itens={p.musicas} icone="musical-notes-outline" />
      <Secao titulo="Comidas favoritas" itens={p.comidas} icone="restaurant-outline" />

      <AvisoIA
        texto={`Montado pela IA a partir de 6 áudios, 12 fotos e 3 textos enviados pela família. Atualizado em ${p.atualizadoEm}. Toda a família pode corrigir.`}
      />

      <Botao
        titulo="Compartilhar link"
        icone="share-social-outline"
        onPress={() =>
          Alert.alert(
            'Link somente leitura',
            'Na versão final, gera um link para cuidadores, centro-dia ou hospital verem o Passaporte, sem poder editar.',
          )
        }
      />
      <Botao
        titulo="Gerar PDF de uma página"
        icone="document-text-outline"
        variante="claro"
        onPress={() =>
          Alert.alert('PDF', 'Na versão final, gera um PDF de uma página para levar na bolsa.')
        }
      />
      <Botao
        titulo="Adicionar áudio, foto ou texto"
        icone="add-circle-outline"
        variante="secundario"
        onPress={() =>
          Alert.alert('Em breve', 'A família vai poder contar histórias por voz e enviar fotos.')
        }
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: cores.laranjaClaro,
    borderWidth: 3,
    borderColor: cores.laranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: fonte.enorme, fontWeight: '700', color: cores.laranjaTexto },
  pessoa: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  avatarPequeno: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.verdeClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPequenoTexto: { fontSize: fonte.subtitulo, fontWeight: '700', color: cores.verdeEscuro },
  pessoaNome: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
});
