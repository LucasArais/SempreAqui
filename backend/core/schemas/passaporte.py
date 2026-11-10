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
    pessoas_importantes: list[PessoaImportante] = Field(default_factory=list, max_length=30)
    rotina: list[Item] = Field(default_factory=list, max_length=30)
    acalma: list[Item] = Field(default_factory=list, max_length=30)
    agita: list[Item] = Field(default_factory=list, max_length=30)
    musicas: list[Musica] = Field(default_factory=list, max_length=30)
    comidas: list[Item] = Field(default_factory=list, max_length=30)
    # Lembranças soltas da família: viram temas de conversa. Foto opcional, pela chave.
    lembrancas: list[Lembranca] = Field(default_factory=list, max_length=60)
