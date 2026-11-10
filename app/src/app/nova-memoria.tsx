import { router } from 'expo-router';
import { View } from 'react-native';

import { ListGroup, ListRow, Text } from '@/components';
import { passaporteAtual } from '@/lib/passaporte';
import { espaco, useTema } from '@/theme';

/** Sheet rápida para adicionar uma memória ao Passaporte: falar, escrever ou uma foto. */
export default function NovaMemoria() {
  const { margem } = useTema();
  const chamada = passaporteAtual().como_gosta_de_ser_chamada || 'ela';
  const ir = (rota: Parameters<typeof router.replace>[0]) => () => router.replace(rota);
  return (
    <View style={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, gap: espaco.s2 }}>
      <Text variante="title2" accessibilityRole="header">
        Nova memória
      </Text>
      <Text variante="callout" cor="secondaryLabel">
        Conte algo sobre a {chamada}. A IA organiza no Passaporte e você confere antes.
      </Text>
      <ListGroup>
        <ListRow
          titulo="Contar falando"
          subtitulo="Grave um áudio, do seu jeito"
          icone="gravar"
          corIcone="accentStrong"
          onPress={ir({ pathname: '/contar-memoria', params: { modo: 'voz' } })}
        />
        <ListRow titulo="Escrever" subtitulo="Um texto curto" icone="texto" onPress={ir({ pathname: '/contar-memoria', params: { modo: 'texto' } })} />
        <ListRow
          titulo="Uma foto com história"
          subtitulo="Da galeria ou da câmera"
          icone="foto"
          onPress={ir({ pathname: '/editar-memoria', params: { secao: 'lembrancas' } })}
        />
      </ListGroup>
    </View>
  );
}
