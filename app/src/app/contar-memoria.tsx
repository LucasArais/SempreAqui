import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Coluna,
  Icon,
  ListGroup,
  mostrarToast,
  nivelDoMetering,
  PrimaryButton,
  RecordButton,
  SecondaryButton,
  Skeleton,
  Text,
  TextField,
} from '@/components';
import { api, ErroApi } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { iaLocalPronta, type MemoriaOrganizada, organizarMemoriaNoAparelho } from '@/lib/ia-local';
import { novoId, passaporteAtual, salvarPassaporte, SECOES, type SecaoLista } from '@/lib/passaporte';
import { espaco, useTema } from '@/theme';

type Fase = 'entrada' | 'gravando' | 'organizando' | 'sugestoes' | 'erro';
type Sugestao = { id: string; secao: SecaoLista | 'quem_ela' | 'como_se_comunica'; titulo: string; detalhe?: string | null; artista?: string | null };

const OPCOES = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const ORDEM: SecaoLista[] = ['pessoas_importantes', 'lembrancas', 'acalma', 'agita', 'rotina', 'musicas', 'comidas'];

/** Transforma a resposta da IA numa lista plana de sugestões, sem repetir o que já está no passaporte. */
function sugestoesDe(m: MemoriaOrganizada): Sugestao[] {
  const p = passaporteAtual();
  const ja = (secao: SecaoLista, titulo: string) =>
    (p[secao] as { titulo?: string; nome?: string }[]).some(
      (i) => (i.titulo ?? i.nome ?? '').toLowerCase() === titulo.toLowerCase(),
    );
  const lista: Sugestao[] = [];
  if (m.quem_ela) lista.push({ id: 'quem_ela', secao: 'quem_ela', titulo: m.quem_ela });
  if (m.como_se_comunica) lista.push({ id: 'como_se_comunica', secao: 'como_se_comunica', titulo: m.como_se_comunica });
  for (const secao of ORDEM) {
    for (const [i, item] of (m[secao] as Record<string, string | null | undefined>[]).entries()) {
      const titulo = (secao === 'pessoas_importantes' ? item.nome : item.titulo) ?? '';
      if (!titulo || ja(secao, titulo)) continue;
      lista.push({
        id: `${secao}-${i}`,
        secao,
        titulo,
        detalhe: secao === 'pessoas_importantes' ? item.relacao : secao === 'musicas' ? item.artista : item.detalhe,
        artista: secao === 'musicas' ? item.artista : undefined,
      });
    }
  }
  return lista;
}

/**
 * Contar uma memória por voz ou por escrito. A IA separa nas seções do Passaporte e a família
 * marca o que entra. No iPhone com IA no aparelho, o áudio não sai do celular.
 */
