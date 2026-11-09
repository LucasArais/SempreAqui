import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { cores, fonte } from '@/tema';

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.azulEscuro,
          headerTitleStyle: { fontSize: fonte.destaque, fontWeight: '700' },
          headerShadowVisible: false,
          headerBackTitle: 'Voltar',
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="passaporte" options={{ title: 'Passaporte de Memória' }} />
        <Stack.Screen name="diario" options={{ title: 'Contar o dia' }} />
        <Stack.Screen name="reminiscencia" options={{ title: 'Conversa de lembranças' }} />
        <Stack.Screen name="semana" options={{ title: 'Resumo da semana' }} />
      </Stack>
    </>
  );
}
