import { Stack } from 'expo-router';

import { Header192 } from '@/components/Header192';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function AjudaLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Ajudante', headerLargeTitleEnabled: false, headerRight: () => <Header192 /> }} />
    </Stack>
  );
}
