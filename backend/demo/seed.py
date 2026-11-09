"""Popula a família de demonstração com relatos fictícios, prontos para o demo.

Uso (a partir de backend/):  uv run python -m demo.seed
Apaga e recria só os relatos da família "familia-demo". Não chama nenhuma IA.
Personas: Cláudia (quem cuida), Rafael (irmão em Recife) e Dona Isabel (vive com Alzheimer).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from core.config import RAIZ_REPO, config
from core.repositorio import Repositorio
from core.schemas.diario import RegistroDiario

FAMILIA = "familia-demo"
EXEMPLOS = RAIZ_REPO / "poc" / "exemplos"


def _quando(dias_atras: int, hora: int, minuto: int) -> str:
    base = datetime.now(UTC).astimezone() - timedelta(days=dias_atras)
    return (
        base.replace(hour=hora, minute=minuto, second=0, microsecond=0).astimezone(UTC).isoformat()
    )


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


def main() -> None:
    repo = Repositorio(config().dados_dir)
    for antigo in repo.listar(FAMILIA, limite=500):
        repo.apagar(FAMILIA, antigo["id"])
    for r in RELATOS:
        audio = (EXEMPLOS / r["audio"]).read_bytes() if r["audio"] else b""
        repo.criar_relato(FAMILIA, r["id"], audio, "audio/mpeg", r["duracao_s"], r["gravado_em"])
        if not r["audio"]:
            relato = repo.obter(FAMILIA, r["id"])
            (repo.pasta_audios / relato["audio_arquivo"]).unlink(missing_ok=True)
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
    print(f"{len(RELATOS)} relatos da Dona Isabel criados para {FAMILIA}.")


if __name__ == "__main__":
    main()
