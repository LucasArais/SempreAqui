import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import {
  AcoesRapidas,
  Avatar,
  Coluna,
  type NomeIcone,
  LinkDaSecao,
  ListGroup,
  ListRow,
  mostrarToast,
  Photo,
  Screen,
  Section,
  Skeleton,
  Text,
} from '@/components';
import { api, ErroApi } from '@/lib/api';
import { compartilharArquivo } from '@/lib/compartilhar';
import { haptic } from '@/lib/haptics';
import { carregarPassaporte, fotoDaChave, oQueFalta, SECOES, type SecaoLista, usePassaporte } from '@/lib/passaporte';
import { gerarPassaportePdf } from '@/lib/passaporte-pdf';
import { espaco } from '@/theme';

type Cor = 'success' | 'attention' | 'accentStrong';

const editar = (secao: string, id?: string) =>
  router.push({ pathname: '/editar-memoria', params: id ? { secao, id } : { secao } });

/** "Adicionar" no título de cada seção: adicionar sempre a um toque, sem linha extra. */
function Adicionar({ secao }: { secao: SecaoLista }) {
  return <LinkDaSecao titulo="Adicionar" icone="adicionar" onPress={() => editar(secao)} />;
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
  // Listas longas mostram 3 itens e "Ver mais": menos rolagem, mesma informação.
  const [aberta, setAberta] = useState(false);
  const visiveis = aberta ? itens : itens.slice(0, 3);
  return (
    <Section titulo={SECOES[secao].titulo} acao={<Adicionar secao={secao} />}>
      {itens.length === 0 ? (
        <Text variante="callout" cor="secondaryLabel">
          Ainda vazio. Toque em Adicionar.
        </Text>
      ) : (
      <ListGroup>
        {visiveis.map((i) => (
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
        {itens.length > 3 && !aberta && (
          <ListRow titulo={`Ver mais ${itens.length - 3}`} icone="chevron" corIcone="secondaryLabel" navega={false} onPress={() => setAberta(true)} />
        )}
      </ListGroup>
      )}
    </Section>
  );
}

export default function Memorias() {
  const { passaporte: p } = usePassaporte();
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState<{ ativo: boolean; url: string | null } | null>(null);

  useEffect(() => {
    api.linkPassaporte().then(setLink).catch(() => undefined);
  }, []);

  if (!p) {
    return (
      <Screen aoAtualizar={carregarPassaporte}>
        <Skeleton linhas={6} />
      </Screen>
    );
  }

  const chamada = p.como_gosta_de_ser_chamada || p.nome || 'Ela';
  const comFoto = p.lembrancas.filter((l) => fotoDaChave(l.foto));

  const falta = oQueFalta(p);

  function criarLink() {
    Alert.alert(
      'Criar um link somente leitura?',
      `Quem receber o link vê o passaporte da ${chamada}: história, pessoas, rotina, o que acalma e as fotos. Nada do Diário. Você pode desligar o link quando quiser.`,
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Criar e enviar',
          onPress: async () => {
            try {
              const novo = await api.criarLinkPassaporte();
              setLink(novo);
              haptic.sucesso();
              await Share.share({ message: `Passaporte de Memória da ${chamada}: ${novo.url}` });
            } catch (e) {
              mostrarToast(e instanceof ErroApi ? e.message : 'Não consegui criar o link agora.');
            }
          },
        },
      ],
    );
  }

  async function desligarLink() {
    try {
      await api.desligarLinkPassaporte();
      setLink({ ativo: false, url: null });
      haptic.sucesso();
      mostrarToast('Link desligado. Quem tinha o link não vê mais o passaporte.');
    } catch {
      mostrarToast('Não consegui desligar agora. Tente de novo em instantes.');
    }
  }

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

      <AcoesRapidas
        acoes={[
          { titulo: 'Contar memória', icone: 'gravar', dica: 'Fale ou escreva. A IA separa nas seções e você confere', onPress: () => router.push('/nova-memoria') },
          { titulo: gerando ? 'Preparando...' : 'Enviar PDF', icone: 'compartilhar', desativado: gerando, dica: 'PDF de uma página para cuidador, centro-dia ou hospital', onPress: compartilharPassaporte },
        ]}
      />

      {falta.vazias.length > 0 && (
        <ListGroup>
          <ListRow
            titulo={`Falta pouco: ${falta.preenchidas} de ${falta.total} partes`}
            subtitulo={`Responda falando: ${falta.vazias[0].pergunta}`}
            icone="gravar"
            corIcone="accentStrong"
            onPress={() => router.push({ pathname: '/contar-memoria', params: { modo: 'voz' } })}
          />
        </ListGroup>
      )}

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

      <Section titulo={SECOES.pessoas_importantes.titulo} acao={<Adicionar secao="pessoas_importantes" />}>
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

      <Section titulo={SECOES.lembrancas.titulo} acao={<Adicionar secao="lembrancas" />}>
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
        {p.lembrancas.some((l) => !fotoDaChave(l.foto)) && (
          <ListGroup>
            {p.lembrancas
              .filter((l) => !fotoDaChave(l.foto))
              .map((l) => (
                <ListRow key={l.id} titulo={l.titulo} subtitulo={l.detalhe ?? undefined} icone="coracao" onPress={() => editar('lembrancas', l.id)} />
              ))}
          </ListGroup>
        )}
        <Text variante="footnote" cor="secondaryLabel">
          Cada lembrança, pessoa, música e comida vira tema da conversa do dia.
        </Text>
      </Section>

      <Section titulo="Compartilhar">
        <ListGroup rodape="Para o cuidador, o centro-dia ou o hospital. O link mostra o passaporte sempre atualizado, sem instalar nada. Nunca inclui o Diário.">
          <ListRow
            titulo={gerando ? 'Preparando o PDF...' : 'PDF de uma página'}
            subtitulo="Para imprimir ou mandar"
            icone="documento"
            onPress={gerando ? undefined : compartilharPassaporte}
          />
          {link?.ativo && link.url ? (
            <>
              <ListRow
                titulo="Enviar o link de novo"
                subtitulo="O link está ligado"
                icone="link"
                corIcone="success"
                onPress={() => Share.share({ message: `Passaporte de Memória da ${chamada}: ${link.url}` })}
              />
              <ListRow titulo="Desligar o link" icone="lixeira" corIcone="attention" onPress={desligarLink} />
            </>
          ) : (
            <ListRow titulo="Criar link para enviar" subtitulo="Abre em qualquer celular" icone="link" onPress={criarLink} />
          )}
        </ListGroup>
      </Section>
    </Screen>
  );
}
