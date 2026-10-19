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
