alter table profiles add column page_roles text[] not null default '{}';
alter table profiles add constraint profiles_page_roles_check check(page_roles <@ array['batch','prod','viewer','chemist','shipping','inventory']::text[]);
create or replace function app_private.has_any_app_role(p_roles text[]) returns boolean language sql stable security definer set search_path=public,app_private as $$
select coalesce((select (array[p.role]||p.page_roles)&&p_roles from profiles p where p.id=auth.uid() and p.active),false)$$;
revoke all on function app_private.has_any_app_role(text[]) from public,anon;
grant execute on function app_private.has_any_app_role(text[]) to authenticated;
create or replace function app_private.current_app_role() returns text language sql stable security definer set search_path=public,app_private as $$
select case when p.role='manager' then 'manager' when p.role='chemist' or 'chemist'=any(p.page_roles) then 'chemist' else p.role end from profiles p where p.id=auth.uid() and p.active$$;
create or replace function app_private.shipping_role_ok() returns boolean language sql stable security definer set search_path=public,app_private as $$select app_private.has_any_app_role(array['manager','chemist','shipping'])$$;
alter policy shipping_shipments_read on shipping_shipments using(app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy shipping_lines_read on shipping_lines using(app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy desk_presence_read on shipping_desk_sessions using(app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy desk_presence_insert on shipping_desk_sessions with check(auth.uid()=user_id and app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy desk_presence_update on shipping_desk_sessions using(auth.uid()=user_id and app_private.has_any_app_role(array['manager','chemist','shipping'])) with check(auth.uid()=user_id and app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy inventory_lines_read_roles on inventory_event_lines using(app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy inventory_events_read_roles on inventory_events using(app_private.has_any_app_role(array['manager','chemist','shipping']));
alter policy work_orders_read_active on work_orders using(app_private.has_any_app_role(array['manager','chemist','prod','batch','viewer']));
alter policy activity_logs_read_active on activity_logs using(app_private.has_any_app_role(array['manager','chemist','prod','batch','viewer']));
alter policy work_orders_update_staff on work_orders using(app_private.has_any_app_role(array['manager','chemist','prod','batch'])) with check(app_private.has_any_app_role(array['manager','chemist','prod','batch']));
create or replace function public.enforce_work_order_permissions() returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare allowed text[]:=array['held','updated_by','updated_from','updated_at','version'];
begin
 if auth.uid() is null then return new; end if;
 if app_private.has_any_app_role(array['manager','chemist']) then return new; end if;
 if not app_private.has_any_app_role(array['prod','batch']) then raise exception 'Work access required' using errcode='42501'; end if;
 if app_private.has_any_app_role(array['batch']) then allowed:=allowed||array['batch_checked','batch_status','batch_made_date']; end if;
 if app_private.has_any_app_role(array['prod']) then allowed:=allowed||array['prod_checked','prod_status','actual','actual_quart','actual_gallon','actual_five','actual_jerry']; end if;
 if (to_jsonb(old)-allowed) is distinct from (to_jsonb(new)-allowed) then raise exception 'Employee cannot modify planning or unassigned department fields' using errcode='42501'; end if;
 return new;
end $$;
create or replace function app_private.get_inventory_stock() returns setof inventory_current_stock language plpgsql security definer set search_path=public,app_private as $$
begin
 if not app_private.has_any_app_role(array['inventory','manager','chemist','shipping']) then raise exception 'Inventory access required' using errcode='42501'; end if;
 return query select * from inventory_current_stock;
end $$;
