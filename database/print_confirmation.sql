create unique index if not exists shipping_packing_slip_unique on public.shipping_shipments
(lower(btrim(coalesce(nullif(btrim(packing_slip),''),shipment_number))))
where status<>'CANCELED' and btrim(coalesce(nullif(btrim(packing_slip),''),shipment_number,''))<>'';

create or replace function app_private.confirm_shipping_print(p_shipment_id uuid,p_expected_floor jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare v public.shipping_shipments%rowtype; result jsonb; k text;
begin
 if auth.uid() is null or not app_private.shipping_role_ok() then raise exception 'Shipping access required' using errcode='42501'; end if;
 select * into v from shipping_shipments where id=p_shipment_id for update;
 if not found then raise exception 'Shipment not found'; end if;
 if btrim(coalesce(nullif(btrim(v.packing_slip),''),v.shipment_number,''))='' then raise exception 'Packing Slip number is required before inventory deduction'; end if;
   foreach k in array array['lines','inventoryProducts','batchCodes','orderName','customer'] loop
     if (v.pallet_plan->'floor'->k) is distinct from (p_expected_floor->k) then
       raise exception 'Order changed on another device. Cancel confirmation, reload the order, and print the updated breakdown. Inventory was not deducted.';
     end if;
   end loop;
 result:=app_private.mark_shipping_shipped(p_shipment_id,(now() at time zone 'America/Chicago')::date);
 update inventory_events set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('print_confirmed_at',coalesce(metadata->'print_confirmed_at',to_jsonb(now())),'last_print_confirmed_at',now(),'print_confirmed_by',auth.uid())
 where id=(select inventory_event_id from shipping_shipments where id=p_shipment_id);
 return result;
end $$;
revoke all on function app_private.confirm_shipping_print(uuid,jsonb) from public,anon;
grant execute on function app_private.confirm_shipping_print(uuid,jsonb) to authenticated;
create or replace function public.confirm_shipping_print(p_shipment_id uuid,p_expected_floor jsonb)
returns jsonb language sql security invoker set search_path=public,app_private as $$select app_private.confirm_shipping_print(p_shipment_id,p_expected_floor)$$;
revoke all on function public.confirm_shipping_print(uuid,jsonb) from public,anon;
grant execute on function public.confirm_shipping_print(uuid,jsonb) to authenticated;

