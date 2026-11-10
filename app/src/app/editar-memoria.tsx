import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Coluna, mostrarToast, PrimaryButton, SecondaryButton, Text } from '@/components';
import { ErroApi } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import {
  apagarItem,
  type ItemDe,
  novoId,
  passaporteAtual,
  salvarItem,
  salvarPassaporte,
  SECOES,
  type SecaoLista,
} from '@/lib/passaporte';
import { espaco, raio, tipografia, useTema } from '@/theme';

type SecaoTexto = 'perfil' | 'quem_ela' | 'como_se_comunica';

type Campo = { chave: string; rotulo: string; exemplo: string; longo?: boolean; teclado?: 'number-pad' | 'url' };

/** Campos de cada tipo de item. A lista é curta de propósito: título e um detalhe opcional. */
function camposDe(secao: SecaoLista | SecaoTexto): Campo[] {
  switch (secao) {
    case 'perfil':
      return [
        { chave: 'como_gosta_de_ser_chamada', rotulo: 'Como gosta de ser chamada', exemplo: 'Dona Isabel' },
        { chave: 'nome', rotulo: 'Nome', exemplo: 'Isabel' },
        { chave: 'idade', rotulo: 'Idade', exemplo: '81', teclado: 'number-pad' },
      ];
    case 'quem_ela':
      return [{ chave: 'quem_ela', rotulo: 'Quem ela é', exemplo: 'O que fazia, do que gosta, o jeito dela', longo: true }];
    case 'como_se_comunica':
      return [{ chave: 'como_se_comunica', rotulo: 'Como se comunica', exemplo: 'Frases curtas, uma coisa de cada vez', longo: true }];
    case 'pessoas_importantes':
      return [
        { chave: 'nome', rotulo: 'Quem é', exemplo: 'A irmã mais nova' },
        { chave: 'relacao', rotulo: 'O que essa pessoa é para ela', exemplo: 'Mora em Campinas, ligam aos domingos', longo: true },
      ];
    case 'musicas':
      return [
        { chave: 'titulo', rotulo: 'Música', exemplo: 'Detalhes' },
        { chave: 'artista', rotulo: 'Quem canta', exemplo: 'Roberto Carlos' },
        { chave: 'link', rotulo: 'Link do YouTube (opcional)', exemplo: 'https://youtube.com/...', teclado: 'url' },
      ];
    default:
      return [
        { chave: 'titulo', rotulo: 'O quê', exemplo: SECOES[secao].exemplo },
        { chave: 'detalhe', rotulo: 'Detalhe (opcional)', exemplo: 'Um jeito, um horário, uma história', longo: true },
      ];
  }
}

const SECOES_TEXTO: Record<SecaoTexto, string> = {
  perfil: 'Sobre ela',
  quem_ela: 'Quem ela é',
  como_se_comunica: 'Como se comunica',
};

/** Sheet para criar, editar ou apagar um item do Passaporte de Memória. */
export default function EditarMemoria() {
  const { cores, margem } = useTema();
  const { secao, id } = useLocalSearchParams<{ secao: SecaoLista | SecaoTexto; id?: string }>();
  const ehTexto = secao in SECOES_TEXTO;
  const passaporte = passaporteAtual();
  const existente = !ehTexto && id ? (passaporte[secao as SecaoLista] as Record<string, unknown>[]).find((i) => i.id === id) : undefined;
  const campos = camposDe(secao);
  const origem: Record<string, unknown> = ehTexto ? (passaporte as unknown as Record<string, unknown>) : (existente ?? {});
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.chave, origem[c.chave] == null ? '' : String(origem[c.chave])])),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = ehTexto ? SECOES_TEXTO[secao as SecaoTexto] : existente ? 'Editar' : SECOES[secao as SecaoLista].novo;
  const obrigatorio = campos[0].chave;
  const podeSalvar = ehTexto || valores[obrigatorio].trim().length > 0;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const limpos = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() || null]));
    try {
      if (ehTexto) {
        const idade = limpos.idade ? Number(limpos.idade) : null;
        await salvarPassaporte({
          ...passaporte,
          ...Object.fromEntries(Object.entries(limpos).map(([k, v]) => [k, v ?? ''])),
          ...(secao === 'perfil' ? { idade: Number.isFinite(idade) ? idade : null } : {}),
        });
      } else {
        const item = { ...(existente ?? {}), ...limpos, id: id ?? novoId(String(secao).slice(0, 3)) } as ItemDe<SecaoLista>;
        await salvarItem(secao as SecaoLista, item);
      }
      haptic.sucesso();
      router.back();
    } catch (e) {
      setSalvando(false);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui salvar. Quer tentar de novo?');
    }
  }

  async function apagar() {
    if (!id) return;
    try {
      const desfazer = await apagarItem(secao as SecaoLista, id);
      haptic.sucesso();
      router.back();
      mostrarToast('Apagado do passaporte.', {
        titulo: 'Desfazer',
        onPress: () => void desfazer().catch(() => mostrarToast('Não consegui desfazer agora.')),
      });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não consegui apagar agora.');
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.s2 }}
    >
      <Text variante="title2" accessibilityRole="header">
        {titulo}
      </Text>
      {campos.map((c, i) => (
        <View key={c.chave} style={{ gap: espaco.meio }}>
          <Text variante="footnote" cor="secondaryLabel">
            {c.rotulo}
          </Text>
          <TextInput
            value={valores[c.chave]}
            onChangeText={(v) => setValores((atual) => ({ ...atual, [c.chave]: v }))}
            placeholder={c.exemplo}
            placeholderTextColor={cores.tertiaryLabel}
            accessibilityLabel={c.rotulo}
            autoFocus={i === 0 && !existente && !ehTexto}
            multiline={c.longo}
            keyboardType={c.teclado ?? 'default'}
            autoCapitalize={c.teclado === 'url' ? 'none' : 'sentences'}
            autoCorrect={c.teclado !== 'url'}
            style={[
              tipografia.body,
              {
                color: cores.label,
                backgroundColor: cores.secondaryBackground,
                borderRadius: raio.card,
                borderCurve: 'continuous',
                paddingHorizontal: espaco.s2,
                paddingVertical: espaco.s1 + espaco.meio,
                minHeight: c.longo ? 96 : 48,
                textAlignVertical: c.longo ? 'top' : 'center',
              },
            ]}
          />
        </View>
      ))}
      {erro && (
        <Text variante="callout" cor="emergency" accessibilityLiveRegion="polite">
          {erro}
        </Text>
      )}
      <Coluna gap="s1">
        <PrimaryButton titulo={salvando ? 'Salvando...' : 'Salvar'} desativado={!podeSalvar || salvando} onPress={salvar} />
        {existente && <SecondaryButton titulo="Apagar do passaporte" icone="lixeira" onPress={apagar} />}
      </Coluna>
    </ScrollView>
  );
}
