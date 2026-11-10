import type { NomeIcone } from '@/components/Icon';

import type { Etapa, Registro } from './api';

/** Valores do schema em palavras de gente. Nunca mostrar "nao_informado" na tela. */
const VALORES: Record<string, string> = {
  boa: 'Boa',
  regular: 'Regular',
  ruim: 'Ruim',
  pouca: 'Pouca',
  recusou: 'Recusou',
  calmo: 'Calmo',
  alegre: 'Alegre',
  triste: 'Triste',
  ansioso: 'Ansioso',
  irritado: 'Irritado',
  apatico: 'Apático',
  variado: 'Variou ao longo do dia',
  nenhuma: 'Nenhuma',
  leve: 'Leve',
  moderada: 'Moderada',
  intensa: 'Intensa',
  sim: 'Tomou todos',
  nao: 'Não tomou',
  parcial: 'Tomou só parte',
  nenhum: 'Nenhum',
  algum: 'Algum',
  muito: 'Muito',
  nao_informado: 'Não foi falado',
  manha: 'manhã',
  tarde: 'tarde',
  noite: 'noite',
  madrugada: 'madrugada',
};

export function rotuloValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Não foi falado';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  return VALORES[String(valor)] ?? String(valor);
}

export const MENSAGEM_ETAPA: Record<Etapa, string> = {
  recebido: 'Recebi seu áudio',
  transcrevendo: 'Ouvindo o que você contou...',
  organizando: 'Organizando o que você contou...',
  resumindo: 'Escrevendo o resumo para a família...',
  pronto: 'Pronto',
  erro: 'Não consegui organizar agora',
};

/** Progresso quando a IA roda no próprio celular. */
export const MENSAGEM_ETAPA_APARELHO = {
  transcrevendo: 'Ouvindo o que você contou, aqui no seu celular...',
  organizando: 'Organizando aqui no celular...',
  resumindo: 'Escrevendo o resumo para a família...',
} as const;

export type LinhaCampo = {
  campo: string;
  rotulo: string;
  valor: string;
  icone: NomeIcone;
};

/** Campos mostrados no resultado, na ordem em que quem cuida pensa no dia. */
export function linhasDoRegistro(r: Registro): LinhaCampo[] {
  const horas = r.sono.horas_aproximadas;
  const acordou = r.sono.despertares_noturnos;
  const detalhesSono = [
    horas ? `cerca de ${rotuloValor(horas)} horas` : null,
    acordou !== null && acordou !== undefined ? `acordou ${acordou} ${acordou === 1 ? 'vez' : 'vezes'}` : null,
  ].filter(Boolean);
  const periodos = r.agitacao.periodos.map((p) => rotuloValor(p));
  return [
    {
      campo: 'sono.qualidade',
      rotulo: 'Sono',
      valor: [rotuloValor(r.sono.qualidade), ...detalhesSono].join(', '),
      icone: 'sono',
    },
    {
      campo: 'alimentacao.qualidade',
      rotulo: 'Alimentação',
      valor:
        rotuloValor(r.alimentacao.qualidade) +
        (r.alimentacao.hidratacao !== 'nao_informado' ? `. Água: ${rotuloValor(r.alimentacao.hidratacao).toLowerCase()}` : ''),
      icone: 'comida',
    },
    { campo: 'humor.predominante', rotulo: 'Humor', valor: rotuloValor(r.humor.predominante), icone: 'humor' },
    {
      campo: 'agitacao.nivel',
      rotulo: 'Agitação',
      valor: rotuloValor(r.agitacao.nivel) + (periodos.length ? `, à ${periodos.join(' e à ')}` : ''),
      icone: 'onda',
    },
    { campo: 'medicacao.tomou', rotulo: 'Remédios', valor: rotuloValor(r.medicacao.tomou), icone: 'remedio' },
    { campo: 'quem_cuida.cansaco', rotulo: 'Seu cansaço', valor: rotuloValor(r.quem_cuida.cansaco), icone: 'coracao' },
  ];
}

export function formatarData(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (data.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${hora}`;
}

export function formatarDuracao(segundos?: number | null) {
  if (!segundos) return '';
  const s = Math.round(segundos);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
}
