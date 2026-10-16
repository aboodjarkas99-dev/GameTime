CREATE OR REPLACE FUNCTION app_private.shipping_desk_patch(p_id uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare v public.shipping_shipments%rowtype;
begin
 if auth.uid() is null or not app_private.shipping_role_ok() then raise exception 'Shipping access required' using errcode='42501'; end if;
 select * into v from shipping_shipments where id=p_id for update;
 if not found then raise exception 'Shipment not found'; end if;
 if v.status in ('SHIPPED','CANCELED') then return jsonb_build_object('ok',false,'locked',true); end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('worker','workerSession','claimedAt','checked','total','ready')) then raise exception 'Unsupported desk field'; end if;
 update shipping_shipments set pallet_plan=jsonb_set(coalesce(pallet_plan,'{}'::jsonb),'{floor}',coalesce(pallet_plan->'floor','{}'::jsonb)||p_patch),updated_by=auth.uid() where id=p_id;
 return jsonb_build_object('ok',true);
end $function$

