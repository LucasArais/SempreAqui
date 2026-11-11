import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AvisoNaomi } from '@/lib/ajudante';
import { api } from '@/lib/api';
import { espaco } from '@/theme';

import { SecondaryButton } from './Buttons';
import { Card } from './Card';
import { Section } from './Layout';
import { NaomiAvatar } from './NaomiAvatar';
import { Text } from './Text';

const ACOES: Record<NonNullable<AvisoNaomi['acao']>, { titulo: string; ir: () => void }> = {
  ver_semana: { titulo: 'Ver a semana', ir: () => router.push('/hoje/semana') },
  nova_tarefa: { titulo: 'Pedir ajuda com uma tarefa', ir: () => router.push('/nova-tarefa') },
  ver_passaporte: { titulo: 'Abrir o Passaporte', ir: () => router.push('/memorias') },
};

// Guardado entre visitas à tela, para o cartão não piscar. O servidor refaz quando chega relato novo.
let ultimos: AvisoNaomi[] = [];

/**
 * "A Naomi percebeu": padrões que a IA achou sozinha nos relatos do último mês, cada um
 * sustentado por pelo menos 3 relatos (backend/core/avisos.py). Some quando não há padrão.
 */
export function AvisosNaomi({ chave }: { chave: string }) {
  const [avisos, setAvisos] = useState<AvisoNaomi[]>(ultimos);
  useEffect(() => {
    let vivo = true;
    api
      .avisosDaNaomi()
      .then((r) => {
        ultimos = r.avisos;
        if (vivo) setAvisos(r.avisos);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [chave]);

  if (!avisos.length) return null;
  return (
    <Section titulo="A Naomi percebeu">
      <View style={{ gap: espaco.s1 + espaco.meio }}>
        {avisos.map((a) => {
          const acao = a.acao ? ACOES[a.acao] : null;
          return (
            <Card key={a.titulo}>
              <View style={{ flexDirection: 'row', gap: espaco.s1 + espaco.meio, alignItems: 'flex-start' }}>
                <NaomiAvatar tamanho={32} />
                <View style={{ flex: 1, gap: espaco.meio }}>
                  <Text variante="headline">{a.titulo}</Text>
                  <Text variante="body">{a.texto}</Text>
                  <Text variante="footnote" cor="secondaryLabel">
                    {`✨ Visto em ${a.evidencias.length} relatos do último mês`}
                  </Text>
                </View>
              </View>
              {acao && <SecondaryButton titulo={acao.titulo} alinhamento="inicio" onPress={acao.ir} />}
            </Card>
          );
        })}
      </View>
    </Section>
  );
}
