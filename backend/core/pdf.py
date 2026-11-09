"""PDF de uma página "Para levar na consulta". Fatos da família, sem interpretação."""

from __future__ import annotations

from fpdf import FPDF

QUALIDADE = {"boa": "Boa", "regular": "Regular", "ruim": "Ruim", "nao_informado": "-", None: "-"}


def _latin(texto: str) -> str:
    # As fontes padrão do PDF usam latin-1: cobre o português, mas não aspas curvas e afins.
    trocas = {"\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'", "\u2014": ",", "\u2013": ","}
    for a, b in trocas.items():
        texto = texto.replace(a, b)
    return texto.encode("latin-1", "replace").decode("latin-1")


def pdf_consulta(fatos: dict, nome: str) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    pdf.set_margins(18, 16, 18)
    largura = pdf.w - 36

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(largura, 10, _latin("Para levar na consulta"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(90, 90, 95)
    pdf.cell(
        largura,
        6,
        _latin(f"{nome}, {fatos['periodo']}. Registros feitos pela família no SempreAqui."),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)

    pdf.set_text_color(28, 28, 30)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(largura, 7, _latin("O que a família observou"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    for item in fatos["para_consulta"]:
        pdf.multi_cell(largura, 6, _latin(f"-  {item}."), new_x="LMARGIN", new_y="NEXT")
    if fatos["mudancas"]:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(largura, 7, _latin("Diferente do habitual"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
        for m in fatos["mudancas"]:
            pdf.multi_cell(largura, 6, _latin(f"-  {m['texto']}."), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(largura, 7, _latin("Sono dia a dia"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    col = largura / 7
    for d in fatos["dias"]:
        pdf.cell(col, 6, _latin(d["dia"]), border=1, align="C")
    pdf.ln()
    for d in fatos["dias"]:
        pdf.cell(
            col,
            6,
            _latin(QUALIDADE.get(d["sono_qualidade"], "-") if d["tem_relato"] else "sem relato"),
            border=1,
            align="C",
        )
    pdf.ln()
    for d in fatos["dias"]:
        horas = f"{d['sono_horas']:g} h".replace(".", ",") if d.get("sono_horas") else "-"
        pdf.cell(col, 6, _latin(horas), border=1, align="C")
    pdf.ln()

    pdf.set_y(-26)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(90, 90, 95)
    pdf.multi_cell(
        largura,
        5,
        _latin(
            "Organizado automaticamente a partir dos relatos de voz da família. Não é avaliação médica: "
            "quem interpreta é a equipe de saúde. Em caso de emergência, ligue 192."
        ),
    )
    return bytes(pdf.output())
