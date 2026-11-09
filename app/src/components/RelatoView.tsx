import { router } from 'expo-router';
import { View } from 'react-native';

import { api, type Relato } from '@/lib/api';
import { ligarEmergencia } from '@/lib/abrir';
import { linhasDoRegistro } from '@/lib/rotulos';
import { espaco, useTema } from '@/theme';

import { AudioPlayer } from './AudioPlayer';
import { EmergencyButton } from './Buttons';
import { Card } from './Card';
import { SummaryCard } from './Content';
import { Icon } from './Icon';
import { ListGroup, ListRow } from './ListRow';
import { Text } from './Text';

/**
 * Um relato organizado pela IA: alerta (se houver), o resumo para a família com acesso ao
 * áudio e à transcrição, e cada campo corrigível com um toque.
 */
export function RelatoView({ relato }: { relato: Relato }) {
  const { cores } = useTema();
  const registro = relato.registro;
  if (!registro) return null;
  const linhas = linhasDoRegistro(registro);
  const tambem = [
    ...registro.episodios.map((e) => ({ titulo: e.descricao, icone: 'atencao' as const, cor: 'attention' as const })),
    ...registro.o_que_ajudou.map((t) => ({ titulo: `Ajudou: ${t}`, icone: 'calma' as const, cor: 'success' as const })),
    ...registro.momentos_bons.map((t) => ({ titulo: t, icone: 'coracao' as const, cor: 'accentStrong' as const })),
    ...registro.observacoes.map((t) => ({ titulo: t, icone: 'texto' as const, cor: 'secondaryLabel' as const })),
  ];

  return (
    <View style={{ gap: espaco.s3 }}>
      {relato.alertas.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', gap: espaco.s1, alignItems: 'flex-start' }}>
            <Icon nome="atencao" cor={cores.emergency} />
            <Text variante="headline" style={{ flex: 1 }}>
              {registro.sinais_de_alerta[0] ?? 'O relato fala de uma situação que pode precisar de atenção agora.'}
            </Text>
          </View>
          <EmergencyButton onPress={ligarEmergencia} />
        </Card>
      )}

      <SummaryCard
        titulo="O que vai para a família"
        texto={relato.resumo ?? ''}
        original={relato.transcricao ?? undefined}
        audio={relato.tem_audio ? <AudioPlayer fonte={api.fonteAudio(relato.id)} /> : undefined}
      />

      <View style={{ gap: espaco.s1 }}>
        <Text variante="title2" accessibilityRole="header">
          O que ficou registrado
        </Text>
        <ListGroup rodape="Toque em um item para corrigir. A IA aprende com cada correção. Não é avaliação médica.">
          {linhas.map((l) => (
            <ListRow
              key={l.campo}
              titulo={l.rotulo}
              subtitulo={l.valor}
              icone={l.icone}
              direita={
                relato.corrigidos.includes(l.campo) ? (
                  <Text variante="footnote" cor="secondaryLabel">
                    Corrigido
                  </Text>
                ) : undefined
              }
              dica="Toque para corrigir"
              onPress={() => router.push({ pathname: '/corrigir', params: { relato: relato.id, campo: l.campo } })}
            />
          ))}
        </ListGroup>
      </View>

      {tambem.length > 0 && (
        <View style={{ gap: espaco.s1 }}>
          <Text variante="title2" accessibilityRole="header">
            Também ficou registrado
          </Text>
          <ListGroup>
            {tambem.map((t, i) => (
              <ListRow key={i} titulo={t.titulo} icone={t.icone} corIcone={t.cor} />
            ))}
          </ListGroup>
        </View>
      )}
    </View>
  );
}
