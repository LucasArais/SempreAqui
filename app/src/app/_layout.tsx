import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { ToastHost } from '@/components';
import { Abertura } from '@/components/Abertura';
import { sincronizar } from '@/lib/diario';
import * as Notifications from 'expo-notifications';

import * as Network from 'expo-network';
import { atualizarDados } from '@/lib/carregamento';
import { CarregamentoSessao } from '@/components/CarregamentoSessao';
import { carregarIaLocal } from '@/lib/ia-local';
import { entrar } from '@/lib/entrar';
import { sessaoAtual, useSessao } from '@/lib/sessao';
import { useTema } from '@/theme';

// A tela de abertura nativa fica até a animação em JS assumir, sem piscar.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Os modais (gravar, corrigir, onboarding) sempre abrem por cima das abas.
export const unstable_settings = { anchor: 'index' };

// Lembretes de tarefa aparecem mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function Raiz() {
  const { cores, escuro } = useTema();
  const sessao = useSessao();
  // Inter só no Android. No iOS a fonte do sistema (SF Pro) já é o padrão.
  const [fontesProntas] = useFonts(
    Platform.OS === 'android' ? { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } : {},
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(cores.background).catch(() => {});
  }, [cores.background]);

  useEffect(() => {
    void entrar();
  }, []);

  useEffect(() => {
    if (!sessao.pronta) return;
    // A checagem da IA nunca bloqueia os dados da família.
    void atualizarDados();
    void carregarIaLocal().then(sincronizar).catch(() => undefined);
  }, [sessao.pronta, sessao.usuario]);

  useEffect(() => {
    const atualizar = () => {
      const atual = sessaoAtual();
      if (atual.pronta) void atualizarDados();
      else if (atual.token) void entrar();
    };
    let anterior = AppState.currentState;
    const app = AppState.addEventListener('change', (atual) => {
      if (atual === 'active' && anterior !== 'active') atualizar();
      anterior = atual;
    });
    let estavaOnline: boolean | null = null;
    const rede = Network.addNetworkStateListener((atual) => {
      const online = atual.isInternetReachable ?? atual.isConnected ?? false;
      if (online && estavaOnline !== true) atualizar();
      estavaOnline = online;
    });
    return () => { app.remove(); rede.remove(); };
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
      {(!sessao.restaurada || (sessao.token && !sessao.pronta)) ? <CarregamentoSessao /> : <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.background } }}>
        <Stack.Protected guard={!sessao.pronta}>
          <Stack.Screen name="entrar" />
          <Stack.Screen name="criar-conta" />
        </Stack.Protected>
        <Stack.Protected guard={sessao.pronta}>
        <Stack.Screen name="index" />
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
        <Stack.Screen name="sus" options={{ presentation: 'modal', headerShown: true, title: 'SUS', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="perto" options={{ presentation: 'modal', headerShown: true, title: 'Perto de você', headerLargeTitleEnabled: false }} />
        <Stack.Screen name="convite/index" options={{ presentation: 'modal', title: 'Convite' }} />
        <Stack.Screen name="convite/[codigo]" options={{ presentation: 'modal', title: 'Convite' }} />
        </Stack.Protected>
        <Stack.Screen name="documento-conta" options={{ presentation: 'modal' }} />
      </Stack>}
      <ToastHost />
      {abrindo && <Abertura aoTerminar={terminarAbertura} />}
    </ThemeProvider>
  );
}
