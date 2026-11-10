import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Avatar,
  Coluna,
  type NomeIcone,
  ListGroup,
  ListRow,
  mostrarToast,
  Photo,
  PrimaryButton,
  Screen,
  Section,
  Skeleton,
  Text,
} from '@/components';
import { compartilharArquivo } from '@/lib/compartilhar';
import { haptic } from '@/lib/haptics';
import { carregarPassaporte, fotoDaChave, SECOES, type SecaoLista, usePassaporte } from '@/lib/passaporte';
import { gerarPassaportePdf } from '@/lib/passaporte-pdf';
import { espaco, useTema } from '@/theme';

type Cor = 'success' | 'attention' | 'accentStrong';

const editar = (secao: string, id?: string) =>
  router.push({ pathname: '/editar-memoria', params: id ? { secao, id } : { secao } });

/** Linha final de cada seção: adicionar sempre a um toque. */
function Adicionar({ secao }: { secao: SecaoLista }) {
  return <ListRow titulo={SECOES[secao].novo} icone="adicionar" corIcone="accentStrong" onPress={() => editar(secao)} />;
}

function Lista({
  secao,
  icone,
  cor,
  itens,
}: {
  secao: SecaoLista;
  icone: NomeIcone;
  cor?: Cor;
  itens: { id: string; titulo: string; subtitulo?: string | null }[];
}) {
  return (
    <Section titulo={SECOES[secao].titulo}>
      <ListGroup>
        {itens.map((i) => (
          <ListRow
            key={i.id}
            titulo={i.titulo}
            subtitulo={i.subtitulo ?? undefined}
            icone={icone}
            corIcone={cor}
            dica="Toque para editar ou apagar"
            onPress={() => editar(secao, i.id)}
          />
        ))}
        <Adicionar secao={secao} />
      </ListGroup>
    </Section>
  );
}

export default function Memorias() {
  const { cores } = useTema();
  const { passaporte: p } = usePassaporte();
  const [gerando, setGerando] = useState(false);

  if (!p) {
    return (
      <Screen aoAtualizar={carregarPassaporte}>
        <Skeleton linhas={6} />
      </Screen>
    );
  }

  const chamada = p.como_gosta_de_ser_chamada || p.nome || 'Ela';
  const comFoto = p.lembrancas.filter((l) => fotoDaChave(l.foto));

  async function compartilharPassaporte() {
    setGerando(true);
    try {
      const uri = await gerarPassaportePdf(p!);
      haptic.sucesso();
      await compartilharArquivo(uri, `Passaporte de Memória da ${chamada}`, 'application/pdf');
    } catch {
      mostrarToast('Não consegui preparar o passaporte agora. Tente de novo em instantes.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <Screen aoAtualizar={carregarPassaporte}>
      <Pressable
        onPress={() => editar('perfil')}
        accessibilityRole="button"
        accessibilityLabel={`${chamada}. Editar nome e idade`}
      >
        <Coluna centro gap="s1">
          <Avatar nome={chamada.replace('Dona ', '')} tom={0} grande fonte={fotoDaChave(p.foto)} />
          <Text variante="title2" centro>
            {chamada}
          </Text>
          <Text variante="callout" cor="secondaryLabel" centro>
            {[p.nome, p.idade ? `${p.idade} anos` : null].filter(Boolean).join(', ') || 'Toque para contar quem ela é'}
          </Text>
        </Coluna>
      </Pressable>

      <Section titulo="Quem ela é">
        <ListGroup>
          <ListRow
            titulo="História"
            subtitulo={p.quem_ela || 'O que fazia, do que gosta, o jeito dela'}
            icone="livro"
            onPress={() => editar('quem_ela')}
          />
          <ListRow
            titulo="Como se comunica"
            subtitulo={p.como_se_comunica || 'O que ajuda a conversa a fluir'}
            icone="texto"
            onPress={() => editar('como_se_comunica')}
          />
        </ListGroup>
      </Section>

      <Section titulo={SECOES.pessoas_importantes.titulo}>
        <ListGroup comAvatar>
          {p.pessoas_importantes.map((x, i) => (
            <ListRow
              key={x.id}
              titulo={x.nome}
              subtitulo={x.relacao ?? undefined}
              esquerda={<Avatar nome={x.nome} tom={i % 5} fonte={fotoDaChave(x.foto)} />}
              dica="Toque para editar ou apagar"
              onPress={() => editar('pessoas_importantes', x.id)}
            />
          ))}
          <Adicionar secao="pessoas_importantes" />
        </ListGroup>
      </Section>

      <Lista secao="rotina" icone="relogio" itens={p.rotina.map((x) => ({ ...x, subtitulo: x.detalhe }))} />
      <Lista secao="acalma" icone="calma" cor="success" itens={p.acalma.map((x) => ({ ...x, subtitulo: x.detalhe }))} />
      <Lista secao="agita" icone="atencao" cor="attention" itens={p.agita.map((x) => ({ ...x, subtitulo: x.detalhe }))} />
      <Lista
        secao="musicas"
        icone="musica"
        itens={p.musicas.map((x) => ({ ...x, subtitulo: [x.artista, x.link ? 'com link do YouTube' : null].filter(Boolean).join(', ') }))}
      />
      <Lista secao="comidas" icone="comida" itens={p.comidas.map((x) => ({ ...x, subtitulo: x.detalhe }))} />

      <Section titulo={SECOES.lembrancas.titulo}>
        {comFoto.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.meio / 2 + 2 }}>
            {comFoto.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => editar('lembrancas', l.id)}
                accessibilityRole="button"
                accessibilityLabel={l.titulo}
                style={{ width: '32.5%' }}
              >
                <Photo rotulo={l.titulo} fonte={fotoDaChave(l.foto)} proporcao={1} style={{ borderRadius: 4 }} />
              </Pressable>
            ))}
          </View>
        )}
        <ListGroup>
          {p.lembrancas
            .filter((l) => !fotoDaChave(l.foto))
            .map((l) => (
              <ListRow key={l.id} titulo={l.titulo} subtitulo={l.detalhe ?? undefined} icone="coracao" onPress={() => editar('lembrancas', l.id)} />
            ))}
          <Adicionar secao="lembrancas" />
        </ListGroup>
        <Text variante="footnote" cor="secondaryLabel">
          Cada lembrança, pessoa, música e comida vira tema da conversa do dia.
        </Text>
      </Section>

      <Coluna gap="s1">
        <PrimaryButton
          titulo={gerando ? 'Preparando o passaporte...' : 'Compartilhar o passaporte'}
          icone="compartilhar"
          desativado={gerando}
          dica="Gera um PDF de uma página para cuidadores, centro-dia ou hospital"
          onPress={compartilharPassaporte}
        />
        <Text variante="footnote" cor="secondaryLabel" centro style={{ color: cores.secondaryLabel }}>
          Vai como PDF de uma página, com o que está aqui.
        </Text>
      </Coluna>
    </Screen>
  );
}
