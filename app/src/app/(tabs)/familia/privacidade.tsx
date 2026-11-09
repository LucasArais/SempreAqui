import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Coluna, ListGroup, ListRow, mostrarToast, PrimaryButton, Screen, SecondaryButton, Section, Text } from '@/components';
import { api, cabecalhos } from '@/lib/api';
import { CHAVE_ONBOARDING } from '@/lib/chaves';
import { compartilharArquivo } from '@/lib/compartilhar';
import { limparTudoLocal } from '@/lib/diario';
import { haptic } from '@/lib/haptics';
import { sair } from '@/lib/sessao';

/** Privacidade e dados (LGPD, art. 18): ver o que guardamos, baixar uma cópia e apagar tudo. */
export default function Privacidade() {
  const [baixando, setBaixando] = useState(false);
  const [apagando, setApagando] = useState(false);

  async function baixarCopia() {
    setBaixando(true);
    try {
      const destino = new File(Paths.cache, 'sempreaqui-dados.zip');
      if (destino.exists) destino.delete();
      const arquivo = await File.downloadFileAsync(api.urlExportar(), destino, { headers: cabecalhos() });
      haptic.sucesso();
      await compartilharArquivo(arquivo.uri, 'Cópia dos dados da família', 'application/zip');
    } catch {
      mostrarToast('Não consegui preparar a cópia agora. Tente de novo em instantes.');
    } finally {
      setBaixando(false);
    }
  }

  function confirmarApagar() {
    // Apagar dados é o único caso em que pedimos confirmação antes.
    Alert.alert(
      'Apagar todos os dados da família?',
      'Somem para todo mundo do grupo: relatos, áudios, transcrições, resumos e correções. Não dá para desfazer. Se quiser, baixe uma cópia antes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar tudo', style: 'destructive', onPress: apagarTudo },
      ],
    );
  }

  async function apagarTudo() {
    setApagando(true);
    try {
      await api.apagarTudo();
      await limparTudoLocal();
      await AsyncStorage.removeItem(CHAVE_ONBOARDING).catch(() => undefined);
      await sair();
      haptic.sucesso();
      router.replace('/onboarding');
      mostrarToast('Todos os dados da família foram apagados.');
    } catch {
      setApagando(false);
      mostrarToast('Não consegui apagar agora. Nada foi perdido. Tente de novo em instantes.');
    }
  }

  return (
    <Screen>
      <Text variante="body" cor="secondaryLabel">
        Os dados da família são de vocês. Aqui você vê o que guardamos, baixa uma cópia de tudo ou apaga tudo quando quiser.
      </Text>

      <Section titulo="O que guardamos">
        <ListGroup rodape="Números anônimos de uso, sem nenhum conteúdo, continuam existindo para medir se o app ajuda.">
          <ListRow icone="gravar" titulo="Áudios e transcrições" subtitulo="O que você contou em cada relato" />
          <ListRow icone="consulta" titulo="Registros e resumos" subtitulo="Organizados pela IA e corrigidos por vocês" />
          <ListRow icone="documento" titulo="Termo de uso dos dados" onPress={() => router.push('/termo')} />
        </ListGroup>
      </Section>

      <Coluna gap="s1">
        <PrimaryButton
          titulo={baixando ? 'Preparando a cópia...' : 'Baixar uma cópia de tudo'}
          icone="compartilhar"
          desativado={baixando}
          dica="Gera um arquivo com os dados e os áudios para salvar ou enviar"
          onPress={baixarCopia}
        />
        <SecondaryButton
          titulo={apagando ? 'Apagando...' : 'Apagar todos os dados da família'}
          icone="lixeira"
          dica="Apaga tudo para todos do grupo. Pede confirmação antes"
          onPress={confirmarApagar}
        />
      </Coluna>
    </Screen>
  );
}
