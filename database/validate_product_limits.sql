create or replace function app_private.validate_product_limits() returns trigger language plpgsql set search_path=public,app_private as $$
declare v jsonb;
begin
 if jsonb_typeof(new.stock_limits)<>'object' then raise exception 'Stock limits must be an object'; end if;
 for v in select value from jsonb_each(new.stock_limits) loop
  if jsonb_typeof(v->'minimum') is distinct from 'number' or jsonb_typeof(v->'safe') is distinct from 'number' then raise exception 'Both stock limits must be numbers'; end if;
  if (v->>'minimum')::numeric<0 or (v->>'safe')::numeric<=(v->>'minimum')::numeric then raise exception 'Safe stock must be greater than a nonnegative minimum'; end if;
 end loop;
 return new;
end $$;
revoke all on function app_private.validate_product_limits() from public,anon,authenticated;
create trigger validate_product_limits before insert or update of stock_limits on factory_products for each row execute function app_private.validate_product_limits();
