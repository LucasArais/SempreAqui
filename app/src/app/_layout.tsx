import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ToastHost } from '@/components';
import { Abertura } from '@/components/Abertura';
import { iniciarDiario } from '@/lib/diario';
import * as Notifications from 'expo-notifications';

import { carregarConversa } from '@/lib/conversa';
import { carregarFamilia } from '@/lib/familia';
import { carregarIaLocal } from '@/lib/ia-local';
import { carregarPassaporte } from '@/lib/passaporte';
import { entrar } from '@/lib/entrar';
import { useTema } from '@/theme';

// A tela de abertura nativa fica até a animação em JS assumir, sem piscar.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Os modais (gravar, corrigir, onboarding) sempre abrem por cima das abas.
export const unstable_settings = { anchor: '(tabs)' };

// Lembretes de tarefa aparecem mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

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
    // A IA do celular carrega antes da fila: relatos que ficaram no meio são organizados aqui.
    void entrar()
      .then(carregarIaLocal)
      .then(() => {
        void carregarPassaporte();
        void carregarConversa();
        void carregarFamilia();
        return iniciarDiario();
      });
  }, []);

  const [abrindo, setAbrindo] = useState(true);
  const terminarAbertura = useCallback(() => setAbrindo(false), []);
  useEffect(() => {
    // A animação já está montada por cima: pode esconder a tela nativa.
    SplashScreen.hideAsync().catch(() => undefined);
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
          name="nova-tarefa"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1],
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="eu"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1],
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="contar-memoria"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1],
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="editar-memoria"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.6, 1],
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
        <Stack.Screen name="ajustes" options={{ presentation: 'modal', headerShown: true, title: 'Ajustes', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="convite/index" options={{ presentation: 'modal', title: 'Convite' }} />
        <Stack.Screen name="convite/[codigo]" options={{ presentation: 'modal', title: 'Convite' }} />
      </Stack>
      <ToastHost />
      {abrindo && <Abertura aoTerminar={terminarAbertura} />}
    </ThemeProvider>
  );
}
