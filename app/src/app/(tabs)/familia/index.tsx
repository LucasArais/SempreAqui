import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';

import { Avatar, Card, Icon, LinhaTarefa, LinkDaSecao, ListGroup, ListRow, mostrarToast, Photo, Screen, Section, Text } from '@/components';
import { fotos } from '@/data/familia';
import { api, ErroApi } from '@/lib/api';
import {
  agradecer,
  fotoDoMembro,
  carregarFamilia,
  type ItemFeed,
  meuNome,
  PAPEIS,
  useFamilia,
} from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { fotoDaChave, passaporteAtual, usePassaporte } from '@/lib/passaporte';
import { formatarData } from '@/lib/rotulos';
import { espaco, tamanho, useTema } from '@/theme';

const TITULO_FEED: Record<ItemFeed['tipo'], (i: ItemFeed) => string> = {
  aviso: (i) => `Aviso de ${i.autor}`,
  tarefa_assumida: (i) => `${i.autor} assumiu uma tarefa`,
  tarefa_concluida: (i) => `${i.autor} fez uma tarefa`,
  resumo: () => 'Resumo do dia',
  conversa: () => 'Conversa do dia',
};

function ItemDoFeed({ item }: { item: ItemFeed }) {
  const { cores } = useTema();
  const aviso = item.tipo === 'aviso';
  const quem = item.obrigados.length ? `Obrigado de ${item.obrigados.join(', ')}` : '';
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }}>
        {aviso ? <Icon nome="atencao" cor={cores.emergency} /> : fotoDoMembro(item.autor) ? <Avatar nome={item.autor} fonte={fotoDaChave(fotoDoMembro(item.autor))} /> : null}
        <Text variante="headline" style={{ flex: 1 }}>
          {TITULO_FEED[item.tipo](item)}
        </Text>
        <Text variante="footnote" cor="secondaryLabel">
          {formatarData(item.quando)}
        </Text>
      </View>
      {item.texto ? <Text variante="body">{item.texto}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s1 }}>
        <Pressable
          onPress={() => {
            haptic.sucesso();
            void agradecer(item.ref);
          }}
          disabled={item.agradeci}
          accessibilityRole="button"
          accessibilityLabel={item.agradeci ? 'Você agradeceu' : 'Dizer obrigado'}
          style={{ minHeight: tamanho.toqueMinimo, flexDirection: 'row', alignItems: 'center', gap: espaco.meio, paddingRight: espaco.s1 }}
        >
          <Icon nome="coracao" cor={item.agradeci ? cores.emergency : cores.accentStrong} tamanho={18} />
          <Text variante="callout" style={{ color: cores.accentStrong }}>
            {item.agradeci ? 'Agradecido' : 'Obrigado'}
          </Text>
        </Pressable>
        <Text variante="footnote" cor="secondaryLabel" style={{ flex: 1 }} numberOfLines={2}>
          {quem}
        </Text>
      </View>
    </Card>
  );
}

export default function Familia() {
  const { membros, tarefas, feed } = useFamilia();
  usePassaporte();
  const [convidando, setConvidando] = useState(false);
  const [feedAberto, setFeedAberto] = useState(false);
  const chamada = passaporteAtual().como_gosta_de_ser_chamada || 'ela';
  useFocusEffect(useCallback(() => void carregarFamilia(), []));
  const abertas = tarefas.filter((t) => !t.concluida);
  const feitas = tarefas.filter((t) => t.concluida);

  async function convidar() {
    setConvidando(true);
    try {
      const { mensagem } = await api.criarConvite('familiar');
      const whatsapp = `whatsapp://send?text=${encodeURIComponent(mensagem)}`;
      if (await Linking.canOpenURL(whatsapp).catch(() => false)) await Linking.openURL(whatsapp);
      else await Share.share({ message: mensagem });
    } catch (e) {
      mostrarToast(e instanceof ErroApi ? e.message : 'Não consegui criar o convite agora.');
    } finally {
      setConvidando(false);
    }
  }

  return (
    <Screen aoAtualizar={carregarFamilia}>
      <Photo fonte={fotoDaChave(passaporteAtual().foto_familia) ?? fotos.familiaReunida} rotulo={`Quem cuida da ${chamada}`} proporcao={2.2} />

      <Section titulo="Tarefas da semana" acao={<LinkDaSecao titulo="Pedir ajuda" icone="adicionar" onPress={() => router.push('/nova-tarefa')} />}>
        <ListGroup rodape="Quem assume recebe um lembrete no celular. Quando alguém faz, a família vê e pode agradecer.">
          {abertas.map((t) => (
            <LinhaTarefa key={t.id} tarefa={t} />
          ))}
          {feitas.slice(0, 3).map((t) => (
            <LinhaTarefa key={t.id} tarefa={t} />
          ))}
        </ListGroup>
      </Section>

      <Section
        titulo="O que aconteceu"
        acao={feed.length > 4 ? <LinkDaSecao titulo={feedAberto ? 'Ver menos' : 'Ver tudo'} onPress={() => setFeedAberto((a) => !a)} /> : undefined}
      >
        {feed.length === 0 ? (
          <Text variante="callout" cor="secondaryLabel">
            Quando alguém enviar um resumo, fizer uma tarefa ou uma conversa, aparece aqui.
          </Text>
        ) : (
          feed.slice(0, feedAberto ? 30 : 4).map((i) => <ItemDoFeed key={i.id} item={i} />)
        )}
      </Section>

      <Section
        titulo={`Quem cuida da ${chamada}`}
        acao={<LinkDaSecao titulo={convidando ? 'Preparando...' : 'Convidar'} icone="adicionar" onPress={convidar} />}
      >
        <ListGroup comAvatar>
          {membros.map((m, i) => (
            <ListRow
              key={`${m.nome}-${i}`}
              titulo={m.eu ? `${meuNome() || 'Você'} (você)` : m.nome}
              subtitulo={PAPEIS[m.papel]}
              esquerda={<Avatar nome={m.nome} tom={i % 5} fonte={fotoDaChave(m.foto)} />}
              onPress={m.eu ? () => router.push('/eu') : undefined}
              dica={m.eu ? 'Toque para mudar seu nome ou papel' : undefined}
            />
          ))}
          <ListRow titulo="Tenho um código de convite" icone="link" onPress={() => router.push('/convite')} />
        </ListGroup>
      </Section>
    </Screen>
  );
}
