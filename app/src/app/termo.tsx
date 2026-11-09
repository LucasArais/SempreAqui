import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { Coluna, Logo, PrimaryButton, Section, Text } from '@/components';
import { espaco, useTema } from '@/theme';

const SECOES = [
  {
    titulo: 'O que guardamos',
    texto:
      'Os áudios que você grava, a transcrição, o registro organizado (sono, alimentação, humor, agitação, remédios e observações), o resumo para a família e as correções que você fizer. Também guardamos números anônimos de uso, sem nenhum conteúdo, para melhorar o app.',
  },
  {
    titulo: 'Para que usamos',
    texto:
      'Só para organizar o cuidado e mostrar à sua família como foi o dia e a semana. Não vendemos, não usamos para propaganda e não compartilhamos com ninguém fora do grupo da família.',
  },
  {
    titulo: 'Quem vê',
    texto:
      'Somente as pessoas que você convidar para o grupo da família. Cada família fica isolada das outras no banco de dados.',
  },
  {
    titulo: 'A inteligência artificial',
    texto:
      'Um modelo de IA transcreve o áudio e organiza o relato. Usamos apenas provedores que não guardam os dados nem os usam para treinar modelos. A IA não faz diagnóstico nem orienta remédios: quem interpreta é a equipe de saúde.',
  },
  {
    titulo: 'Seus direitos',
    texto:
      'Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir uma cópia de tudo, corrigir o que estiver errado, revogar este consentimento e apagar todos os dados da família a qualquer momento, pelo próprio app.',
  },
];

/** Termo de consentimento em linguagem simples, sem letras miúdas. */
export default function Termo() {
  const { cores, margem } = useTema();
  return (
    <ScrollView
      style={{ backgroundColor: cores.background }}
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.secao }}
    >
      <Coluna gap="s1">
        <Logo tamanho={56} />
        <Text variante="largeTitle" accessibilityRole="header">
          Termo de uso dos dados
        </Text>
        <Text variante="callout" cor="secondaryLabel">
          Versão 1, novembro de 2026. Escrito para ser lido inteiro em 2 minutos.
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
