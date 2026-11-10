import AsyncStorage from '@/lib/armazenamento-conta';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch } from 'react-native';

import { ListGroup, ListRow, mostrarToast, Screen, Section, Text } from '@/components';
import { api, cabecalhos } from '@/lib/api';
import { CHAVE_ONBOARDING } from '@/lib/chaves';
import { compartilharArquivo } from '@/lib/compartilhar';
import { limparTudoLocal } from '@/lib/diario';
import { haptic } from '@/lib/haptics';
import { carregarIaLocal, definirIaLocalAtiva, motivoEmPalavras, testarIaLocal, useIaLocal } from '@/lib/ia-local';
import { rotuloValor } from '@/lib/rotulos';
import { modelosAndroid } from '../../../../modules/ia-local';
import { sair } from '@/lib/sessao';

/** Privacidade e dados (LGPD, art. 18): ver o que guardamos, baixar uma cópia e apagar tudo. */
export default function Privacidade() {
  const [baixando, setBaixando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [testando, setTestando] = useState(false);

  async function testarIa() {
    setTestando(true);
    try {
      const r = await testarIaLocal();
      haptic.sucesso();
      Alert.alert(
        `Funcionou em ${String(r.segundos).replace('.', ',')} s, aqui no celular`,
        [
          `Ouviu: "${r.transcricao.slice(0, 160)}${r.transcricao.length > 160 ? '...' : ''}"`,
          `Sono: ${rotuloValor(r.registro.sono.qualidade)}. Remédios: ${rotuloValor(r.registro.medicacao.tomou)}. Cansaço de quem cuida: ${rotuloValor(r.registro.quem_cuida.cansaco)}.`,
          `Resumo: ${r.resumo}`,
        ].join('\n\n'),
      );
    } catch (e) {
      Alert.alert('O teste não funcionou', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setTestando(false);
    }
  }

  async function baixarIa() {
    if (!modelosAndroid) return;
    setProgresso(0);
    try {
      await modelosAndroid.baixarModelos(setProgresso);
      await carregarIaLocal();
      haptic.sucesso();
      mostrarToast('Pronto: os relatos agora são organizados aqui no celular.');
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : 'Não consegui baixar agora. Tente de novo no Wi-Fi.');
    } finally {
      setProgresso(null);
    }
  }

  function apagarIa() {
    Alert.alert('Apagar a IA do celular?', 'Os relatos voltam a ser organizados na nuvem. Dá para baixar de novo quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await modelosAndroid?.apagarModelos();
          await carregarIaLocal();
          mostrarToast('A IA foi apagada do celular.');
        },
      },
    ]);
  }
  const ia = useIaLocal();
  const disponivel = Boolean(ia.disponibilidade?.transcricao && ia.disponibilidade?.modelo);

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
      router.replace('/entrar');
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

      <Section titulo="IA no seu celular">
        <ListGroup rodape={disponivel ? (ia.ativa ? 'Seus áudios ficam só neste celular. Para a família, vai apenas o relato organizado. Sem custo de IA.' : 'Desligada: os relatos são organizados na nuvem, por provedores que não guardam dados.') : motivoEmPalavras(ia.disponibilidade?.motivo)}>
          <ListRow
            icone="cadeado"
            titulo="Organizar os relatos aqui no celular"
            subtitulo={disponivel ? 'Funciona sem internet' : 'Indisponível neste celular'}
            navega={false}
            direita={
              <Switch
                value={disponivel && ia.ativa}
                disabled={!disponivel}
                onValueChange={(v) => void definirIaLocalAtiva(v)}
                accessibilityLabel="Organizar os relatos aqui no celular"
              />
            }
          />
          {modelosAndroid && ia.disponibilidade?.motivo === 'baixar_modelos' && (
            <ListRow
              icone="compartilhar"
              titulo={progresso === null ? `Baixar a IA para o celular (${modelosAndroid.tamanhoDownloadMb()} MB)` : `Baixando a IA... ${Math.round(progresso * 100)}%`}
              subtitulo={`${modelosAndroid.nomeDoMotor()}${modelosAndroid.idDoMotor() === 'gemini-nano' ? ', do próprio Android' : ''}. Uma vez só, use o Wi-Fi`}
              navega={false}
              onPress={progresso === null ? baixarIa : undefined}
            />
          )}
          {disponivel && (
            <ListRow
              icone="tocar"
              titulo={testando ? 'Testando... pode levar um minuto' : 'Testar a IA do celular'}
              subtitulo="Com um relato de exemplo, sem internet"
              navega={false}
              onPress={testando ? undefined : testarIa}
            />
          )}
          {modelosAndroid && modelosAndroid.modelosBaixados() && (
            <ListRow icone="lixeira" titulo="Apagar a IA do celular" subtitulo={`${modelosAndroid.nomeDoMotor()}. Libera ${modelosAndroid.tamanhoDownloadMb()} MB; os relatos voltam para a nuvem`} navega={false} onPress={apagarIa} />
          )}
        </ListGroup>
      </Section>

      <Section titulo="O que guardamos">
        <ListGroup rodape="Números anônimos de uso, sem nenhum conteúdo, continuam existindo para medir se o app ajuda.">
          <ListRow
            icone="gravar"
            titulo="Áudios e transcrições"
            subtitulo={disponivel && ia.ativa ? 'Áudios ficam só no celular; guardamos a transcrição' : 'O que você contou em cada relato'}
          />
          <ListRow icone="consulta" titulo="Registros e resumos" subtitulo="Organizados pela IA e corrigidos por vocês" />
          <ListRow icone="documento" titulo="Termo de uso dos dados" onPress={() => router.push('/termo')} />
        </ListGroup>
      </Section>

      <Section titulo="Seus direitos">
        <ListGroup rodape="Apagar tudo vale para todos do grupo e pede confirmação antes.">
          <ListRow
            titulo={baixando ? 'Preparando a cópia...' : 'Baixar uma cópia de tudo'}
            subtitulo="Dados e áudios, para salvar ou enviar"
            icone="compartilhar"
            onPress={baixando ? undefined : baixarCopia}
          />
          <ListRow
            titulo={apagando ? 'Apagando...' : 'Apagar todos os dados da família'}
            icone="lixeira"
            corIcone="emergency"
            navega={false}
            onPress={apagando ? undefined : confirmarApagar}
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}
