import { Stack } from 'expo-router';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function FamiliaLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Família' }} />
      <Stack.Screen name="privacidade" options={{ title: 'Privacidade e dados' }} />
    </Stack>
  );
}
