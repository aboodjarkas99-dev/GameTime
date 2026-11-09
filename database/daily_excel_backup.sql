-- GameTime automatic daily Excel backup
-- The Edge Function writes a private "latest" workbook plus one dated workbook per Central-time day.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null default current_date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),
  source text not null default 'cron',
  latest_path text,
  archive_path text,
  file_bytes bigint,
  row_counts jsonb not null default '{}'::jsonb,
  error_message text
);
alter table public.backup_runs enable row level security;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'gametime_backup_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'gametime_backup_token',
      'Private token used only by the GameTime daily backup cron job'
    );
  end if;
end $$;

create or replace function public.verify_gametime_backup_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, vault
as $$
  select coalesce(
    exists (
      select 1 from vault.decrypted_secrets
      where name = 'gametime_backup_token'
        and decrypted_secret = p_token
    ),
    false
  );
$$;
revoke all on function public.verify_gametime_backup_token(text) from public;
revoke all on function public.verify_gametime_backup_token(text) from anon;
revoke all on function public.verify_gametime_backup_token(text) from authenticated;
grant execute on function public.verify_gametime_backup_token(text) to service_role;

-- The production cron job is installed separately after the Edge Function deploys.
