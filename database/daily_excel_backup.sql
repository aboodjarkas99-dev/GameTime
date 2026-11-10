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

drop policy if exists "Managers can read backup runs" on public.backup_runs;
create policy "Managers can read backup runs"
on public.backup_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'manager'
  )
);

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

create or replace function public.gametime_backup_metadata()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, information_schema, storage, cron
as $
select jsonb_build_object(
  'schema_columns', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.table_name, x.ordinal_position)
    from (
      select c.table_name, c.ordinal_position, c.column_name, c.data_type,
             c.udt_name, c.is_nullable, c.column_default,
             c.character_maximum_length, c.numeric_precision, c.numeric_scale
      from information_schema.columns c
      where c.table_schema = 'public'
    ) x
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.table_name, x.constraint_name)
    from (
      select rel.relname as table_name, con.conname as constraint_name,
             case con.contype
               when 'p' then 'PRIMARY KEY'
               when 'f' then 'FOREIGN KEY'
               when 'u' then 'UNIQUE'
               when 'c' then 'CHECK'
               when 'x' then 'EXCLUSION'
               else con.contype::text
             end as constraint_type,
             pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
    ) x
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.tablename, x.indexname)
    from (
      select schemaname, tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
    ) x
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.table_name, x.trigger_name)
    from (
      select cls.relname as table_name, trg.tgname as trigger_name,
             pg_get_triggerdef(trg.oid, true) as definition
      from pg_trigger trg
      join pg_class cls on cls.oid = trg.tgrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
      where nsp.nspname = 'public' and not trg.tgisinternal
    ) x
  ), '[]'::jsonb),
  'rls_policies', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.tablename, x.policyname)
    from (
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
    ) x
  ), '[]'::jsonb),
  'cron_jobs', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.jobid)
    from (
      select jobid, jobname, schedule, active, database, username
      from cron.job
    ) x
  ), '[]'::jsonb),
  'storage_buckets', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.name)
    from (
      select id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
      from storage.buckets
    ) x
  ), '[]'::jsonb),
  'storage_objects', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.bucket_id, x.name)
    from (
      select bucket_id, name, owner_id, created_at, updated_at, last_accessed_at, metadata
      from storage.objects
    ) x
  ), '[]'::jsonb),
  'extensions', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.name)
    from (
      select extname as name, extversion as version
      from pg_extension
    ) x
  ), '[]'::jsonb),
  'routines', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.routine_name, x.arguments)
    from (
      select n.nspname as schema_name, p.proname as routine_name,
             pg_get_function_identity_arguments(p.oid) as arguments,
             pg_get_function_result(p.oid) as result_type,
             p.prosecdef as security_definer
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','app_private')
    ) x
  ), '[]'::jsonb)
);
$;

revoke all on function public.gametime_backup_metadata() from public;
revoke all on function public.gametime_backup_metadata() from anon;
revoke all on function public.gametime_backup_metadata() from authenticated;
grant execute on function public.gametime_backup_metadata() to service_role;

-- Daily automatic backup. Supabase Cron is UTC; 08:30 UTC is approximately
-- 2:30 AM Central Standard Time / 3:30 AM Central Daylight Time.
select cron.unschedule(jobid)
from cron.job
where jobname = 'gametime-daily-excel-backup';

select cron.schedule(
  'gametime-daily-excel-backup',
  '30 8 * * *',
  $job$
    select net.http_post(
      url := 'https://bqnptjfdsxzbxtkzigim.supabase.co/functions/v1/gametime-daily-backup',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-gametime-backup-token',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='gametime_backup_token'
          limit 1
        )
      ),
      body := jsonb_build_object('source','daily-cron'),
      timeout_milliseconds := 120000
    );
  $job$
);
