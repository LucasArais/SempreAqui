import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  Coluna,
  EmptyState,
  mostrarToast,
  PrimaryButton,
  RelatoView,
  Screen,
  SecondaryButton,
  Skeleton,
  Text,
} from '@/components';
import { api } from '@/lib/api';
import { acompanhar, removerRelatoLocal, substituirRelato, sincronizar, useRelato } from '@/lib/diario';
import { haptic } from '@/lib/haptics';
import { formatarData, MENSAGEM_ETAPA } from '@/lib/rotulos';

/** Um relato do histórico: resultado completo, editável, com áudio e transcrição. */
export default function RelatoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { relato, pendente } = useRelato(id);
  const [tentando, setTentando] = useState(false);
  const emAndamento = relato && !['pronto', 'erro'].includes(relato.etapa);

  useEffect(() => {
    if (emAndamento) void acompanhar(id);
  }, [emAndamento, id]);

  const titulo = formatarData(relato?.gravado_em ?? pendente?.gravado_em ?? new Date().toISOString());

  async function tentarDeNovo() {
    setTentando(true);
    try {
      substituirRelato(await api.tentarDeNovo(id));
      await acompanhar(id);
    } catch {
      mostrarToast('Não consegui agora. Tente de novo em instantes.');
    } finally {
      setTentando(false);
    }
  }

  function apagar() {
    // Apagar dados é o único caso em que pedimos confirmação antes.
    Alert.alert('Apagar este relato?', 'O áudio, a transcrição e o resumo somem para toda a família.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.apagar(id);
            removerRelatoLocal(id);
            haptic.sucesso();
            router.back();
            mostrarToast('Relato apagado.');
          } catch {
            mostrarToast('Não consegui apagar agora. Tente de novo em instantes.');
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: titulo, headerLargeTitleEnabled: false }} />

      {pendente && (
        <EmptyState
          icone="nuvem"
          titulo="Guardado no celular"
          texto="Este relato ainda não foi enviado. Ele vai sozinho quando a internet voltar."
        >
          <SecondaryButton titulo="Tentar enviar agora" onPress={() => void sincronizar()} />
        </EmptyState>
      )}

      {emAndamento && (
        <Coluna gap="s2">
          <Text variante="title2" accessibilityLiveRegion="polite">
            {MENSAGEM_ETAPA[relato.etapa]}
          </Text>
          <Skeleton linhas={3} />
        </Coluna>
      )}

      {relato?.etapa === 'erro' && (
        <EmptyState icone="atencao" titulo="Não consegui organizar este relato" texto={relato.erro ?? undefined}>
          <PrimaryButton titulo={tentando ? 'Tentando...' : 'Tentar de novo'} desativado={tentando} onPress={tentarDeNovo} />
        </EmptyState>
      )}

      {relato?.etapa === 'pronto' && (
        <>
          <RelatoView relato={relato} />
          {relato.enviado_familia ? (
            <Text variante="footnote" cor="secondaryLabel" centro>
              Enviado para a família.
            </Text>
          ) : (
            <PrimaryButton
              titulo="Enviar para a família"
              icone="seguir"
              onPress={async () => {
                try {
                  substituirRelato(await api.enviarParaFamilia(relato.id));
                  haptic.sucesso();
                  mostrarToast('Enviado para a família.');
                } catch {
                  mostrarToast('Não consegui enviar agora. Tente de novo em instantes.');
                }
              }}
            />
          )}
        </>
      )}

      {relato && <SecondaryButton titulo="Apagar este relato" icone="lixeira" onPress={apagar} />}
    </Screen>
  );
}
