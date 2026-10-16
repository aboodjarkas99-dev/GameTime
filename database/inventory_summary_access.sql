alter policy inventory_lines_read_roles on inventory_event_lines using(app_private.current_app_role() in ('manager','chemist','shipping'));
alter policy inventory_events_read_roles on inventory_events using(app_private.current_app_role() in ('manager','chemist','shipping'));
create or replace function app_private.get_inventory_stock() returns setof public.inventory_current_stock language plpgsql security definer set search_path=public,app_private as $$
begin
 if auth.uid() is null or coalesce(app_private.current_app_role(),'') not in ('inventory','manager','chemist','shipping') then raise exception 'Inventory access required' using errcode='42501'; end if;
 return query select * from public.inventory_current_stock;
end $$;
revoke all on function app_private.get_inventory_stock() from public,anon;
grant execute on function app_private.get_inventory_stock() to authenticated;
create or replace function public.get_inventory_stock() returns setof public.inventory_current_stock language sql security invoker set search_path=public,app_private as $$select * from app_private.get_inventory_stock()$$;
revoke all on function public.get_inventory_stock() from public,anon;
grant execute on function public.get_inventory_stock() to authenticated;
