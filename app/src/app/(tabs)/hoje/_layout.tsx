import { Stack } from 'expo-router';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function HojeLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Hoje' }} />
      <Stack.Screen name="semana" options={{ title: 'Esta semana' }} />
    </Stack>
  );
}
