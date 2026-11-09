"""Semana da pessoa: linha de base, mudanças de padrão e lista para a consulta.

Tudo aqui é determinístico, sem IA. Cada mudança vem de uma regra explícita comparando a semana
com o habitual da própria pessoa (as semanas anteriores). Isso garante que nenhum alerta seja
inventado e que qualquer pessoa possa conferir de onde ele veio.

Linguagem: calma, factual, sem interpretação clínica. Dizemos o que mudou, nunca o que significa.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from statistics import mean
from zoneinfo import ZoneInfo

DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
MESES = [
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
MINIMO_DIAS_BASE = 5


@dataclass
class Dia:
    data: date
    registro: dict | None = None
    alertas: list[str] = field(default_factory=list)

    @property
    def tem_relato(self) -> bool:
        return self.registro is not None

    def valor(self, caminho: str):
        atual = self.registro
        for parte in caminho.split("."):
            atual = atual.get(parte) if isinstance(atual, dict) else None
        return atual


@dataclass
class Mudanca:
    tipo: str  # sono, remedios, alimentacao, agitacao, risco, quem_cuida
    texto: str
    datas: list[str] = field(default_factory=list)


def _data_local(iso: str, fuso: str) -> date:
    return datetime.fromisoformat(iso).astimezone(ZoneInfo(fuso)).date()


def agrupar_por_dia(relatos: list[dict], fuso: str) -> dict[date, Dia]:
    """Um dia por data local. Com mais de um relato no dia, vale o mais recente."""
    dias: dict[date, Dia] = {}
    for r in sorted(relatos, key=lambda r: r["gravado_em"]):
        if r.get("etapa") != "pronto" or not r.get("registro"):
            continue
        d = _data_local(r["gravado_em"], fuso)
        dias[d] = Dia(d, r["registro"], list(r.get("alertas") or []))
    return dias


def _lista_dias(datas: list[date]) -> str:
    nomes = [DIAS[d.weekday()] for d in datas]
    if len(nomes) == 1:
        return nomes[0]
    return ", ".join(nomes[:-1]) + " e " + nomes[-1]


def _intervalo(datas: list[date]) -> str:
    return f"de {DIAS[datas[0].weekday()]} a {DIAS[datas[-1].weekday()]}"


def _num(valor: float) -> str:
    return (f"{valor:.1f}".rstrip("0").rstrip(".")).replace(".", ",")


def _minuscula(texto: str) -> str:
    return texto[:1].lower() + texto[1:]


def _dias(n: int) -> str:
    return f"{n} {'dia' if n == 1 else 'dias'}"


def _vezes(valor: float) -> str:
    n = max(0, round(valor))
    return "nenhuma vez" if n == 0 else f"{n} {'vez' if n == 1 else 'vezes'}"


def periodo_texto(inicio: date, fim: date) -> str:
    if inicio.month == fim.month:
        return f"{inicio.day} a {fim.day} de {MESES[fim.month - 1]}"
    return f"{inicio.day} de {MESES[inicio.month - 1]} a {fim.day} de {MESES[fim.month - 1]}"


@dataclass
class LinhaDeBase:
    dias: int
    horas: float | None
    despertares: float | None
    remedios_incompletos: float
    agitacao_forte: float

    @property
    def disponivel(self) -> bool:
        return self.dias >= MINIMO_DIAS_BASE


def linha_de_base(dias: dict[date, Dia], antes_de: date, janela: int = 28) -> LinhaDeBase:
    anteriores = [
        d for data, d in dias.items() if antes_de - timedelta(days=janela) <= data < antes_de
    ]
    horas = [
        d.valor("sono.horas_aproximadas") for d in anteriores if d.valor("sono.horas_aproximadas")
    ]
    despertares = [
        d.valor("sono.despertares_noturnos")
        for d in anteriores
        if d.valor("sono.despertares_noturnos") is not None
    ]
    total = len(anteriores) or 1
    return LinhaDeBase(
        dias=len(anteriores),
        horas=round(mean(horas), 1) if horas else None,
        despertares=round(mean(despertares), 1) if despertares else None,
        remedios_incompletos=sum(
            d.valor("medicacao.tomou") in ("parcial", "nao") for d in anteriores
        )
        / total,
        agitacao_forte=sum(d.valor("agitacao.nivel") in ("moderada", "intensa") for d in anteriores)
        / total,
    )


def detectar_mudancas(
    semana: list[Dia], base: LinhaDeBase, quem_cuida: str = "Quem cuida"
) -> list[Mudanca]:
    com_relato = [d for d in semana if d.tem_relato]
    mudancas: list[Mudanca] = []

    # 1. Risco sempre aparece primeiro, mesmo sem linha de base.
    quedas = [
        d
        for d in com_relato
        if any(e.get("tipo") in ("queda", "engasgo") for e in d.valor("episodios") or [])
    ]
    if quedas:
        n = len(quedas)
        mudancas.append(
            Mudanca(
                "risco",
                f"{n} {'situação' if n == 1 else 'situações'} de risco registrada{'' if n == 1 else 's'} ({_lista_dias([d.data for d in quedas])})",
                [d.data.isoformat() for d in quedas],
            )
        )

    # 2. Noites ruins seguidas (três ou mais).
    sequencia: list[Dia] = []
    melhor: list[Dia] = []
    for d in semana:
        if d.tem_relato and d.valor("sono.qualidade") == "ruim":
            sequencia.append(d)
            melhor = sequencia if len(sequencia) > len(melhor) else melhor
        else:
            sequencia = []
    if len(melhor) >= 3:
        mudancas.append(
            Mudanca(
                "sono",
                f"Noites ruins {len(melhor)} dias seguidos, {_intervalo([d.data for d in melhor])}",
                [d.data.isoformat() for d in melhor],
            )
        )

    # 3. Comparação com o habitual (só com linha de base suficiente).
    if base.disponivel:
        despertares = [
            d.valor("sono.despertares_noturnos")
            for d in com_relato
            if d.valor("sono.despertares_noturnos") is not None
        ]
        if (
            base.despertares is not None
            and len(despertares) >= 2
            and mean(despertares) >= base.despertares + 1
        ):
            mudancas.append(
                Mudanca(
                    "sono",
                    f"Acordou mais vezes à noite: cerca de {_vezes(mean(despertares))} por noite, o habitual é {_vezes(base.despertares)}",
                )
            )
        horas = [
            d.valor("sono.horas_aproximadas")
            for d in com_relato
            if d.valor("sono.horas_aproximadas")
        ]
        if base.horas and len(horas) >= 2 and mean(horas) <= base.horas - 1.5:
            mudancas.append(
                Mudanca(
                    "sono",
                    f"Dormiu menos que o habitual: cerca de {_num(mean(horas))} horas por noite, o habitual é {_num(base.horas)}",
                )
            )

    # 4. Remédios, alimentação, agitação: contagem na semana.
    incompletos = [d for d in com_relato if d.valor("medicacao.tomou") in ("parcial", "nao")]
    if len(incompletos) >= 2 and (not base.disponivel or base.remedios_incompletos < 0.2):
        mudancas.append(
            Mudanca(
                "remedios",
                f"Não tomou todos os remédios em {_dias(len(incompletos))} ({_lista_dias([d.data for d in incompletos])})",
                [d.data.isoformat() for d in incompletos],
            )
        )
    pouca = [d for d in com_relato if d.valor("alimentacao.qualidade") in ("pouca", "recusou")]
    if len(pouca) >= 3:
        mudancas.append(
            Mudanca(
                "alimentacao",
                f"Comeu pouco em {_dias(len(pouca))}",
                [d.data.isoformat() for d in pouca],
            )
        )
    agitacao = [d for d in com_relato if d.valor("agitacao.nivel") in ("moderada", "intensa")]
    if len(agitacao) >= 2 and (
        not base.disponivel or base.agitacao_forte < len(agitacao) / max(len(com_relato), 1)
    ):
        mudancas.append(
            Mudanca(
                "agitacao",
                f"Agitação moderada ou forte em {_dias(len(agitacao))}",
                [d.data.isoformat() for d in agitacao],
            )
        )

    # 5. Quem cuida também importa.
    cansaco = [d for d in com_relato if d.valor("quem_cuida.cansaco") == "muito"]
    if len(cansaco) >= 2:
        mudancas.append(
            Mudanca(
                "quem_cuida",
                f"{quem_cuida} relatou muito cansaço em {_dias(len(cansaco))}",
                [d.data.isoformat() for d in cansaco],
            )
        )
    return mudancas


def para_consulta(semana: list[Dia]) -> list[str]:
    """Fatos objetivos da semana para levar à equipe de saúde. Sem interpretação."""
    com_relato = [d for d in semana if d.tem_relato]
    if not com_relato:
        return []
    itens = [f"Dias com relato da família: {len(com_relato)} de 7"]
    ruins = [d for d in com_relato if d.valor("sono.qualidade") == "ruim"]
    horas = [
        d.valor("sono.horas_aproximadas") for d in com_relato if d.valor("sono.horas_aproximadas")
    ]
    sono = f"Sono: {len(ruins)} {'noite ruim' if len(ruins) == 1 else 'noites ruins'}"
    if ruins:
        sono += f" ({_lista_dias([d.data for d in ruins])})"
    if horas:
        sono += f". Média de cerca de {_num(mean(horas))} horas nas noites com horário informado"
    itens.append(sono)
    despertares = [
        (d, d.valor("sono.despertares_noturnos"))
        for d in com_relato
        if d.valor("sono.despertares_noturnos")
    ]
    if despertares:
        maior = max(despertares, key=lambda x: x[1])
        itens.append(
            f"Acordou durante a noite em {_dias(len(despertares))}, até {maior[1]} vezes ({DIAS[maior[0].data.weekday()]})"
        )
    incompletos = [d for d in com_relato if d.valor("medicacao.tomou") in ("parcial", "nao")]
    itens.append(
        f"Remédios: não tomou todos em {_dias(len(incompletos))} ({_lista_dias([d.data for d in incompletos])})"
        if incompletos
        else "Remédios: tomou todos nos dias com relato"
    )
    pouca = [d for d in com_relato if d.valor("alimentacao.qualidade") in ("pouca", "recusou")]
    if pouca:
        itens.append(
            f"Alimentação: comeu pouco ou recusou em {_dias(len(pouca))} ({_lista_dias([d.data for d in pouca])})"
        )
    agitacao = [d for d in com_relato if d.valor("agitacao.nivel") in ("moderada", "intensa")]
    if agitacao:
        itens.append(
            f"Agitação moderada ou forte em {_dias(len(agitacao))} ({_lista_dias([d.data for d in agitacao])})"
        )
    episodios = [(d, e) for d in com_relato for e in d.valor("episodios") or []]
    if episodios:
        itens.append(
            "Episódios: "
            + "; ".join(
                f"{DIAS[d.data.weekday()]}, {_minuscula(e.get('descricao', '').rstrip('.'))}"
                for d, e in episodios
            )
        )
    else:
        itens.append("Nenhuma queda ou situação de risco registrada")
    return itens


def montar_semana(
    relatos: list[dict], fim: date, fuso: str, quem_cuida: str = "Quem cuida"
) -> dict:
    """Fatos da semana (7 dias terminando em fim) prontos para a API, o resumo e o PDF."""
    por_dia = agrupar_por_dia(relatos, fuso)
    inicio = fim - timedelta(days=6)
    semana = [
        por_dia.get(inicio + timedelta(days=i)) or Dia(inicio + timedelta(days=i)) for i in range(7)
    ]
    base = linha_de_base(por_dia, inicio)
    mudancas = detectar_mudancas(semana, base, quem_cuida)
    com_relato = [d for d in semana if d.tem_relato]
    return {
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "periodo": periodo_texto(inicio, fim),
        "dias": [
            {
                "data": d.data.isoformat(),
                "dia": DIAS_CURTOS[d.data.weekday()],
                "tem_relato": d.tem_relato,
                "sono_qualidade": d.valor("sono.qualidade") if d.tem_relato else None,
                "sono_horas": d.valor("sono.horas_aproximadas") if d.tem_relato else None,
                "alerta": bool(d.alertas),
            }
            for d in semana
        ],
        "dias_com_relato": len(com_relato),
        "linha_de_base_dias": base.dias,
        "habitual_sono_horas": base.horas if base.disponivel else None,
        "mudancas": [asdict(m) for m in mudancas],
        "para_consulta": para_consulta(semana),
        "o_que_ajudou": sorted({t for d in com_relato for t in d.valor("o_que_ajudou") or []}),
        "momentos_bons": [t for d in com_relato for t in d.valor("momentos_bons") or []],
    }
