import { useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ErroApi } from '@/lib/api';
import { assumirTarefa, concluirTarefa, largarTarefa, quandoEmPalavras, type Tarefa } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, useTema } from '@/theme';

import { Icon } from './Icon';
import { ListRow } from './ListRow';
import { Text } from './Text';
import { mostrarToast } from './Toast';

/**
 * Uma tarefa da família, com a ação certa à vista:
 * - livre: "Eu assumo";
 * - minha: "Concluir" (e, tocando na linha, desistir);
 * - de outra pessoa: tocando, marcar como feita ou assumir no lugar, com confirmação;
 * - feita: tocando, reabrir.
 */
export function LinhaTarefa({ tarefa }: { tarefa: Tarefa }) {
  const { cores } = useTema();
  const [ocupado, setOcupado] = useState(false);
  const livre = !tarefa.responsavel_nome;
  const minha = tarefa.minha;

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

  const assumir = () => agir(() => assumirTarefa(tarefa.id), 'Obrigado! Você vai receber um lembrete.');
  const concluir = () => agir(() => concluirTarefa(tarefa.id, true), 'Feito! A família vai ver no feed.');

  function opcoes() {
    if (tarefa.concluida) {
      Alert.alert(tarefa.titulo, 'Essa tarefa já foi feita.', [
        { text: 'Reabrir', onPress: () => void agir(() => concluirTarefa(tarefa.id, false), 'Tarefa reaberta.') },
        { text: 'Fechar', style: 'cancel' },
      ]);
    } else if (minha) {
      Alert.alert(tarefa.titulo, 'Essa tarefa está com você.', [
        { text: 'Concluir', onPress: () => void concluir() },
        { text: 'Não vou conseguir', style: 'destructive', onPress: () => void agir(() => largarTarefa(tarefa.id), 'A tarefa voltou para a família.') },
        { text: 'Fechar', style: 'cancel' },
      ]);
    } else if (!livre) {
      Alert.alert(tarefa.titulo, `Está com ${tarefa.responsavel_nome}.`, [
        { text: 'Marcar como feita', onPress: () => void concluir() },
        { text: 'Assumir no meu lugar', onPress: () => void assumir() },
        { text: 'Fechar', style: 'cancel' },
      ]);
    }
  }

  const quem = livre ? 'Ninguém assumiu ainda' : minha ? 'Com você' : `Com ${tarefa.responsavel_nome}`;
  const botao = !tarefa.concluida && (livre || minha) && (
    <Pressable
      onPress={livre ? assumir : concluir}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={livre ? `Eu assumo: ${tarefa.titulo}` : `Concluir: ${tarefa.titulo}`}
      style={{
        minHeight: tamanho.toqueMinimo,
        paddingHorizontal: espaco.s2,
        borderRadius: raio.botao,
        backgroundColor: livre ? cores.accent : 'transparent',
        borderWidth: livre ? 0 : 1.5,
        borderColor: cores.success,
        justifyContent: 'center',
      }}
    >
      <Text variante="callout" style={{ color: livre ? cores.onAccent : cores.success, fontWeight: '600' }}>
        {ocupado ? '...' : livre ? 'Eu assumo' : 'Concluir'}
      </Text>
    </Pressable>
  );

  return (
    <ListRow
      titulo={tarefa.titulo}
      subtitulo={`${quem}. ${quandoEmPalavras(tarefa.quando)}`}
      riscado={tarefa.concluida}
      navega={false}
      esquerda={
        <Icon
          nome={tarefa.concluida ? 'feito' : livre ? 'mao' : minha ? 'relogio' : 'pendente'}
          cor={tarefa.concluida ? cores.success : livre ? cores.attention : minha ? cores.accentStrong : cores.tertiaryLabel}
        />
      }
      direita={botao || undefined}
      onPress={livre ? undefined : opcoes}
      rotuloAcessivel={`${tarefa.titulo}. ${quem}. ${quandoEmPalavras(tarefa.quando)}. ${tarefa.concluida ? 'Feita' : 'Pendente'}`}
      dica={tarefa.concluida ? 'Toque para reabrir' : minha ? 'Toque para mais opções' : livre ? undefined : 'Toque para marcar como feita ou assumir'}
    />
  );
}
