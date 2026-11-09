import { Alert, Linking } from 'react-native';

/** Liga para a emergência. Se o aparelho não consegue ligar, diz isso com clareza e dá a saída. */
export async function ligarEmergencia() {
  try {
    await Linking.openURL('tel:192');
  } catch {
    Alert.alert(
      'Não consegui abrir o telefone',
      'Ligue 192 direto do seu celular. Se a pessoa estiver em perigo, peça ajuda a quem estiver por perto.',
    );
  }
}

/** Abre a música no YouTube (app ou navegador): o vídeo escolhido pela família ou a busca. */
export async function abrirMusica(musica: { titulo: string; artista: string; link?: string }) {
  const busca = encodeURIComponent(`${musica.titulo} ${musica.artista}`);
  const url = musica.link ?? `https://www.youtube.com/results?search_query=${busca}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Não consegui abrir o YouTube', `Procure por "${musica.titulo}, ${musica.artista}" no YouTube.`);
  }
}

/** Abre um link de fonte oficial no navegador. */
export async function abrirLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Não consegui abrir o link', `Você pode acessar pelo navegador: ${url}`);
  }
}
