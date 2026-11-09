"""Popula a família de demonstração com relatos fictícios, prontos para o demo.

Uso (a partir de backend/):  uv run python -m demo.seed
Apaga e recria só os relatos da família "familia-demo". Não chama nenhuma IA.
Personas: Cláudia (quem cuida), Rafael (irmão em Recife) e Dona Isabel (vive com Alzheimer).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from core.config import RAIZ_REPO
from core.repositorio import repositorio_padrao
from core.schemas.diario import RegistroDiario

FAMILIA = "familia-demo"
EXEMPLOS = RAIZ_REPO / "poc" / "exemplos"


def _quando(dias_atras: int, hora: int, minuto: int) -> str:
    """Horário local do relato. Nunca no futuro: hoje, no máximo uma hora atrás."""
    agora = datetime.now(UTC).astimezone()
    base = (agora - timedelta(days=dias_atras)).replace(
        hour=hora, minute=minuto, second=0, microsecond=0
    )
    if base > agora - timedelta(hours=1):
        base = (agora - timedelta(hours=1)).replace(second=0, microsecond=0)
    return base.astimezone(UTC).isoformat()


RELATOS = [
    {
        "id": "demo-0000-0000-0001",
        "gravado_em": _quando(0, 21, 10),
        "duracao_s": 38,
        "audio": "relato_01_dia_tranquilo.mp3",
        "transcricao": (EXEMPLOS / "relato_01_dia_tranquilo.txt")
        .read_text(encoding="utf-8")
        .strip(),
        "registro": {
            "sono": {"qualidade": "boa", "horas_aproximadas": 7, "despertares_noturnos": 1},
            "alimentacao": {
                "qualidade": "regular",
                "hidratacao": "boa",
                "observacao": "Comeu pouco no almoço, aceitou a sopa à tarde",
            },
            "humor": {"predominante": "calmo"},
            "agitacao": {
                "nivel": "leve",
                "periodos": ["tarde"],
                "gatilhos": ["perguntou pela casa da mãe"],
            },
            "episodios": [],
            "medicacao": {"tomou": "sim"},
            "o_que_ajudou": ["músicas do Roberto Carlos"],
            "momentos_bons": ["sorriu muito na chamada de vídeo"],
            "quem_cuida": {"cansaco": "algum"},
            "observacoes": [],
            "sinais_de_alerta": [],
        },
        "alertas": [],
        "resumo": (
            "A Dona Isabel teve um dia bom. Dormiu bem e tomou os remédios. No fim da tarde ficou "
            "ansiosa perguntando pela casa da mãe, e as músicas do Roberto Carlos ajudaram de novo. "
            "Sorriu muito na chamada de vídeo."
        ),
        "enviado": False,
    },
    {
        "id": "demo-0000-0000-0002",
        "gravado_em": _quando(1, 22, 5),
        "duracao_s": 31,
        "audio": "relato_03_queda.mp3",
        "transcricao": (EXEMPLOS / "relato_03_queda.txt").read_text(encoding="utf-8").strip(),
        "registro": {
            "sono": {"qualidade": "boa", "horas_aproximadas": 8},
            "alimentacao": {"qualidade": "boa", "hidratacao": "nao_informado"},
            "humor": {"predominante": "calmo"},
            "agitacao": {"nivel": "nenhuma", "periodos": [], "gatilhos": []},
            "episodios": [
                {
                    "tipo": "queda",
                    "descricao": "Escorregou no banheiro e bateu a cabeça na pia",
                    "periodo": "tarde",
                }
            ],
            "medicacao": {"tomou": "sim"},
            "o_que_ajudou": ["ver as fotos antigas da família"],
            "momentos_bons": [],
            "quem_cuida": {"cansaco": "nao_informado"},
            "observacoes": ["Ficou mais sonolenta que o normal depois da queda"],
            "sinais_de_alerta": ["Queda com batida na cabeça e sonolência fora do normal"],
        },
        "alertas": ["Queda com batida na cabeça e sonolência fora do normal"],
        "resumo": (
            "A Dona Isabel escorregou no banheiro, bateu a cabeça e ficou mais sonolenta que o normal. "
            "Se houver risco agora, ligue 192 (SAMU). No resto do dia ficou calma, comeu bem e tomou "
            "os remédios."
        ),
        "enviado": True,
    },
    {
        "id": "demo-0000-0000-0003",
        "gravado_em": _quando(2, 23, 20),
        "duracao_s": 44,
        "audio": None,
        "transcricao": (
            "Noite difícil. A mãe acordou umas quatro vezes de madrugada procurando a bolsa. De manhã "
            "não quis tomar o remédio de jeito nenhum, só tomou o da noite. Almoçou pouco. No fim da "
            "tarde coloquei Roberto Carlos e ela se acalmou. Eu estou exausta."
        ),
        "registro": {
            "sono": {"qualidade": "ruim", "despertares_noturnos": 4},
            "alimentacao": {"qualidade": "pouca", "hidratacao": "nao_informado"},
            "humor": {"predominante": "ansioso"},
            "agitacao": {
                "nivel": "moderada",
                "periodos": ["madrugada", "tarde"],
                "gatilhos": ["procurando a bolsa"],
            },
            "episodios": [
                {
                    "tipo": "desorientacao",
                    "descricao": "Acordou várias vezes procurando a bolsa",
                    "periodo": "madrugada",
                }
            ],
            "medicacao": {"tomou": "parcial", "observacao": "Recusou o remédio da manhã"},
            "o_que_ajudou": ["músicas do Roberto Carlos"],
            "momentos_bons": [],
            "quem_cuida": {"cansaco": "muito"},
            "observacoes": [],
            "sinais_de_alerta": [],
        },
        "alertas": [],
        "resumo": (
            "Noite difícil: a Dona Isabel acordou quatro vezes procurando a bolsa e não quis o remédio "
            "da manhã. A música ajudou no fim da tarde. A Cláudia está muito cansada. Alguém pode "
            "ligar para ela ou cobrir a folga de sábado?"
        ),
        "enviado": True,
    },
]


def _historico() -> list[dict]:
    """Semanas anteriores (a linha de base) e dois dias difíceis desta semana."""
    relatos = []
    for dias in range(3, 29):
        if dias in (6, 11, 17, 23):  # nem todo dia tem relato, como na vida real
            continue
        dificil = dias in (3, 4)
        horas = (4.5 if dias == 4 else 5) if dificil else (7 if dias % 3 else 7.5)
        acordou = (4 if dias == 4 else 3) if dificil else (1 if dias % 4 else 0)
        remedio = "parcial" if dias == 4 else "sim"
        relatos.append(
            {
                "id": f"demo-hist-{dias:04d}",
                "gravado_em": _quando(dias, 21, 30),
                "duracao_s": 25,
                "audio": None,
                "transcricao": (
                    f"A mãe dormiu mal, umas {horas:g} horas, acordou {acordou} vezes de madrugada."
                    + (
                        " De manhã não quis o remédio."
                        if remedio == "parcial"
                        else " Tomou os remédios."
                    )
                    if dificil
                    else f"Dia tranquilo. A mãe dormiu umas {horas:g} horas, comeu bem e tomou os remédios."
                ),
                "registro": {
                    "sono": {
                        "qualidade": "ruim" if dificil else "boa",
                        "horas_aproximadas": horas,
                        "despertares_noturnos": acordou,
                    },
                    "alimentacao": {
                        "qualidade": "regular" if dificil else "boa",
                        "hidratacao": "boa",
                    },
                    "humor": {"predominante": "ansioso" if dificil else "calmo"},
                    "agitacao": {
                        "nivel": "moderada"
                        if dificil
                        else ("leve" if dias % 5 == 0 else "nenhuma"),
                        "periodos": ["tarde"] if dificil or dias % 5 == 0 else [],
                        "gatilhos": [],
                    },
                    "episodios": [],
                    "medicacao": {"tomou": remedio},
                    "o_que_ajudou": ["músicas do Roberto Carlos"] if dias % 2 else [],
                    "momentos_bons": [],
                    "quem_cuida": {"cansaco": "muito" if dificil else "algum"},
                    "observacoes": [],
                    "sinais_de_alerta": [],
                },
                "alertas": [],
                "resumo": (
                    "Noite difícil: a Dona Isabel dormiu pouco e acordou várias vezes."
                    if dificil
                    else "Dia tranquilo: a Dona Isabel dormiu bem, comeu e tomou os remédios."
                ),
                "enviado": True,
            }
        )
    return relatos


def main() -> None:
    repo = repositorio_padrao()
    if hasattr(repo, "garantir_grupo"):
        repo.garantir_grupo(FAMILIA, "Família da Dona Isabel (demonstração)")
    # Só os relatos de demonstração são recriados; gravações reais da família ficam.
    for antigo in repo.listar(FAMILIA, limite=1000):
        if antigo["id"].startswith("demo-"):
            repo.apagar(FAMILIA, antigo["id"])
    for r in RELATOS + _historico():
        audio = (EXEMPLOS / r["audio"]).read_bytes() if r["audio"] else None
        repo.criar_relato(FAMILIA, r["id"], audio, "audio/mpeg", r["duracao_s"], r["gravado_em"])
        registro = RegistroDiario.model_validate(r["registro"]).model_dump()
        repo.salvar_resultado(
            r["id"],
            r["transcricao"],
            registro,
            r["alertas"],
            r["resumo"],
            False,
            "extracao.v2",
            "seed",
        )
        if r["enviado"]:
            repo.marcar_enviado(FAMILIA, r["id"])
    onde = "Supabase" if hasattr(repo, "garantir_grupo") else "banco local"
    total = len(RELATOS) + len(_historico())
    print(
        f"{total} relatos da Dona Isabel criados para {FAMILIA} ({onde}), com quatro semanas de histórico."
    )


if __name__ == "__main__":
    main()
