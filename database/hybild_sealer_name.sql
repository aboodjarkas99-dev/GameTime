-- Product alias rollout: original ledger labels remain unchanged for audit history.
-- Canonical product alias; leave tinted Hybild variants distinct.
CREATE OR REPLACE FUNCTION app_private.canonical_factory_product(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN lower(regexp_replace(btrim(p_name),'\s+',' ','g')) IN ('hybild','hybild sealer') THEN 'Hybild Sealer' ELSE p_name END
$$;
REVOKE ALL ON FUNCTION app_private.canonical_factory_product(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.canonical_factory_product(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION app_private.canonical_hybild_json(p_value jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,app_private AS $$
DECLARE result jsonb;
BEGIN
 CASE jsonb_typeof(p_value)
 WHEN 'string' THEN RETURN to_jsonb(app_private.canonical_factory_product(p_value#>>'{}'));
 WHEN 'array' THEN SELECT coalesce(jsonb_agg(app_private.canonical_hybild_json(value) ORDER BY ord),'[]'::jsonb) INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(value,ord); RETURN result;
 WHEN 'object' THEN SELECT coalesce(jsonb_object_agg(key,app_private.canonical_hybild_json(value)),'{}'::jsonb) INTO result FROM jsonb_each(p_value); RETURN result;
 ELSE RETURN p_value;
 END CASE;
END $$;
REVOKE ALL ON FUNCTION app_private.canonical_hybild_json(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.canonical_hybild_json(jsonb) TO authenticated,service_role;

create or replace view public.inventory_current_stock with(security_invoker=true) as
select lower(app_private.canonical_factory_product(l.product_key)) product_key,max(app_private.canonical_factory_product(l.product)) product,l.package_type,sum(l.qty_delta) stock_units,sum(l.gallons_delta) stock_gallons,max(e.created_at) last_movement_at,
coalesce(sum(l.qty_delta) filter(where e.event_type in ('PRODUCTION','PRODUCTION_CORRECTION')),0) produced_units,
-coalesce(sum(l.qty_delta) filter(where e.event_type in ('SHIPPED','SHIPPING_CORRECTION')),0) shipped_units,
coalesce(sum(l.qty_delta) filter(where e.event_type not in ('PRODUCTION','PRODUCTION_CORRECTION','SHIPPED','SHIPPING_CORRECTION')),0) adjustment_units
from inventory_event_lines l join inventory_events e on e.id=l.inventory_event_id
where coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
group by lower(app_private.canonical_factory_product(l.product_key)),l.package_type;
create or replace view public.inventory_shipping_monthly with(security_invoker=true) as
select date_trunc('month',e.event_date::timestamptz)::date as month,lower(app_private.canonical_factory_product(l.product_key)) product_key,max(app_private.canonical_factory_product(l.product)) product,l.package_type,-sum(l.qty_delta) shipped_units,-sum(l.gallons_delta) shipped_gallons,count(distinct e.event_id) shipment_events
from inventory_event_lines l join inventory_events e on e.id=l.inventory_event_id
where e.event_type in ('SHIPPED','SHIPPING_CORRECTION') and coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
group by date_trunc('month',e.event_date::timestamptz)::date,lower(app_private.canonical_factory_product(l.product_key)),l.package_type;

CREATE OR REPLACE FUNCTION app_private.normalize_hybild_product_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
BEGIN new.product:=app_private.canonical_factory_product(new.product); RETURN new; END $$;
CREATE OR REPLACE FUNCTION app_private.normalize_hybild_catalog_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
BEGIN new.name:=app_private.canonical_factory_product(new.name); RETURN new; END $$;
CREATE OR REPLACE FUNCTION app_private.normalize_hybild_ledger_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
BEGIN
 IF lower(regexp_replace(btrim(new.product),'\s+',' ','g')) IN ('hybild','hybild sealer') THEN new.product:='Hybild Sealer';new.product_key:='hybild sealer'; END IF;
 RETURN new;
END $$;
CREATE OR REPLACE FUNCTION app_private.normalize_hybild_shipping_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
BEGIN new.inventory_product:=app_private.canonical_factory_product(new.inventory_product);new.description:=app_private.canonical_factory_product(new.description);RETURN new; END $$;
CREATE OR REPLACE FUNCTION app_private.normalize_hybild_shipment_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
BEGIN new.pallet_plan:=app_private.canonical_hybild_json(new.pallet_plan); RETURN new; END $$;
REVOKE ALL ON FUNCTION app_private.normalize_hybild_product_row(),app_private.normalize_hybild_catalog_row(),app_private.normalize_hybild_ledger_row(),app_private.normalize_hybild_shipping_row(),app_private.normalize_hybild_shipment_row() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_orders_00_canonical_product BEFORE INSERT OR UPDATE OF product ON public.work_orders FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_product_row();
CREATE TRIGGER progress_00_canonical_product BEFORE INSERT OR UPDATE OF product ON public.work_order_daily_progress FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_product_row();
CREATE TRIGGER catalog_00_canonical_name BEFORE INSERT OR UPDATE OF name ON public.factory_products FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_catalog_row();
CREATE TRIGGER ledger_00_canonical_product BEFORE INSERT OR UPDATE OF product,product_key ON public.inventory_event_lines FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_ledger_row();
CREATE TRIGGER shipping_lines_00_canonical_product BEFORE INSERT OR UPDATE OF inventory_product,description ON public.shipping_lines FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_shipping_row();
CREATE TRIGGER shipping_00_canonical_snapshot BEFORE INSERT OR UPDATE OF pallet_plan ON public.shipping_shipments FOR EACH ROW EXECUTE FUNCTION app_private.normalize_hybild_shipment_row();

CREATE OR REPLACE FUNCTION public.set_inventory_stock_service(p_event_id text, p_event_date date, p_product text, p_package_type text, p_target_units numeric, p_gallons_per_unit numeric, p_note text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_key text;
  v_current numeric;
  v_delta numeric;
  v_event bigint;
  v_type text;
begin
  p_product:=app_private.canonical_factory_product(p_product);
  if p_target_units < 0 then raise exception 'Target stock cannot be negative'; end if;
  v_key := lower(regexp_replace(btrim(p_product),'\s+',' ','g'));

  perform pg_advisory_xact_lock(hashtextextended(v_key||'|'||p_package_type,0));

  select coalesce(sum(qty_delta),0)
  into v_current
  from public.inventory_event_lines
  where lower(app_private.canonical_factory_product(product_key))=v_key and package_type=p_package_type and coalesce(metadata->>'excluded_from_factory_inventory','false')<>'true';

  v_delta := p_target_units-v_current;
  if v_delta=0 then
    return jsonb_build_object('ok',true,'no_change',true,'current_units',v_current);
  end if;

  v_type := case when not exists(
    select 1 from public.inventory_event_lines
    where lower(app_private.canonical_factory_product(product_key))=v_key and package_type=p_package_type
  ) then 'OPENING' else 'ADJUSTMENT' end;

  insert into public.inventory_events(
    event_id,event_type,event_date,source_system,source_ref,notes,created_by,metadata
  ) values (
    p_event_id,v_type,p_event_date,'gametime','manual-stock-set',p_note,p_actor,
    jsonb_build_object('target_units',p_target_units,'previous_units',v_current)
  )
  returning id into v_event;

  insert into public.inventory_event_lines(
    inventory_event_id,product,product_key,package_type,qty_delta,gallons_per_unit
  ) values (
    v_event,btrim(p_product),v_key,p_package_type,v_delta,p_gallons_per_unit
  );

  return jsonb_build_object(
    'ok',true,'event_id',p_event_id,'event_type',v_type,
    'previous_units',v_current,'target_units',p_target_units,'delta',v_delta
  );
end;
$function$;

-- Original ledger rows remain intact; the canonical views combine aliases.
CREATE TEMP TABLE hybild_before ON COMMIT DROP AS SELECT package_type,sum(qty_delta) units,sum(gallons_delta) gallons FROM inventory_event_lines WHERE product_key IN ('hybild','hybild sealer') GROUP BY package_type;
UPDATE public.work_orders SET product='Hybild Sealer' WHERE lower(btrim(product))='hybild';
UPDATE public.work_order_daily_progress SET product='Hybild Sealer' WHERE lower(btrim(product))='hybild';
UPDATE public.shipping_lines SET inventory_product='Hybild Sealer' WHERE lower(btrim(inventory_product))='hybild';
UPDATE public.shipping_lines SET description='Hybild Sealer' WHERE lower(btrim(description))='hybild';
UPDATE public.shipping_shipments SET pallet_plan=app_private.canonical_hybild_json(pallet_plan),totals=app_private.canonical_hybild_json(totals) WHERE pallet_plan IS DISTINCT FROM app_private.canonical_hybild_json(pallet_plan) OR totals IS DISTINCT FROM app_private.canonical_hybild_json(totals);
UPDATE public.factory_products target SET stock_limits=source.stock_limits||target.stock_limits,category=CASE WHEN target.category='unclassified' THEN source.category ELSE target.category END,active=target.active OR source.active FROM public.factory_products source WHERE target.name_key='hybild sealer' AND source.name_key='hybild';
UPDATE public.factory_products SET active=false WHERE name_key='hybild';
DO $$ BEGIN
 IF EXISTS((SELECT * FROM hybild_before EXCEPT SELECT package_type,sum(qty_delta),sum(gallons_delta) FROM inventory_event_lines WHERE product_key IN ('hybild','hybild sealer') GROUP BY package_type) UNION ALL (SELECT package_type,sum(qty_delta),sum(gallons_delta) FROM inventory_event_lines WHERE product_key IN ('hybild','hybild sealer') GROUP BY package_type EXCEPT SELECT * FROM hybild_before)) THEN RAISE EXCEPTION 'Rename changed Hybild quantities'; END IF;
END $$;

