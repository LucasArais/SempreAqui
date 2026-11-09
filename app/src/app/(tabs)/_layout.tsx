import { NativeTabs } from 'expo-router/native-tabs';

import { useTema } from '@/theme';

/** Tab bar nativa e translúcida com 4 abas: Hoje, Memórias, Família, Ajuda. */
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
      <NativeTabs.Trigger name="familia">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>Família</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ajuda">
        <NativeTabs.Trigger.Icon sf="lifepreserver" md="support" />
        <NativeTabs.Trigger.Label>Ajuda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
