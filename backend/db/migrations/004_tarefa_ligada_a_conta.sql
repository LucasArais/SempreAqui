-- A tarefa fica ligada à conta de quem assumiu (não só ao nome), para mudar de nome sem perder o vínculo.
alter table public.tarefas add column if not exists responsavel_usuario uuid;
