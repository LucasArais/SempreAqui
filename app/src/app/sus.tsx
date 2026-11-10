import { router } from 'expo-router';

import { ListGroup, ListRow, Screen, Section, Text } from '@/components';
import { abrirLink } from '@/lib/abrir';
import { usePassaporte } from '@/lib/passaporte';
import { formatarCns, SERVICOS_SUS, TELEFONES_SUS } from '@/lib/sus';
import { Linking } from 'react-native';

/** Serviços do SUS para a família: o Cartão SUS dela, links oficiais e telefones. */
export default function Sus() {
  const { passaporte: p } = usePassaporte();
  const chamada = p?.como_gosta_de_ser_chamada || 'ela';

  return (
    <Screen>
      <Section titulo={`Cartão SUS da ${chamada}`}>
        <ListGroup rodape="Use no posto, na farmácia e no hospital. O número fica só com a família.">
          <ListRow
            titulo={p?.cartao_sus ? formatarCns(p.cartao_sus) : 'Ainda não cadastrado'}
            subtitulo={p?.ubs_referencia ? `UBS de referência: ${p.ubs_referencia}` : 'Toque para cadastrar o número e a UBS'}
            icone="documento"
            corIcone="accentStrong"
            onPress={() => router.push({ pathname: '/editar-memoria', params: { secao: 'sus' } })}
          />
        </ListGroup>
      </Section>

      <Section titulo="Perto de você">
        <ListGroup rodape="Do cadastro oficial do SUS, com mapa, rota e telefone.">
          <ListRow titulo="Hospitais, UPAs e pronto-socorro" icone="atencao" corIcone="emergency" onPress={() => router.push({ pathname: '/perto', params: { grupo: 'emergencia' } })} />
          <ListRow titulo="Postos de saúde e UBS" icone="casa" onPress={() => router.push({ pathname: '/perto', params: { grupo: 'ubs' } })} />
          <ListRow titulo="CAPS" subtitulo="Atenção psicossocial" icone="coracao" onPress={() => router.push({ pathname: '/perto', params: { grupo: 'caps' } })} />
        </ListGroup>
      </Section>

      {SERVICOS_SUS.map((grupo) => (
        <Section key={grupo.secao} titulo={grupo.secao}>
          <ListGroup>
            {grupo.itens.map((s) => (
              <ListRow key={s.url} titulo={s.titulo} subtitulo={s.detalhe} icone="link" onPress={() => void abrirLink(s.url)} dica="Abre o site oficial" />
            ))}
          </ListGroup>
        </Section>
      ))}

      <Section titulo="Telefones">
        <ListGroup>
          {TELEFONES_SUS.map((t) => (
            <ListRow
              key={t.numero}
              titulo={t.titulo}
              subtitulo={t.detalhe}
              icone="telefone"
              corIcone={t.numero === '192' ? 'emergency' : 'accentStrong'}
              onPress={() => void Linking.openURL(`tel:${t.numero}`)}
            />
          ))}
        </ListGroup>
      </Section>

      <Text variante="footnote" cor="secondaryLabel">
        Links oficiais do Ministério da Saúde. O SempreAqui não acessa os sistemas do SUS: só guarda o número que a família digitou.
      </Text>
    </Screen>
  );
}
