create table if not exists public.shipping_desk_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 session text not null, name text not null, role text not null,
 order_name text not null default '', customer text not null default '',
 since bigint not null default 0, seen_at timestamptz not null default now(),
 primary key(user_id,session)
);
alter table public.shipping_desk_sessions enable row level security;
revoke all on public.shipping_desk_sessions from anon,authenticated;
grant select,insert,update on public.shipping_desk_sessions to authenticated;
create policy desk_presence_read on public.shipping_desk_sessions for select to authenticated using((app_private.current_app_role() in ('manager','chemist','shipping')));
create policy desk_presence_insert on public.shipping_desk_sessions for insert to authenticated with check(auth.uid()=user_id and (app_private.current_app_role() in ('manager','chemist','shipping')));
create policy desk_presence_update on public.shipping_desk_sessions for update to authenticated using(auth.uid()=user_id and (app_private.current_app_role() in ('manager','chemist','shipping'))) with check(auth.uid()=user_id and (app_private.current_app_role() in ('manager','chemist','shipping')));
create or replace function app_private.shipping_desk_patch(p_id uuid,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path=public,app_private as $$
declare v public.shipping_shipments%rowtype;
begin
 if auth.uid() is null or not (app_private.current_app_role() in ('manager','chemist','shipping')) then raise exception 'Shipping access required' using errcode='42501'; end if;
 select * into v from shipping_shipments where id=p_id for update;
 if not found then raise exception 'Shipment not found'; end if;
 if v.status in ('SHIPPED','CANCELED') then return jsonb_build_object('ok',false,'locked',true); end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('worker','workerSession','claimedAt','checked','total','ready')) then raise exception 'Unsupported desk field'; end if;
 update shipping_shipments set pallet_plan=jsonb_set(coalesce(pallet_plan,'{}'::jsonb),'{floor}',coalesce(pallet_plan->'floor','{}'::jsonb)||p_patch),updated_by=auth.uid() where id=p_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function app_private.shipping_desk_patch(uuid,jsonb) from public,anon;
grant execute on function app_private.shipping_desk_patch(uuid,jsonb) to authenticated;
create or replace function public.shipping_desk_patch(p_id uuid,p_patch jsonb) returns jsonb language sql security invoker set search_path=public,app_private as $$select app_private.shipping_desk_patch(p_id,p_patch)$$;
revoke all on function public.shipping_desk_patch(uuid,jsonb) from public,anon;
grant execute on function public.shipping_desk_patch(uuid,jsonb) to authenticated;
