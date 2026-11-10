import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from './api';
import { aoTrocarConta, sessaoAtual } from './sessao';

export type DiaSemana = {
  data: string;
  dia: string;
  tem_relato: boolean;
  sono_qualidade: string | null;
  sono_horas: number | null;
  alerta: boolean;
};

export type Mudanca = { tipo: string; texto: string; datas: string[] };

export type Semana = {
  inicio: string;
  fim: string;
  periodo: string;
  dias: DiaSemana[];
  dias_com_relato: number;
  linha_de_base_dias: number;
  habitual_sono_horas: number | null;
  mudancas: Mudanca[];
  para_consulta: string[];
  o_que_ajudou: string[];
  resumo: string;
  resumo_seguro: boolean;
};

let emCache: Semana | null = null;

/** Semana atual (7 dias até hoje). Atualiza sempre que a tela volta a ficar visível. */
export function useSemana() {
  const [semana, setSemana] = useState<Semana | null>(emCache);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sessaoAtual().pronta) return;
    try {
      const nova = await api.semana();
      emCache = nova;
      setSemana(nova);
      setErro(null);
    } catch {
      setErro('Não consegui carregar a semana agora.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  return { semana, erro, carregar };
}

aoTrocarConta(() => { emCache = null; });
