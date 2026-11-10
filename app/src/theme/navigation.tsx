import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { HeaderPerfil } from '@/components/HeaderPerfil';
import { HeaderRecord } from '@/components/HeaderRecord';

import type { Cores } from './colors';
import { tipografia } from './typography';

type OpcoesStack = Exclude<NonNullable<ComponentProps<typeof Stack>['screenOptions']>, Function>;

const ios = Platform.OS === 'ios';
/** No iOS 26 o próprio sistema aplica o efeito de vidro na borda de rolagem. Blur manual só antes disso. */
const iosAntigo = ios && Number.parseInt(String(Platform.Version), 10) < 26;

/** Cabeçalho padrão das abas: large title que encolhe ao rolar e material translúcido no iOS. */
export function opcoesDeCabecalho(cores: Cores): OpcoesStack {
  return {
    headerLargeTitleEnabled: true,
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTransparent: ios,
    ...(iosAntigo ? { headerBlurEffect: 'systemMaterial' as const } : {}),
    ...(ios ? {} : { headerStyle: { backgroundColor: cores.background } }),
    headerTintColor: cores.accentStrong,
    headerTitleStyle: { ...fonte(tipografia.headline), color: cores.label },
    headerLargeTitleStyle: { ...fonte(tipografia.largeTitle), color: cores.label },
    headerBackButtonDisplayMode: 'minimal',
    headerRight: () => <HeaderRecord />,
    headerLeft: () => <HeaderPerfil />,
    contentStyle: { backgroundColor: cores.background },
  };
}

/** Só repassa as chaves definidas: fontFamily undefined vira fonte inválida no cabeçalho nativo. */
function fonte(estilo: { fontFamily?: string; fontWeight?: unknown; fontSize?: number }) {
  return {
    ...(estilo.fontFamily ? { fontFamily: estilo.fontFamily } : {}),
    ...(estilo.fontWeight ? { fontWeight: estilo.fontWeight as '400' | '600' | '700' } : {}),
    ...(estilo.fontSize ? { fontSize: estilo.fontSize } : {}),
  };
}
