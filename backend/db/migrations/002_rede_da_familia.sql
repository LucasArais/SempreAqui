-- Ciclo 6: Rede da Família. Convites, tarefas com responsável por nome e o feed da família.

alter table public.tarefas add column if not exists responsavel_nome text;
alter table public.tarefas add column if not exists criada_por text;
alter table public.tarefas add column if not exists criado_em timestamptz not null default now();
alter table public.tarefas add column if not exists concluida_em timestamptz;
create index if not exists tarefas_grupo on public.tarefas (grupo_id, concluida, quando);

-- Convite por código, válido por 7 dias e para várias pessoas. Só o backend lê.
create table public.convites (
  codigo text primary key check (codigo ~ '^[A-Z0-9]{6,12}$'),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  papel text not null check (papel in ('quem_cuida', 'familiar', 'cuidador_profissional')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
alter table public.convites enable row level security;

-- Feed da família: avisos, obrigados e o que aconteceu com as tarefas.
create table public.feed_eventos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  tipo text not null check (tipo in ('aviso', 'obrigado', 'tarefa_assumida', 'tarefa_concluida')),
  autor text not null,
  texto text,
  ref text,
  criado_em timestamptz not null default now()
);
create index feed_eventos_grupo_data on public.feed_eventos (grupo_id, criado_em desc);
alter table public.feed_eventos enable row level security;
create policy "somente membros do grupo" on public.feed_eventos for all to authenticated
  using (public.sa_membro_do_grupo(grupo_id)) with check (public.sa_membro_do_grupo(grupo_id));
