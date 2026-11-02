CREATE OR REPLACE FUNCTION app_private.capture_work_order_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare
  v_old_done boolean := coalesce(old.prod_status,'')='done';
  v_new_done boolean := coalesce(new.prod_status,'')='done';
  v_event bigint;
  v_type text;
  v_event_id text;
  v_changed boolean;
begin
  v_changed :=
    v_old_done is distinct from v_new_done
    or old.product is distinct from new.product
    or old.batch is distinct from new.batch
    or old.actual_quart is distinct from new.actual_quart
    or old.actual_gallon is distinct from new.actual_gallon
    or old.actual_five is distinct from new.actual_five
    or old.actual_jerry is distinct from new.actual_jerry;

  if not v_changed or (not v_old_done and not v_new_done) then
    return new;
  end if;

  v_type := case when not v_old_done and v_new_done then 'PRODUCTION' else 'PRODUCTION_CORRECTION' end;
  v_event_id := 'prod_order_'||new.id::text||'_'||gen_random_uuid()::text;

  insert into public.inventory_events(
    event_id,event_type,event_date,source_system,source_ref,notes,metadata
  ) values (
    v_event_id,
    v_type,
    coalesce(new.prod_work_date,new.work_date,old.prod_work_date,old.work_date,current_date),
    'gametime',
    new.id::text,
    case when v_type='PRODUCTION' then 'Production WORK DONE' else 'Production quantity correction' end,
    jsonb_build_object('work_order_id',new.id,'version',new.version)
  )
  on conflict (event_id) do nothing
  returning id into v_event;

  if v_event is null then return new; end if;

  if v_old_done and not v_new_done then
    perform app_private.inventory_add_line(v_event,old.product,'quart_can',-coalesce(old.actual_quart,0),0.25,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'gallon',-coalesce(old.actual_gallon,0),1,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'five_gallon_pail',-coalesce(old.actual_five,0),5,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'jerry_1_25',-coalesce(old.actual_jerry,0),1.25,old.batch);
  elsif not v_old_done and v_new_done then
    perform app_private.inventory_add_line(v_event,new.product,'quart_can',coalesce(new.actual_quart,0),0.25,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'gallon',coalesce(new.actual_gallon,0),1,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'five_gallon_pail',coalesce(new.actual_five,0),5,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'jerry_1_25',coalesce(new.actual_jerry,0),1.25,new.batch);
  elsif old.product is distinct from new.product or old.batch is distinct from new.batch then
    perform app_private.inventory_add_line(v_event,old.product,'quart_can',-coalesce(old.actual_quart,0),0.25,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'gallon',-coalesce(old.actual_gallon,0),1,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'five_gallon_pail',-coalesce(old.actual_five,0),5,old.batch);
    perform app_private.inventory_add_line(v_event,old.product,'jerry_1_25',-coalesce(old.actual_jerry,0),1.25,old.batch);
    perform app_private.inventory_add_line(v_event,new.product,'quart_can',coalesce(new.actual_quart,0),0.25,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'gallon',coalesce(new.actual_gallon,0),1,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'five_gallon_pail',coalesce(new.actual_five,0),5,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'jerry_1_25',coalesce(new.actual_jerry,0),1.25,new.batch);
  else
    perform app_private.inventory_add_line(v_event,new.product,'quart_can',coalesce(new.actual_quart,0)-coalesce(old.actual_quart,0),0.25,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'gallon',coalesce(new.actual_gallon,0)-coalesce(old.actual_gallon,0),1,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'five_gallon_pail',coalesce(new.actual_five,0)-coalesce(old.actual_five,0),5,new.batch);
    perform app_private.inventory_add_line(v_event,new.product,'jerry_1_25',coalesce(new.actual_jerry,0)-coalesce(old.actual_jerry,0),1.25,new.batch);
  end if;

  if not exists(select 1 from public.inventory_event_lines l where l.inventory_event_id=v_event) then
    delete from public.inventory_events where id=v_event;
  end if;

  return new;
end;
$function$

