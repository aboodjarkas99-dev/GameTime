CREATE OR REPLACE FUNCTION app_private.mark_shipping_shipped(p_shipment_id uuid, p_ship_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare
  v_ship public.shipping_shipments%rowtype;
  v_line public.shipping_lines%rowtype;
  v_event bigint;
  v_event_id text;
  v_package text;
  v_gpu numeric;
  v_line_count integer:=0;
begin
  if not app_private.shipping_role_ok() then
    raise exception 'Shipping access required' using errcode='42501';
  end if;

  select * into v_ship
  from public.shipping_shipments
  where id=p_shipment_id
  for update;

  if not found then raise exception 'Shipment not found'; end if;
  if v_ship.status='CANCELED' then raise exception 'Canceled shipment cannot be shipped'; end if;
  if v_ship.status='SHIPPED' then
    return jsonb_build_object('ok',true,'duplicate',true,'shipment_id',p_shipment_id,'event_id','ship_'||p_shipment_id::text||'_shipped');
  end if;
  if v_ship.status<>'READY' then
    raise exception 'Review the shipment and save it as READY before Mark Shipped';
  end if;

  if p_ship_date is null then p_ship_date:=current_date; end if;
  v_event_id:='ship_'||p_shipment_id::text||'_shipped';

  insert into public.inventory_events(
    event_id,event_type,event_date,source_system,source_ref,customer,packing_slip,notes,created_by,metadata
  ) values (
    v_event_id,'SHIPPED',p_ship_date,'gametime',
    coalesce(v_ship.shipment_number,p_shipment_id::text),
    v_ship.customer,coalesce(v_ship.packing_slip,v_ship.shipment_number),
    'GameTime Shipping — Mark shipped',auth.uid(),
    jsonb_build_object(
      'shipment_id',p_shipment_id,
      'shipment_number',v_ship.shipment_number,
      'pallets',coalesce((v_ship.totals->>'pallets')::numeric,0)
    )
  )
  on conflict(event_id) do nothing
  returning id into v_event;

  if v_event is null then
    select id into v_event from public.inventory_events where event_id=v_event_id;
  end if;

  if not exists(select 1 from public.inventory_event_lines where inventory_event_id=v_event) then
    for v_line in
      select * from public.shipping_lines
      where shipment_id=p_shipment_id
      order by line_order
    loop
      v_line_count:=v_line_count+1;
      -- Drawdowns are mail samples, not warehouse stock.
      if v_line.size='drawdown' then continue; end if;
      v_package:=case v_line.size
        when 'gal5' then 'five_gallon_pail'
        when 'gal1' then 'gallon'
        when 'quart' then 'quart_can'
        when 'pint' then 'pint_can'
        when 'gal125' then 'jerry_1_25'
        when 'gal15' then 'gallon_1_5'
        when 'vinyl' then 'vinyl_box'
        when 'drawdown' then 'drawdown_box'
        else 'unit'
      end;
      v_gpu:=case v_line.size
        when 'gal5' then 5
        when 'gal1' then 1
        when 'quart' then 0.25
        when 'pint' then 0.125
        when 'gal125' then 1.25
        when 'gal15' then 1.5
        else null
      end;

      insert into public.inventory_event_lines(
        inventory_event_id,product,product_key,package_type,qty_delta,gallons_per_unit,batch,metadata
      ) values (
        v_event,v_line.inventory_product,
        app_private.inventory_product_key(v_line.inventory_product),
        v_package,-v_line.qty,v_gpu,v_line.batch,
        jsonb_build_object(
          'shipping_line_id',v_line.id,
          'sku',v_line.sku,
          'description',v_line.description,
          'size',v_line.size
        )
      );
    end loop;
  else
    select count(*) into v_line_count from public.shipping_lines where shipment_id=p_shipment_id;
  end if;

  if v_line_count=0 then raise exception 'Shipment has no lines'; end if;

  update public.shipping_shipments
  set status='SHIPPED',shipped_date=p_ship_date,shipped_at=coalesce(shipped_at,now()),
      inventory_event_id=v_event,updated_at=now(),updated_by=auth.uid()
  where id=p_shipment_id;

  return jsonb_build_object('ok',true,'duplicate',false,'shipment_id',p_shipment_id,'event_id',v_event_id,'inventory_event_id',v_event);
end;
$function$

