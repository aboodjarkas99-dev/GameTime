CREATE OR REPLACE FUNCTION public.set_inventory_stock_service(p_event_id text, p_event_date date, p_product text, p_package_type text, p_target_units numeric, p_gallons_per_unit numeric, p_note text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_key text;
  v_current numeric;
  v_delta numeric;
  v_event bigint;
  v_type text;
begin
  if p_target_units < 0 then raise exception 'Target stock cannot be negative'; end if;
  v_key := lower(regexp_replace(btrim(p_product),'\s+',' ','g'));

  perform pg_advisory_xact_lock(hashtextextended(v_key||'|'||p_package_type,0));

  select coalesce(sum(qty_delta),0)
  into v_current
  from public.inventory_event_lines
  where product_key=v_key and package_type=p_package_type and coalesce(metadata->>'excluded_from_factory_inventory','false')<>'true';

  v_delta := p_target_units-v_current;
  if v_delta=0 then
    return jsonb_build_object('ok',true,'no_change',true,'current_units',v_current);
  end if;

  v_type := case when not exists(
    select 1 from public.inventory_event_lines
    where product_key=v_key and package_type=p_package_type
  ) then 'OPENING' else 'ADJUSTMENT' end;

  insert into public.inventory_events(
    event_id,event_type,event_date,source_system,source_ref,notes,created_by,metadata
  ) values (
    p_event_id,v_type,p_event_date,'gametime','manual-stock-set',p_note,p_actor,
    jsonb_build_object('target_units',p_target_units,'previous_units',v_current)
  )
  returning id into v_event;

  insert into public.inventory_event_lines(
    inventory_event_id,product,product_key,package_type,qty_delta,gallons_per_unit
  ) values (
    v_event,btrim(p_product),v_key,p_package_type,v_delta,p_gallons_per_unit
  );

  return jsonb_build_object(
    'ok',true,'event_id',p_event_id,'event_type',v_type,
    'previous_units',v_current,'target_units',p_target_units,'delta',v_delta
  );
end;
$function$

