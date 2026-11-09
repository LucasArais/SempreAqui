"""API do SempreAqui.

Rodar localmente:  uv run uvicorn api.main:app --reload

Privacidade: nenhum conteúdo de relato, transcrição, nome ou áudio vai para log.
O log de acesso do uvicorn registra só método, rota e status.
"""

from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from pydantic import BaseModel

from agents.diario import processar_relato
from core.config import config
from core.llm import ErroProvedorIA, ProvedorIA, provedor_padrao
from core.schemas.diario import RegistroDiario

logging.basicConfig(level=config().log_level.upper())
log = logging.getLogger("sempreaqui.api")

app = FastAPI(
    title="SempreAqui API",
    description="IA que aproxima famílias em torno do cuidado de quem vive com Alzheimer.",
    version="0.1.0",
)

TIPOS_AUDIO = {
    "audio/mpeg",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
}
TAMANHO_MAXIMO = 15 * 1024 * 1024


class RespostaDiario(BaseModel):
    transcricao: str
    registro: RegistroDiario
    alertas: list[str]
    resumo_familia: str


def obter_provedor() -> ProvedorIA:
    try:
        return provedor_padrao()
    except ErroProvedorIA as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


@app.get("/saude")
def saude() -> dict:
    return {"status": "ok"}


@app.post("/diario/relatos", response_model=RespostaDiario)
async def criar_relato(
    audio: UploadFile, provedor: ProvedorIA = Depends(obter_provedor)
) -> RespostaDiario:
    if audio.content_type not in TIPOS_AUDIO:
        raise HTTPException(415, "Formato de áudio não suportado.")
    conteudo = await audio.read()
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(413, "Áudio muito longo. Envie até 15 MB.")
    log.info("diario.relato recebido bytes=%d", len(conteudo))
    estado = processar_relato(provedor, audio=conteudo, mime_type=audio.content_type)
    log.info(
        "diario.relato processado alertas=%d resumo_seguro=%s",
        len(estado["alertas"]),
        estado.get("resumo_seguro_usado", False),
    )
    return RespostaDiario(
        transcricao=estado["transcricao"],
        registro=estado["registro"],
        alertas=estado["alertas"],
        resumo_familia=estado["resumo"],
    )
