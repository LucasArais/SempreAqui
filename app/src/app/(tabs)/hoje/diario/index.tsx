import { router } from 'expo-router';

import { EmptyState, Icon, ListGroup, ListRow, PrimaryButton, Screen, Section } from '@/components';
import type { Relato } from '@/lib/api';
import { type Pendente, atualizarRelatos, useAtualizarAoFocar, useDiario } from '@/lib/diario';
import { formatarData, formatarDuracao, MENSAGEM_ETAPA } from '@/lib/rotulos';
import { useTema } from '@/theme';

type Item = { id: string; gravado_em: string; relato?: Relato; pendente?: Pendente };

function porDia(itens: Item[]) {
  const grupos = new Map<string, Item[]>();
  for (const item of itens) {
    const dia = new Date(item.gravado_em).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    grupos.set(dia, [...(grupos.get(dia) ?? []), item]);
  }
  return [...grupos.entries()];
}

/** Linha do tempo dos relatos: o que já foi organizado, o que está em andamento e o que espera internet. */
export default function Historico() {
  const { cores } = useTema();
  const { relatos, pendentes, carregado } = useDiario();
  useAtualizarAoFocar();
  const itens: Item[] = [
    ...pendentes.map((p) => ({ id: p.id, gravado_em: p.gravado_em, pendente: p })),
    ...relatos.map((r) => ({ id: r.id, gravado_em: r.gravado_em, relato: r })),
  ].sort((a, b) => b.gravado_em.localeCompare(a.gravado_em));

  if (carregado && itens.length === 0) {
    return (
      <Screen aoAtualizar={atualizarRelatos}>
        <EmptyState
          icone="historico"
          titulo="Seus relatos aparecem aqui"
          texto="Grave como foi o dia. A IA organiza sono, comida, humor e remédios, e você confere antes de enviar."
        >
          <PrimaryButton titulo="Gravar agora" icone="gravar" onPress={() => router.push('/gravar')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen aoAtualizar={atualizarRelatos}>
      {porDia(itens).map(([dia, doDia]) => (
        <Section key={dia} titulo={dia.charAt(0).toUpperCase() + dia.slice(1)}>
          <ListGroup>
            {doDia.map((item) => {
              const { relato, pendente } = item;
              const hora = formatarData(item.gravado_em).split(', ').pop();
              const duracao = formatarDuracao(relato?.duracao_s ?? pendente?.duracao_s);
              let subtitulo: string;
              let icone = <Icon nome="livro" cor={cores.secondaryLabel} />;
              if (pendente) {
                subtitulo = 'Guardado no celular. Envio quando a internet voltar';
                icone = <Icon nome="nuvem" cor={cores.secondaryLabel} />;
              } else if (relato?.etapa === 'pronto') {
                subtitulo = relato.resumo ?? '';
                if (relato.alertas.length) icone = <Icon nome="atencao" cor={cores.emergency} />;
                else if (relato.enviado_familia) icone = <Icon nome="feito" cor={cores.success} />;
              } else if (relato?.etapa === 'erro') {
                subtitulo = 'Não consegui organizar. Toque para tentar de novo';
                icone = <Icon nome="atencao" cor={cores.attention} />;
              } else {
                subtitulo = MENSAGEM_ETAPA[relato?.etapa ?? 'recebido'];
                icone = <Icon nome="relogio" cor={cores.secondaryLabel} />;
              }
              return (
                <ListRow
                  key={item.id}
                  titulo={[hora, duracao].filter(Boolean).join(', ')}
                  subtitulo={subtitulo.length > 120 ? `${subtitulo.slice(0, 117)}...` : subtitulo}
                  esquerda={icone}
                  onPress={() => router.push({ pathname: '/hoje/diario/[id]', params: { id: item.id } })}
                />
              );
            })}
          </ListGroup>
        </Section>
      ))}
    </Screen>
  );
}
