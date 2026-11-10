import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { PrimaryButton, Section, Text } from '@/components';
import { useMargensSeguras } from '@/lib/insets';
import { espaco, useTema } from '@/theme';

const TERMOS = [
  ['Para que serve', 'O SempreAqui ajuda a organizar o cuidado em família. Você pode registrar relatos, compartilhar tarefas e guardar memórias. A IA organiza o que foi contado; ela pode errar e você deve conferir o resultado.'],
  ['Cuidados importantes', 'O app não faz diagnóstico, não recomenda remédios e não substitui a equipe de saúde. Em uma emergência, ligue 192.'],
  ['Sua conta', 'Use um e-mail seu, escolha uma senha segura e não compartilhe o acesso. Registre informações de outra pessoa apenas quando tiver autorização. O cadastro da conta não substitui o consentimento para guardar os relatos de saúde.'],
];
const PRIVACIDADE = [
  ['Dados da conta', 'Guardamos seu nome, e-mail e a data e versão do aceite dos termos. A senha é protegida pelo serviço de autenticação; o app não guarda a senha em texto. Nesta etapa, não pedimos confirmação por e-mail.'],
  ['Dados da família', 'Relatos, fotos e memórias são usados para organizar o cuidado. O registro de dados de saúde exige um consentimento separado no início do uso. Não vendemos os dados nem os usamos para propaganda.'],
  ['IA e compartilhamento', 'Quando disponível, a IA pode funcionar no próprio celular. Na nuvem, usamos provedores configurados para não guardar os dados nem os usar para treinamento. Quem tem acesso ao grupo da família vê os conteúdos compartilhados nele.'],
  ['Você decide', 'Em Ajustes, você encontra opções para baixar uma cópia dos dados da família ou apagá-los. O consentimento para dados de saúde pode ser revogado.'],
];

export default function DocumentoConta() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const { cores, margem } = useTema();
  const { topo, base } = useMargensSeguras();
  const privacidade = tipo === 'privacidade';
  return (
    <ScrollView style={{ flex: 1, backgroundColor: cores.background }} contentContainerStyle={{ paddingHorizontal: margem, paddingTop: topo + espaco.s3, paddingBottom: base + espaco.s3, gap: espaco.secao }}>
      <Text variante="largeTitle" accessibilityRole="header">{privacidade ? 'Política de Privacidade' : 'Termos de Uso'}</Text>
      <Text variante="footnote" cor="secondaryLabel">Versão 1 · novembro de 2026</Text>
      {(privacidade ? PRIVACIDADE : TERMOS).map(([titulo, texto]) => <Section key={titulo} titulo={titulo}><Text>{texto}</Text></Section>)}
      <PrimaryButton titulo="Voltar" onPress={() => router.back()} />
    </ScrollView>
  );
}
