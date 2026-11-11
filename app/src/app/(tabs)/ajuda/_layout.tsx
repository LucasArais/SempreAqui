import { Stack } from 'expo-router';

import { Header192 } from '@/components/Header192';
import { TituloNaomi } from '@/components/TituloNaomi';

import { useTema } from '@/theme';
import { opcoesDeCabecalho } from '@/theme/navigation';

export default function AjudaLayout() {
  const { cores } = useTema();
  return (
    <Stack screenOptions={opcoesDeCabecalho(cores)}>
      <Stack.Screen name="index" options={{ title: 'Naomi', headerTitle: () => <TituloNaomi />, headerLargeTitleEnabled: false, headerRight: () => <Header192 /> }} />
    </Stack>
  );
}
