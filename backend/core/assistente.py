"""Ajudante: o chat da família sobre o cuidado.

Responde só com o que está registrado no SempreAqui (Diário, semana, tarefas, Passaporte,
conversa do dia) e diz de onde veio cada resposta. Não inventa e não interpreta saúde:

- Risco e perguntas médicas passam pelo mesmo caminho do Apoio (core/apoio.py): 192 antes de
  tudo, recusa gentil para remédio, dose e diagnóstico.
- Situações difíceis ("ela está agitada") viram a resposta completa do Apoio, com fontes.
- O resto é reconhecido por intenção e respondido a partir dos dados, sem IA e sem custo.
- O que não reconhece volta como "nao_entendi" com um contexto curto. No iPhone com IA no
  aparelho, o app pode tentar responder com esse contexto, validando a resposta com os
  guardrails; sem isso, o Ajudante sugere perguntas que sabe responder.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import date, datetime

from core import apoio, guardrails

PERGUNTAS_SUGERIDAS = [
    "Como ela está hoje?",
    "Como foi a semana?",
    "Ela tem dormido bem?",
    "O que falta fazer esta semana?",
    "Do que ela gosta?",
    "Ela está agitada, o que eu faço?",
]

_INTENCOES: list[tuple[str, list[str]]] = [
    ("saudacao", [r"^(oi|ola|bom dia|boa tarde|boa noite|e ai|tudo bem)\b[\s!?.]*$"]),
    (
        "o_que_sabe",
        [
            r"o que (voce|vc) (sabe|faz)",
            r"como (voce|vc) (funciona|ajuda)",
            r"^ajuda[?!.]*$",
            r"quem e (voce|vc)",
        ],
    ),
    (
        "semana",
        [
            r"\bsemana\b",
            r"ultimos dias",
            r"esses dias",
            r"como (ela|ele|a mae|a vo|o pai) (tem )?(andado|estado|passado)",
        ],
    ),
    ("sono", [r"\bdorm", r"\bsono\b", r"\bnoite\b", r"acord"]),
    ("alimentacao", [r"\bcom(eu|endo|er|ida)\b", r"aliment", r"apetite", r"\bagua\b", r"bebe"]),
    (
        "remedios",
        [
            r"tom(ou|ando|a) (os |o )?remedi",
            r"remedios? (de|da|do) (hoje|ontem|manha|noite)",
            r"tomou tudo",
        ],
    ),
    ("humor", [r"\bhumor\b", r"\bfeliz\b", r"\btriste\b", r"animad", r"\bcalma\b"]),
    (
        "tarefas",
        [
            r"tarefa",
            r"falta fazer",
            r"\bconsulta\b",
            r"quem vai",
            r"quem (pode|consegue)",
            r"folga",
            r"o que (eu )?posso fazer pra ajudar",
            r"como (eu )?posso ajudar",
        ],
    ),
    (
        "gosta",
        [
            r"(do que|o que) (ela|ele) gosta",
            r"\bgosta de\b",
            r"\bmusica",
            r"comida (favorita|preferida)",
            r"o que acalma",
            r"o que agita",
            r"passaporte",
        ],
    ),
    ("conversa", [r"\bconversa\b", r"reminiscencia", r"sobre o que (falar|conversar)", r"assunto"]),
    (
        "hoje",
        [
            r"\bhoje\b",
            r"\bontem\b",
            r"como (ela|ele|a mae|a vo|o pai) (esta|ta|foi)",
            r"como foi o dia",
            r"ultimo relato",
            r"novidade",
        ],
    ),
]


def intencao(texto: str) -> str | None:
    base = guardrails.normalizar(texto).strip()
    for nome, padroes in _INTENCOES:
        if any(re.search(p, base) for p in padroes):
            return nome
    return None


def _data(iso: str) -> str:
    meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return f"{d.day} de {meses[d.month - 1]}"


def _quando(iso: str, hoje: date) -> str:
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).date()
    if d == hoje:
        return "hoje"
    if (hoje - d).days == 1:
        return "ontem"
    return f"em {_data(iso)}"


def _resposta(texto: str, origem: str | None = None, **extra) -> dict:
    return {"tipo": "resposta", "texto": texto, "origem": origem, **extra}


def _contagem(relatos: list[dict], campo: str, sub: str) -> Counter:
    valores = Counter()
    for r in relatos:
        v = ((r.get("registro") or {}).get(campo) or {}).get(sub)
        if v and v != "nao_informado":
            valores[v] += 1
    return valores


def _frase_contagem(contagem: Counter, rotulos: dict[str, str]) -> str:
    partes = [
        f"{rotulos.get(v, v.replace('_', ' '))} em {n} {'dia' if n == 1 else 'dias'}"
        for v, n in contagem.most_common()
    ]
    if not partes:
        return ""
    return partes[0] if len(partes) == 1 else ", ".join(partes[:-1]) + " e " + partes[-1]


def responder(pergunta: str, ctx: dict) -> dict:
    """ctx: passaporte, relatos (prontos, mais recentes primeiro), semana (fatos), tarefas,
    conversa (roteiro de hoje ou None), resumo_semana (se já existir), hoje (date)."""
    p = ctx["passaporte"]
    chamada = p.get("como_gosta_de_ser_chamada") or p.get("nome") or "ela"
    hoje: date = ctx["hoje"]
    relatos: list[dict] = ctx["relatos"]
    ultimos7 = [
        r
        for r in relatos
        if (hoje - datetime.fromisoformat(r["gravado_em"].replace("Z", "+00:00")).date()).days < 7
    ]

    # 1. Segurança primeiro: risco, pergunta médica e situações difíceis são o Apoio.
    classe = apoio.classificar(pergunta)
    situacoes = [s for s in apoio.situacoes(pergunta) if s not in ("recusa",)]
    tema = intencao(pergunta)
    base = guardrails.normalizar(pergunta)
    pede_ajuda = re.search(
        r"nao (quer|quis|aceita|deixa)|recus|o que (eu )?(faco|fazer)|como (eu )?(faco|lido)|me ajuda|socorro",
        base,
    )
    sobre_dados = tema in ("sono", "alimentacao", "humor", "remedios", "semana", "hoje")
    if classe in ("risco", "medica") or (situacoes and (pede_ajuda or not sobre_dados)):
        r = apoio.responder(pergunta, p, relatos)
        return {"tipo": "apoio", "apoio": r, "texto": None, "origem": None}

    if tema == "saudacao":
        return _resposta(
            f"Oi! Eu sou o Ajudante do SempreAqui. Posso contar como a {chamada} está, como foi a semana, "
            "o que falta fazer e o que costuma ajudar. Pergunte do seu jeito.",
            sugestoes=PERGUNTAS_SUGERIDAS[:4],
        )
    if tema == "o_que_sabe":
        return _resposta(
            "Eu respondo com o que a família registrou: o Diário, a semana, as tarefas, o Passaporte e a conversa do dia. "
            "Não digo o que um sintoma significa nem indico remédio: isso é com a equipe de saúde. Em risco, ligue 192.",
            sugestoes=PERGUNTAS_SUGERIDAS,
        )

    if tema == "hoje":
        if not relatos:
            return _resposta(
                f"Ainda não há relatos da {chamada}. Quando alguém gravar como foi o dia, eu conto aqui.",
                "Diário",
            )
        r = relatos[0]
        texto = f"O último relato é de {_quando(r['gravado_em'], hoje)}. {r.get('resumo') or ''}".strip()
        if r.get("alertas"):
            texto += " Esse relato fala de uma situação de risco. Se ainda houver risco, ligue 192."
        return _resposta(
            texto,
            f"Do Diário, {_data(r['gravado_em'])}",
            relato_id=r["id"],
            sugestoes=["Como foi a semana?", "Ela tem dormido bem?"],
        )

    if tema == "semana":
        s = ctx["semana"]
        if not s or not s.get("dias_com_relato"):
            return _resposta("Ainda não há relatos nesta semana.", "Diário")
        texto = (
            ctx.get("resumo_semana")
            or f"Na semana de {s['periodo']}, houve relato em {s['dias_com_relato']} de 7 dias."
        )
        mudancas = [m["texto"] for m in s.get("mudancas", [])][:3]
        if mudancas:
            texto += (
                " O que mudou em relação ao habitual: "
                + "; ".join(m[0].lower() + m[1:] for m in mudancas)
                + "."
            )
        return _resposta(
            texto,
            f"Da semana de {s['periodo']}, a partir do Diário",
            acao="ver_semana",
            sugestoes=["O que falta fazer esta semana?"],
        )

    if tema in ("sono", "alimentacao", "humor", "remedios"):
        if not ultimos7:
            return _resposta("Não há relatos nos últimos 7 dias para eu responder isso.", "Diário")
        n = len(ultimos7)
        if tema == "sono":
            frase = _frase_contagem(
                _contagem(ultimos7, "sono", "qualidade"),
                {"boa": "noite boa", "regular": "noite regular", "ruim": "noite ruim"},
            )
            horas = [
                h
                for r in ultimos7
                if (h := ((r.get("registro") or {}).get("sono") or {}).get("horas_aproximadas"))
            ]
            media = f"{sum(horas) / len(horas):.1f}".replace(".", ",").replace(",0", "")
            extra = f" Quando falaram das horas, foram em média {media} horas." if horas else ""
            texto = (
                f"Nos últimos 7 dias ({n} relatos): {frase or 'o sono não foi comentado'}.{extra}"
            )
        elif tema == "alimentacao":
            frase = _frase_contagem(
                _contagem(ultimos7, "alimentacao", "qualidade"),
                {
                    "boa": "comeu bem",
                    "regular": "comeu mais ou menos",
                    "pouca": "comeu pouco",
                    "recusou": "recusou comida",
                },
            )
            texto = (
                f"Nos últimos 7 dias ({n} relatos): {frase or 'a alimentação não foi comentada'}."
            )
        elif tema == "humor":
            frase = _frase_contagem(_contagem(ultimos7, "humor", "predominante"), {})
            bons = [
                m for r in ultimos7 for m in ((r.get("registro") or {}).get("momentos_bons") or [])
            ][:2]
            texto = f"Nos últimos 7 dias ({n} relatos), o humor mais citado: {frase or 'não comentado'}."
            if bons:
                texto += " Momentos bons: " + "; ".join(bons) + "."
        else:
            frase = _frase_contagem(
                _contagem(ultimos7, "medicacao", "tomou"),
                {"sim": "tomou todos", "nao": "não tomou", "parcial": "tomou só parte"},
            )
            texto = f"Nos últimos 7 dias ({n} relatos): {frase or 'os remédios não foram comentados'}. Dúvida sobre remédio ou dose é com a equipe de saúde."
        return _resposta(texto, "Do Diário dos últimos 7 dias", sugestoes=["Como foi a semana?"])

    if tema == "tarefas":
        abertas = [t for t in ctx["tarefas"] if not t["concluida"]]
        if not abertas:
            return _resposta(
                "Nenhuma tarefa aberta agora. Quer pedir ajuda com alguma coisa?",
                "Tarefas da família",
                acao="nova_tarefa",
            )
        livres = [t for t in abertas if not t.get("responsavel_nome")]
        linhas = [
            f"{t['titulo']} ({t['responsavel_nome'] or 'ninguém assumiu ainda'})"
            for t in abertas[:5]
        ]
        texto = "Tarefas abertas: " + "; ".join(linhas) + "."
        if livres:
            texto += f" Dá para assumir {'essa' if len(livres) == 1 else 'essas'} com um toque na aba Família."
        return _resposta(texto, "Tarefas da família", acao="ver_tarefas")

    if tema == "gosta":
        acalma = ", ".join(a["titulo"] for a in p.get("acalma", [])[:3])
        musicas = ", ".join(m["titulo"] for m in p.get("musicas", [])[:3])
        comidas = ", ".join(c["titulo"] for c in p.get("comidas", [])[:3])
        partes = [
            x
            for x in [
                f"O que acalma: {acalma}" if acalma else "",
                f"Músicas: {musicas}" if musicas else "",
                f"Comidas: {comidas}" if comidas else "",
            ]
            if x
        ]
        if not partes:
            return _resposta(
                f"O Passaporte da {chamada} ainda está vazio. Conte uma memória na aba Memórias e eu passo a saber.",
                "Passaporte",
                acao="ver_passaporte",
            )
        return _resposta(". ".join(partes) + ".", "Do Passaporte de Memória", acao="ver_passaporte")

    if tema == "conversa":
        c = ctx.get("conversa")
        if not c:
            return _resposta(
                "Ainda não há tema de conversa: conte memórias no Passaporte.",
                "Passaporte",
                acao="ver_passaporte",
            )
        return _resposta(
            f"A conversa de hoje é sobre {c['tema']}. Uma boa pergunta para começar: {c['perguntas'][0]}",
            "Da conversa do dia, montada do Passaporte",
            acao="abrir_conversa",
        )

    # Não reconhecido: contexto curto e verdadeiro para a IA do celular tentar, e perguntas que eu sei.
    contexto = _contexto(ctx, chamada)
    return {
        "tipo": "nao_entendi",
        "texto": "Essa eu ainda não sei responder com certeza. Posso falar destas coisas:",
        "origem": None,
        "sugestoes": PERGUNTAS_SUGERIDAS,
        "contexto": contexto,
    }


def _contexto(ctx: dict, chamada: str) -> str:
    """Fatos curtos e verdadeiros para a IA do celular responder sem inventar."""
    p = ctx["passaporte"]
    partes = [f"Pessoa: {chamada}."]
    if p.get("quem_ela"):
        partes.append(f"Quem ela é: {p['quem_ela']}")
    if ctx["relatos"]:
        r = ctx["relatos"][0]
        partes.append(f"Último relato ({_data(r['gravado_em'])}): {r.get('resumo') or ''}")
    if ctx.get("resumo_semana"):
        partes.append(f"Semana: {ctx['resumo_semana']}")
    abertas = [t["titulo"] for t in ctx["tarefas"] if not t["concluida"]][:4]
    if abertas:
        partes.append("Tarefas abertas: " + "; ".join(abertas) + ".")
    return "\n".join(partes)[:1500]
