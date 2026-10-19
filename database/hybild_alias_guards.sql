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
