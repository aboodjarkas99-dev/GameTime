-- Names only: all recorded container quantities and immutable ledger rows stay intact.
UPDATE factory_products p SET name=app_private.canonical_factory_product(p.name)
WHERE p.name IS DISTINCT FROM app_private.canonical_factory_product(p.name)
AND NOT EXISTS(SELECT 1 FROM factory_products t WHERE t.id<>p.id AND t.name_key=lower(app_private.canonical_factory_product(p.name)));
UPDATE factory_products SET active=false WHERE name IS DISTINCT FROM app_private.canonical_factory_product(name);
UPDATE work_orders SET product=app_private.canonical_factory_product(product) WHERE product IS DISTINCT FROM app_private.canonical_factory_product(product);
UPDATE work_order_daily_progress SET product=app_private.canonical_factory_product(product) WHERE product IS DISTINCT FROM app_private.canonical_factory_product(product);
UPDATE shipping_lines SET inventory_product=app_private.canonical_factory_product(inventory_product),description=app_private.canonical_factory_product(description) WHERE inventory_product IS DISTINCT FROM app_private.canonical_factory_product(inventory_product) OR description IS DISTINCT FROM app_private.canonical_factory_product(description);
