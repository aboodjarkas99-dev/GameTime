alter table public.factory_products add column if not exists category text not null default 'unclassified' check(category in ('sport','residential','cleaner','unclassified'));
alter table public.factory_products add column if not exists stock_limits jsonb not null default '{}'::jsonb;
update factory_products p set category=case
 when name ~* '(cleaner|cleaning)' then 'cleaner'
 when exists(select 1 from inventory_current_stock s where lower(btrim(s.product))=p.name_key and s.package_type in ('quart_can','gallon','jerry_1_25')) then 'residential'
 when exists(select 1 from inventory_current_stock s where lower(btrim(s.product))=p.name_key and s.package_type='five_gallon_pail') then 'sport'
 else 'unclassified' end where category='unclassified';
alter table shipping_lines add column if not exists inventory_managed boolean not null default true;
create or replace function app_private.exclude_external_paint() returns trigger language plpgsql security definer set search_path=public,app_private as $$
begin
 if new.sku ~* '^GTCWP' or new.description ~* 'Chameleon Paint' then new.inventory_managed:=false; end if;
 return new;
end $$;
revoke all on function app_private.exclude_external_paint() from public,anon,authenticated;
create trigger exclude_external_paint before insert or update of sku,description on shipping_lines for each row execute function app_private.exclude_external_paint();
update shipping_lines set inventory_managed=false where inventory_product='Pantone P62' or sku ~* '^GTCWP' or description ~* 'Chameleon Paint';
update inventory_event_lines set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('excluded_from_factory_inventory',true,'exclusion_reason','External paint — not manufactured by factory','excluded_at',now())
where product='Pantone P62' or metadata->>'sku' ~* '^GTCWP' or metadata->>'description' ~* 'Chameleon Paint';

create or replace view public.inventory_current_stock with(security_invoker=true) as
select l.product_key,max(l.product) product,l.package_type,sum(l.qty_delta) stock_units,sum(l.gallons_delta) stock_gallons,max(e.created_at) last_movement_at,
coalesce(sum(l.qty_delta) filter(where e.event_type in ('PRODUCTION','PRODUCTION_CORRECTION')),0) produced_units,
-coalesce(sum(l.qty_delta) filter(where e.event_type in ('SHIPPED','SHIPPING_CORRECTION')),0) shipped_units,
coalesce(sum(l.qty_delta) filter(where e.event_type not in ('PRODUCTION','PRODUCTION_CORRECTION','SHIPPED','SHIPPING_CORRECTION')),0) adjustment_units
from inventory_event_lines l join inventory_events e on e.id=l.inventory_event_id
where coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
group by l.product_key,l.package_type;
create or replace view public.inventory_shipping_monthly with(security_invoker=true) as
select date_trunc('month',e.event_date::timestamptz)::date as month,l.product_key,max(l.product) product,l.package_type,-sum(l.qty_delta) shipped_units,-sum(l.gallons_delta) shipped_gallons,count(distinct e.event_id) shipment_events
from inventory_event_lines l join inventory_events e on e.id=l.inventory_event_id
where e.event_type in ('SHIPPED','SHIPPING_CORRECTION') and coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
group by date_trunc('month',e.event_date::timestamptz)::date,l.product_key,l.package_type;

create table app_private.shipping_order_numbers(number_key text primary key,shipment_id uuid not null,reserved_at timestamptz not null default now());
alter table app_private.shipping_order_numbers enable row level security;
create policy shipping_numbers_no_client on app_private.shipping_order_numbers for all to authenticated using(false) with check(false);
revoke all on app_private.shipping_order_numbers from public,anon,authenticated;
insert into app_private.shipping_order_numbers(number_key,shipment_id)
select distinct lower(regexp_replace(btrim(n),'\s+','','g')),s.id from shipping_shipments s cross join lateral(values(s.shipment_number),(s.packing_slip)) v(n) where btrim(coalesce(n,''))<>'';
create or replace function app_private.reserve_shipping_order_number() returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare k text; owner_id uuid;
begin
 if new.status in ('READY','SHIPPED') and btrim(coalesce(nullif(btrim(new.packing_slip),''),new.shipment_number,''))='' then raise exception 'Order / Packing Slip number is required'; end if;
 for k in select distinct lower(regexp_replace(btrim(n),'\s+','','g')) from (values(new.shipment_number),(new.packing_slip))v(n) where btrim(coalesce(n,''))<>'' order by 1 loop
  insert into shipping_order_numbers(number_key,shipment_id) values(k,new.id) on conflict(number_key) do nothing;
  select shipment_id into owner_id from shipping_order_numbers where number_key=k;
  if owner_id<>new.id then raise exception 'Order / Packing Slip number already exists. Open the original order; this number cannot be reused, even after cancellation.' using errcode='23505'; end if;
 end loop;
 return new;
end $$;
revoke all on function app_private.reserve_shipping_order_number() from public,anon,authenticated;
create trigger reserve_shipping_order_number before insert or update of shipment_number,packing_slip,status on shipping_shipments for each row execute function app_private.reserve_shipping_order_number();

