import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Linking, Share } from 'react-native';

import { Avatar, Coluna, ListGroup, ListRow, mostrarToast, Photo, Screen, SecondaryButton, Section, Text } from '@/components';
import { fotos } from '@/data/familia';
import { abrirLink } from '@/lib/abrir';
import { api, ErroApi } from '@/lib/api';
import { meuNome, PAPEIS, useFamilia } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { useIaLocal } from '@/lib/ia-local';
import { enviarFoto, fotoDaChave, passaporteAtual, salvarPassaporte, usePassaporte } from '@/lib/passaporte';

const FONTE_OFICIAL = 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_pratico_cuidador.pdf';
const CODIGO_ABERTO = 'https://github.com/LucasArais/SempreAqui';

/** Fecha os Ajustes e abre outra tela do app. */
function ir(rota: Href) {
  router.back();
  setTimeout(() => router.push(rota), 250);
}

/** Ajustes: quem está usando, a família (foto, dados dela, convite) e privacidade. */
export default function Ajustes() {
  const { eu, membros } = useFamilia();
  const { passaporte } = usePassaporte();
  const ia = useIaLocal();
  const [trocando, setTrocando] = useState(false);
  const nome = meuNome();
  const chamada = passaporte?.como_gosta_de_ser_chamada || 'ela';
  const iaLigada = ia.ativa && ia.disponibilidade?.transcricao && ia.disponibilidade?.modelo;

  async function trocarFotoDaFamilia() {
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (resultado.canceled || !resultado.assets[0]) return;
    setTrocando(true);
    try {
      const chave = await enviarFoto(resultado.assets[0].uri);
      await salvarPassaporte({ ...passaporteAtual(), foto_familia: chave });
      haptic.sucesso();
      mostrarToast('Foto da família trocada.');
    } catch (e) {
      mostrarToast(e instanceof ErroApi ? e.message : 'Não consegui trocar a foto agora.');
    } finally {
      setTrocando(false);
    }
  }

  async function convidar() {
    try {
      const { mensagem } = await api.criarConvite('familiar');
      const whatsapp = `whatsapp://send?text=${encodeURIComponent(mensagem)}`;
      if (await Linking.canOpenURL(whatsapp).catch(() => false)) await Linking.openURL(whatsapp);
      else await Share.share({ message: mensagem });
    } catch (e) {
      mostrarToast(e instanceof ErroApi ? e.message : 'Não consegui criar o convite agora.');
    }
  }

  return (
    <Screen>
      <Coluna centro gap="s1">
        <Avatar nome={nome || '?'} tom={1} grande />
        <Text variante="title2" centro>
          {nome || 'Você'}
        </Text>
        <Text variante="callout" cor="secondaryLabel" centro>
          {eu?.papel ? PAPEIS[eu.papel] : 'Diga seu nome para a família saber quem é quem'}
        </Text>
        <SecondaryButton titulo={nome ? 'Mudar nome ou papel' : 'Dizer meu nome'} onPress={() => ir('/eu')} />
      </Coluna>

      <Section titulo="Família">
        <Photo fonte={fotoDaChave(passaporte?.foto_familia) ?? fotos.familiaReunida} rotulo="Foto da família" proporcao={16 / 9} />
        <SecondaryButton titulo={trocando ? 'Enviando a foto...' : 'Trocar a foto da família'} icone="foto" alinhamento="inicio" onPress={trocarFotoDaFamilia} />
        <ListGroup>
          <ListRow titulo={`Dados da ${chamada}`} subtitulo="Nome, idade e foto" icone="coracao" onPress={() => ir({ pathname: '/editar-memoria', params: { secao: 'perfil' } })} />
          <ListRow titulo="Quem faz parte" subtitulo={`${membros.length} ${membros.length === 1 ? 'pessoa' : 'pessoas'} no grupo`} icone="familia" onPress={() => ir('/familia')} />
          <ListRow titulo="Convidar pelo WhatsApp" icone="adicionar" onPress={convidar} />
          <ListRow titulo="Tenho um código de convite" icone="link" onPress={() => ir('/convite')} />
        </ListGroup>
      </Section>

      <Section titulo="Privacidade">
        <ListGroup>
          <ListRow
            titulo="IA no seu celular"
            subtitulo={iaLigada ? 'Ligada: seus áudios não saem do celular' : 'Desligada ou indisponível neste celular'}
            icone="cadeado"
            corIcone={iaLigada ? 'success' : undefined}
            onPress={() => ir('/familia/privacidade')}
          />
          <ListRow titulo="Privacidade e dados da família" subtitulo="Baixar uma cópia ou apagar tudo" icone="documento" onPress={() => ir('/familia/privacidade')} />
          <ListRow titulo="Termo de uso dos dados" icone="texto" onPress={() => ir('/termo')} />
        </ListGroup>
      </Section>

      <Section titulo="Sobre">
        <ListGroup rodape={`SempreAqui ${Constants.expoConfig?.version ?? ''}. Não substitui a equipe de saúde. Em risco, ligue 192.`}>
          <ListRow titulo="Fonte oficial do Ajudante" subtitulo="Guia Prático do Cuidador, Ministério da Saúde" icone="link" onPress={() => abrirLink(FONTE_OFICIAL)} />
          <ListRow titulo="Código aberto" subtitulo="Licença MIT, no GitHub" icone="link" onPress={() => abrirLink(CODIGO_ABERTO)} />
        </ListGroup>
      </Section>
    </Screen>
  );
}
