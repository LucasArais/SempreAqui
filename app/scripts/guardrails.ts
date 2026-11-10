/**
 * Roda os casos adversariais do backend (backend/evals/guardrails/casos.yaml) contra os
 * guardrails do celular (src/lib/guardrails.ts). Os dois precisam concordar em 100% dos casos.
 * Uso (Node 22.6 ou mais novo, a partir de app/):  node scripts/guardrails.ts
 */
import { readFileSync } from 'node:fs';

import { detectarRisco, validarPerguntas, verificarTextoFamilia } from '../src/lib/guardrails.ts';

const yaml = readFileSync(new URL('../../backend/evals/guardrails/casos.yaml', import.meta.url), 'utf8');
let secao = '';
let erros = 0;
let total = 0;
for (const linha of yaml.split('\n')) {
  const cabecalho = linha.match(/^(\w+):\s*$/);
  if (cabecalho) secao = cabecalho[1];
  const caso = linha.match(/^\s*- \{texto: ("(?:[^"\\]|\\.)*"), (bloquear|risco): (true|false)/);
  if (!caso) continue;
  const texto = JSON.parse(caso[1]) as string;
  const esperado = caso[3] === 'true';
  const obtido = secao === 'texto_familia' ? verificarTextoFamilia(texto).length > 0 : detectarRisco(texto).length > 0;
  total++;
  if (obtido !== esperado) {
    erros++;
    console.error(`Divergência (${secao}): esperado ${esperado}, obtido ${obtido}: ${texto}`);
  }
}
if (!total || erros) {
  console.error(`${erros} de ${total} casos divergem do backend.`);
  process.exit(1);
}
console.log(`Guardrails do celular: ${total} de ${total} casos iguais ao backend.`);

// Perguntas da conversa de hoje escritas pela IA do celular.

const perguntas: [string, boolean][] = [
  ['O que a senhora vê nessa foto?', true],
  ['Que cheiro tinha a cozinha da sua mãe?', true],
  ['A senhora lembra do nome dele?', false],
  ['Você se recorda desse dia?', false],
  ['Ela esqueceu quem é o filho?', false],
  ['Como era o paciente nessa época?', false],
  ['Conta mais.', false],
];
const erradas = perguntas.filter(([p, ok]) => validarPerguntas([p]).length === (ok ? 0 : 1));
if (erradas.length) {
  console.error('Validação de perguntas divergente:', erradas);
  process.exit(1);
}
console.log(`Perguntas da conversa: ${perguntas.length} de ${perguntas.length} casos corretos.`);
