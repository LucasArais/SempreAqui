import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { CHAVE_ONBOARDING } from '@/lib/chaves';

/** Primeira abertura: onboarding curto que termina gravando o primeiro relato. Depois, Hoje. */
export default function Inicio() {
  const [destino, setDestino] = useState<'/hoje' | '/onboarding' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_ONBOARDING)
      .then((visto) => setDestino(visto ? '/hoje' : '/onboarding'))
      .catch(() => setDestino('/hoje'));
  }, []);

  return destino ? <Redirect href={destino} /> : null;
}
