import * as Location from 'expo-location';

import { api } from './api';

/**
 * SUS no app: o Cartão Nacional de Saúde (mesma conferência do backend, core/sus.py) e os
 * serviços oficiais. Links conferidos no ar em novembro de 2026. O SempreAqui não acessa os
 * sistemas do SUS: só guarda o número que a família digita e aponta para os serviços.
 */

export const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/** 15 dígitos, começando com 1, 2, 7, 8 ou 9, e a soma ponderada múltipla de 11. */
export function cnsValido(numero: string) {
  const cns = soDigitos(numero);
  if (cns.length !== 15 || !'12789'.includes(cns[0])) return false;
  const soma = [...cns].reduce((total, d, i) => total + Number(d) * (15 - i), 0);
  return soma % 11 === 0;
}

/** "898001160660000" vira "898 0011 6066 0000", como no cartão. */
export function formatarCns(numero: string) {
  const cns = soDigitos(numero);
  return cns.length === 15 ? `${cns.slice(0, 3)} ${cns.slice(3, 7)} ${cns.slice(7, 11)} ${cns.slice(11)}` : numero;
}

export type ServicoSus = { titulo: string; detalhe: string; url: string };

export const SERVICOS_SUS: { secao: string; itens: ServicoSus[] }[] = [
  {
    secao: 'Programas do SUS para o Alzheimer',
    itens: [
      {
        titulo: 'Remédios do Alzheimer de graça',
        detalhe: 'Componente Especializado da Assistência Farmacêutica: como pedir, com receita e laudo',
        url: 'https://www.gov.br/saude/pt-br/composicao/sectics/daf/ceaf',
      },
      {
        titulo: 'Protocolo de tratamento do Alzheimer no SUS',
        detalhe: 'O protocolo oficial (PCDT) que orienta diagnóstico e tratamento na rede pública',
        url: 'https://www.gov.br/saude/pt-br/assuntos/pcdt/d/doenca-de-alzheimer/view',
      },
      { titulo: 'Melhor em Casa', detalhe: 'Atendimento do SUS em casa, para quem tem dificuldade de sair', url: 'https://www.gov.br/saude/pt-br/composicao/saes/melhor-em-casa' },
      {
        titulo: 'Brasil que Cuida',
        detalhe: 'Política Nacional de Cuidados (Lei 15.069/2024): apoio a quem cuida e a quem é cuidado',
        url: 'https://www.gov.br/mds/pt-br/acoes-e-programas/brasil-que-cuida',
      },
    ],
  },
  {
    secao: 'No celular',
    itens: [
      {
        titulo: 'Meu SUS Digital',
        detalhe: 'Cartão SUS digital, carteira de vacinação, exames e histórico de atendimentos',
        url: 'https://meususdigital.saude.gov.br',
      },
    ],
  },
  {
    secao: 'Remédios e vacinas',
    itens: [
      { titulo: 'Farmácia Popular', detalhe: 'Remédios de graça ou com desconto em farmácias credenciadas', url: 'https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular' },
    ],
  },
  {
    secao: 'Cuidado e atendimento',
    itens: [
      { titulo: 'Encontrar unidades de saúde', detalhe: 'Busca oficial de UBS, CAPS e hospitais (CNES)', url: 'https://cnes.datasus.gov.br/' },
      { titulo: 'Vacinação', detalhe: 'Calendário e campanhas do Ministério da Saúde', url: 'https://www.gov.br/saude/pt-br/vacinacao' },
    ],
  },
  {
    secao: 'Para entender e cuidar',
    itens: [
      { titulo: 'Alzheimer, no Ministério da Saúde', detalhe: 'O que é, sintomas e tratamento pelo SUS', url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/alzheimer' },
      { titulo: 'Guia Prático do Cuidador', detalhe: 'Ministério da Saúde. A fonte das orientações da Naomi', url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_pratico_cuidador.pdf' },
      { titulo: 'Ouvidoria do SUS', detalhe: 'Reclamações, sugestões e informações. Telefone 136', url: 'https://www.gov.br/saude/pt-br/canais-de-atendimento/ouvsus' },
    ],
  },
];

export const TELEFONES_SUS = [
  { titulo: '192, SAMU', detalhe: 'Emergência', numero: '192' },
  { titulo: '136, Disque Saúde', detalhe: 'Informações e Ouvidoria do SUS', numero: '136' },
  { titulo: '100, Disque Direitos Humanos', detalhe: 'Para denunciar violência contra a pessoa idosa', numero: '100' },
];

// Unidades perto da família (backend/core/sus.py, dados abertos do CNES) --------


export type GrupoUnidade = 'emergencia' | 'ubs' | 'caps';
export type Unidade = {
  cnes: number;
  nome: string;
  tipo_rotulo: string;
  endereco: string;
  telefone: string | null;
  lat: number;
  lon: number;
  sus: boolean;
  publica: boolean;
  h24: boolean;
  distancia_km: number;
};

const UF_POR_NOME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function siglaDaUf(regiao: string | null | undefined) {
  if (!regiao) return null;
  if (/^[A-Z]{2}$/.test(regiao)) return regiao;
  const chave = regiao.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return UF_POR_NOME[chave] ?? null;
}

export class SemLocalizacao extends Error {}

/**
 * Onde a pessoa está agora: coordenadas para a distância e cidade para o cadastro do SUS.
 * A localização não é guardada em lugar nenhum.
 */
export async function ondeEstou() {
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (!permissao.granted) throw new SemLocalizacao('Sem permissão de localização.');
  const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [lugar] = await Location.reverseGeocodeAsync(posicao.coords);
  const cidade = lugar?.city ?? lugar?.subregion ?? null;
  const uf = siglaDaUf(lugar?.region);
  if (!cidade || !uf) throw new SemLocalizacao('Não consegui saber em que cidade você está.');
  return { lat: posicao.coords.latitude, lon: posicao.coords.longitude, cidade, uf };
}

export async function unidadesPerto(grupo: GrupoUnidade, onde: { lat: number; lon: number; cidade: string; uf: string }) {
  return api.unidadesSus({ ...onde, grupo });
}
