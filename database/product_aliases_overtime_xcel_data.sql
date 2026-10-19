-- Canonical views combine existing ledger rows; preserve original ledger history.
UPDATE public.factory_products p SET name=app_private.canonical_factory_product(p.name)
WHERE lower(btrim(p.name)) IN ('overtime','xcel a','xcel b','xcel part a','xcel part b')
AND NOT EXISTS(SELECT 1 FROM public.factory_products target WHERE target.id<>p.id AND target.name_key=lower(app_private.canonical_factory_product(p.name)));
UPDATE public.work_orders SET product=app_private.canonical_factory_product(product) WHERE product IS DISTINCT FROM app_private.canonical_factory_product(product);
UPDATE public.work_order_daily_progress SET product=app_private.canonical_factory_product(product) WHERE product IS DISTINCT FROM app_private.canonical_factory_product(product);
UPDATE public.shipping_lines SET inventory_product=app_private.canonical_factory_product(inventory_product),description=app_private.canonical_factory_product(description) WHERE inventory_product IS DISTINCT FROM app_private.canonical_factory_product(inventory_product) OR description IS DISTINCT FROM app_private.canonical_factory_product(description);
UPDATE public.shipping_shipments SET pallet_plan=app_private.canonical_hybild_json(pallet_plan) WHERE pallet_plan IS DISTINCT FROM app_private.canonical_hybild_json(pallet_plan);
