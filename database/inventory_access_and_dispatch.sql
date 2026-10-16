alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check(role in ('manager','batch','prod','viewer','chemist','shipping','inventory'));
alter policy inventory_lines_read_roles on inventory_event_lines using(app_private.current_app_role() in ('manager','chemist','shipping','inventory'));
alter policy inventory_events_read_roles on inventory_events using(app_private.current_app_role() in ('manager','chemist','shipping','inventory'));
alter policy factory_products_read on factory_products using(app_private.current_app_role() in ('manager','chemist','shipping','prod','batch','inventory'));
alter policy work_orders_read_active on work_orders using(app_private.is_active_user() and app_private.current_app_role()<>'inventory');
alter policy activity_logs_read_active on activity_logs using(app_private.is_active_user() and app_private.current_app_role()<>'inventory');
create or replace function app_private.manager_complete_shipping(p_id uuid,p_date date,p_adjust_stock boolean,p_note text) returns jsonb
language plpgsql security definer set search_path=public,app_private as $$
declare s shipping_shipments%rowtype; result jsonb;
begin
 if auth.uid() is null or coalesce(app_private.current_app_role(),'') not in ('manager','chemist') then raise exception 'Management access required' using errcode='42501'; end if;
 if p_adjust_stock is null or p_date is null then raise exception 'Choose a date and stock handling'; end if;
 select * into s from shipping_shipments where id=p_id for update;
 if not found then raise exception 'Shipment not found'; end if;
 if s.status='CANCELED' then raise exception 'Canceled shipment cannot be completed'; end if;
 if s.status='SHIPPED' then return jsonb_build_object('ok',true,'duplicate',true,'status_only',coalesce((s.pallet_plan->'dispatch_record'->>'status_only')::boolean,false)); end if;
 if not exists(select 1 from shipping_lines where shipment_id=p_id) then raise exception 'Shipment has no saved lines. Review the order first.'; end if;
 if p_adjust_stock then
  if s.status='DRAFT' then update shipping_shipments set status='READY' where id=p_id; end if;
  result:=app_private.mark_shipping_shipped(p_id,p_date);
 else
  if s.inventory_event_id is not null or exists(select 1 from inventory_events where event_id='ship_'||p_id::text||'_shipped') then
   update shipping_shipments set status='SHIPPED',shipped_date=p_date,shipped_at=coalesce(shipped_at,now()),updated_by=auth.uid(),updated_at=now() where id=p_id;
   return jsonb_build_object('ok',true,'duplicate',true,'status_only',false);
  end if;
  update shipping_shipments set status='SHIPPED',shipped_date=p_date,shipped_at=coalesce(shipped_at,now()),updated_by=auth.uid(),updated_at=now() where id=p_id;
  result:=jsonb_build_object('ok',true,'duplicate',false,'status_only',true);
 end if;
 update shipping_shipments set pallet_plan=coalesce(pallet_plan,'{}')||jsonb_build_object('dispatch_record',jsonb_build_object('status_only',not p_adjust_stock,'recorded_by',auth.uid(),'recorded_at',now(),'ship_date',p_date,'note',p_note,'previous_status',s.status)) where id=p_id;
 return result;
end $$;
revoke all on function app_private.manager_complete_shipping(uuid,date,boolean,text) from public,anon;
grant execute on function app_private.manager_complete_shipping(uuid,date,boolean,text) to authenticated;
create or replace function public.manager_complete_shipping(p_id uuid,p_date date,p_adjust_stock boolean,p_note text) returns jsonb language sql security invoker set search_path=public,app_private as $$select app_private.manager_complete_shipping(p_id,p_date,p_adjust_stock,p_note)$$;
revoke all on function public.manager_complete_shipping(uuid,date,boolean,text) from public,anon;
grant execute on function public.manager_complete_shipping(uuid,date,boolean,text) to authenticated;

