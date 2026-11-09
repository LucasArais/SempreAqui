-- Schema inicial do SempreAqui.
-- Princípio: todo dado pertence a um grupo familiar e só membros desse grupo o enxergam (RLS).
-- Em produção com Supabase, troque sa_usuario_atual() por auth.uid().

create extension if not exists vector;
create extension if not exists pgcrypto;

-- Usuário de aplicação sem privilégio de superusuário, para que o RLS seja aplicado de fato.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sempreaqui_app') then
    create role sempreaqui_app login password 'troque-esta-senha-app';
  end if;
end $$;

-- Quem está fazendo a requisição. A API define com: set local app.usuario_id = '<uuid>';
create or replace function sa_usuario_atual() returns uuid
language sql stable as $$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$$;

create table grupos_familiares (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  usuario_id uuid not null,
  nome_exibicao text not null,
  papel text not null check (papel in ('quem_cuida', 'familiar', 'cuidador_profissional')),
  criado_em timestamptz not null default now(),
  unique (grupo_id, usuario_id)
);

-- Consentimento explícito (LGPD, art. 11): registrado por finalidade, com versão do termo.
create table consentimentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  usuario_id uuid not null,
  finalidade text not null check (finalidade in (
    'dados_de_saude_diario', 'passaporte_memoria', 'audio_e_fotos', 'compartilhamento_link'
  )),
  versao_termo text not null,
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz
);

create or replace function sa_membro_do_grupo(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where grupo_id = g and usuario_id = sa_usuario_atual())
$$;

create table pessoas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  como_gosta_de_ser_chamada text not null,
  criado_em timestamptz not null default now()
);

create table passaportes (
  pessoa_id uuid primary key references pessoas(id) on delete cascade,
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  dados jsonb not null default '{}',
  -- token aleatório para o link somente leitura; nulo quando o compartilhamento está desligado
  token_compartilhamento text unique,
  atualizado_em timestamptz not null default now()
);

create table registros_diario (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  data date not null,
  audio_caminho text,
  transcricao text,
  dados jsonb not null,
  alertas jsonb not null default '[]',
  resumo_familia text,
  versao_prompt text not null,
  criado_por uuid not null,
  criado_em timestamptz not null default now()
);
create index on registros_diario (pessoa_id, data);

-- Correções feitas pela família nos campos da IA. Alimentam o prompt de extração seguinte.
create table correcoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  relato_id uuid not null references registros_diario(id) on delete cascade,
  campo text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  resumo_anterior text,
  desfeita boolean not null default false,
  criado_em timestamptz not null default now()
);

create table sessoes_reminiscencia (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  roteiro jsonb not null,
  reacao text check (reacao in ('gostou_muito', 'gostou', 'neutra', 'desconforto')),
  notas text,
  realizada_em timestamptz
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_familiares(id) on delete cascade,
  titulo text not null,
  tipo text not null check (tipo in ('consulta', 'visita', 'cobrir_folga', 'compra', 'outro')),
  responsavel_id uuid references membros(id) on delete set null,
  quando timestamptz,
  concluida boolean not null default false
);

-- Métricas anônimas: sem conteúdo, família só como hash.
create table eventos (
  id bigserial primary key,
  tipo text not null,
  familia_hash text not null,
  semana text not null,
  valor double precision,
  rotulo text,
  criado_em timestamptz not null default now()
);

-- Trechos de fontes oficiais. Não é dado de família, então é legível por todos os usuários.
create table fontes_trechos (
  id bigserial primary key,
  fonte_id text not null,
  titulo text not null,
  orgao text not null,
  url text not null,
  conteudo text not null,
  embedding vector(768) not null
);
create index on fontes_trechos using hnsw (embedding vector_cosine_ops);

-- Row Level Security: cada tabela de família só é visível para membros do grupo.
do $$
declare t text;
begin
  foreach t in array array[
    'membros', 'consentimentos', 'pessoas', 'passaportes',
    'registros_diario', 'correcoes', 'sessoes_reminiscencia', 'tarefas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy membros_do_grupo on %I using (sa_membro_do_grupo(grupo_id)) '
      'with check (sa_membro_do_grupo(grupo_id))', t);
    execute format('grant select, insert, update, delete on %I to sempreaqui_app', t);
  end loop;
end $$;

alter table grupos_familiares enable row level security;
create policy membros_do_grupo on grupos_familiares using (sa_membro_do_grupo(id));
grant select, insert, update, delete on grupos_familiares to sempreaqui_app;
grant select on fontes_trechos to sempreaqui_app;

-- Criar um grupo exige inserir o grupo e o primeiro membro juntos, o que o RLS bloquearia.
-- Esta função faz as duas coisas de forma atômica para o usuário atual.
create or replace function sa_criar_grupo(nome_grupo text, nome_exibicao text, papel text)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid;
begin
  if sa_usuario_atual() is null then
    raise exception 'usuário não identificado';
  end if;
  insert into grupos_familiares (nome) values (nome_grupo) returning id into novo;
  insert into membros (grupo_id, usuario_id, nome_exibicao, papel)
    values (novo, sa_usuario_atual(), nome_exibicao, papel);
  return novo;
end $$;
grant execute on function sa_criar_grupo(text, text, text) to sempreaqui_app;

-- Direito de exclusão (LGPD, art. 18): apagar o grupo apaga tudo em cascata.
-- A exportação é feita pela API, reunindo todas as tabelas acima filtradas pelo grupo.
