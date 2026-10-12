alter policy desk_presence_read on public.shipping_desk_sessions using (app_private.current_app_role() in ('manager','chemist','shipping'));
alter policy desk_presence_insert on public.shipping_desk_sessions with check (auth.uid()=user_id and app_private.current_app_role() in ('manager','chemist','shipping'));
alter policy desk_presence_update on public.shipping_desk_sessions using (auth.uid()=user_id and app_private.current_app_role() in ('manager','chemist','shipping')) with check (auth.uid()=user_id and app_private.current_app_role() in ('manager','chemist','shipping'));
