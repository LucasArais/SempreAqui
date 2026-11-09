import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { ListGroup, ListRow, Text } from '@/components';
import { pessoa } from '@/data/familia';
import { espaco, useTema } from '@/theme';

/** Sheet rápida para adicionar uma memória ao Passaporte. */
export default function NovaMemoria() {
  const { margem } = useTema();
  const emBreve = (o: string) => () =>
    Alert.alert(o, 'Na próxima versão, a IA organiza isso no Passaporte para você conferir.', [
      { text: 'Entendi', onPress: () => router.back() },
    ]);
  return (
    <View style={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, gap: espaco.s2 }}>
      <Text variante="title2" accessibilityRole="header">
        Nova memória
      </Text>
      <Text variante="callout" cor="secondaryLabel">
        Conte algo sobre a {pessoa.comoGostaDeSerChamada}. A IA organiza no Passaporte e você confere antes.
      </Text>
      <ListGroup>
        <ListRow titulo="Contar uma história" subtitulo="Grave um áudio" icone="gravar" corIcone="accentStrong" onPress={emBreve('Contar uma história')} />
        <ListRow titulo="Escolher fotos" subtitulo="Da galeria do celular" icone="foto" onPress={emBreve('Escolher fotos')} />
        <ListRow titulo="Escrever" subtitulo="Um texto curto" icone="texto" onPress={emBreve('Escrever')} />
      </ListGroup>
    </View>
  );
}
