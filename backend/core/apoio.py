"""Apoio na Hora Difícil: quem cuida descreve a situação e recebe o que costuma funcionar.

Determinístico de propósito, porque é a hora em que errar custa mais:

1. Classifica o pedido. Risco (queda, engasgo, violência...) vem antes de tudo: 192 e avisar a
   família. Pergunta médica (dose, remédio, diagnóstico, "é normal?", "está piorando?") recebe uma
   recusa gentil e o encaminhamento à equipe de saúde, sem deixar a pessoa sem apoio prático.
2. Reconhece a situação (agitação, banho, comida, sono, cansaço de quem cuida...).
3. Cruza com o Passaporte (o que acalma, o que agita, como se comunica) e com o Diário (o que
   ajudou nos últimos 60 dias, com as datas). Cada sugestão diz de onde veio.
4. Busca trechos oficiais no acervo (core/fontes.py). Toda resposta tem ao menos uma fonte.

Sem IA no caminho, a resposta é previsível, explicável e coberta por evals
(evals/apoio/casos.yaml). A voz entra só para transcrever o pedido.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime

from core import guardrails
from core.fontes import TRECHOS, citacao

RECUSA_MEDICA = (
    "Sobre remédio, dose ou o que isso significa na saúde dela, quem pode orientar com segurança "
    "é a equipe de saúde que acompanha a {chamada}. Eu não indico remédio, não mudo dose e não "
    "digo o que um sinal quer dizer. Anote o que aconteceu e leve na próxima consulta, ou ligue "
    "para a unidade de saúde. Enquanto isso, o que costuma ajudar no dia a dia está abaixo."
)
MENSAGEM_AVISO = "Depois, avise a família pelo app: todos ficam sabendo na hora."

# Pedido de orientação médica. Falar de remédio não basta ("ela não quer tomar o remédio" é
# uma situação do dia a dia); precisa pedir dose, indicação, troca ou interpretação.
_REMEDIOS = (
    r"(remedio|remedios|medicamento|medicamentos|medicacao|comprimido|comprimidos|calmante|"
    r"calmantes|dipirona|paracetamol|rivotril|clonazepam|haloperidol|quetiapina|risperidona|"
    r"donepezila|memantina|rivastigmina|galantamina|melatonina|vitamina|cha calmante|adesivo)"
)
_MEDICA = [
    r"\b(dose|doses|dosagem|mg|miligramas?|gotas)\b",
    r"\b(posso|devo|pode|preciso|tenho que|da pra|vale|seria bom|e bom|tem problema)\b.{0,40}\b"
    r"(dar|tomar|aumentar|diminuir|reduzir|parar|suspender|trocar|tirar|dobrar|cortar|partir|"
    r"misturar|juntar|repetir)\b.{0,40}\b" + _REMEDIOS,
    r"\b(qual|que|algum|alguma|quais)\b.{0,25}\b" + _REMEDIOS + r"\b",
    r"\b" + _REMEDIOS + r"\b.{0,30}\b(serve|funciona|resolve|ajuda|faz mal|e perigoso|vicia)\b",
    r"\b(e normal|isso e normal|sera normal|e esperado)\b",
    r"\b(esta piorando|ta piorando|piorou|vai piorar|esta avancando|avancou|progredindo)\b",
    r"\b(qual|que|em que) (fase|estagio)\b",
    r"\b(fase|estagio) (inicial|moderad[ao]|avancad[ao]|grave|final)\b",
    r"\bdiagnostic",
    r"\b(e|sera|pode ser) (sintoma|sinal|alzheimer|demencia|depressao|infeccao|avc|derrame|delirium)\b",
    r"\b(sinal|sintoma|sinais|sintomas) de\b",
    r"\b(tem cura|quanto tempo (ela|ele) (ainda )?(tem|vai|vive)|vai morrer|expectativa de vida)\b",
    r"\bo que (ela|ele) tem\b",
]

# Situação -> palavras do pedido que a indicam (sem acento, minúsculas).
SITUACOES: dict[str, list[str]] = {
    "agitacao": [
        r"agitad",
        r"nervos",
        r"irritad",
        r"brav[ao]",
        r"grit",
        r"inquiet",
        r"ansios",
        r"quer ir embora",
        r"ir embora",
        r"ir para casa",
        r"ir pra casa",
        r"casa da mae",
        r"quer a mae",
        r"chama a mae",
        r"agressiv",
        r"xing",
        r"empurr",
        r"impaciente",
    ],
    "tristeza": [r"chor", r"triste", r"tristeza"],
    "banho": [r"banho", r"tomar banho", r"chuveiro", r"higiene"],
    "comer": [
        r"\bcomer\b",
        r"\bcome\b",
        r"comida",
        r"almoc",
        r"jant",
        r"aliment",
        r"apetite",
        r"refeic",
    ],
    "remedio_recusa": [
        r"nao (quer|quis|aceita|aceitou) (tomar )?(o |os )?remedio",
        r"cusp",
        r"recusa.{0,20}remedio",
    ],
    "sono": [
        r"dorm",
        r"\bsono\b",
        r"insonia",
        r"madrugada",
        r"acorda",
        r"acordou",
        r"de noite",
        r"a noite",
    ],
    "repeticao": [
        r"repet",
        r"mesma pergunta",
        r"toda hora",
        r"o tempo todo pergunta",
        r"pergunta de novo",
    ],
    "confusao": [
        r"confus",
        r"nao reconhece",
        r"nao me reconhece",
        r"nao sabe onde",
        r"desorient",
        r"perdid",
    ],
    "confusao_subita": [
        r"de repente",
        r"do nada",
        r"desde hoje",
        r"diferente do normal",
        r"muito sonolent",
    ],
    "cansaco": [
        r"cansad",
        r"exaust",
        r"nao aguento",
        r"nao aguento mais",
        r"esgotad",
        r"sozinh",
        r"culpa",
        r"raiva dela",
        r"perdi a paciencia",
        r"sem forca",
        r"no limite",
    ],
    "apatia": [
        r"nao quer fazer nada",
        r"desanimad",
        r"apatic",
        r"parad[ao] o dia",
        r"so quer ficar",
    ],
    "vestir": [r"vestir", r"roupa", r"trocar de roupa"],
    "sair": [r"quer sair", r"sair de casa", r"passear", r"caminhar", r"andar na rua"],
    "recusa": [r"nao quer", r"nao quis", r"recus", r"nao aceita"],
}

# Que partes do Passaporte servem para cada situação.
_PASSAPORTE_POR_SITUACAO = {
    "agitacao": ("acalma", "agita", "comunica"),
    "tristeza": ("acalma", "pessoas", "comunica"),
    "banho": ("acalma", "agita", "comunica"),
    "comer": ("comidas", "acalma"),
    "remedio_recusa": ("comunica", "acalma"),
    "sono": ("rotina", "acalma"),
    "repeticao": ("comunica", "acalma"),
    "confusao": ("comunica", "rotina", "acalma"),
    "apatia": ("acalma", "musicas", "lembrancas"),
    "vestir": ("comunica",),
    "sair": ("acalma", "rotina"),
    "recusa": ("comunica", "acalma", "agita"),
}

# Situações em que o que ajudou no Diário é relevante.
_DIARIO_AJUDA = {
    "agitacao",
    "tristeza",
    "sono",
    "repeticao",
    "confusao",
    "apatia",
    "recusa",
    "banho",
}

# Trecho geral quando nenhuma situação foi reconhecida: toda resposta tem fonte.
_TRECHO_PADRAO = "comunicacao"


def normalizar(texto: str) -> str:
    return guardrails.normalizar(texto)


def classificar(texto: str) -> str:
    """'risco', 'medica' ou 'geral'. Risco vence tudo."""
    if guardrails.detectar_risco(texto):
        return "risco"
    base = normalizar(texto)
    if any(re.search(p, base) for p in _MEDICA):
        return "medica"
    return "geral"


def situacoes(texto: str) -> list[str]:
    base = normalizar(texto)
    achadas = [s for s, padroes in SITUACOES.items() if any(re.search(p, base) for p in padroes)]
    # "recusa" genérica só vale se nenhuma recusa específica foi reconhecida.
    if "recusa" in achadas and {"banho", "comer", "remedio_recusa", "vestir"} & set(achadas):
        achadas.remove("recusa")
    if "remedio_recusa" in achadas:
        achadas = [s for s in achadas if s != "comer"]
    return achadas


def _data_curta(iso: str) -> str:
    meses = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
    ]
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return f"{d.day} de {meses[d.month - 1]}"


def _o_que_ajudou(relatos: list[dict]) -> list[dict]:
    """O que ajudou no Diário, do mais frequente ao menos, com as datas."""
    datas: dict[str, list[str]] = {}
    nomes: dict[str, str] = {}
    contagem: Counter[str] = Counter()
    for r in relatos:
        registro = r.get("registro") or {}
        for item in registro.get("o_que_ajudou") or []:
            chave = normalizar(item).strip()
            if not chave:
                continue
            nomes.setdefault(chave, item)
            contagem[chave] += 1
            datas.setdefault(chave, []).append(r["gravado_em"])
    saida = []
    for chave, vezes in contagem.most_common(3):
        quando = sorted(datas[chave])[-3:]
        saida.append(
            {"titulo": nomes[chave], "vezes": vezes, "datas": [_data_curta(d) for d in quando]}
        )
    return saida


def _sugestoes(
    passaporte: dict, relatos: list[dict], achadas: list[str], chamada: str
) -> list[dict]:
    partes: list[str] = []
    for s in achadas:
        for p in _PASSAPORTE_POR_SITUACAO.get(s, ()):
            if p not in partes:
                partes.append(p)
    sugestoes: list[dict] = []

    def incluir(titulo: str, texto: str, origem: str) -> None:
        if guardrails.verificar_texto_familia(f"{titulo} {texto}"):
            return
        chave = normalizar(titulo)
        for s in sugestoes:
            outra = normalizar(s["titulo"])
            if chave in outra or outra in chave:
                # O mesmo que já está na lista, vindo de outro lugar: junta as origens.
                if origem not in s["origem"]:
                    s["origem"] += f". {origem}"
                    if texto and texto not in s["texto"]:
                        s["texto"] += f" {texto}"
                return
        sugestoes.append({"titulo": titulo, "texto": texto, "origem": origem})

    if _DIARIO_AJUDA & set(achadas):
        for item in _o_que_ajudou(relatos)[:2]:
            vezes = "1 vez" if item["vezes"] == 1 else f"{item['vezes']} vezes"
            incluir(
                item["titulo"][0].upper() + item["titulo"][1:],
                f"Já ajudou {vezes} nas últimas semanas, segundo o Diário.",
                "Do Diário: " + ", ".join(item["datas"]),
            )
    if "acalma" in partes:
        for a in passaporte.get("acalma", [])[:3]:
            incluir(
                a["titulo"],
                a.get("detalhe") or f"Costuma acalmar a {chamada}.",
                "Do Passaporte: o que acalma",
            )
    if "comidas" in partes:
        favoritas = ", ".join(c["titulo"] for c in passaporte.get("comidas", [])[:3])
        if favoritas:
            incluir(
                "Ofereça o que ela gosta",
                f"As comidas favoritas dela: {favoritas}.",
                "Do Passaporte: comidas",
            )
    if "musicas" in partes:
        for m in passaporte.get("musicas", [])[:2]:
            artista = f", {m['artista']}" if m.get("artista") else ""
            incluir(
                f'Coloque "{m["titulo"]}"',
                f"Uma música que ela gosta{artista}.",
                "Do Passaporte: músicas",
            )
    if "lembrancas" in partes:
        for lem in passaporte.get("lembrancas", [])[:1]:
            incluir(
                f"Converse sobre {lem['titulo'].lower()}",
                "A conversa do dia no app ajuda com perguntas gentis.",
                "Do Passaporte: lembranças",
            )
    if "rotina" in partes:
        for r in passaporte.get("rotina", [])[:3]:
            incluir(
                r["titulo"],
                r.get("detalhe") or "Faz parte da rotina dela.",
                "Do Passaporte: rotina",
            )
    if "pessoas" in partes:
        for p in passaporte.get("pessoas_importantes", [])[:2]:
            incluir(
                f"Fale de {p['nome']}",
                p.get("relacao") or "Uma pessoa importante para ela.",
                "Do Passaporte: pessoas importantes",
            )
    if "comunica" in partes and passaporte.get("como_se_comunica"):
        incluir(
            "Do jeito que ela entende melhor",
            passaporte["como_se_comunica"],
            "Do Passaporte: como se comunica",
        )
    if "agita" in partes:
        for g in passaporte.get("agita", [])[:2]:
            incluir(
                f"Evite: {g['titulo'].lower()}",
                g.get("detalhe") or f"Costuma agitar a {chamada}.",
                "Do Passaporte: o que agita",
            )
    return sugestoes[:7]


def _fontes(achadas: list[str], tipo: str) -> list[dict]:
    temas = set(achadas)
    if tipo == "medica":
        temas |= {"remedio"}
    pontuados = []
    for i, t in enumerate(TRECHOS):
        pontos = len(temas & set(t["temas"]))
        if pontos:
            pontuados.append((-pontos, i, t))
    escolhidos = [t for _, _, t in sorted(pontuados)[:2]]
    if not escolhidos:
        escolhidos = [next(t for t in TRECHOS if t["id"] == _TRECHO_PADRAO)]
    return [citacao(t) for t in escolhidos]


def responder(texto: str, passaporte: dict, relatos: list[dict]) -> dict:
    """Monta a resposta completa. relatos: os do Diário dos últimos 60 dias, já prontos."""
    chamada = passaporte.get("como_gosta_de_ser_chamada") or passaporte.get("nome") or "pessoa"
    tipo = classificar(texto)
    achadas = situacoes(texto)
    acoes: list[str] = []
    aviso = None
    if tipo == "risco":
        aviso = f"{guardrails.MENSAGEM_RISCO} {MENSAGEM_AVISO}"
        acoes = ["ligar_192", "avisar_familia"]
    elif tipo == "medica":
        aviso = RECUSA_MEDICA.format(chamada=chamada)
    if "cansaco" in achadas:
        acoes.append("pedir_ajuda_familia")
    if "confusao_subita" in achadas and tipo != "risco":
        acoes.append("ligar_unidade")
        aviso = aviso or (
            "Mudança de repente pede atenção ainda hoje: procure a UBS ou a UPA. "
            "Se houver risco agora, ligue 192 (SAMU)."
        )
    sugestoes = [] if tipo == "risco" else _sugestoes(passaporte, relatos, achadas, chamada)
    return {
        "tipo": tipo,
        "situacoes": achadas,
        "aviso": aviso,
        "sugestoes": sugestoes,
        "fontes": _fontes(achadas, tipo),
        "acoes": acoes,
        "chamada": chamada,
    }


def textos_da_resposta(resposta: dict) -> list[str]:
    """Todo texto que a família vê, para os evals conferirem com os guardrails."""
    textos = [resposta["aviso"] or ""]
    textos += [f"{s['titulo']} {s['texto']} {s['origem']}" for s in resposta["sugestoes"]]
    textos += [f["texto"] for f in resposta["fontes"]]
    return [t for t in textos if t]
