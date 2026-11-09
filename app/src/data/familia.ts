/**
 * Família fictícia usada nas telas enquanto o app não conversa com a API.
 * Os formatos seguem os schemas do backend (backend/core/schemas) para a troca ser direta.
 * Nenhum dado aqui é de pessoa real.
 */
import type { ImageSource } from 'expo-image';

import type { NomeIcone } from '@/components';

/** Retratos gerados por IA. São pessoas fictícias, sem relação com ninguém real. */
export const fotos: Record<string, ImageSource> = {
  donaIsabel: require('../../assets/fotos/dona-isabel.jpg'),
  claudia: require('../../assets/fotos/claudia.jpg'),
  rafael: require('../../assets/fotos/rafael.jpg'),
  neta: require('../../assets/fotos/neta.jpg'),
  cuidador: require('../../assets/fotos/cuidador.jpg'),
  marido: require('../../assets/fotos/marido.jpg'),
  familiaReunida: require('../../assets/fotos/familia-reunida.jpg'),
  atelie: require('../../assets/fotos/atelie-1978.jpg'),
  claudiaPequena: require('../../assets/fotos/claudia-pequena.jpg'),
  saoJoao: require('../../assets/fotos/sao-joao.jpg'),
  casa: require('../../assets/fotos/casa-rua-das-flores.jpg'),
  aniversario: require('../../assets/fotos/aniversario-81.jpg'),
};

export const quemUsa = { nome: 'Cláudia', papel: 'Quem cuida' };

export const pessoa = {
  nome: 'Isabel',
  comoGostaDeSerChamada: 'Dona Isabel',
  idade: 81,
  cidade: 'São Paulo, SP',
  quemEla:
    'Costureira por 40 anos, fez vestidos de noiva para meia cidade. Gosta de casa cheia, de café passado na hora e de conversar sobre o tempo do ateliê.',
  comoSeComunica:
    'Entende melhor frases curtas, uma coisa de cada vez. Quando aperta a mão da gente, quer companhia. Chama a Cláudia de "minha menina".',
  pessoasImportantes: [
    { nome: 'O marido', relacao: 'Falecido em 2015. Se conheceram num baile de São João', tom: 0, foto: fotos.marido },
    { nome: 'Cláudia', relacao: 'Filha, mora com ela', tom: 1, foto: fotos.claudia },
    { nome: 'Rafael', relacao: 'Filho, mora em Recife', tom: 2, foto: fotos.rafael },
    { nome: 'A neta', relacao: 'Filha da Cláudia, canta com ela aos domingos', tom: 3, foto: fotos.neta },
  ],
  rotina: [
    { titulo: 'Acorda por volta das 7h', detalhe: 'Café com leite e pão na chapa' },
    { titulo: 'Cochilo depois do almoço', detalhe: 'Na poltrona da sala, uns 40 minutos' },
    { titulo: 'Fim da tarde', detalhe: 'Novela e chá de camomila' },
  ],
  acalma: [
    { titulo: 'Roberto Carlos', detalhe: 'Principalmente "Detalhes". Ela canta junto' },
    { titulo: 'Retalhos de tecido', detalhe: 'Gosta de dobrar e separar por cor' },
    { titulo: 'Ligação de vídeo com o Rafael', detalhe: 'Funciona melhor de manhã' },
  ],
  agita: [
    { titulo: 'Barulho e muita gente', detalhe: 'Festas grandes, TV alta' },
    { titulo: 'Pressa no banho', detalhe: 'Avisar antes de cada passo' },
    { titulo: 'Fim da tarde', detalhe: 'Às vezes pergunta pela casa da mãe dela' },
  ],
  musicasEComidas: [
    { titulo: 'Músicas', detalhe: 'Roberto Carlos, forró de São João, hinos da igreja', icone: 'musica' as NomeIcone },
    { titulo: 'Comidas', detalhe: 'Sopa de legumes, pão de queijo, doce de abóbora', icone: 'comida' as NomeIcone },
  ],
  fotos: [
    { legenda: 'O ateliê, 1978', tom: 0, icone: 'foto' as NomeIcone, fonte: fotos.atelie },
    { legenda: 'São João na praça, 1965', tom: 3, icone: 'musica' as NomeIcone, fonte: fotos.saoJoao },
    { legenda: 'Com a Cláudia pequena, 1978', tom: 2, icone: 'familia' as NomeIcone, fonte: fotos.claudiaPequena },
    { legenda: 'A casa da Rua das Flores', tom: 4, icone: 'casa' as NomeIcone, fonte: fotos.casa },
    { legenda: '81 anos, com a neta', tom: 0, icone: 'coracao' as NomeIcone, fonte: fotos.aniversario },
    { legenda: 'Todos juntos, 2026', tom: 1, icone: 'familia' as NomeIcone, fonte: fotos.familiaReunida },
  ],
  fontesDoPassaporte: '6 áudios, 12 fotos e 3 textos enviados pela família',
};

