/**
 * Roda os casos adversariais do backend (backend/evals/guardrails/casos.yaml) contra os
 * guardrails do celular (src/lib/guardrails.ts). Os dois precisam concordar em 100% dos casos.
 * Uso (Node 22.6 ou mais novo, a partir de app/):  node scripts/guardrails.ts
 */
import { readFileSync } from 'node:fs';

import { detectarRisco, verificarTextoFamilia } from '../src/lib/guardrails.ts';

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
