
create or replace function app_private.complete_printed_shipping(p_id uuid,p_floor jsonb,p_done jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare v public.shipping_shipments%rowtype; k text;
begin
 if auth.uid() is null or not app_private.shipping_role_ok() then raise exception 'Shipping access required' using errcode='42501'; end if;
 select * into v from shipping_shipments where id=p_id for update;
 if not found or v.status<>'SHIPPED' then raise exception 'Printed shipment not found'; end if;
 foreach k in array array['lines','inventoryProducts','orderName','customer'] loop
  if (v.pallet_plan->'floor'->k) is distinct from (p_floor->k) then raise exception 'Inventory was already deducted. Reload the original order; quantities and inventory products cannot change.'; end if;
 end loop;
 update shipping_shipments set pallet_plan=jsonb_set(pallet_plan,'{floor}',(pallet_plan->'floor')||jsonb_build_object('done',p_done||jsonb_build_object('finishedBy',(select display_name from profiles where id=auth.uid()),'finishedAt',floor(extract(epoch from now())*1000)),'loaded',p_floor->'loaded','batchCodes',p_floor->'batchCodes','headerOk',p_floor->'headerOk','bol',p_floor->'bol','carrier',p_floor->'carrier')),updated_at=now(),updated_by=auth.uid() where id=p_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function app_private.complete_printed_shipping(uuid,jsonb,jsonb) from public,anon;
grant execute on function app_private.complete_printed_shipping(uuid,jsonb,jsonb) to authenticated;
create or replace function public.complete_printed_shipping(p_id uuid,p_floor jsonb,p_done jsonb)
returns jsonb language sql security invoker set search_path=public,app_private as $$select app_private.complete_printed_shipping(p_id,p_floor,p_done)$$;
revoke all on function public.complete_printed_shipping(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.complete_printed_shipping(uuid,jsonb,jsonb) to authenticated;