export const familia = [
  { nome: 'Cláudia', papel: 'Quem cuida', cidade: 'Mora com a Dona Isabel', tom: 1, foto: fotos.claudia },
  { nome: 'Rafael', papel: 'Familiar', cidade: 'Recife', tom: 2, foto: fotos.rafael },
  { nome: 'A neta', papel: 'Familiar', cidade: 'São Paulo', tom: 3, foto: fotos.neta },
  { nome: 'Cuidador profissional', papel: 'Terças e quintas', cidade: 'Contratado pela família', tom: 4, foto: fotos.cuidador },
];

export type Tarefa = { id: string; titulo: string; quando: string; quem: string; feita: boolean; hoje?: boolean };

export const tarefas: Tarefa[] = [
  { id: 't1', titulo: 'Ligar para a Dona Isabel', quando: 'Hoje, 10h', quem: 'Rafael', feita: true, hoje: true },
  { id: 't2', titulo: 'Comprar fraldas e lenços', quando: 'Hoje', quem: 'A neta', feita: false, hoje: true },
  { id: 't3', titulo: 'Consulta na UBS', quando: 'Quinta, 9h', quem: 'Cláudia, com o Rafael por vídeo', feita: false },
  { id: 't4', titulo: 'Cobrir a folga da Cláudia', quando: 'Sábado à tarde', quem: 'A neta', feita: false },
];

export const diarioDeHoje = {
  original:
    'Hoje foi um dia bom. A mãe dormiu bem, acordou só uma vez de madrugada pra ir ao banheiro, deu umas sete horas de sono. No almoço comeu pouco, mas no fim da tarde aceitou a sopa. Os remédios ela tomou certinho. Lá pelas quatro ficou um pouco ansiosa, perguntando pela casa da mãe dela. Coloquei Roberto Carlos e ela foi se acalmando, até cantou junto. O Rafael ligou por vídeo e ela sorriu muito.',
  resumo:
    'A Dona Isabel teve um dia bom. Dormiu bem e tomou os remédios. No fim da tarde ficou ansiosa, e as músicas do Roberto Carlos ajudaram de novo. A ligação do Rafael fez ela sorrir muito.',
  campos: [
    { rotulo: 'Sono', valor: 'Bom, cerca de 7 horas. Acordou 1 vez', icone: 'sono' as NomeIcone },
    { rotulo: 'Alimentação', valor: 'Comeu pouco no almoço, aceitou a sopa', icone: 'comida' as NomeIcone },
    { rotulo: 'Humor', valor: 'Calma na maior parte do dia', icone: 'humor' as NomeIcone },
    { rotulo: 'Remédios', valor: 'Tomou todos', icone: 'remedio' as NomeIcone },
    { rotulo: 'O que ajudou', valor: 'Músicas do Roberto Carlos', icone: 'calma' as NomeIcone },
  ],
};