export default function ContarMemoria() {
  const { cores, margem } = useTema();
  const { modo } = useLocalSearchParams<{ modo?: 'voz' | 'texto' }>();
  const gravador = useAudioRecorder(OPCOES);
  const estadoGravador = useAudioRecorderState(gravador, 120);
  const [fase, setFase] = useState<Fase>('entrada');
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [noAparelho, setNoAparelho] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const porVoz = modo !== 'texto';

  useEffect(() => {
    if (porVoz) void setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }, [porVoz]);

  async function gravarOuParar() {
    if (fase === 'gravando') {
      await gravador.stop();
      if (gravador.uri) await organizar({ uri: gravador.uri });
      return;
    }
    const permissao = await AudioModule.requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      setErro('Sem permissão para o microfone. Você pode escrever em vez de falar.');
      return;
    }
    await gravador.prepareToRecordAsync();
    gravador.record();
    haptic.toque();
    setFase('gravando');
  }

  async function organizar(entrada: { uri?: string; texto?: string }) {
    setFase('organizando');
    setErro(null);
    let memoria: MemoriaOrganizada | null = null;
    if (iaLocalPronta()) {
      try {
        memoria = (await organizarMemoriaNoAparelho(entrada)).memoria;
        setNoAparelho(true);
      } catch {
        memoria = null;
      }
    }
    if (!memoria) {
      try {
        memoria = await api.organizarMemoria(entrada);
        setNoAparelho(false);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Não consegui organizar agora. Tente de novo em instantes.');
        setFase('erro');
        return;
      }
    }
    const lista = sugestoesDe(memoria);
    setSugestoes(lista);
    setMarcadas(new Set(lista.map((s) => s.id)));
    haptic.sucesso();
    setFase('sugestoes');
  }

  function alternar(id: string) {
    haptic.selecao();
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  async function adicionar() {
    const escolhidas = sugestoes.filter((s) => marcadas.has(s.id));
    const p = { ...passaporteAtual() };
    for (const s of escolhidas) {
      if (s.secao === 'quem_ela' || s.secao === 'como_se_comunica') {
        p[s.secao] = p[s.secao] ? `${p[s.secao]} ${s.titulo}` : s.titulo;
      } else if (s.secao === 'pessoas_importantes') {
        p.pessoas_importantes = [...p.pessoas_importantes, { id: novoId('p'), nome: s.titulo, relacao: s.detalhe ?? null }];
      } else if (s.secao === 'musicas') {
        p.musicas = [...p.musicas, { id: novoId('m'), titulo: s.titulo, artista: s.artista ?? null }];
      } else {
        p[s.secao] = [...p[s.secao], { id: novoId(s.secao.slice(0, 3)), titulo: s.titulo, detalhe: s.detalhe ?? null }];
      }
    }
    setSalvando(true);
    try {
      await salvarPassaporte(p);
      haptic.sucesso();
      router.back();
      mostrarToast(`${escolhidas.length} ${escolhidas.length === 1 ? 'memória adicionada' : 'memórias adicionadas'} ao passaporte.`);
    } catch (e) {
      setSalvando(false);
      setErro(e instanceof ErroApi ? e.message : 'Não consegui salvar agora.');
    }
  }

  const rotuloSecao = (s: Sugestao['secao']) =>
    s === 'quem_ela' ? 'Quem ela é' : s === 'como_se_comunica' ? 'Como se comunica' : SECOES[s].titulo;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: margem, paddingTop: espaco.s3 + espaco.s1, paddingBottom: espaco.s5, gap: espaco.s3 }}
    >
      <Coluna gap="s1">
        <Text variante="title2" accessibilityRole="header">
          {fase === 'sugestoes' ? 'Confira antes de guardar' : 'Contar uma memória'}
        </Text>
        <Text variante="callout" cor="secondaryLabel">
          {fase === 'sugestoes'
            ? 'Desmarque o que não estiver certo. Só o que ficar marcado entra no passaporte.'
            : `Fale como se contasse para alguém da família: do que ela gosta, quem é importante, histórias, o que acalma. A IA separa nas seções e você confere.`}
        </Text>
      </Coluna>

      {(fase === 'entrada' || fase === 'gravando') &&
        (porVoz ? (
          <Coluna centro gap="s2">
            <RecordButton
              gravando={fase === 'gravando'}
              segundos={estadoGravador.durationMillis / 1000}
              nivel={nivelDoMetering(estadoGravador.metering)}
              onPress={gravarOuParar}
              rotulo={fase === 'gravando' ? 'Toque para terminar' : 'Toque para falar'}
              apoio="Por exemplo: ela adora forró, o irmão dela se chama João..."
            />
            <SecondaryButton titulo="Prefiro escrever" icone="texto" onPress={() => router.setParams({ modo: 'texto' })} />
          </Coluna>
        ) : (
          <Coluna gap="s2">
            <TextField
              valor={texto}
              onChange={setTexto}
              rotulo="O que você quer contar"
              placeholder="Ela adora forró e pão de queijo. O irmão dela, João, mora em Minas. Fica agitada com barulho de moto."
            />
            <PrimaryButton titulo="Organizar" desativado={!texto.trim()} onPress={() => organizar({ texto })} />
          </Coluna>
        ))}

      {fase === 'organizando' && (
        <Coluna gap="s1">
          <Text variante="headline">{iaLocalPronta() ? 'Organizando aqui no celular...' : 'Organizando o que você contou...'}</Text>
          <Skeleton linhas={4} />
        </Coluna>
      )}

      {fase === 'sugestoes' &&
        (sugestoes.length === 0 ? (
          <Coluna gap="s2">
            <Text variante="body">Não encontrei nada novo para o passaporte nesse relato. Quer tentar contar de outro jeito?</Text>
            <SecondaryButton titulo="Contar de novo" onPress={() => setFase('entrada')} />
          </Coluna>
        ) : (
          <Coluna gap="s2">
            <ListGroup>
              {sugestoes.map((s) => {
                const marcado = marcadas.has(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => alternar(s.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcado }}
                    accessibilityLabel={`${rotuloSecao(s.secao)}: ${s.titulo}`}
                    style={{ flexDirection: 'row', gap: espaco.s2, alignItems: 'center', paddingHorizontal: espaco.s2, paddingVertical: espaco.s1 + espaco.meio, minHeight: 56 }}
                  >
                    <Icon nome={marcado ? 'feito' : 'pendente'} cor={marcado ? cores.accentStrong : cores.tertiaryLabel} />
                    <View style={{ flex: 1 }}>
                      <Text variante="footnote" cor="secondaryLabel">
                        {rotuloSecao(s.secao)}
                      </Text>
                      <Text variante="body">{s.titulo}</Text>
                      {s.detalhe ? (
                        <Text variante="footnote" cor="secondaryLabel">
                          {s.detalhe}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ListGroup>
            {noAparelho && (
              <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'center' }}>
                <Icon nome="cadeado" cor={cores.success} />
                <Text variante="footnote" cor="secondaryLabel" style={{ flex: 1 }}>
                  Organizado aqui no seu celular. O que você contou não saiu dele.
                </Text>
              </View>
            )}
            <PrimaryButton
              titulo={salvando ? 'Guardando...' : `Adicionar ${marcadas.size} ao passaporte`}
              desativado={!marcadas.size || salvando}
              onPress={adicionar}
            />
          </Coluna>
        ))}

      {erro && (
        <Coluna gap="s1">
          <Text variante="callout" cor="emergency" accessibilityLiveRegion="polite">
            {erro}
          </Text>
          {fase === 'erro' && <SecondaryButton titulo="Tentar de novo" onPress={() => setFase('entrada')} />}
        </Coluna>
      )}
    </ScrollView>
  );
}
