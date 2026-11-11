"""Onde os relatos, correções e métricas ficam guardados.

Por enquanto em SQLite local (backend/dados/, ignorado pelo git), para o ciclo rodar sem depender
do banco remoto. A interface é pequena de propósito: a versão Postgres/Supabase implementa os
mesmos métodos, e nada acima desta camada muda.

Privacidade:
- Tudo é filtrado por familia_id. Nenhum método devolve dado de outra família.
- A tabela de eventos não guarda conteúdo, só tipo, semana e um número. A família entra como hash.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ESQUEMA = """
create table if not exists relatos (
  id text primary key,
  familia_id text not null,
  criado_em text not null,
  gravado_em text not null,
  duracao_s real,
  audio_arquivo text,
  mime text,
  etapa text not null,
  erro text,
  transcricao text,
  registro text,
  alertas text,
  resumo text,
  resumo_seguro integer default 0,
  versao_prompt text,
  modelo text,
  enviado_familia integer default 0
);
create index if not exists relatos_familia on relatos (familia_id, gravado_em);

create table if not exists correcoes (
  id text primary key,
  relato_id text not null references relatos(id) on delete cascade,
  familia_id text not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  resumo_anterior text,
  criado_em text not null,
  desfeita integer default 0
);
create index if not exists correcoes_familia on correcoes (familia_id, criado_em);

create table if not exists membros (
  usuario_id text not null,
  familia_id text not null,
  nome_exibicao text,
  papel text not null,
  foto text,
  criado_em text not null,
  primary key (usuario_id, familia_id)
);

create table if not exists consentimentos (
  id integer primary key autoincrement,
  usuario_id text not null,
  familia_id text not null,
  finalidade text not null,
  versao_termo text not null,
  aceito_em text not null
);

create table if not exists passaportes (
  familia_id text primary key,
  dados text not null,
  atualizado_em text not null
);

create table if not exists sessoes (
  id text primary key,
  familia_id text not null,
  data text not null,
  roteiro text not null,
  reacao text,
  nota text,
  realizada_em text not null
);
create index if not exists sessoes_familia_data on sessoes (familia_id, data desc);

create table if not exists links_passaporte (
  token text primary key,
  familia_id text not null unique,
  criado_em text not null
);

create table if not exists tarefas (
  id text primary key,
  familia_id text not null,
  titulo text not null,
  tipo text not null,
  responsavel_nome text,
  responsavel_usuario text,
  criada_por text,
  quando text,
  concluida integer not null default 0,
  criado_em text not null,
  concluida_em text
);

create table if not exists convites (
  codigo text primary key,
  familia_id text not null,
  papel text not null,
  criado_em text not null,
  expira_em text not null
);

create table if not exists feed_eventos (
  id text primary key,
  familia_id text not null,
  tipo text not null,
  autor text not null,
  texto text,
  ref text,
  criado_em text not null
);