export const semana = {
  periodo: '3 a 9 de novembro',
  resumo:
    'Uma semana mais calma que a anterior. A Dona Isabel dormiu bem em cinco das sete noites e cantou com a neta no domingo. A Cláudia registrou cansaço na terça e na quarta.',
  original:
    'Terça: noite difícil, acordou quatro vezes, não quis o remédio da manhã. Quarta: de novo acordou várias vezes, eu estou exausta. Domingo: a Bia veio e as duas cantaram a tarde toda.',
  mudancas: [
    'Acordou mais vezes à noite na terça e na quarta. O habitual é 1 vez',
    'Recusou o remédio da manhã em 2 dias',
  ],
  sono: [
    { dia: 'Seg', horas: 7 },
    { dia: 'Ter', horas: 4 },
    { dia: 'Qua', horas: 5 },
    { dia: 'Qui', horas: 7 },
    { dia: 'Sex', horas: 7.5 },
    { dia: 'Sáb', horas: 8 },
    { dia: 'Dom', horas: 7 },
  ],
  habitualSono: 7,
  paraConsulta: [
    'Sono: duas noites com 4 a 5 horas (terça e quarta). Nas outras, cerca de 7 horas',
    'Remédio da manhã recusado na terça e na quarta',
    'Comeu pouco no almoço em 3 dias',
    'Nenhuma queda ou situação de risco registrada',
  ],
};

export const feed = [
  {
    id: 'f1',
    autor: 'Cláudia',
    quando: 'Hoje, 21h',
    resumo: diarioDeHoje.resumo,
    original: diarioDeHoje.original,
  },
  {
    id: 'f2',
    autor: 'Cláudia',
    quando: 'Quarta, 22h',
    resumo:
      'Noite difícil. A Dona Isabel acordou várias vezes procurando a bolsa e não quis o remédio da manhã. A Cláudia está muito cansada. Alguém pode cobrir a folga de sábado?',
    original:
      'De novo acordou várias vezes procurando a bolsa. De manhã não quis tomar o remédio de jeito nenhum. Eu estou exausta, se alguém pudesse ficar com ela no sábado eu agradecia.',
  },
];

export const sessao = {
  tema: 'Os vestidos de noiva',
  duracao: '5 a 10 minutos',
  // link: o vídeo exato escolhido pela família. Sem link, abre a busca no YouTube.
  musica: { titulo: 'Detalhes', artista: 'Roberto Carlos', link: undefined as string | undefined },
  foto: { legenda: 'O ateliê de costura, 1978', tom: 0, icone: 'foto' as NomeIcone, fonte: fotos.atelie },
  passos: [
    'Olha que foto bonita. O que a senhora vê aqui?',
    'Me conta como era fazer um vestido de noiva. Qual parte a senhora mais gostava?',
    'Esse tecido é macio, né? Que pano a senhora gostava de usar?',
    'Foi muito bom ouvir a senhora. Vamos escutar Roberto Carlos?',
  ],
};

export const reacoes = [
  { id: 'gostou_muito', rotulo: 'Gostou muito', icone: 'coracao' as NomeIcone },
  { id: 'gostou', rotulo: 'Gostou', icone: 'humor' as NomeIcone },
  { id: 'neutra', rotulo: 'Ficou indiferente', icone: 'pendente' as NomeIcone },
  { id: 'desconforto', rotulo: 'Ficou desconfortável', icone: 'atencao' as NomeIcone },
];

export const apoio = {
  exemplo: 'Ela está agitada e quer ir embora para a casa da mãe dela.',
  sugestoes: [
    {
      titulo: 'Coloque Roberto Carlos',
      texto: 'Nas últimas 3 vezes que ela ficou assim no fim da tarde, a música ajudou em poucos minutos.',
      origem: 'Do Diário: 3, 5 e 9 de novembro',
    },
    {
      titulo: 'Converse sobre a mãe dela, sem corrigir',
      texto: 'Pergunte como era a casa da mãe. Ela gosta de contar do quintal e das galinhas.',
      origem: 'Do Passaporte de Memória',
    },
    {
      titulo: 'Ofereça os retalhos de tecido',
      texto: 'Dobrar e separar por cor costuma acalmar as mãos e a cabeça.',
      origem: 'Do Passaporte de Memória',
    },
  ],
  orientacaoGeral:
    'Em momentos de agitação, fale devagar, com frases curtas, e evite discutir ou corrigir. Se a agitação ficar frequente, converse com a equipe de saúde.',
  fonte: {
    titulo: 'Ministério da Saúde: Alzheimer',
    url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/alzheimer',
  },
};
