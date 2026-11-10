"""Repositório no Supabase: Postgres (pelo pooler) e áudios no bucket privado "audios".

Mesma interface do repositório local (core/repositorio.py). A família chega como código
(por exemplo, "familia-demo") e é convertida no id do grupo.

O backend conecta como dono das tabelas e por isso filtra por grupo em TODAS as consultas.
O RLS do banco protege o acesso feito pelo app com a chave publishable.
A chave secret do Supabase só é usada aqui, no servidor, para o Storage.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from core.repositorio import (
    EVENTOS_PERMITIDOS,
    FamiliaDesconhecida,
    _hash_familia,
    _semana,
    _sessao,
    extensao_audio,
)

BUCKET = "audios"


class RepositorioSupabase:
    def __init__(self, url_banco: str, url_supabase: str, chave_secreta: str) -> None:
        self._pool = ConnectionPool(
            url_banco,
            min_size=1,
            max_size=6,
            kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": None},
            open=True,
        )
        self._storage = f"{url_supabase.rstrip('/')}/storage/v1/object"
        self._cabecalhos = {"apikey": chave_secreta, "Authorization": f"Bearer {chave_secreta}"}
        self._grupos: dict[str, UUID] = {}

    # Apoio -----------------------------------------------------------------

    def _sql(self, consulta: str, parametros: tuple = ()) -> list[dict]:
        with self._pool.connection() as conexao:
            cursor = conexao.execute(consulta, parametros)
            return cursor.fetchall() if cursor.description else []

    def grupo(self, familia_id: str) -> UUID:
        if familia_id not in self._grupos:
            linhas = self._sql("select id from grupos_familiares where codigo = %s", (familia_id,))
            if not linhas:
                raise FamiliaDesconhecida(familia_id)
            self._grupos[familia_id] = linhas[0]["id"]
        return self._grupos[familia_id]

    def garantir_grupo(self, familia_id: str, nome: str) -> UUID:
        self._sql(
            "insert into grupos_familiares (codigo, nome) values (%s, %s) on conflict (codigo) do nothing",
            (familia_id, nome),
        )
        self._grupos.pop(familia_id, None)
        return self.grupo(familia_id)

    # Relatos ---------------------------------------------------------------

    def criar_relato(
        self,
        familia_id: str,
        relato_id: str,
        audio: bytes | None,
        mime: str,
        duracao_s: float | None,
        gravado_em: str | None,
    ) -> tuple[dict, bool]:
        existente = self.obter(familia_id, relato_id)
        if existente:
            return existente, False
        grupo = self.grupo(familia_id)
        caminho = None
        if audio:
            caminho = f"{grupo}/{relato_id}.{extensao_audio(mime)}"
            resposta = httpx.post(
                f"{self._storage}/{BUCKET}/{caminho}",
                content=audio,
                headers={**self._cabecalhos, "Content-Type": mime, "x-upsert": "true"},
                timeout=60,
            )
            resposta.raise_for_status()
        self._sql(
            "insert into relatos (id, grupo_id, gravado_em, duracao_s, audio_caminho, mime) "
            "values (%s, %s, coalesce(%s::timestamptz, now()), %s, %s, %s) on conflict (id) do nothing",
            (relato_id, grupo, gravado_em, duracao_s, caminho, mime),
        )
        return self.obter(familia_id, relato_id), True  # type: ignore[return-value]

    def atualizar_etapa(self, relato_id: str, etapa: str, erro: str | None = None) -> None:
        self._sql(
            "update relatos set etapa = %s, erro = %s where id = %s", (etapa, erro, relato_id)
        )

    def salvar_resultado(
        self,
        relato_id: str,
        transcricao: str,
        registro: dict,
        alertas: list[str],
        resumo: str,
        resumo_seguro: bool,
        versao_prompt: str,
        modelo: str,
    ) -> None:
        self._sql(
            "update relatos set etapa = 'pronto', erro = null, transcricao = %s, registro = %s, "
            "alertas = %s, resumo = %s, resumo_seguro = %s, versao_prompt = %s, modelo = %s "
            "where id = %s",
            (
                transcricao,
                Jsonb(registro),
                Jsonb(alertas),
                resumo,
                resumo_seguro,
                versao_prompt,
                modelo,
                relato_id,
            ),
        )

    def atualizar_registro(self, relato_id: str, registro: dict, resumo: str) -> None:
        self._sql(
            "update relatos set registro = %s, resumo = %s where id = %s",
            (Jsonb(registro), resumo, relato_id),
        )

    def marcar_enviado(self, familia_id: str, relato_id: str) -> None:
        self._sql(
            "update relatos set enviado_familia = true where id = %s and grupo_id = %s",
            (relato_id, self.grupo(familia_id)),
        )

    def obter(self, familia_id: str, relato_id: str) -> dict | None:
        linhas = self._sql(
            "select * from relatos where id = %s and grupo_id = %s",
            (relato_id, self.grupo(familia_id)),
        )
        return _relato(linhas[0]) if linhas else None

    def listar(self, familia_id: str, limite: int = 50) -> list[dict]:
        linhas = self._sql(
            "select * from relatos where grupo_id = %s order by gravado_em desc limit %s",
            (self.grupo(familia_id), limite),
        )
        return [_relato(linha) for linha in linhas]

    def apagar(self, familia_id: str, relato_id: str) -> bool:
        relato = self.obter(familia_id, relato_id)
        if not relato:
            return False
        if relato["audio_arquivo"]:
            httpx.request(
                "DELETE",
                f"{self._storage}/{BUCKET}",
                json={"prefixes": [relato["audio_arquivo"]]},
                headers=self._cabecalhos,
                timeout=30,
            )
        self._sql(
            "delete from relatos where id = %s and grupo_id = %s",
            (relato_id, self.grupo(familia_id)),
        )
        return True

    def ler_audio(self, relato: dict) -> bytes | None:
        if not relato.get("audio_arquivo"):
            return None
        resposta = httpx.get(
            f"{self._storage}/authenticated/{BUCKET}/{relato['audio_arquivo']}",
            headers=self._cabecalhos,
            timeout=60,
        )
        return resposta.content if resposta.status_code == 200 else None

    def tem_audio(self, relato: dict) -> bool:
        return bool(relato.get("audio_arquivo"))

    def campos_corrigidos(self, familia_id: str, relato_ids: list[str]) -> dict[str, list[str]]:
        if not relato_ids:
            return {}
        linhas = self._sql(
            "select relato_id, array_agg(distinct campo order by campo) as campos from correcoes "
            "where grupo_id = %s and not desfeita and relato_id = any(%s) group by relato_id",
            (self.grupo(familia_id), relato_ids),
        )
        return {linha["relato_id"]: list(linha["campos"]) for linha in linhas}

    # Famílias e membros ----------------------------------------------------

    def familia_do_usuario(self, usuario_id: str) -> dict | None:
        linhas = self._sql(
            "select g.codigo, m.papel from membros m join grupos_familiares g on g.id = m.grupo_id "
            "where m.usuario_id = %s order by m.criado_em limit 1",
            (usuario_id,),
        )
        return {"familia": linhas[0]["codigo"], "papel": linhas[0]["papel"]} if linhas else None

    def entrar_na_familia(self, usuario_id: str, familia_id: str, nome: str, papel: str) -> None:
        self._sql(
            "insert into membros (grupo_id, usuario_id, nome_exibicao, papel) values (%s, %s, %s, %s) "
            "on conflict (grupo_id, usuario_id) do nothing",
            (self.grupo(familia_id), usuario_id, nome, papel),
        )

    def criar_familia(self, usuario_id: str, nome_familia: str, nome: str) -> str:
        codigo = f"familia-{uuid.uuid4().hex[:12]}"
        self.garantir_grupo(codigo, nome_familia)
        self.entrar_na_familia(usuario_id, codigo, nome, "quem_cuida")
        return codigo

    def registrar_consentimento(
        self, usuario_id: str, familia_id: str, finalidades: list[str], versao: str
    ) -> None:
        grupo = self.grupo(familia_id)
        for finalidade in finalidades:
            self._sql(
                "insert into consentimentos (grupo_id, usuario_id, finalidade, versao_termo) "
                "values (%s, %s, %s, %s)",
                (grupo, usuario_id, finalidade, versao),
            )

    # LGPD: exportar e apagar tudo ------------------------------------------

    def exportar(self, familia_id: str) -> dict:
        grupo = self.grupo(familia_id)
        correcoes = [
            _correcao(linha)
            for linha in self._sql(
                "select * from correcoes where grupo_id = %s order by criado_em", (grupo,)
            )
        ]
        membros = self._sql(
            "select nome_exibicao, papel, criado_em from membros where grupo_id = %s", (grupo,)
        )
        consentimentos = self._sql(
            "select finalidade, versao_termo, aceito_em, revogado_em from consentimentos where grupo_id = %s",
            (grupo,),
        )
        for linha in membros + consentimentos:
            for chave, valor in linha.items():
                linha[chave] = _iso(valor)
        return {
            "relatos": self.listar(familia_id, limite=100000),
            "correcoes": correcoes,
            "membros": membros,
            "consentimentos": consentimentos,
            "passaporte": self.obter_passaporte(familia_id),
            "sessoes": self.sessoes_recentes(familia_id, limite=100000),
        }

    def apagar_familia(self, familia_id: str) -> int:
        """Apaga os áudios do Storage e depois o grupo, que leva tudo em cascata."""
        relatos = self.listar(familia_id, limite=100000)
        caminhos = [r["audio_arquivo"] for r in relatos if r.get("audio_arquivo")]
        for inicio in range(0, len(caminhos), 100):
            httpx.request(
                "DELETE",
                f"{self._storage}/{BUCKET}",
                json={"prefixes": caminhos[inicio : inicio + 100]},
                headers=self._cabecalhos,
                timeout=60,
            )
        self._sql("delete from grupos_familiares where codigo = %s", (familia_id,))
        self._grupos.pop(familia_id, None)
        return len(relatos)

    # Passaporte e conversas ------------------------------------------------

    def obter_passaporte(self, familia_id: str) -> dict | None:
        linhas = self._sql(
            "select dados from passaportes where grupo_id = %s order by atualizado_em desc limit 1",
            (self.grupo(familia_id),),
        )
        return linhas[0]["dados"] if linhas else None

    def salvar_passaporte(self, familia_id: str, dados: dict) -> None:
        grupo = self.grupo(familia_id)
        chamada = dados.get("como_gosta_de_ser_chamada") or dados.get("nome") or "Sem nome"
        existente = self._sql(
            "select pessoa_id from passaportes where grupo_id = %s limit 1", (grupo,)
        )
        if existente:
            pessoa = existente[0]["pessoa_id"]
            self._sql(
                "update pessoas set como_gosta_de_ser_chamada = %s where id = %s and grupo_id = %s",
                (chamada, pessoa, grupo),
            )
            self._sql(
                "update passaportes set dados = %s, atualizado_em = now() where pessoa_id = %s and grupo_id = %s",
                (Jsonb(dados), pessoa, grupo),
            )
            return
        pessoa = self._sql(
            "insert into pessoas (grupo_id, como_gosta_de_ser_chamada) values (%s, %s) returning id",
            (grupo, chamada),
        )[0]["id"]
        self._sql(
            "insert into passaportes (pessoa_id, grupo_id, dados) values (%s, %s, %s)",
            (pessoa, grupo, Jsonb(dados)),
        )

    def registrar_sessao(
        self, familia_id: str, roteiro: dict, reacao: str, nota: str | None
    ) -> str:
        linhas = self._sql(
            "insert into sessoes_reminiscencia (grupo_id, roteiro, reacao, realizada_em) "
            "values (%s, %s, %s, now()) returning id",
            (self.grupo(familia_id), Jsonb({**roteiro, "nota": nota}), reacao),
        )
        return str(linhas[0]["id"])

    def sessoes_recentes(self, familia_id: str, limite: int = 60) -> list[dict]:
        linhas = self._sql(
            "select id, roteiro, reacao, realizada_em from sessoes_reminiscencia where grupo_id = %s "
            "order by realizada_em desc limit %s",
            (self.grupo(familia_id), limite),
        )
        return [
            _sessao(x["roteiro"], x["id"], x["reacao"], x["roteiro"].get("nota"), x["realizada_em"])
            for x in linhas
        ]

    # Correções -------------------------------------------------------------

    def registrar_correcao(
        self,
        familia_id: str,
        relato_id: str,
        campo: str,
        valor_anterior: Any,
        valor_novo: Any,
        resumo_anterior: str | None,
    ) -> str:
        linhas = self._sql(
            "insert into correcoes (relato_id, grupo_id, campo, valor_anterior, valor_novo, resumo_anterior) "
            "values (%s, %s, %s, %s, %s, %s) returning id",
            (
                relato_id,
                self.grupo(familia_id),
                campo,
                Jsonb(valor_anterior),
                Jsonb(valor_novo),
                resumo_anterior,
            ),
        )
        return str(linhas[0]["id"])

    def obter_correcao(self, familia_id: str, correcao_id: str) -> dict | None:
        try:
            UUID(correcao_id)
        except ValueError:
            return None
        linhas = self._sql(
            "select * from correcoes where id = %s and grupo_id = %s",
            (correcao_id, self.grupo(familia_id)),
        )
        return _correcao(linhas[0]) if linhas else None

    def marcar_correcao_desfeita(self, correcao_id: str) -> None:
        self._sql("update correcoes set desfeita = true where id = %s", (correcao_id,))

    def correcoes_recentes(self, familia_id: str, limite: int = 8) -> list[dict]:
        linhas = self._sql(
            "select c.*, r.transcricao from correcoes c join relatos r on r.id = c.relato_id "
            "where c.grupo_id = %s and not c.desfeita order by c.criado_em desc limit %s",
            (self.grupo(familia_id), limite),
        )
        return [{**_correcao(linha), "trecho": linha["transcricao"]} for linha in linhas]

    # Métricas anônimas -----------------------------------------------------

    def registrar_evento(
        self, tipo: str, familia_id: str, valor: float | None = None, rotulo: str | None = None
    ) -> None:
        if tipo not in EVENTOS_PERMITIDOS:
            raise ValueError(f"Evento desconhecido: {tipo}")
        self._sql(
            "insert into eventos (tipo, familia_hash, semana, valor, rotulo) values (%s, %s, %s, %s, %s)",
            (tipo, _hash_familia(familia_id), _semana(), valor, rotulo),
        )

    def metricas(self) -> dict:
        por_semana = self._sql(
            "select semana, count(*) as diarios, count(distinct familia_hash) as familias from eventos "
            "where tipo = 'diario_gravado' group by semana order by semana"
        )
        total = self._sql("select count(*) as n from relatos where etapa = 'pronto'")[0]["n"]
        corrigidos = self._sql(
            "select count(distinct relato_id) as n from correcoes where not desfeita"
        )[0]["n"]
        por_campo = self._sql(
            "select campo, count(*) as correcoes from correcoes where not desfeita "
            "group by campo order by correcoes desc"
        )
        mediana = self._sql(
            "select percentile_disc(0.5) within group (order by valor) as m from eventos "
            "where tipo = 'primeiro_diario' and valor is not null"
        )[0]["m"]
        sessoes = self._sql(
            "select rotulo as reacao, count(*) as sessoes from eventos where tipo = 'sessao_concluida' group by rotulo"
        )
        return {
            "diarios_por_semana": por_semana,
            "relatos_processados": total,
            "relatos_com_correcao": corrigidos,
            "taxa_de_correcao": round(corrigidos / total, 3) if total else None,
            "correcoes_por_campo": por_campo,
            "segundos_ate_primeiro_diario_mediana": mediana,
            "sessoes_reminiscencia": sessoes,
        }


def _iso(valor: Any) -> Any:
    return valor.isoformat() if isinstance(valor, datetime) else valor


def _relato(linha: dict) -> dict:
    dados = dict(linha)
    dados["audio_arquivo"] = dados.pop("audio_caminho")
    dados["familia_id"] = str(dados.pop("grupo_id"))
    for chave in ("criado_em", "gravado_em"):
        dados[chave] = _iso(dados[chave])
    if isinstance(dados.get("alertas"), str):
        dados["alertas"] = json.loads(dados["alertas"])
    return dados


def _correcao(linha: dict) -> dict:
    dados = {k: v for k, v in linha.items() if k != "transcricao"}
    dados["id"] = str(dados["id"])
    dados["familia_id"] = str(dados.pop("grupo_id"))
    dados["criado_em"] = _iso(dados["criado_em"])
    return dados
