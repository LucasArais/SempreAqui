import { Stack } from 'expo-router';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function MemoriasLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Memórias' }} />
    </Stack>
  );
}
