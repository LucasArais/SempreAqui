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

/** Abre um link de fonte oficial no navegador. */
export async function abrirLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Não consegui abrir o link', `Você pode acessar pelo navegador: ${url}`);
  }
}
