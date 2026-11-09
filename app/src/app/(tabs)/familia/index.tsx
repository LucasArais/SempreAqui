import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import {
  Avatar,
  Photo,
  Icon,
  ListGroup,
  ListRow,
  PrimaryButton,
  Screen,
  Section,
  SummaryCard,
} from '@/components';
import { familia, feed, fotos, pessoa, tarefas as tarefasIniciais } from '@/data/familia';
import { haptic } from '@/lib/haptics';
import { useTema } from '@/theme';

export default function Familia() {
  const { cores } = useTema();
  const [tarefas, setTarefas] = useState(tarefasIniciais);

  function alternar(id: string) {
    setTarefas((lista) =>
      lista.map((t) => {
        if (t.id !== id) return t;
        if (!t.feita) haptic.sucesso();
        return { ...t, feita: !t.feita };
      }),
    );
  }

  return (
    <Screen>
      <Photo fonte={fotos.familiaReunida} rotulo="Dona Isabel com a Cláudia, o Rafael e a neta" proporcao={4 / 3} />

      <Section titulo={`Quem cuida da ${pessoa.comoGostaDeSerChamada}`}>
        <ListGroup comAvatar>
          {familia.map((m) => (
            <ListRow
              key={m.nome}
              titulo={m.nome}
              subtitulo={`${m.papel}. ${m.cidade}`}
              esquerda={<Avatar nome={m.nome} tom={m.tom} fonte={m.foto} />}
            />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Tarefas da semana">
        <ListGroup rodape="Toque para marcar como feita. Quem se ofereceu recebe um lembrete.">
          {tarefas.map((t) => (
            <ListRow
              key={t.id}
              titulo={t.titulo}
              subtitulo={`${t.quem}. ${t.quando}`}
              riscado={t.feita}
              esquerda={
                <Icon nome={t.feita ? 'feito' : 'pendente'} cor={t.feita ? cores.success : cores.tertiaryLabel} />
              }
              onPress={() => alternar(t.id)}
              navega={false}
              rotuloAcessivel={`${t.titulo}. ${t.quem}. ${t.quando}. ${t.feita ? 'Concluída' : 'Pendente'}`}
              dica={t.feita ? 'Toque para marcar como pendente' : 'Toque para marcar como feita'}
            />
          ))}
        </ListGroup>
      </Section>

      <Section titulo="Resumos">
        {feed.map((f) => (
          <SummaryCard key={f.id} meta={`Diário da ${f.autor}, ${f.quando.toLowerCase()}`} texto={f.resumo} original={f.original} />
        ))}
        <ListGroup>
          <ListRow titulo="Ver a semana completa" icone="calendario" onPress={() => router.push('/hoje/semana')} />
          <ListRow titulo="Privacidade e dados da família" icone="cadeado" onPress={() => router.push('/familia/privacidade')} />
        </ListGroup>
      </Section>

      <PrimaryButton
        titulo="Convidar alguém da família"
        icone="adicionar"
        dica="Envia um convite para entrar no grupo da família"
        onPress={() =>
          Share.share({
            message: `Estou usando o SempreAqui para cuidar da ${pessoa.comoGostaDeSerChamada}. Entra no nosso grupo para a gente dividir o cuidado?`,
          })
        }
      />
    </Screen>
  );
}
