/**
 * Valida o contraste WCAG das cores do tema, em modo claro e escuro.
 * Uso (Node 22.6 ou mais novo, a partir de app/):  node scripts/contraste.ts
 */
import { claro, escuro, paresDeContraste, paresNaoTextuais, type Cores } from '../src/theme/colors.ts';

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let falhas = 0;
const linhas: string[] = ['| Modo | Texto | Fundo | Contraste | Mínimo | Resultado |', '|---|---|---|---|---|---|'];

for (const [nome, cores] of [['claro', claro], ['escuro', escuro]] as [string, Cores][]) {
  const grupos: [[keyof Cores, keyof Cores][], number][] = [
    [paresDeContraste, 4.5],
    [paresNaoTextuais, 3],
  ];
  for (const [pares, minimo] of grupos) {
    for (const [frente, fundo] of pares) {
      const valor = contraste(cores[frente] as string, cores[fundo] as string);
      const ok = valor >= minimo;
      if (!ok) falhas++;
      linhas.push(
        `| ${nome} | ${frente} | ${fundo} | ${valor.toFixed(2)}:1 | ${minimo}:1 | ${ok ? 'passa' : 'FALHA'} |`,
      );
    }
  }
}

console.log(linhas.join('\n'));
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares passam no WCAG AA.');
process.exit(falhas ? 1 : 0);
