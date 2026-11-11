import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { Coluna, Logo, PrimaryButton, Section, Text } from '@/components';
import { espaco, useTema } from '@/theme';

const SECOES = [
  {
    titulo: 'Quem foi Naomi Feil',
    texto:
      'Assistente social e gerontóloga, nasceu em Munique em 1932. Em 1937 a família deixou a Alemanha nazista e foi para os Estados Unidos. A partir dos 8 anos, Naomi cresceu dentro de um lar de idosos em Cleveland, o Montefiore Home: o pai era o administrador e a mãe cuidava do serviço social. Os moradores eram seus vizinhos e amigos.',
  },
  {
    titulo: 'O que ela ensinou',
    texto:
      'Depois de se formar em serviço social na Universidade Columbia, voltou a trabalhar no mesmo lar. Ali percebeu que corrigir a pessoa desorientada ("sua mãe já morreu", "hoje não é segunda") só trazia mais angústia. Entre 1963 e 1980 criou o método Validation: em vez de trazer a pessoa para a nossa realidade, acolher o sentimento por trás do que ela diz, com respeito e empatia.',
  },
  {
    titulo: 'O legado',
    texto:
      'Escreveu "Validation: The Feil Method" (1982) e "The Validation Breakthrough" (1993), e fundou o Validation Training Institute, que formou profissionais no mundo todo. Morreu em 24 de dezembro de 2023, aos 91 anos.',
  },
  {
    titulo: 'Por que a nossa assistente tem o nome dela',
    texto:
      'Porque é assim que a Naomi do SempreAqui tenta ajudar: na hora difícil, primeiro acolher, depois mostrar o que costuma funcionar com quem você cuida. O nome é uma homenagem. O SempreAqui não tem ligação com o Validation Training Institute.',
  },
];

/** A inspiração do nome da assistente: Naomi Feil, criadora do método Validation. */
export default function PorQueNaomi() {
  const { cores, margem } = useTema();
  return (
    <ScrollView
      style={{ backgroundColor: cores.background }}
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.secao }}
    >
      <Coluna gap="s1">
        <Logo tamanho={56} />
        <Text variante="largeTitle" accessibilityRole="header">
          Por que Naomi?
        </Text>
        <Text variante="callout" cor="secondaryLabel">
          Uma homenagem a Naomi Feil (1932 a 2023), que ensinou o mundo a acolher em vez de corrigir.
        </Text>
      </Coluna>
      {SECOES.map((s) => (
        <Section key={s.titulo} titulo={s.titulo}>
          <Text variante="body">{s.texto}</Text>
        </Section>
      ))}
      <PrimaryButton titulo="Entendi" onPress={() => router.back()} />
    </ScrollView>
  );
}
