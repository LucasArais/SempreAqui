import { Stack } from 'expo-router';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function HojeLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      {/* Na tela Hoje o botão grande já grava; o microfone do cabeçalho seria repetido. */}
      <Stack.Screen name="index" options={{ title: 'Hoje', headerRight: undefined }} />
      <Stack.Screen name="semana" options={{ title: 'Esta semana' }} />
      <Stack.Screen name="diario/index" options={{ title: 'Diário' }} />
      <Stack.Screen name="diario/[id]" options={{ title: 'Relato' }} />
    </Stack>
  );
}
