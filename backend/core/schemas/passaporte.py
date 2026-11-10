"""Passaporte de Memória: quem a pessoa é, nas palavras da família.

Cada item de lista tem um id estável, gerado no celular, para editar e apagar sem ambiguidade.
As Conversas de Reminiscência são montadas a partir daqui.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

_ID = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")


class Item(BaseModel):
    id: str = _ID
    titulo: str = Field(min_length=1, max_length=120)
    detalhe: str | None = Field(default=None, max_length=300)


class Lembranca(Item):
    """Uma lembrança contada pela família, com foto opcional."""

    foto: str | None = Field(default=None, max_length=40)


class PessoaImportante(BaseModel):
    id: str = _ID
    nome: str = Field(min_length=1, max_length=80)
    relacao: str | None = Field(default=None, max_length=200)
    # Chave de uma foto já guardada no app (família de demonstração). Upload vem depois.
    foto: str | None = Field(default=None, max_length=40)


class Musica(BaseModel):
    id: str = _ID
    titulo: str = Field(min_length=1, max_length=120)
    artista: str | None = Field(default=None, max_length=120)
    link: str | None = Field(default=None, max_length=300)

    @field_validator("link")
    @classmethod
    def _so_https(cls, valor: str | None) -> str | None:
        if valor is None or not valor.strip():
            return None
        valor = valor.strip()
        if not valor.startswith("https://"):
            raise ValueError("O link precisa começar com https://")
        return valor


class Passaporte(BaseModel):
    nome: str = Field(default="", max_length=80)
    como_gosta_de_ser_chamada: str = Field(default="", max_length=80)
    idade: int | None = Field(default=None, ge=0, le=130)
    quem_ela: str = Field(default="", max_length=1000)
    como_se_comunica: str = Field(default="", max_length=1000)
    # Chave da foto de rosto já guardada no app (família de demonstração).
    foto: str | None = Field(default=None, max_length=40)
    # Foto da família reunida, mostrada na aba Família. Trocada em Ajustes.
    foto_familia: str | None = Field(default=None, max_length=40)
    pessoas_importantes: list[PessoaImportante] = Field(default_factory=list, max_length=30)
    rotina: list[Item] = Field(default_factory=list, max_length=30)
    acalma: list[Item] = Field(default_factory=list, max_length=30)
    agita: list[Item] = Field(default_factory=list, max_length=30)
    musicas: list[Musica] = Field(default_factory=list, max_length=30)
    comidas: list[Item] = Field(default_factory=list, max_length=30)
    # Lembranças soltas da família: viram temas de conversa. Foto opcional, pela chave.
    lembrancas: list[Lembranca] = Field(default_factory=list, max_length=60)


# Sugestões da IA a partir de um áudio ou texto livre da família. Nada entra no passaporte
# sem a família conferir e marcar.


class ItemSugerido(BaseModel):
    titulo: str = Field(description="Curto, nas palavras da família.")
    detalhe: str | None = Field(default=None, description="Um detalhe útil, se houver.")


class PessoaSugerida(BaseModel):
    nome: str = Field(description='Como a família chama a pessoa: "Rafael", "a irmã mais nova".')
    relacao: str | None = Field(default=None, description="Quem é para ela, em poucas palavras.")


class MusicaSugerida(BaseModel):
    titulo: str
    artista: str | None = None


class MemoriaOrganizada(BaseModel):
    """O que a família contou, separado nas seções do Passaporte. Só o que foi dito."""

    quem_ela: str | None = Field(
        default=None, description="Trabalho, história de vida, jeito dela. Vazio se não foi falado."
    )
    como_se_comunica: str | None = Field(
        default=None, description="Como ela entende e se expressa. Vazio se não foi falado."
    )
    pessoas_importantes: list[PessoaSugerida] = Field(default_factory=list)
    rotina: list[ItemSugerido] = Field(default_factory=list, description="Horários e hábitos.")
    acalma: list[ItemSugerido] = Field(default_factory=list, description="O que acalma ou faz bem.")
    agita: list[ItemSugerido] = Field(default_factory=list, description="O que agita ou incomoda.")
    musicas: list[MusicaSugerida] = Field(default_factory=list)
    comidas: list[ItemSugerido] = Field(default_factory=list)
    lembrancas: list[ItemSugerido] = Field(
        default_factory=list, description="Histórias, lugares, épocas e fatos marcantes."
    )
