import { useLocalSearchParams } from 'expo-router';
import { type ComponentType, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';

import { AcoesRapidas, EmergencyButton, Icon, ListGroup, ListRow, Screen, Skeleton, Text } from '@/components';
import { ligarEmergencia } from '@/lib/abrir';
import { ErroApi } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { type GrupoUnidade, ondeEstou, SemLocalizacao, type Unidade, unidadesPerto } from '@/lib/sus';
import { espaco, raio, useTema } from '@/theme';

/** O mapa nativo só existe no build instalado; no Expo Go a tela mostra só a lista. */
type PropsMapa = {
  style: object;
  cameraPosition: { coordinates: { latitude: number; longitude: number }; zoom: number };
  markers: { id: string; coordinates: { latitude: number; longitude: number }; title: string; tintColor: string; systemImage: string }[];
  properties: { isMyLocationEnabled: boolean };
  onMarkerClick: (m: { id?: string }) => void;
};
let MapaApple: ComponentType<PropsMapa> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapaApple = Platform.OS === 'ios' ? require('expo-maps').AppleMaps.View : null;
} catch {
  MapaApple = null;
}

const GRUPOS: { id: GrupoUnidade; titulo: string; vazio: string }[] = [
  { id: 'emergencia', titulo: 'Emergência', vazio: 'Não achei hospital ou UPA no cadastro desta cidade.' },
  { id: 'ubs', titulo: 'Postos e UBS', vazio: 'Não achei UBS no cadastro desta cidade.' },
  { id: 'caps', titulo: 'CAPS', vazio: 'Não achei CAPS no cadastro desta cidade.' },
];

function km(d: number) {
  return d < 1 ? `${Math.round(d * 1000)} m` : `${String(d).replace('.', ',')} km`;
}

/**
 * Unidades de saúde perto de quem está usando: hospitais, UPAs e pronto-socorros em emergência,
 * UBS e CAPS. Do cadastro oficial do SUS (CNES), num mapa e numa lista com rota e telefone.
 */
export default function Perto() {
  const { cores } = useTema();
  const params = useLocalSearchParams<{ grupo?: GrupoUnidade }>();
  const [grupo, setGrupo] = useState<GrupoUnidade>(params.grupo ?? 'emergencia');
  const [onde, setOnde] = useState<Awaited<ReturnType<typeof ondeEstou>> | null>(null);
  const [unidades, setUnidades] = useState<Unidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setUnidades(null);
      setErro(null);
      try {
        const local = onde ?? (await ondeEstou());
        if (!vivo) return;
        setOnde(local);
        const r = await unidadesPerto(grupo, local);
        if (vivo) setUnidades(r.unidades);
      } catch (e) {
        if (!vivo) return;
        setErro(
          e instanceof SemLocalizacao
            ? 'Para achar as unidades perto, o app precisa da sua localização. Ela não é guardada. Em emergência, ligue 192.'
            : e instanceof ErroApi
              ? e.message
              : 'Não consegui buscar agora. Em emergência, ligue 192.',
        );
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grupo, onde]);

  function abrirUnidade(u: Unidade) {
    haptic.toque();
    const rota = `maps://?daddr=${u.lat},${u.lon}&q=${encodeURIComponent(u.nome)}`;
    const opcoes: { text: string; onPress?: () => void; style?: 'cancel' }[] = [{ text: 'Rota no Mapas', onPress: () => void Linking.openURL(rota) }];
    if (u.telefone) opcoes.push({ text: `Ligar: ${u.telefone}`, onPress: () => void Linking.openURL(`tel:${u.telefone!.replace(/\D/g, '')}`) });
    opcoes.push({ text: 'Fechar', style: 'cancel' });
    Alert.alert(u.nome, [u.endereco, `${km(u.distancia_km)} daqui`].filter(Boolean).join('\n'), opcoes);
  }

  const cor = (u: Unidade) => (u.sus || u.publica ? cores.success : cores.secondaryLabel);

  return (
    <Screen>
      {grupo === 'emergencia' && <EmergencyButton onPress={ligarEmergencia} />}

      <AcoesRapidas
        acoes={GRUPOS.map((g) => ({
          titulo: g.titulo,
          icone: g.id === 'emergencia' ? 'atencao' : g.id === 'ubs' ? 'casa' : 'coracao',
          cor: grupo === g.id ? cores.accentStrong : cores.secondaryLabel,
          onPress: () => setGrupo(g.id),
        }))}
      />

      {MapaApple && onde && unidades && unidades.length > 0 && (
        <View style={{ height: 260, borderRadius: raio.card, overflow: 'hidden' }}>
          <MapaApple
            style={{ flex: 1 }}
            cameraPosition={{ coordinates: { latitude: onde.lat, longitude: onde.lon }, zoom: 13 }}
            properties={{ isMyLocationEnabled: true }}
            markers={unidades.map((u) => ({
              id: String(u.cnes),
              coordinates: { latitude: u.lat, longitude: u.lon },
              title: u.nome,
              tintColor: u.sus || u.publica ? '#2E7D4F' : '#8E8E93',
              systemImage: grupo === 'emergencia' ? 'cross.fill' : grupo === 'ubs' ? 'stethoscope' : 'heart.fill',
            }))}
            onMarkerClick={(m) => {
              const u = unidades.find((x) => String(x.cnes) === m.id);
              if (u) abrirUnidade(u);
            }}
          />
        </View>
      )}

      {erro ? (
        <Text variante="callout" cor="emergency" accessibilityLiveRegion="polite">
          {erro}
        </Text>
      ) : !unidades ? (
        <View style={{ gap: espaco.s1 }}>
          <Text variante="footnote" cor="secondaryLabel">
            Procurando no cadastro do SUS{onde ? ` em ${onde.cidade}` : ''}...
          </Text>
          <Skeleton linhas={4} />
        </View>
      ) : unidades.length === 0 ? (
        <Text variante="callout" cor="secondaryLabel">
          {GRUPOS.find((g) => g.id === grupo)?.vazio}
        </Text>
      ) : (
        <ListGroup rodape="Do Cadastro Nacional de Estabelecimentos de Saúde (CNES), do Ministério da Saúde. Alguns endereços do cadastro podem estar desatualizados: confira antes de sair. Sua localização não é guardada.">
          {unidades.map((u) => (
            <ListRow
              key={u.cnes}
              titulo={u.nome}
              subtitulo={[km(u.distancia_km), u.tipo_rotulo, u.h24 ? '24 horas' : null, u.sus ? 'Atende pelo SUS' : u.publica ? 'Pública' : null].filter(Boolean).join('. ')}
              esquerda={<Icon nome={grupo === 'emergencia' ? 'atencao' : 'casa'} cor={cor(u)} />}
              onPress={() => abrirUnidade(u)}
              dica="Rota no Mapas ou ligar"
            />
          ))}
        </ListGroup>
      )}

      {onde && (
        <Pressable
          onPress={() => void Linking.openURL(`maps://?q=${encodeURIComponent(grupo === 'emergencia' ? 'hospital' : grupo === 'ubs' ? 'UBS' : 'CAPS')}&sll=${onde.lat},${onde.lon}`)}
          accessibilityRole="link"
          style={{ alignSelf: 'center', paddingVertical: espaco.s1 }}
        >
          <Text variante="callout" style={{ color: cores.accentStrong }}>
            Procurar também no Mapas
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}
