UPDATE factory_products target SET stock_limits=source.stock_limits||target.stock_limits,category=CASE WHEN target.category='unclassified' THEN source.category ELSE target.category END,active=target.active OR source.active FROM factory_products source WHERE target.name_key='and1k' AND source.name_key='1k';
UPDATE factory_products SET active=false WHERE name_key='1k';
UPDATE work_orders SET product='AND1k' WHERE lower(btrim(product))='1k';
UPDATE work_order_daily_progress SET product='AND1k' WHERE lower(btrim(product))='1k';
UPDATE shipping_lines SET inventory_product='AND1k' WHERE lower(btrim(inventory_product))='1k';
UPDATE shipping_shipments SET pallet_plan=app_private.canonical_hybild_json(pallet_plan) WHERE pallet_plan IS DISTINCT FROM app_private.canonical_hybild_json(pallet_plan);
