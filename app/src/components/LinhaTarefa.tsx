import { useState } from 'react';
import { Pressable } from 'react-native';

import { ErroApi } from '@/lib/api';
import { assumirTarefa, concluirTarefa, meuNome, quandoEmPalavras, type Tarefa } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Icon } from './Icon';
import { ListRow } from './ListRow';
import { Text } from './Text';
import { mostrarToast } from './Toast';

/** Uma tarefa: sem responsável, "Eu assumo" em um toque; minha, marcar como feita. */
export function LinhaTarefa({ tarefa }: { tarefa: Tarefa }) {
  const { cores } = useTema();
  const [ocupado, setOcupado] = useState(false);
  const minha = !!tarefa.responsavel_nome && tarefa.responsavel_nome === meuNome();
  const livre = !tarefa.responsavel_nome;

  async function agir(acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(true);
    try {
      await acao();
      haptic.sucesso();
      mostrarToast(mensagem);
    } catch (e) {
      mostrarToast(e instanceof ErroApi ? e.message : 'Não consegui agora. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ListRow
      titulo={tarefa.titulo}
      subtitulo={`${livre ? 'Ninguém assumiu ainda' : tarefa.responsavel_nome}. ${quandoEmPalavras(tarefa.quando)}`}
      riscado={tarefa.concluida}
      navega={false}
      esquerda={
        <Icon nome={tarefa.concluida ? 'feito' : livre ? 'mao' : 'pendente'} cor={tarefa.concluida ? cores.success : livre ? cores.attention : cores.tertiaryLabel} />
      }
      direita={
        livre && !tarefa.concluida ? (
          <Pressable
            onPress={() => agir(() => assumirTarefa(tarefa.id), 'Obrigado! Você vai receber um lembrete.')}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={`Eu assumo: ${tarefa.titulo}`}
            style={{ minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.s2, borderRadius: raio.botao, backgroundColor: cores.accent, justifyContent: 'center' }}
          >
            <Text variante="callout" style={{ color: cores.onAccent, fontWeight: '600' }}>
              {ocupado ? '...' : 'Eu assumo'}
            </Text>
          </Pressable>
        ) : undefined
      }
      onPress={
        !livre && !tarefa.concluida
          ? () => agir(() => concluirTarefa(tarefa.id, true), 'Feito! A família vai ver no feed.')
          : tarefa.concluida
            ? () => agir(() => concluirTarefa(tarefa.id, false), 'Tarefa reaberta.')
            : undefined
      }
      rotuloAcessivel={`${tarefa.titulo}. ${livre ? 'Ninguém assumiu ainda' : tarefa.responsavel_nome}. ${quandoEmPalavras(tarefa.quando)}. ${tarefa.concluida ? 'Feita' : 'Pendente'}`}
      dica={livre ? undefined : tarefa.concluida ? 'Toque para reabrir' : minha ? 'Toque quando terminar' : 'Toque para marcar como feita'}
    />
  );
}

