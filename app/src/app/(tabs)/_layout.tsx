import { NativeTabs } from 'expo-router/native-tabs';

import { useTema } from '@/theme';

/** Tab bar nativa e translúcida com 5 abas: Hoje, Memórias, a Naomi (assistente, no meio), Família e Ajustes.
 * O nome é uma homenagem a Naomi Feil, criadora do método Validation (veja app/src/app/naomi.tsx). */
export default function Abas() {
  const { cores } = useTema();
  return (
    <NativeTabs tintColor={cores.accentStrong} disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="hoje">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
        <NativeTabs.Trigger.Label>Hoje</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="memorias">
        <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} md="auto_stories" />
        <NativeTabs.Trigger.Label>Memórias</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ajuda">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        <NativeTabs.Trigger.Label>Naomi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="familia">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>Família</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ajustes">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
