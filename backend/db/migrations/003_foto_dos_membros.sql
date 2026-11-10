-- Cada pessoa da família pode ter a própria foto (chave no armazenamento privado do grupo).
alter table public.membros add column if not exists foto text check (foto is null or foto ~ '^(up-[0-9a-f]{24}|[A-Za-z]{2,30})$');
