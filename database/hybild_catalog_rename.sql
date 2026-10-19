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
