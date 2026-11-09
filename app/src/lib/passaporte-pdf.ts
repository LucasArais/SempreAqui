import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';

import { fotos, pessoa } from '@/data/familia';
import { claro } from '@/theme/colors';

/**
 * Passaporte de Memória em PDF de uma página, para cuidador, centro-dia ou hospital.
 * Montado no próprio celular a partir de HTML, com as fotos embutidas.
 */

async function imagemBase64(modulo: number, tipo = 'image/jpeg') {
  try {
    const asset = Asset.fromModule(modulo);
    await asset.downloadAsync();
    const dados = await readAsStringAsync(asset.localUri ?? asset.uri, { encoding: 'base64' });
    return `data:${tipo};base64,${dados}`;
  } catch {
    return null;
  }
}

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function lista(itens: { titulo: string; detalhe?: string }[]) {
  return `<ul>${itens
    .map((i) => `<li><strong>${escapar(i.titulo)}</strong>${i.detalhe ? `<span>${escapar(i.detalhe)}</span>` : ''}</li>`)
    .join('')}</ul>`;
}

export async function gerarPassaportePdf(): Promise<string> {
  const [retrato, logo, ...rostos] = await Promise.all([
    imagemBase64(fotos.donaIsabel as number),
    imagemBase64(require('../../assets/simbolo.png'), 'image/png'),
    ...pessoa.pessoasImportantes.map((p) => (p.foto ? imagemBase64(p.foto as number) : Promise.resolve(null))),
  ]);
  const c = claro;
  const pessoas = pessoa.pessoasImportantes
    .map(
      (p, i) => `<div class="pessoa">
        ${rostos[i] ? `<img src="${rostos[i]}" />` : `<div class="inicial">${escapar(p.nome.replace('O ', '').replace('A ', '').charAt(0))}</div>`}
        <div><strong>${escapar(p.nome)}</strong><span>${escapar(p.relacao)}</span></div>
      </div>`,
    )
    .join('');
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 14mm 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${c.label}; font-size: 10.5pt; line-height: 1.35; margin: 0; }
    .topo { display: flex; gap: 16px; align-items: center; padding: 14px 16px; border-radius: 16px; background: ${c.accentSoft}; }
    .topo img { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; }
    .rotulo { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: ${c.accentStrong}; font-weight: 700; }
    h1 { font-size: 24pt; margin: 2px 0 2px; }
    .sub { color: ${c.secondaryLabel}; }
    .chamar { margin-top: 6px; font-size: 11.5pt; }
    .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .caixa { background: ${c.secondaryBackground}; border-radius: 12px; padding: 10px 12px; break-inside: avoid; }
    .caixa h2 { font-size: 11pt; margin: 0 0 6px; }
    .calma { background: ${c.successSoft}; } .calma h2 { color: ${c.success}; }
    .agita { background: ${c.attentionSoft}; } .agita h2 { color: ${c.attention}; }
    .larga { grid-column: span 2; }
    ul { margin: 0; padding-left: 16px; } li { margin-bottom: 4px; }
    li span { display: block; color: ${c.secondaryLabel}; font-size: 9.5pt; }
    p { margin: 0; }
    .pessoas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pessoa { display: flex; gap: 8px; align-items: center; }
    .pessoa img, .inicial { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: none; }
    .inicial { background: ${c.tons[0]}; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .pessoa span { display: block; color: ${c.secondaryLabel}; font-size: 9pt; }
    .rodape { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: ${c.secondaryLabel}; font-size: 8.5pt; }
    .rodape img { width: 26px; height: 26px; }
  </style></head><body>
    <div class="topo">
      ${retrato ? `<img src="${retrato}" />` : ''}
      <div>
        <div class="rotulo">Passaporte de Memória</div>
        <h1>${escapar(pessoa.comoGostaDeSerChamada)}</h1>
        <div class="sub">${escapar(pessoa.nome)}, ${pessoa.idade} anos</div>
        <div class="chamar">Gosta de ser chamada de <strong>${escapar(pessoa.comoGostaDeSerChamada)}</strong>.</div>
      </div>
    </div>
    <div class="grade">
      <div class="caixa larga"><h2>Quem ela é</h2><p>${escapar(pessoa.quemEla)}</p></div>
      <div class="caixa larga"><h2>Como se comunica</h2><p>${escapar(pessoa.comoSeComunica)}</p></div>
      <div class="caixa calma"><h2>O que acalma</h2>${lista(pessoa.acalma)}</div>
      <div class="caixa agita"><h2>O que agita</h2>${lista(pessoa.agita)}</div>
      <div class="caixa"><h2>Rotina</h2>${lista(pessoa.rotina)}</div>
      <div class="caixa"><h2>Músicas e comidas</h2>${lista(pessoa.musicasEComidas)}</div>
      <div class="caixa larga"><h2>Pessoas importantes</h2><div class="pessoas">${pessoas}</div></div>
    </div>
    <div class="rodape">
      ${logo ? `<img src="${logo}" />` : ''}
      <div>Organizado pela família no SempreAqui em ${hoje}. Para quem cuida da ${escapar(pessoa.comoGostaDeSerChamada)}: obrigado pelo carinho.</div>
    </div>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  return uri;
}
