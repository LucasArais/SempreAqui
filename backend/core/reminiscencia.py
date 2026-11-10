"""Conversa de hoje: um tema do Passaporte e perguntas gentis que mudam todo dia.

Sem IA de propósito. As perguntas vêm de um banco de roteiros escritos à mão, revisados para
nunca testar a memória ("você lembra?") e nunca corrigir a pessoa. A IA, quando entrar, só
personaliza a partir daqui. Assim a conversa funciona sempre, de graça e sem risco de inventar.

Como o tema é escolhido:
- Candidatos: lembranças, pessoas importantes, músicas, comidas, o que acalma e a história.
- Tema usado nos últimos 3 dias fica de fora, para não repetir.
- Reação registrada pela família pesa: "gostou muito" puxa o tema de volta mais vezes,
  "ficou desconfortável" tira o tema da roda por 3 semanas.
- O sorteio usa a data e a família como semente: o mesmo dia mostra a mesma conversa,
  o dia seguinte mostra outra.
"""

from __future__ import annotations

import hashlib
import random
import re
from dataclasses import dataclass, field
from datetime import date

REACOES = ("gostou_muito", "gostou", "neutra", "desconforto")
PESO_REACAO = {"gostou_muito": 3.0, "gostou": 1.5, "neutra": -0.5}
DIAS_SEM_REPETIR = 3
DIAS_DE_PAUSA_DESCONFORTO = 21

# Perguntas que testam a memória ou corrigem a pessoa. Nenhum roteiro pode ter isso.
PROIBIDO = re.compile(r"\b(lembra|lembrar|recorda|esqueceu|esquecer|não é isso|nao e isso)\b", re.I)

FECHAMENTOS = [
    "Foi muito bom conversar com a senhora.",
    "Que bom ouvir a senhora contar isso.",
    "Adorei essa conversa. Vamos ouvir uma música?",
    "Obrigado por dividir isso. A senhora conta muito bem.",
]

# Cada tipo tem vários roteiros de três perguntas. {t}: o tema; {de_t}: "do marido", "de Rafael".
ROTEIROS: dict[str, list[list[str]]] = {
    "lembranca": [
        [
            "Olha que foto bonita. O que a senhora vê aqui?",
            "Me conta um pouco sobre {t}.",
            "Quem mais estava com a senhora nesse tempo?",
        ],
        [
            "Essa foto é {de_t}. O que chama a sua atenção nela?",
            "Como era um dia comum nessa época?",
            "Qual parte disso a senhora mais gostava?",
        ],
        [
            "Vamos olhar essa foto com calma? Que cores a senhora vê?",
            "Que barulhos e cheiros tinham nesse lugar?",
            "O que a senhora gostaria de contar sobre isso para a neta?",
        ],
        [
            "Hoje eu trouxe {t}. O que essa foto faz a senhora sentir?",
            "Quem a senhora vê nessa foto?",
            "Se pudesse voltar lá hoje, o que faria primeiro?",
        ],
    ],
    "pessoa": [
        [
            "Vamos falar {de_t}?",
            "Me conta uma história boa com {t}.",
            "O que vocês gostavam de fazer juntos?",
        ],
        [
            "Do que a senhora mais gosta no jeito {de_t}?",
            "Que lugar vocês gostavam de ir?",
            "Que apelido carinhoso a senhora usa para essa pessoa?",
        ],
        [
            "Olha quem está aqui. Me conta sobre {t}.",
            "Como foi a primeira vez que vocês se viram?",
            "Que comida vocês gostavam de dividir?",
        ],
    ],
    "musica": [
        [
            "Vamos ouvir {t}?",
            "Essa música faz a senhora pensar em quê?",
            "Onde a senhora gostava de ouvir música assim?",
        ],
        [
            "Hoje tem {t}. A senhora gosta dessa?",
            "Essa é boa de dançar ou de ouvir quietinha?",
            "Quem gostava de cantar junto com a senhora?",
        ],
        [
            "Que tal cantar {t} juntos?",
            "Qual parte dessa música é a mais bonita?",
            "Em que festa essa música tocava?",
        ],
    ],
    "comida": [
        [
            "Hoje vamos falar de {t}. Como se faz?",
            "Que cheiro fica na casa quando tem {t}?",
            "Quem fazia {t} do jeito mais gostoso?",
        ],
        [
            "{T} combina com que hora do dia?",
            "Que segredo deixa {t} mais gostoso?",
            "Com quem a senhora gostava de comer isso?",
        ],
        [
            "Se a gente fosse fazer {t} hoje, por onde começava?",
            "Que tempero não pode faltar?",
            "Em que dia especial tinha {t}?",
        ],
    ],
    "gosto": [
        [
            "Vamos fazer algo que a senhora gosta? Hoje é {t}.",
            "Me mostra como a senhora gosta de fazer isso.",
            "O que deixa isso ainda melhor?",
        ],
        [
            "A senhora gosta de {t}, né? O que tem de bom nisso?",
            "Desde quando a senhora gosta disso?",
            "Quem gostava disso junto com a senhora?",
        ],
    ],
    "historia": [
        [
            "Me conta sobre o trabalho da senhora.",
            "Qual era a parte do trabalho que a senhora mais gostava?",
            "Que coisa a senhora fazia muito bem?",
        ],
        [
            "Como era um dia de trabalho da senhora?",
            "Quem trabalhava junto com a senhora?",
            "Qual foi o trabalho mais bonito que a senhora fez?",
        ],
        [
            "A senhora ensinava as pessoas a fazer o seu trabalho?",
            "O que é preciso para fazer isso bem feito?",
            "Qual foi o dia mais feliz no trabalho?",
        ],
    ],
}

