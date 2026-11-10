import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Coluna, Icon, PrimaryButton, Text } from '@/components';
import { ErroApi } from '@/lib/api';
import { criarTarefa, type Tarefa } from '@/lib/familia';
import { haptic } from '@/lib/haptics';
import { espaco, raio, tamanho, tipografia, useTema } from '@/theme';

const TIPOS: { id: Tarefa['tipo']; rotulo: string; exemplo: string }[] = [
  { id: 'cobrir_folga', rotulo: 'Cobrir uma folga', exemplo: 'Ficar com ela no sábado à tarde' },
  { id: 'visita', rotulo: 'Visita ou ligação', exemplo: 'Ligar por vídeo de manhã' },
  { id: 'consulta', rotulo: 'Consulta', exemplo: 'Levar na consulta da UBS' },
  { id: 'compra', rotulo: 'Compra', exemplo: 'Comprar fraldas e lenços' },
  { id: 'outro', rotulo: 'Outra coisa', exemplo: 'Pagar a conta de luz' },
];

/** Próximos 7 dias, para escolher com um toque. */
function proximosDias() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const rotulo = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return { data: d, rotulo: rotulo[0].toUpperCase() + rotulo.slice(1) };
  });
}

const PERIODOS = [
  { rotulo: 'Manhã', hora: 9 },
  { rotulo: 'Tarde', hora: 14 },
  { rotulo: 'Noite', hora: 19 },
];

/** Nova tarefa da família em poucos toques: o quê, quando e se é para mim ou para quem puder. */
export default function NovaTarefa() {
  const { cores, margem } = useTema();
  const params = useLocalSearchParams<{ tipo?: Tarefa['tipo'] }>();
  const [tipo, setTipo] = useState<Tarefa['tipo']>(params.tipo ?? 'cobrir_folga');
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState(params.tipo === 'cobrir_folga' ? 5 : 0);
  const [periodo, setPeriodo] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dias = proximosDias();
  const exemplo = TIPOS.find((t) => t.id === tipo)?.exemplo ?? '';

  async function salvar(paraMim: boolean) {
    const quando = new Date(dias[dia].data);
    quando.setHours(PERIODOS[periodo].hora, 0, 0, 0);
    setSalvando(true);
    try {
      await criarTarefa({ titulo: titulo.trim() || exemplo, tipo, quando: quando.toISOString(), paraMim });
      haptic.sucesso();
      router.back();
    } catch (e) {
      setSalvando(false);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui salvar agora.');
    }
  }

  const chip = (ativo: boolean) => ({
    minHeight: tamanho.toqueMinimo,
    paddingHorizontal: espaco.s2,
    borderRadius: raio.botao,
    borderCurve: 'continuous' as const,
    backgroundColor: ativo ? cores.accentSoft : cores.secondaryBackground,
    borderWidth: 2,
    borderColor: ativo ? cores.accentStrong : 'transparent',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.s3 }}>
      <Text variante="title2" accessibilityRole="header">
        Nova tarefa da família
      </Text>

      <Coluna gap="s1">
        <Text variante="footnote" cor="secondaryLabel">
          O que é
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s1 }} accessibilityRole="radiogroup">
          {TIPOS.map((t) => (
            <Pressable key={t.id} onPress={() => { haptic.selecao(); setTipo(t.id); }} accessibilityRole="radio" accessibilityState={{ checked: tipo === t.id }} style={chip(tipo === t.id)}>
              <Text variante="callout">{t.rotulo}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={titulo}
          onChangeText={setTitulo}
          placeholder={exemplo}
          placeholderTextColor={cores.tertiaryLabel}
          accessibilityLabel="Descrição da tarefa"
          style={[tipografia.body, { color: cores.label, backgroundColor: cores.secondaryBackground, borderRadius: raio.card, paddingHorizontal: espaco.s2, minHeight: 48 }]}
        />
      </Coluna>

      <Coluna gap="s1">
        <Text variante="footnote" cor="secondaryLabel">
          Quando
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.s1 }}>
          {dias.map((d, i) => (
            <Pressable key={d.rotulo + i} onPress={() => { haptic.selecao(); setDia(i); }} accessibilityRole="radio" accessibilityState={{ checked: dia === i }} style={chip(dia === i)}>
              <Text variante="callout">{d.rotulo}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: espaco.s1 }}>
          {PERIODOS.map((p, i) => (
            <Pressable key={p.rotulo} onPress={() => { haptic.selecao(); setPeriodo(i); }} accessibilityRole="radio" accessibilityState={{ checked: periodo === i }} style={[chip(periodo === i), { flex: 1 }]}>
              <Text variante="callout">{p.rotulo}</Text>
            </Pressable>
          ))}
        </View>
      </Coluna>

      {erro && (
        <Text variante="callout" cor="emergency">
          {erro}
        </Text>
      )}

      <Coluna gap="s1">
        <PrimaryButton titulo={salvando ? 'Salvando...' : 'Pedir para a família'} icone="familia" desativado={salvando} dica="Aparece para todos; quem puder assume com um toque" onPress={() => salvar(false)} />
        <Pressable onPress={() => salvar(true)} disabled={salvando} accessibilityRole="button" style={{ minHeight: tamanho.toqueMinimo, flexDirection: 'row', gap: espaco.s1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon nome="feito" cor={cores.accentStrong} tamanho={18} />
          <Text variante="callout" style={{ color: cores.accentStrong }}>
            Fica comigo
          </Text>
        </Pressable>
      </Coluna>
    </ScrollView>
  );
}
