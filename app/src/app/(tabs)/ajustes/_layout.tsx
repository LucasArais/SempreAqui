import { Stack } from 'expo-router';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function AjustesLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Ajustes' }} />
    </Stack>
  );
}
