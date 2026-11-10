"""Página somente leitura do Passaporte de Memória, para quem recebe o link.

Mostra só o passaporte: nada do Diário, nada de saúde. HTML simples, sem JavaScript, que abre
em qualquer celular. Todo texto da família passa por html.escape.
"""

from __future__ import annotations

from collections.abc import Callable
from html import escape

_ESTILO = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif;
  color: #1C1C1E; background: #F2F2F7; line-height: 1.45; font-size: 17px; }
main { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }
.topo { background: #E6F0FA; border-radius: 20px; padding: 20px; display: flex; gap: 16px; align-items: center; }
.topo img { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; flex: none; }
.rotulo { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #1F5F99; font-weight: 700; }
h1 { font-size: 28px; margin: 2px 0; }
.sub { color: #3C3C43; }
section { background: #fff; border-radius: 16px; padding: 14px 16px; margin-top: 12px; }
h2 { font-size: 18px; margin: 0 0 8px; }
.calma h2 { color: #1E7A3C; } .agita h2 { color: #9A5B00; }
ul { margin: 0; padding-left: 20px; } li { margin-bottom: 6px; }
li span { display: block; color: #3C3C43; font-size: 15px; }
.pessoas { display: grid; gap: 10px; }
.pessoa { display: flex; gap: 10px; align-items: center; }
.pessoa img, .inicial { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none; }
.inicial { background: #E6F0FA; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.pessoa span { display: block; color: #3C3C43; font-size: 15px; }
.fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.fotos figure { margin: 0; } .fotos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
.fotos figcaption { font-size: 13px; color: #3C3C43; }
footer { margin-top: 20px; font-size: 14px; color: #3C3C43; text-align: center; }
"""


def _lista(itens: list[dict], titulo: str = "titulo", detalhe: str = "detalhe") -> str:
    if not itens:
        return "<p class='sub'>Ainda não preenchido.</p>"
    linhas = []
    for i in itens:
        extra = f"<span>{escape(i[detalhe])}</span>" if i.get(detalhe) else ""
        linhas.append(f"<li><strong>{escape(i[titulo])}</strong>{extra}</li>")
    return "<ul>" + "".join(linhas) + "</ul>"


def renderizar(p: dict, url_foto: Callable[[str], str]) -> str:
    chamada = p.get("como_gosta_de_ser_chamada") or p.get("nome") or "Ela"
    sub = ", ".join(
        x for x in [p.get("nome") or "", f"{p['idade']} anos" if p.get("idade") else ""] if x
    )
    retrato = f"<img src='{escape(url_foto(p['foto']))}' alt=''>" if p.get("foto") else ""
    pessoas = []
    for x in p.get("pessoas_importantes", []):
        rosto = (
            f"<img src='{escape(url_foto(x['foto']))}' alt=''>"
            if x.get("foto")
            else f"<div class='inicial'>{escape(x['nome'][:1])}</div>"
        )
        relacao = f"<span>{escape(x['relacao'])}</span>" if x.get("relacao") else ""
        pessoas.append(
            f"<div class='pessoa'>{rosto}<div><strong>{escape(x['nome'])}</strong>{relacao}</div></div>"
        )
    fotos = [
        f"<figure><img src='{escape(url_foto(lem['foto']))}' alt='{escape(lem['titulo'])}'>"
        f"<figcaption>{escape(lem['titulo'])}</figcaption></figure>"
        for lem in p.get("lembrancas", [])
        if lem.get("foto")
    ]
    lembrancas = [lem for lem in p.get("lembrancas", []) if not lem.get("foto")]
    musicas = [{"titulo": m["titulo"], "detalhe": m.get("artista")} for m in p.get("musicas", [])]
    secoes = [
        f"<section><h2>Quem ela é</h2><p>{escape(p.get('quem_ela') or 'Ainda não preenchido.')}</p></section>",
        f"<section><h2>Como se comunica</h2><p>{escape(p.get('como_se_comunica') or 'Ainda não preenchido.')}</p></section>",
        f"<section class='calma'><h2>O que acalma</h2>{_lista(p.get('acalma', []))}</section>",
        f"<section class='agita'><h2>O que agita</h2>{_lista(p.get('agita', []))}</section>",
        f"<section><h2>Rotina</h2>{_lista(p.get('rotina', []))}</section>",
        f"<section><h2>Pessoas importantes</h2><div class='pessoas'>{''.join(pessoas) or 'Ainda não preenchido.'}</div></section>",
        f"<section><h2>Músicas</h2>{_lista(musicas)}</section>",
        f"<section><h2>Comidas</h2>{_lista(p.get('comidas', []))}</section>",
    ]
    if fotos or lembrancas:
        secoes.append(
            "<section><h2>Lembranças</h2>"
            + (f"<div class='fotos'>{''.join(fotos)}</div>" if fotos else "")
            + (_lista(lembrancas) if lembrancas else "")
            + "</section>"
        )
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Passaporte de Memória: {escape(chamada)}</title>
<style>{_ESTILO}</style></head>
<body><main>
<div class="topo">{retrato}<div><div class="rotulo">Passaporte de Memória</div>
<h1>{escape(chamada)}</h1><div class="sub">{escape(sub)}</div></div></div>
{"".join(secoes)}
<footer>Compartilhado pela família no SempreAqui, somente para leitura.<br>
Obrigado por cuidar da {escape(chamada)} com carinho.</footer>
</main></body></html>"""
