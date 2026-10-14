create table if not exists public.factory_products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 name_key text generated always as (lower(btrim(name))) stored unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.factory_products enable row level security;
revoke all on public.factory_products from anon,authenticated;
grant select,insert,update on public.factory_products to authenticated;
create policy factory_products_read on public.factory_products for select to authenticated
 using (app_private.current_app_role() in ('manager','chemist','shipping','prod','batch'));
create policy factory_products_add on public.factory_products for insert to authenticated
 with check (app_private.current_app_role() in ('manager','chemist'));
create policy factory_products_edit on public.factory_products for update to authenticated
 using (app_private.current_app_role() in ('manager','chemist'))
 with check (app_private.current_app_role() in ('manager','chemist'));
insert into public.factory_products(name)
select distinct on(lower(btrim(product))) btrim(product) from (
 select product from work_orders
 union all select product from work_order_daily_progress
) p where length(btrim(product)) between 1 and 120
order by lower(btrim(product)),product
on conflict(name_key) do nothing;
create or replace function app_private.remember_factory_product() returns trigger
language plpgsql security definer set search_path=public,app_private as $$
begin
 if length(btrim(new.product)) between 1 and 120 then
  insert into factory_products(name) values(btrim(new.product)) on conflict(name_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function app_private.remember_factory_product() from public,anon,authenticated;
create trigger remember_factory_product after insert or update of product on public.work_orders for each row execute function app_private.remember_factory_product();
alter publication supabase_realtime add table public.factory_products;

