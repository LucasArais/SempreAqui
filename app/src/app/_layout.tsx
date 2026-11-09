import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ToastHost } from '@/components';
import { iniciarDiario } from '@/lib/diario';
import { entrar } from '@/lib/entrar';
import { useTema } from '@/theme';

// Os modais (gravar, corrigir, onboarding) sempre abrem por cima das abas.
export const unstable_settings = { anchor: '(tabs)' };

export default function Raiz() {
  const { cores, escuro } = useTema();
  // Inter só no Android. No iOS a fonte do sistema (SF Pro) já é o padrão.
  const [fontesProntas] = useFonts(
    Platform.OS === 'android' ? { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } : {},
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(cores.background).catch(() => {});
  }, [cores.background]);

  useEffect(() => {
    void entrar().then(iniciarDiario);
  }, []);

  if (Platform.OS === 'android' && !fontesProntas) return null;

  const base = escuro ? DarkTheme : DefaultTheme;
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      primary: cores.accentStrong,
      background: cores.background,
      card: cores.background,
      text: cores.label,
      border: cores.separator,
    },
  };

  return (
    <ThemeProvider value={tema}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="gravar"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1],
            sheetCornerRadius: 24,
            contentStyle: { backgroundColor: cores.background },
          }}
        />
        <Stack.Screen
          name="nova-memoria"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="corrigir"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="sessao" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="termo" options={{ presentation: 'modal' }} />
      </Stack>
      <ToastHost />
    </ThemeProvider>
  );
}