TIPO_ROTULO = {
    "lembranca": "Lembrança",
    "pessoa": "Pessoa importante",
    "musica": "Música",
    "comida": "Comida",
    "gosto": "Algo que acalma",
    "historia": "A história dela",
}


@dataclass
class Tema:
    chave: str
    tipo: str
    titulo: str
    detalhe: str | None = None
    foto: str | None = None
    musica: dict | None = None
    extras: dict = field(default_factory=dict)


def _sem_artigo(texto: str) -> tuple[str, str]:
    """("o marido", "do marido") ou ("Rafael", "de Rafael"), para encaixar nas frases."""
    m = re.match(r"^(O|A|Os|As)\s+(.*)$", texto.strip())
    if m:
        artigo = m.group(1).lower()
        resto = m.group(2)
        return f"{artigo} {resto}", f"d{artigo} {resto}"
    return texto, f"de {texto}"


def temas_do_passaporte(passaporte: dict) -> list[Tema]:
    temas: list[Tema] = []
    for lem in passaporte.get("lembrancas", []):
        temas.append(
            Tema(
                f"lembranca:{lem['id']}",
                "lembranca",
                lem["titulo"],
                lem.get("detalhe"),
                lem.get("foto"),
            )
        )
    for p in passaporte.get("pessoas_importantes", []):
        temas.append(
            Tema(f"pessoa:{p['id']}", "pessoa", p["nome"], p.get("relacao"), p.get("foto"))
        )
    for m in passaporte.get("musicas", []):
        temas.append(Tema(f"musica:{m['id']}", "musica", m["titulo"], m.get("artista"), musica=m))
    for c in passaporte.get("comidas", []):
        temas.append(Tema(f"comida:{c['id']}", "comida", c["titulo"], c.get("detalhe")))
    for a in passaporte.get("acalma", []):
        temas.append(Tema(f"gosto:{a['id']}", "gosto", a["titulo"], a.get("detalhe")))
    if (passaporte.get("quem_ela") or "").strip():
        temas.append(
            Tema("historia:quem_ela", "historia", "A história dela", passaporte["quem_ela"])
        )
    return temas


def _semente(*partes: str) -> int:
    return int(hashlib.sha256("|".join(partes).encode()).hexdigest()[:12], 16)