create table if not exists eventos (
  id integer primary key autoincrement,
  tipo text not null,
  familia_hash text not null,
  semana text not null,
  valor real,
  rotulo text,
  criado_em text not null
);
"""

EVENTOS_PERMITIDOS = {
    "diario_gravado",
    "campo_corrigido",
    "correcao_desfeita",
    "primeiro_diario",
    "sessao_concluida",
    "relato_enviado_offline",
    "apoio_pedido",
    "assistente_pergunta",
    "naomi_avisos",
}

_SAL = "sempreaqui-metricas-v1"


class FamiliaDesconhecida(LookupError):
    """O código de família não existe no banco."""


def agora() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _semana(iso: str | None = None) -> str:
    data = datetime.fromisoformat(iso) if iso else datetime.now(UTC)
    ano, semana, _ = data.isocalendar()
    return f"{ano}-S{semana:02d}"


def _hash_familia(familia_id: str) -> str:
    return hashlib.sha256(f"{_SAL}:{familia_id}".encode()).hexdigest()[:16]


def extensao_audio(mime: str) -> str:
    return {"audio/mpeg": "mp3", "audio/wav": "wav"}.get(mime, "m4a")


class Repositorio:
    """Implementação local em SQLite. A do Supabase está em repositorio_supabase.py."""

    def __init__(self, pasta: Path) -> None:
        self.pasta = Path(pasta)
        self.pasta_audios = self.pasta / "audios"
        self.pasta_audios.mkdir(parents=True, exist_ok=True)
        self.arquivo = self.pasta / "sempreaqui.db"
        with self._conexao() as c:
            c.executescript(ESQUEMA)
            colunas = {x["name"] for x in c.execute("pragma table_info(tarefas)")}
            if "responsavel_usuario" not in colunas:
                c.execute("alter table tarefas add column responsavel_usuario text")

    @contextmanager
    def _conexao(self):
        conexao = sqlite3.connect(self.arquivo, timeout=10)
        conexao.row_factory = sqlite3.Row
        conexao.execute("pragma foreign_keys = on")
        conexao.execute("pragma journal_mode = wal")
        try:
            yield conexao
            conexao.commit()
        finally:
            conexao.close()

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
        """Guarda o áudio e cria o relato. Idempotente pelo id: reenvio da fila offline não duplica.

        Devolve (relato, criado_agora).
        """
        existente = self.obter(familia_id, relato_id)
        if existente:
            return existente, False
        nome = None
        if audio:
            nome = f"{relato_id}.{extensao_audio(mime)}"
            (self.pasta_audios / nome).write_bytes(audio)
        with self._conexao() as c:
            c.execute(
                "insert into relatos (id, familia_id, criado_em, gravado_em, duracao_s, "
                "audio_arquivo, mime, etapa) values (?, ?, ?, ?, ?, ?, ?, 'recebido')",
                (relato_id, familia_id, agora(), gravado_em or agora(), duracao_s, nome, mime),
            )
        return self.obter(familia_id, relato_id), True  # type: ignore[return-value]

    def atualizar_etapa(self, relato_id: str, etapa: str, erro: str | None = None) -> None:
        with self._conexao() as c:
            c.execute(
                "update relatos set etapa = ?, erro = ? where id = ?", (etapa, erro, relato_id)
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
        with self._conexao() as c:
            c.execute(
                "update relatos set etapa = 'pronto', erro = null, transcricao = ?, registro = ?, "
                "alertas = ?, resumo = ?, resumo_seguro = ?, versao_prompt = ?, modelo = ? "
                "where id = ?",
                (
                    transcricao,
                    json.dumps(registro, ensure_ascii=False),
                    json.dumps(alertas, ensure_ascii=False),
                    resumo,
                    int(resumo_seguro),
                    versao_prompt,
                    modelo,
                    relato_id,
                ),
            )

    def atualizar_registro(self, relato_id: str, registro: dict, resumo: str) -> None:
        with self._conexao() as c:
            c.execute(
                "update relatos set registro = ?, resumo = ? where id = ?",
                (json.dumps(registro, ensure_ascii=False), resumo, relato_id),
            )

    def marcar_enviado(self, familia_id: str, relato_id: str) -> None:
        with self._conexao() as c:
            c.execute(
                "update relatos set enviado_familia = 1 where id = ? and familia_id = ?",
                (relato_id, familia_id),
            )

    def obter(self, familia_id: str, relato_id: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select * from relatos where id = ? and familia_id = ?", (relato_id, familia_id)
            ).fetchone()
        return _relato(linha) if linha else None

    def listar(self, familia_id: str, limite: int = 50) -> list[dict]:
        with self._conexao() as c:
            linhas = c.execute(
                "select * from relatos where familia_id = ? order by gravado_em desc limit ?",
                (familia_id, limite),
            ).fetchall()
        return [_relato(linha) for linha in linhas]

    def apagar(self, familia_id: str, relato_id: str) -> bool:
        relato = self.obter(familia_id, relato_id)
        if not relato:
            return False
        if relato["audio_arquivo"]:
            (self.pasta_audios / relato["audio_arquivo"]).unlink(missing_ok=True)
        with self._conexao() as c:
            c.execute(
                "delete from relatos where id = ? and familia_id = ?", (relato_id, familia_id)
            )
        return True

    def caminho_audio(self, relato: dict) -> Path | None:
        if not relato.get("audio_arquivo"):
            return None
        caminho = self.pasta_audios / relato["audio_arquivo"]
        return caminho if caminho.exists() else None

    def ler_audio(self, relato: dict) -> bytes | None:
        caminho = self.caminho_audio(relato)
        return caminho.read_bytes() if caminho else None

    def tem_audio(self, relato: dict) -> bool:
        return self.caminho_audio(relato) is not None

    def campos_corrigidos(self, familia_id: str, relato_ids: list[str]) -> dict[str, list[str]]:
        """Campos com correção ativa em cada relato, numa consulta só."""
        if not relato_ids:
            return {}
        marcas = ",".join("?" * len(relato_ids))
        with self._conexao() as c:
            linhas = c.execute(
                f"select relato_id, campo from correcoes where familia_id = ? and desfeita = 0 "
                f"and relato_id in ({marcas})",
                (familia_id, *relato_ids),
            ).fetchall()
        resultado: dict[str, list[str]] = {}
        for linha in linhas:
            resultado.setdefault(linha["relato_id"], []).append(linha["campo"])
        return {k: sorted(set(v)) for k, v in resultado.items()}

    # Famílias e membros ----------------------------------------------------

    def familia_do_usuario(self, usuario_id: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select familia_id, papel from membros where usuario_id = ? order by criado_em limit 1",
                (usuario_id,),
            ).fetchone()
        return {"familia": linha["familia_id"], "papel": linha["papel"]} if linha else None

    def entrar_na_familia(self, usuario_id: str, familia_id: str, nome: str, papel: str) -> None:
        with self._conexao() as c:
            c.execute(
                "insert or ignore into membros (usuario_id, familia_id, nome_exibicao, papel, criado_em) "
                "values (?, ?, ?, ?, ?)",
                (usuario_id, familia_id, nome, papel, agora()),
            )

    def criar_familia(self, usuario_id: str, nome_familia: str, nome: str) -> str:
        codigo = f"familia-{uuid.uuid4().hex[:12]}"
        self.entrar_na_familia(usuario_id, codigo, nome, "quem_cuida")
        return codigo

    def registrar_consentimento(
        self, usuario_id: str, familia_id: str, finalidades: list[str], versao: str
    ) -> None:
        with self._conexao() as c:
            c.executemany(
                "insert into consentimentos (usuario_id, familia_id, finalidade, versao_termo, aceito_em) "
                "values (?, ?, ?, ?, ?)",
                [(usuario_id, familia_id, f, versao, agora()) for f in finalidades],
            )

    # LGPD: exportar e apagar tudo ------------------------------------------

    def exportar(self, familia_id: str) -> dict:
        with self._conexao() as c:
            correcoes = [
                _correcao(linha)
                for linha in c.execute(
                    "select * from correcoes where familia_id = ? order by criado_em", (familia_id,)
                )
            ]
            membros = [
                dict(linha)
                for linha in c.execute(
                    "select nome_exibicao, papel, criado_em from membros where familia_id = ?",
                    (familia_id,),
                )
            ]
            consentimentos = [
                dict(linha)
                for linha in c.execute(
                    "select finalidade, versao_termo, aceito_em from consentimentos where familia_id = ?",
                    (familia_id,),
                )
            ]
        return {
            "relatos": self.listar(familia_id, limite=100000),
            "correcoes": correcoes,
            "membros": membros,
            "consentimentos": consentimentos,
            "passaporte": self.obter_passaporte(familia_id),
            "sessoes": self.sessoes_recentes(familia_id, limite=100000),
            "tarefas": self.listar_tarefas(familia_id, incluir_antigas=True),
            "feed": self.feed_eventos(familia_id, limite=100000),
        }

    def apagar_familia(self, familia_id: str) -> int:
        relatos = self.listar(familia_id, limite=100000)
        for relato in relatos:
            self.apagar(familia_id, relato["id"])
        with self._conexao() as c:
            for tabela in (
                "correcoes",
                "membros",
                "consentimentos",
                "passaportes",
                "sessoes",
                "links_passaporte",
                "tarefas",
                "convites",
                "feed_eventos",
            ):
                c.execute(f"delete from {tabela} where familia_id = ?", (familia_id,))
        import shutil

        shutil.rmtree(self.pasta / "fotos" / _seguro(familia_id), ignore_errors=True)
        return len(relatos)

    # Rede da família ------------------------------------------------------

    def membros_da_familia(self, familia_id: str) -> list[dict]:
        with self._conexao() as c:
            linhas = c.execute(
                "select usuario_id, nome_exibicao, papel, foto from membros where familia_id = ? "
                "order by criado_em",
                (familia_id,),
            ).fetchall()
        return [
            {
                "usuario_id": x["usuario_id"],
                "nome": x["nome_exibicao"],
                "papel": x["papel"],
                "foto": x["foto"],
            }
            for x in linhas
        ]

    def atualizar_membro(
        self, familia_id: str, usuario_id: str, nome: str, papel: str, foto: str | None = None
    ) -> None:
        with self._conexao() as c:
            c.execute(
                "update membros set nome_exibicao = ?, papel = ?, foto = ? "
                "where familia_id = ? and usuario_id = ?",
                (nome, papel, foto, familia_id, usuario_id),
            )
            # As tarefas assumidas acompanham o nome novo.
            c.execute(
                "update tarefas set responsavel_nome = ? where familia_id = ? and responsavel_usuario = ?",
                (nome, familia_id, usuario_id),
            )

    def criar_convite(self, familia_id: str, codigo: str, papel: str, expira_em: str) -> None:
        with self._conexao() as c:
            c.execute(
                "insert into convites (codigo, familia_id, papel, criado_em, expira_em) values (?, ?, ?, ?, ?)",
                (codigo, familia_id, papel, agora(), expira_em),
            )

    def usar_convite(self, codigo: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select familia_id, papel from convites where codigo = ? and expira_em > ?",
                (codigo, agora()),
            ).fetchone()
        return {"familia": linha["familia_id"], "papel": linha["papel"]} if linha else None

    def mudar_de_familia(self, usuario_id: str, familia_id: str, nome: str, papel: str) -> None:
        with self._conexao() as c:
            c.execute("delete from membros where usuario_id = ?", (usuario_id,))
        self.entrar_na_familia(usuario_id, familia_id, nome, papel)

    def listar_tarefas(self, familia_id: str, incluir_antigas: bool = False) -> list[dict]:
        filtro = "" if incluir_antigas else "and (concluida = 0 or concluida_em > ?)"
        parametros: tuple = (familia_id,) if incluir_antigas else (familia_id, _dias_atras(7))
        with self._conexao() as c:
            linhas = c.execute(
                f"select * from tarefas where familia_id = ? {filtro} "
                "order by concluida, coalesce(quando, '9999'), criado_em",
                parametros,
            ).fetchall()
        return [_tarefa(dict(x)) for x in linhas]

    def obter_tarefa(self, familia_id: str, tarefa_id: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select * from tarefas where id = ? and familia_id = ?", (tarefa_id, familia_id)
            ).fetchone()
        return _tarefa(dict(linha)) if linha else None

    def criar_tarefa(self, familia_id: str, dados: dict) -> dict:
        tarefa_id = str(uuid.uuid4())
        with self._conexao() as c:
            c.execute(
                "insert into tarefas (id, familia_id, titulo, tipo, responsavel_nome, criada_por, quando, "
                "concluida, criado_em) values (?, ?, ?, ?, ?, ?, ?, 0, ?)",
                (
                    tarefa_id,
                    familia_id,
                    dados["titulo"],
                    dados["tipo"],
                    dados.get("responsavel_nome"),
                    dados.get("criada_por"),
                    dados.get("quando"),
                    agora(),
                ),
            )
        return self.obter_tarefa(familia_id, tarefa_id)  # type: ignore[return-value]

    def atualizar_tarefa(self, familia_id: str, tarefa_id: str, campos: dict) -> dict | None:
        permitidos = {
            "titulo",
            "tipo",
            "responsavel_nome",
            "responsavel_usuario",
            "quando",
            "concluida",
        }
        campos = {k: v for k, v in campos.items() if k in permitidos}
        if "concluida" in campos:
            campos["concluida_em"] = agora() if campos["concluida"] else None
            campos["concluida"] = 1 if campos["concluida"] else 0
        if campos:
            sets = ", ".join(f"{k} = ?" for k in campos)
            with self._conexao() as c:
                c.execute(
                    f"update tarefas set {sets} where id = ? and familia_id = ?",
                    (*campos.values(), tarefa_id, familia_id),
                )
        return self.obter_tarefa(familia_id, tarefa_id)

    def apagar_tarefa(self, familia_id: str, tarefa_id: str) -> bool:
        with self._conexao() as c:
            cursor = c.execute(
                "delete from tarefas where id = ? and familia_id = ?", (tarefa_id, familia_id)
            )
        return cursor.rowcount > 0

    def registrar_feed(
        self, familia_id: str, tipo: str, autor: str, texto: str | None, ref: str | None
    ) -> str:
        evento_id = str(uuid.uuid4())
        with self._conexao() as c:
            c.execute(
                "insert into feed_eventos (id, familia_id, tipo, autor, texto, ref, criado_em) "
                "values (?, ?, ?, ?, ?, ?, ?)",
                (evento_id, familia_id, tipo, autor, texto, ref, agora()),
            )
        return evento_id

    def feed_eventos(self, familia_id: str, limite: int = 200) -> list[dict]:
        with self._conexao() as c:
            linhas = c.execute(
                "select id, tipo, autor, texto, ref, criado_em from feed_eventos where familia_id = ? "
                "order by criado_em desc limit ?",
                (familia_id, limite),
            ).fetchall()
        return [dict(x) for x in linhas]

    # Passaporte e conversas ------------------------------------------------

    def obter_passaporte(self, familia_id: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select dados from passaportes where familia_id = ?", (familia_id,)
            ).fetchone()
        return json.loads(linha["dados"]) if linha else None

    def salvar_passaporte(self, familia_id: str, dados: dict) -> None:
        with self._conexao() as c:
            c.execute(
                "insert into passaportes (familia_id, dados, atualizado_em) values (?, ?, ?) "
                "on conflict (familia_id) do update set dados = excluded.dados, "
                "atualizado_em = excluded.atualizado_em",
                (familia_id, json.dumps(dados, ensure_ascii=False), agora()),
            )

    def salvar_foto(self, familia_id: str, chave: str, conteudo: bytes) -> None:
        pasta = self.pasta / "fotos" / _seguro(familia_id)
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / f"{chave}.jpg").write_bytes(conteudo)

    def ler_foto(self, familia_id: str, chave: str) -> bytes | None:
        caminho = self.pasta / "fotos" / _seguro(familia_id) / f"{chave}.jpg"
        return caminho.read_bytes() if caminho.exists() else None

    def definir_link(self, familia_id: str, token: str | None) -> None:
        with self._conexao() as c:
            c.execute("delete from links_passaporte where familia_id = ?", (familia_id,))
            if token:
                c.execute(
                    "insert into links_passaporte (token, familia_id, criado_em) values (?, ?, ?)",
                    (token, familia_id, agora()),
                )

    def link_da_familia(self, familia_id: str) -> str | None:
        with self._conexao() as c:
            linha = c.execute(
                "select token from links_passaporte where familia_id = ?", (familia_id,)
            ).fetchone()
        return linha["token"] if linha else None

    def familia_do_link(self, token: str) -> str | None:
        with self._conexao() as c:
            linha = c.execute(
                "select familia_id from links_passaporte where token = ?", (token,)
            ).fetchone()
        return linha["familia_id"] if linha else None

    def registrar_sessao(
        self, familia_id: str, roteiro: dict, reacao: str, nota: str | None
    ) -> str:
        sessao_id = str(uuid.uuid4())
        with self._conexao() as c:
            c.execute(
                "insert into sessoes (id, familia_id, data, roteiro, reacao, nota, realizada_em) "
                "values (?, ?, ?, ?, ?, ?, ?)",
                (
                    sessao_id,
                    familia_id,
                    roteiro["data"],
                    json.dumps(roteiro, ensure_ascii=False),
                    reacao,
                    nota,
                    agora(),
                ),
            )
        return sessao_id

    def sessoes_recentes(self, familia_id: str, limite: int = 60) -> list[dict]:
        with self._conexao() as c:
            linhas = c.execute(
                "select * from sessoes where familia_id = ? order by data desc, realizada_em desc "
                "limit ?",
                (familia_id, limite),
            ).fetchall()
        return [
            _sessao(json.loads(x["roteiro"]), x["id"], x["reacao"], x["nota"], x["realizada_em"])
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
        correcao_id = str(uuid.uuid4())
        with self._conexao() as c:
            c.execute(
                "insert into correcoes (id, relato_id, familia_id, campo, valor_anterior, "
                "valor_novo, resumo_anterior, criado_em) values (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    correcao_id,
                    relato_id,
                    familia_id,
                    campo,
                    json.dumps(valor_anterior, ensure_ascii=False),
                    json.dumps(valor_novo, ensure_ascii=False),
                    resumo_anterior,
                    agora(),
                ),
            )
        return correcao_id

    def obter_correcao(self, familia_id: str, correcao_id: str) -> dict | None:
        with self._conexao() as c:
            linha = c.execute(
                "select * from correcoes where id = ? and familia_id = ?", (correcao_id, familia_id)
            ).fetchone()
        return _correcao(linha) if linha else None

    def marcar_correcao_desfeita(self, correcao_id: str) -> None:
        with self._conexao() as c:
            c.execute("update correcoes set desfeita = 1 where id = ?", (correcao_id,))

    def correcoes_recentes(self, familia_id: str, limite: int = 8) -> list[dict]:
        """Correções válidas mais recentes da família, com um trecho do relato para contexto."""
        with self._conexao() as c:
            linhas = c.execute(
                "select c.*, r.transcricao from correcoes c join relatos r on r.id = c.relato_id "
                "where c.familia_id = ? and c.desfeita = 0 order by c.criado_em desc limit ?",
                (familia_id, limite),
            ).fetchall()
        return [{**_correcao(linha), "trecho": linha["transcricao"]} for linha in linhas]

    # Métricas anônimas -----------------------------------------------------

    def registrar_evento(
        self, tipo: str, familia_id: str, valor: float | None = None, rotulo: str | None = None
    ) -> None:
        if tipo not in EVENTOS_PERMITIDOS:
            raise ValueError(f"Evento desconhecido: {tipo}")
        with self._conexao() as c:
            c.execute(
                "insert into eventos (tipo, familia_hash, semana, valor, rotulo, criado_em) "
                "values (?, ?, ?, ?, ?, ?)",
                (tipo, _hash_familia(familia_id), _semana(), valor, rotulo, agora()),
            )

    def metricas(self) -> dict:
        """Números agregados, sem nenhum conteúdo de relato."""
        with self._conexao() as c:
            por_semana = [
                dict(linha)
                for linha in c.execute(
                    "select semana, count(*) as diarios, count(distinct familia_hash) as familias "
                    "from eventos where tipo = 'diario_gravado' group by semana order by semana"
                )
            ]
            total_relatos = c.execute(
                "select count(*) from relatos where etapa = 'pronto'"
            ).fetchone()[0]
            corrigidos = c.execute(
                "select count(distinct relato_id) from correcoes where desfeita = 0"
            ).fetchone()[0]
            por_campo = [
                dict(linha)
                for linha in c.execute(
                    "select campo, count(*) as correcoes from correcoes where desfeita = 0 "
                    "group by campo order by correcoes desc"
                )
            ]
            primeiros = [
                linha[0]
                for linha in c.execute(
                    "select valor from eventos where tipo = 'primeiro_diario' and valor is not null "
                    "order by valor"
                )
            ]
            sessoes = [
                dict(linha)
                for linha in c.execute(
                    "select rotulo as reacao, count(*) as sessoes from eventos "
                    "where tipo = 'sessao_concluida' group by rotulo"
                )
            ]
        mediana = primeiros[len(primeiros) // 2] if primeiros else None
        return {
            "diarios_por_semana": por_semana,
            "relatos_processados": total_relatos,
            "relatos_com_correcao": corrigidos,
            "taxa_de_correcao": round(corrigidos / total_relatos, 3) if total_relatos else None,
            "correcoes_por_campo": por_campo,
            "segundos_ate_primeiro_diario_mediana": mediana,
            "sessoes_reminiscencia": sessoes,
        }


def _json(valor: str | None, padrao: Any = None) -> Any:
    return json.loads(valor) if valor else padrao


def _relato(linha: sqlite3.Row) -> dict:
    dados = dict(linha)
    dados["registro"] = _json(dados["registro"])
    dados["alertas"] = _json(dados["alertas"], [])
    dados["resumo_seguro"] = bool(dados["resumo_seguro"])
    dados["enviado_familia"] = bool(dados["enviado_familia"])
    return dados


def _correcao(linha: sqlite3.Row) -> dict:
    dados = {k: linha[k] for k in linha.keys() if k != "transcricao"}
    dados["valor_anterior"] = _json(dados["valor_anterior"])
    dados["valor_novo"] = _json(dados["valor_novo"])
    dados["desfeita"] = bool(dados["desfeita"])
    return dados


def repositorio_padrao():
    """Supabase quando configurado (REPOSITORIO=supabase ou as variáveis presentes), senão local."""
    from core.config import config

    cfg = config()
    if cfg.repositorio == "local":
        return Repositorio(cfg.dados_dir)
    if cfg.supabase_database_url and cfg.supabase_secret_key and cfg.supabase_url:
        from core.repositorio_supabase import RepositorioSupabase

        return RepositorioSupabase(
            cfg.supabase_database_url, cfg.supabase_url, cfg.supabase_secret_key
        )
    return Repositorio(cfg.dados_dir)


def _sessao(
    roteiro: dict, sessao_id: str, reacao: str | None, nota: str | None, quando: Any
) -> dict:
    """Formato comum das sessões, igual no SQLite e no Supabase."""
    return {
        "id": str(sessao_id),
        "data": roteiro.get("data"),
        "tema_chave": roteiro.get("tema_chave"),
        "tema": roteiro.get("tema"),
        "tipo": roteiro.get("tipo"),
        "conjunto": roteiro.get("conjunto"),
        "perguntas": roteiro.get("perguntas", []),
        "reacao": reacao,
        "nota": nota,
        "realizada_em": quando if isinstance(quando, str) else quando.isoformat(),
    }


def _seguro(texto: str) -> str:
    """Nome de pasta sem caracteres que escapem do diretório."""
    return "".join(c for c in texto if c.isalnum() or c in "-_") or "x"


def _dias_atras(dias: int) -> str:
    from datetime import timedelta

    return (datetime.now(UTC) - timedelta(days=dias)).isoformat(timespec="seconds")


def _tarefa(linha: dict) -> dict:
    """Formato comum das tarefas, igual no SQLite e no Supabase."""

    def iso(v: Any) -> str | None:
        return v if v is None or isinstance(v, str) else v.isoformat()

    return {
        "id": str(linha["id"]),
        "titulo": linha["titulo"],
        "tipo": linha["tipo"],
        "responsavel_nome": linha.get("responsavel_nome"),
        "responsavel_usuario": str(linha["responsavel_usuario"])
        if linha.get("responsavel_usuario")
        else None,
        "criada_por": linha.get("criada_por"),
        "quando": iso(linha.get("quando")),
        "concluida": bool(linha["concluida"]),
        "criado_em": iso(linha.get("criado_em")),
        "concluida_em": iso(linha.get("concluida_em")),
    }
