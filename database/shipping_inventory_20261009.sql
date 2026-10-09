-- Add display totals while retaining existing row-level access controls.
create or replace view public.inventory_current_stock with (security_invoker=true) as
select l.product_key, max(l.product) as product, l.package_type,
       sum(l.qty_delta) as stock_units, sum(l.gallons_delta) as stock_gallons,
       max(e.created_at) as last_movement_at,
       coalesce(sum(l.qty_delta) filter (where e.event_type in ('PRODUCTION','PRODUCTION_CORRECTION')),0) as produced_units,
       -coalesce(sum(l.qty_delta) filter (where e.event_type in ('SHIPPED','SHIPPING_CORRECTION')),0) as shipped_units,
       coalesce(sum(l.qty_delta) filter (where e.event_type not in ('PRODUCTION','PRODUCTION_CORRECTION','SHIPPED','SHIPPING_CORRECTION')),0) as adjustment_units
from public.inventory_event_lines l join public.inventory_events e on e.id=l.inventory_event_id
 group by l.product_key,l.package_type;

-- Existing policies allow only the same factory roles to receive these updates.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shipping_shipments') then
    alter publication supabase_realtime add table public.shipping_shipments;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inventory_event_lines') then
    alter publication supabase_realtime add table public.inventory_event_lines;
  end if;
end $$;

-- Historical production predates the ledger. Bring each order's production net
-- to its recorded actual quantities; retain all existing events and corrections.
-- Daily progress quantities are separate completed portions after carryover.
lock table public.work_orders,public.work_order_daily_progress in share mode;
lock table public.inventory_events,public.inventory_event_lines in share row exclusive mode;
do $$
declare r record; p record; v_event bigint; v_current numeric; v_delta numeric;
begin
  for r in select * from public.work_orders where prod_status='done' and deleted_at is null and not hold_line loop
    if exists(select 1 from public.inventory_events where event_id='historical_prod_order_'||r.id) then continue; end if;
    v_event:=null;
    for p in select * from (values
      ('quart_can',coalesce(r.actual_quart,0),0.25),
      ('gallon',coalesce(r.actual_gallon,0),1),
      ('five_gallon_pail',coalesce(r.actual_five,0),5),
      ('jerry_1_25',coalesce(r.actual_jerry,0),1.25)
    ) as packages(package_type,target,gpu) loop
      select coalesce(sum(l.qty_delta),0) into v_current
      from public.inventory_event_lines l join public.inventory_events e on e.id=l.inventory_event_id
      where e.event_type in ('PRODUCTION','PRODUCTION_CORRECTION')
        and e.metadata->>'work_order_id'=r.id::text
        and not (e.metadata ? 'daily_progress_id')
        and l.product_key=app_private.inventory_product_key(r.product)
        and l.package_type=p.package_type;
      v_delta:=p.target-v_current;
      if v_delta=0 then continue; end if;
      if v_event is null then
        insert into public.inventory_events(event_id,event_type,event_date,source_system,source_ref,notes,metadata)
        values ('historical_prod_order_'||r.id,'PRODUCTION_CORRECTION',coalesce(r.prod_work_date,r.work_date,current_date),'gametime',r.id::text,
        'Historical recorded actual production reconciliation; past shipments not included',jsonb_build_object('work_order_id',r.id,'historical_backfill',true)) returning id into v_event;
      end if;
      perform app_private.inventory_add_line(v_event,r.product,p.package_type,v_delta,p.gpu,r.batch);
    end loop;
  end loop;
  for r in select * from public.work_order_daily_progress where coalesce(actual_quart,0)+coalesce(actual_gallon,0)+coalesce(actual_five,0)+coalesce(actual_jerry,0)>0 loop
    v_event:=null;
    insert into public.inventory_events(event_id,event_type,event_date,source_system,source_ref,notes,metadata)
    values ('prod_progress_'||r.id,'PRODUCTION',r.work_date,'gametime','progress:'||r.id,'Historical actual partial-day production',
    jsonb_build_object('daily_progress_id',r.id,'work_order_id',r.order_id,'historical_backfill',true))
    on conflict(event_id) do nothing returning id into v_event;
    if v_event is null then continue; end if;
    perform app_private.inventory_add_line(v_event,r.product,'quart_can',coalesce(r.actual_quart,0),0.25,r.batch);
    perform app_private.inventory_add_line(v_event,r.product,'gallon',coalesce(r.actual_gallon,0),1,r.batch);
    perform app_private.inventory_add_line(v_event,r.product,'five_gallon_pail',coalesce(r.actual_five,0),5,r.batch);
    perform app_private.inventory_add_line(v_event,r.product,'jerry_1_25',coalesce(r.actual_jerry,0),1.25,r.batch);
  end loop;
end $$;