def _pesos(temas: list[Tema], historico: list[dict], hoje: date) -> dict[str, float]:
    pesos = {t.chave: 1.0 for t in temas}
    for s in historico:
        chave = s.get("tema_chave")
        if chave not in pesos:
            continue
        quando = date.fromisoformat(s["data"])
        dias = (hoje - quando).days
        if s.get("reacao") == "desconforto" and dias < DIAS_DE_PAUSA_DESCONFORTO:
            pesos[chave] = 0.0
            continue
        if 0 <= dias < DIAS_SEM_REPETIR and quando != hoje:
            pesos[chave] = 0.0
            continue
        if pesos[chave] > 0:
            pesos[chave] = max(0.2, pesos[chave] + PESO_REACAO.get(s.get("reacao") or "", 0))
    return pesos


def _tem_nome_proprio(titulo: str) -> bool:
    """Alguma palavra além da primeira começa com maiúscula (nome de pessoa, lugar, música)."""
    return any(p[:1].isupper() for p in titulo.split()[1:])


def _preencher(pergunta: str, tema: Tema) -> str:
    t, de_t = _sem_artigo(tema.titulo)
    if tema.tipo == "musica":
        t = f'"{tema.titulo}"'
        de_t = f'de "{tema.titulo}"'
    elif tema.tipo in ("comida", "gosto") and not _tem_nome_proprio(tema.titulo):
        # "Retalhos de tecido" vira "retalhos de tecido"; "Roberto Carlos" fica como está.
        t = tema.titulo[0].lower() + tema.titulo[1:]
    texto = pergunta.replace("{de_t}", de_t).replace("{T}", t[0].upper() + t[1:]).replace("{t}", t)
    return texto


def conversa_do_dia(
    passaporte: dict,
    historico: list[dict],
    hoje: date,
    familia_id: str,
    pular: list[str] | None = None,
) -> dict | None:
    """Monta o roteiro de hoje. historico: sessões anteriores com data, tema_chave, conjunto e reação."""
    temas = temas_do_passaporte(passaporte)
    pular = pular or []
    if not temas:
        return None
    pesos = _pesos(temas, historico, hoje)
    candidatos = [t for t in temas if pesos[t.chave] > 0 and t.chave not in pular]
    if not candidatos:
        # Tudo foi usado há pouco: melhor repetir um tema bom do que não ter conversa.
        candidatos = [t for t in temas if t.chave not in pular] or temas
        pesos = {t.chave: 1.0 for t in candidatos}
    sorteio = random.Random(_semente(familia_id, hoje.isoformat(), *pular))
    tema = sorteio.choices(candidatos, weights=[pesos[t.chave] for t in candidatos], k=1)[0]

    roteiros = ROTEIROS[tema.tipo]
    anteriores = [
        s for s in historico if s.get("tema_chave") == tema.chave and s.get("conjunto") is not None
    ]
    if anteriores:
        ultimo = max(anteriores, key=lambda s: s["data"])
        conjunto = (int(ultimo["conjunto"]) + 1) % len(roteiros)
    else:
        conjunto = _semente(tema.chave, hoje.isoformat()) % len(roteiros)
    perguntas = [_preencher(p, tema) for p in roteiros[conjunto]]
    perguntas.append(FECHAMENTOS[_semente(hoje.isoformat()) % len(FECHAMENTOS)])

    musica = tema.musica
    if musica is None and passaporte.get("musicas"):
        # Música do dia: a que a pessoa mais curtiu aparece mais, mas todas entram na roda.
        musicas = passaporte["musicas"]
        musica = musicas[_semente(familia_id, hoje.isoformat(), "musica") % len(musicas)]

    return {
        "data": hoje.isoformat(),
        "tema_chave": tema.chave,
        "tipo": tema.tipo,
        "tipo_rotulo": TIPO_ROTULO[tema.tipo],
        "tema": tema.titulo,
        "detalhe": tema.detalhe,
        "foto": tema.foto,
        "musica": musica,
        "conjunto": conjunto,
        "perguntas": perguntas,
    }
