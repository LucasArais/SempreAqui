-- SempreAqui: schema inicial no Supabase.
--
-- Princípio: todo dado pertence a um grupo familiar e só os membros desse grupo o enxergam.
-- O RLS usa o login do Supabase (auth.uid()) e protege qualquer acesso feito pelo app com a
-- chave publishable. O backend acessa com a conexão do dono das tabelas e filtra por família
-- em todas as consultas.
--
-- Nenhuma senha ou chave neste arquivo. Ele é público.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Grupos e membros ------------------------------------------------------------

create table public.grupos_familiares (
  id uuid primary key default gen_random_uuid(),
  -- Código estável usado pelo backend (por exemplo, a família de demonstração)
  codigo text unique not null check (codigo ~ '^[A-Za-z0-9-]{3,64}$'),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome_exibicao text not null,
  papel text not null check (papel in ('quem_cuida', 'familiar', 'cuidador_profissional')),
  criado_em timestamptz not null default now(),
  unique (grupo_id, usuario_id)
);
create index membros_usuario on public.membros (usuario_id);

-- Consentimento explícito por finalidade (LGPD, art. 11)
create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  finalidade text not null check (finalidade in (
    'dados_de_saude_diario', 'passaporte_memoria', 'audio_e_fotos', 'compartilhamento_link'
  )),
  versao_termo text not null,
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz
);

-- Diz se o usuário logado é membro do grupo. Security definer para não cair em recursão no RLS.
create or replace function public.sa_membro_do_grupo(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros m where m.grupo_id = g and m.usuario_id = (select auth.uid())
  )
$$;
revoke execute on function public.sa_membro_do_grupo(uuid) from public, anon;
grant execute on function public.sa_membro_do_grupo(uuid) to authenticated;

-- Pessoa que vive com Alzheimer e Passaporte -----------------------------------

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  como_gosta_de_ser_chamada text not null,
  criado_em timestamptz not null default now()
);

create table public.passaportes (
  pessoa_id uuid primary key references public.pessoas(id) on delete cascade,
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  dados jsonb not null default '{}',
  token_compartilhamento text unique,
  atualizado_em timestamptz not null default now()
);

-- Diário --------------------------------------------------------------------------

create table public.relatos (
  -- O id nasce no celular: reenviar da fila offline nunca duplica.
  id text primary key check (id ~ '^[A-Za-z0-9-]{8,64}$'),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  criado_em timestamptz not null default now(),
  gravado_em timestamptz not null,
  duracao_s real,
  audio_caminho text,
  mime text,
  etapa text not null default 'recebido'
    check (etapa in ('recebido', 'transcrevendo', 'organizando', 'resumindo', 'pronto', 'erro')),
  erro text,
  transcricao text,
  registro jsonb,
  alertas jsonb not null default '[]',
  resumo text,
  resumo_seguro boolean not null default false,
  versao_prompt text,
  modelo text,
  enviado_familia boolean not null default false
);
create index relatos_grupo_data on public.relatos (grupo_id, gravado_em desc);

-- Correções da família nos campos da IA. Alimentam o prompt de extração seguinte.
create table public.correcoes (
  id uuid primary key default gen_random_uuid(),
  relato_id text not null references public.relatos(id) on delete cascade,
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  campo text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  resumo_anterior text,
  desfeita boolean not null default false,
  criado_em timestamptz not null default now()
);
create index correcoes_grupo_data on public.correcoes (grupo_id, criado_em desc);

-- Métricas anônimas: sem conteúdo, família só como hash. Nunca acessível pelo app.
create table public.eventos (
  id bigint generated always as identity primary key,
  tipo text not null,
  familia_hash text not null,
  semana text not null,
  valor double precision,
  rotulo text,
  criado_em timestamptz not null default now()
);

-- Rede da família e reminiscência (ciclos seguintes) ------------------------------

create table public.sessoes_reminiscencia (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  pessoa_id uuid references public.pessoas(id) on delete cascade,
  roteiro jsonb not null,
  reacao text,
  realizada_em timestamptz
);

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  titulo text not null,
  tipo text not null check (tipo in ('consulta', 'visita', 'cobrir_folga', 'compra', 'outro')),
  responsavel_id uuid references public.membros(id) on delete set null,
  quando timestamptz,
  concluida boolean not null default false
);

-- Fontes oficiais para o RAG. Não é dado de família.
create table public.fontes_trechos (
  id bigint generated always as identity primary key,
  fonte_id text not null,
  titulo text not null,
  orgao text not null,
  url text not null,
  conteudo text not null,
  embedding extensions.vector(768) not null
);
create index fontes_trechos_embedding on public.fontes_trechos
  using hnsw (embedding extensions.vector_cosine_ops);

-- Row Level Security ---------------------------------------------------------------

alter table public.grupos_familiares enable row level security;
create policy "membros leem o próprio grupo" on public.grupos_familiares
  for select to authenticated using (public.sa_membro_do_grupo(id));

do $$
declare t text;
begin
  foreach t in array array[
    'membros', 'consentimentos', 'pessoas', 'passaportes', 'relatos', 'correcoes',
    'sessoes_reminiscencia', 'tarefas'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "somente membros do grupo" on public.%I for all to authenticated '
      'using (public.sa_membro_do_grupo(grupo_id)) with check (public.sa_membro_do_grupo(grupo_id))',
      t
    );
  end loop;
end $$;

-- Eventos: RLS ligado e nenhuma política. Só o backend lê e escreve.
alter table public.eventos enable row level security;

alter table public.fontes_trechos enable row level security;
create policy "fontes oficiais são públicas para quem está logado" on public.fontes_trechos
  for select to authenticated using (true);

-- Criar grupo e o primeiro membro juntos (o RLS bloquearia fazer em dois passos).
create or replace function public.sa_criar_grupo(codigo_grupo text, nome_grupo text, nome_exibicao text, papel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare novo uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'usuário não identificado';
  end if;
  insert into public.grupos_familiares (codigo, nome) values (codigo_grupo, nome_grupo) returning id into novo;
  insert into public.membros (grupo_id, usuario_id, nome_exibicao, papel)
    values (novo, (select auth.uid()), nome_exibicao, papel);
  return novo;
end $$;
revoke execute on function public.sa_criar_grupo(text, text, text, text) from public, anon;
grant execute on function public.sa_criar_grupo(text, text, text, text) to authenticated;

-- Áudios ----------------------------------------------------------------------------
-- Bucket privado. Caminho: <grupo_id>/<relato_id>.<ext>. Só membros do grupo leem.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 26214400,
        array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/webm'])
on conflict (id) do nothing;

create policy "membros ouvem os áudios do grupo" on storage.objects
  for select to authenticated
  using (bucket_id = 'audios' and public.sa_membro_do_grupo(((storage.foldername(name))[1])::uuid));

-- Direito de exclusão (LGPD, art. 18): apagar o grupo apaga tudo em cascata.
-- Os áudios do bucket são apagados pelo backend antes de remover o grupo.
