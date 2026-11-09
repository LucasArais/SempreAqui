import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AvisoIA,
  Botao,
  Cartao,
  Etiqueta,
  LinhaIcone,
  Paragrafo,
  Subtitulo,
  Tela,
  Titulo,
} from '@/components/ui';
import { passaporte, reacoes, sessaoReminiscencia as s } from '@/dados/mock';
import { cores, espaco, fonte, raio, TOQUE_MINIMO } from '@/tema';

export default function Reminiscencia() {
  const [passo, setPasso] = useState(-1);
  const [reacao, setReacao] = useState<string | null>(null);

  if (passo === -1) {
    return (
      <Tela>
        <Etiqueta texto={s.duracao} cor={cores.laranjaClaro} />
        <Titulo>{s.tema}</Titulo>
        <Paragrafo>
          Uma conversa curta e gostosa com a {passaporte.comoGostaDeSerChamada}, montada a partir do
          Passaporte de Memória.
        </Paragrafo>

        <View style={estilos.foto} accessibilityLabel={s.material.descricao}>
          <Ionicons name="image-outline" size={64} color={cores.laranjaTexto} />
          <Text style={estilos.fotoTexto}>{s.material.descricao}</Text>
        </View>

        <Cartao>
          <Subtitulo>Você vai precisar</Subtitulo>
          <LinhaIcone icone="image-outline" texto={s.material.descricao} />
          <LinhaIcone icone="musical-notes-outline" texto={s.material.musica} />
        </Cartao>

        <Cartao cor={cores.laranjaClaro}>
          <Subtitulo>Evite</Subtitulo>
          {s.evite.map((e) => (
            <LinhaIcone key={e} icone="close-circle-outline" texto={e} />
          ))}
        </Cartao>

        <Botao titulo="Começar a conversa" icone="play" onPress={() => setPasso(0)} />
      </Tela>
    );
  }

  if (passo < s.passos.length) {
    const atual = s.passos[passo];
    return (
      <Tela>
        <Paragrafo suave>
          Parte {passo + 1} de {s.passos.length}
        </Paragrafo>
        <Titulo>{atual.titulo}</Titulo>
        <Paragrafo>{atual.texto}</Paragrafo>
        <Cartao cor={cores.verdeClaro}>
          <Subtitulo>Você pode perguntar</Subtitulo>
          <Text style={estilos.pergunta}>"{atual.pergunta}"</Text>
        </Cartao>
        <Botao
          titulo={passo === s.passos.length - 1 ? 'Terminar' : 'Próxima parte'}
          icone="arrow-forward"
          onPress={() => setPasso(passo + 1)}
        />
        {passo > 0 && (
          <Botao
            titulo="Voltar"
            icone="arrow-back"
            variante="claro"
            onPress={() => setPasso(passo - 1)}
          />
        )}
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo>Como ela reagiu?</Titulo>
      <Paragrafo>Isso ajuda a IA a escolher melhor os temas das próximas conversas.</Paragrafo>
      <View style={{ gap: espaco.m }}>
        {reacoes.map((r) => {
          const marcado = reacao === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setReacao(r.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: marcado }}
              accessibilityLabel={r.rotulo}
              style={[estilos.opcao, marcado && estilos.opcaoMarcada]}
            >
              <Ionicons
                name={r.icone}
                size={32}
                color={marcado ? cores.branco : cores.azulEscuro}
              />
              <Text style={[estilos.opcaoTexto, marcado && { color: cores.branco }]}>
                {r.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <AvisoIA texto="Se ela ficou desconfortável, a IA evita esse tema nas próximas sessões." />
      <Botao
        titulo="Salvar e voltar"
        icone="checkmark"
        onPress={() => router.back()}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  foto: {
    height: 200,
    borderRadius: raio,
    backgroundColor: cores.laranjaClaro,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
  },
  fotoTexto: { fontSize: fonte.pequena, color: cores.laranjaTexto, fontWeight: '600' },
  pergunta: { fontSize: fonte.subtitulo, color: cores.texto, lineHeight: 34, fontStyle: 'italic' },
  opcao: {
    minHeight: TOQUE_MINIMO + 8,
    borderRadius: raio,
    borderWidth: 2,
    borderColor: cores.azul,
    backgroundColor: cores.cartao,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
  },
  opcaoMarcada: { backgroundColor: cores.azul },
  opcaoTexto: { fontSize: fonte.destaque, fontWeight: '700', color: cores.azulEscuro },
});
