import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon, ListGroup, ListRow, mostrarToast, Skeleton, Text } from '@/components';
import { api, type CampoEditavel, ErroApi } from '@/lib/api';
import { substituirRelato, useRelato } from '@/lib/diario';
import { haptic } from '@/lib/haptics';
import { atualizarCorrecoes, iaLocalPronta, reescreverResumoNoAparelho } from '@/lib/ia-local';
import { rotuloValor } from '@/lib/rotulos';
import { espaco, useTema } from '@/theme';

let camposEmCache: CampoEditavel[] | null = null;

/** Sheet de correção: um toque escolhe o valor certo, com "Desfazer" logo depois. */
export default function Corrigir() {
  const { cores, margem } = useTema();
  const { relato: relatoId, campo } = useLocalSearchParams<{ relato: string; campo: string }>();
  const { relato } = useRelato(relatoId);
  const [campos, setCampos] = useState<CampoEditavel[] | null>(camposEmCache);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (camposEmCache) return;
    api
      .campos()
      .then((lista) => {
        camposEmCache = lista;
        setCampos(lista);
      })
      .catch(() => setErro('Sem conexão agora. Tente corrigir quando a internet voltar.'));
  }, []);

  const definicao = campos?.find((c) => c.campo === campo);
  const atual = relato?.registro ? ler(relato.registro, campo) : undefined;

  async function escolher(valor: string) {
    if (!relato || valor === atual) {
      router.back();
      return;
    }
    setSalvando(valor);
    try {
      const { relato: novo, correcao_id } = await api.corrigir(relato.id, campo, valor);
      substituirRelato(novo);
      void atualizarCorrecoes();
      // Relato organizado no celular: o resumo é reescrito aqui, sem mandar o texto para a nuvem.
      if (novo.no_aparelho && iaLocalPronta()) {
        void reescreverResumoNoAparelho(novo)
          .then((r) => r && substituirRelato(r))
          .catch(() => undefined);
      }
      haptic.sucesso();
      router.back();
      mostrarToast(`${definicao?.rotulo ?? 'Campo'} corrigido para ${rotuloValor(valor).toLowerCase()}.`, {
        titulo: 'Desfazer',
        onPress: () => {
          api
            .desfazer(relato.id, correcao_id)
            .then(substituirRelato)
            .catch(() => mostrarToast('Não consegui desfazer agora. Tente de novo em instantes.'));
        },
      });
    } catch (e) {
      setSalvando(null);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui salvar. Quer tentar de novo?');
    }
  }

  return (
    <View style={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.s2 }}>
      <Text variante="title2" accessibilityRole="header">
        {definicao ? `Corrigir: ${definicao.rotulo.toLowerCase()}` : 'Corrigir'}
      </Text>
      <Text variante="callout" cor="secondaryLabel">
        A IA entendeu “{rotuloValor(atual)}”. Toque no que aconteceu de verdade.
      </Text>

      {erro && (
        <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }}>
          <Icon nome="atencao" cor={cores.attention} tamanho={16} />
          <Text variante="callout" cor="attention" style={{ flex: 1 }}>
            {erro}
          </Text>
        </View>
      )}

      {!campos && !erro && <Skeleton linhas={3} comTitulo={false} />}

      {definicao?.opcoes && (
        <ListGroup>
          {definicao.opcoes.map((opcao) => {
            const marcada = opcao === atual;
            return (
              <ListRow
                key={opcao}
                titulo={rotuloValor(opcao)}
                navega={false}
                onPress={() => escolher(opcao)}
                rotuloAcessivel={`${rotuloValor(opcao)}${marcada ? ', escolhido agora' : ''}`}
                direita={
                  salvando === opcao ? (
                    <Text variante="footnote" cor="secondaryLabel">
                      Salvando...
                    </Text>
                  ) : marcada ? (
                    <Icon nome="feito" cor={cores.accentStrong} />
                  ) : undefined
                }
              />
            );
          })}
        </ListGroup>
      )}
    </View>
  );
}

function ler(registro: object, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((atual, parte) => {
    if (atual && typeof atual === 'object') return (atual as Record<string, unknown>)[parte];
    return undefined;
  }, registro);
}
