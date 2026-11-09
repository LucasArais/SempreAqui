"""Estrutura do Diário Inteligente.

Cada campo descreve o que foi *relatado* por quem cuida. Nada aqui é interpretação clínica.
Quando o relato não fala de um assunto, o valor é "nao_informado", nunca um palpite.
As descrições dos campos também orientam o modelo na extração estruturada.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Periodo = Literal["manha", "tarde", "noite", "madrugada"]


class Sono(BaseModel):
    qualidade: Literal["boa", "regular", "ruim", "nao_informado"] = Field(
        description="Como quem cuida descreveu a noite. 'ruim' se acordou muito ou dormiu pouco."
    )
    horas_aproximadas: float | None = Field(
        default=None, ge=0, le=24, description="Horas de sono citadas no relato, se houver."
    )
    despertares_noturnos: int | None = Field(
        default=None, ge=0, description="Quantas vezes acordou durante a noite, se citado."
    )
    observacao: str | None = Field(
        default=None, description="Detalhe relevante, em poucas palavras."
    )


class Alimentacao(BaseModel):
    qualidade: Literal["boa", "regular", "pouca", "recusou", "nao_informado"] = Field(
        description="Como comeu no dia, segundo o relato."
    )
    hidratacao: Literal["boa", "pouca", "nao_informado"] = Field(
        description="Se bebeu água ou líquidos, segundo o relato."
    )
    observacao: str | None = None


class Humor(BaseModel):
    predominante: Literal[
        "calmo", "alegre", "triste", "ansioso", "irritado", "apatico", "variado", "nao_informado"
    ] = Field(description="Humor que mais apareceu no dia.")
    observacao: str | None = None


class Agitacao(BaseModel):
    nivel: Literal["nenhuma", "leve", "moderada", "intensa", "nao_informado"] = Field(
        description="Intensidade da agitação relatada. 'nenhuma' só se o relato disser que foi tranquilo."
    )
    periodos: list[Periodo] = Field(default_factory=list, description="Quando aconteceu.")
    gatilhos: list[str] = Field(
        default_factory=list, description="O que parece ter desencadeado, nas palavras do relato."
    )


class Episodio(BaseModel):
    tipo: Literal[
        "queda",
        "desorientacao",
        "tentativa_de_sair",
        "agressividade",
        "alucinacao",
        "recusa_de_cuidado",
        "engasgo",
        "outro",
    ]
    descricao: str = Field(description="O que aconteceu, de forma objetiva e curta.")
    periodo: Periodo | None = None


class Medicacao(BaseModel):
    tomou: Literal["sim", "nao", "parcial", "nao_informado"] = Field(
        description="Se tomou a medicação do dia. 'parcial' se tomou só parte das doses."
    )
    observacao: str | None = None


class QuemCuida(BaseModel):
    cansaco: Literal["nenhum", "algum", "muito", "nao_informado"] = Field(
        description="Cansaço que a própria pessoa que cuida relatou sentir."
    )
    observacao: str | None = None


class RegistroDiario(BaseModel):
    """Registro de um dia, extraído do relato de quem cuida."""

    sono: Sono
    alimentacao: Alimentacao
    humor: Humor
    agitacao: Agitacao
    episodios: list[Episodio] = Field(default_factory=list)
    medicacao: Medicacao
    o_que_ajudou: list[str] = Field(
        default_factory=list,
        description="O que acalmou ou fez bem, como música, uma ligação, uma atividade.",
    )
    momentos_bons: list[str] = Field(
        default_factory=list, description="Momentos de afeto, alegria ou conexão citados."
    )
    quem_cuida: QuemCuida
    observacoes: list[str] = Field(default_factory=list, description="Outros fatos relatados.")
    sinais_de_alerta: list[str] = Field(
        default_factory=list,
        description=(
            "Situações que podem exigir atendimento imediato: queda com batida na cabeça, "
            "sonolência fora do normal após queda, engasgo, falta de ar, desmaio, sangramento, "
            "violência, pessoa desaparecida. Vazio se nada disso foi relatado."
        ),
    )
