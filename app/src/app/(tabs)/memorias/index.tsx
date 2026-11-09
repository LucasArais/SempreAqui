import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Coluna,
  ListGroup,
  ListRow,
  mostrarToast,
  Photo,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Section,
  Text,
} from '@/components';
import { fotos, pessoa } from '@/data/familia';
import { compartilharArquivo } from '@/lib/compartilhar';
import { haptic } from '@/lib/haptics';
import { gerarPassaportePdf } from '@/lib/passaporte-pdf';
import { espaco } from '@/theme';

function GradeDeFotos() {
  const linhas = [];
  for (let i = 0; i < pessoa.fotos.length; i += 3) linhas.push(pessoa.fotos.slice(i, i + 3));
  return (
    <View style={{ gap: espaco.meio / 2 + 2 }}>
      {linhas.map((linha, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: espaco.meio / 2 + 2 }}>
          {linha.map((f) => (
            <View key={f.legenda} style={{ flex: 1 }}>
              <Photo rotulo={f.legenda} fonte={f.fonte} tom={f.tom} icone={f.icone} proporcao={1} style={{ borderRadius: 4 }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function Memorias() {
  const [gerando, setGerando] = useState(false);

  async function compartilharPassaporte() {
    setGerando(true);
    try {
      const uri = await gerarPassaportePdf();
      haptic.sucesso();
      await compartilharArquivo(uri, `Passaporte de Memória da ${pessoa.comoGostaDeSerChamada}`, 'application/pdf');
    } catch {
      mostrarToast('Não consegui preparar o passaporte agora. Tente de novo em instantes.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <Screen>
      <Coluna centro gap="s1">
        <Avatar nome={pessoa.comoGostaDeSerChamada.replace('Dona ', '')} tom={0} grande fonte={fotos.donaIsabel} />
        <Text variante="title2" centro>
          {pessoa.comoGostaDeSerChamada}
        </Text>
        <Text variante="callout" cor="secondaryLabel" centro>
          {pessoa.nome}, {pessoa.idade} anos. Gosta de ser chamada de {pessoa.comoGostaDeSerChamada}.
        </Text>
      </Coluna>

      <Section titulo="Quem ela é">
        <ListGroup>
          <ListRow titulo="História" subtitulo={pessoa.quemEla} icone="livro" />
          <ListRow titulo="Como se comunica" subtitulo={pessoa.comoSeComunica} icone="texto" />
        </ListGroup>
      </Section>

      <Section titulo="Pessoas importantes">
        <ListGroup comAvatar>
          {pessoa.pessoasImportantes.map((p) => (
            <ListRow key={p.nome} titulo={p.nome} subtitulo={p.relacao} esquerda={<Avatar nome={p.nome} tom={p.tom} fonte={p.foto} />} />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Rotina">
        <ListGroup>
          {pessoa.rotina.map((r) => (
            <ListRow key={r.titulo} titulo={r.titulo} subtitulo={r.detalhe} icone="relogio" />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="O que acalma">
        <ListGroup>
          {pessoa.acalma.map((r) => (
            <ListRow key={r.titulo} titulo={r.titulo} subtitulo={r.detalhe} icone="calma" corIcone="success" />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="O que agita">
        <ListGroup>
          {pessoa.agita.map((r) => (
            <ListRow key={r.titulo} titulo={r.titulo} subtitulo={r.detalhe} icone="atencao" corIcone="attention" />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Músicas e comidas">
        <ListGroup>
          {pessoa.musicasEComidas.map((r) => (
            <ListRow key={r.titulo} titulo={r.titulo} subtitulo={r.detalhe} icone={r.icone} />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Fotos">
        <GradeDeFotos />
        <SecondaryButton
          titulo="Adicionar uma memória"
          icone="adicionar"
          alinhamento="inicio"
          onPress={() => router.push('/nova-memoria')}
        />
      </Section>

      <Coluna gap="s1">
        <PrimaryButton
          titulo={gerando ? 'Preparando o passaporte...' : 'Compartilhar o passaporte'}
          icone="compartilhar"
          desativado={gerando}
          dica="Gera um PDF de uma página para cuidadores, centro-dia ou hospital"
          onPress={compartilharPassaporte}
        />
        <Text variante="footnote" cor="secondaryLabel" centro>
          Organizado automaticamente a partir de {pessoa.fontesDoPassaporte}. Vai como PDF de uma página.
        </Text>
      </Coluna>
    </Screen>
  );
}
