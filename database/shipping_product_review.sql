CREATE OR REPLACE FUNCTION app_private.base_factory_product(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH cleaned AS (SELECT btrim(regexp_replace(regexp_replace(p_name,'\yper[[:space:]-]+cases?\y',' ','gi'),'^[[:space:]/(),-]+|[[:space:]/(),-]+$','','g')) AS name), matched AS (SELECT name,regexp_match(name,'^(Omega|Alpha|Phoenix|Hydra)[[:space:]]+(?:1k[[:space:]]+)?(Matte|Satin|Gloss|Semi[[:space:]-]*(?:Gloss|Glass))$','i') AS family FROM cleaned)
 SELECT CASE WHEN family IS NOT NULL THEN initcap(family[1])||' '||CASE WHEN lower(family[2]) LIKE 'semi%' THEN CASE WHEN lower(family[1]) IN ('phoenix','hydra') THEN 'SemiGlass' ELSE 'Semi Gloss' END ELSE initcap(family[2]) END ELSE CASE lower(regexp_replace(name,'[[:space:]-]+','','g'))
 WHEN '1k' THEN 'AND1k' WHEN 'and1k' THEN 'AND1k'
 WHEN 'hybild' THEN 'Hybild Sealer' WHEN 'hybildsealer' THEN 'Hybild Sealer'
 WHEN 'overtime' THEN 'OverTime Finish' WHEN 'overtimefinish' THEN 'OverTime Finish'
 WHEN 'overtimecatalyst' THEN 'OverTime Catalyst'
 WHEN 'xcela' THEN 'X-cel 2k High Solids Part A' WHEN 'xcelparta' THEN 'X-cel 2k High Solids Part A' WHEN 'xcel2khighsolidsparta' THEN 'X-cel 2k High Solids Part A'
 WHEN 'xcelb' THEN 'X-cel Catalyst Part B' WHEN 'xcelpartb' THEN 'X-cel Catalyst Part B' WHEN 'xcelcatalystpartb' THEN 'X-cel Catalyst Part B'
 ELSE name END END FROM matched
$$;


REVOKE ALL ON FUNCTION app_private.base_factory_product(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.base_factory_product(text) TO authenticated,service_role;
CREATE TABLE public.inventory_product_aliases(alias_key text PRIMARY KEY,alias_name text NOT NULL,target_product_id uuid NOT NULL REFERENCES factory_products(id),created_by uuid REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.shipping_product_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),alias_key text NOT NULL UNIQUE,source_name text NOT NULL,latest_shipment_id uuid REFERENCES shipping_shipments(id),packing_slip text,customer text,package_size text,quantity numeric,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESOLVED')),target_product_id uuid REFERENCES factory_products(id),resolved_by uuid REFERENCES profiles(id),resolved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE inventory_product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_product_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inventory_product_aliases,shipping_product_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON inventory_product_aliases,shipping_product_reviews TO authenticated,service_role;
CREATE POLICY product_aliases_read ON inventory_product_aliases FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active));
CREATE POLICY shipping_reviews_read ON shipping_product_reviews FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist']));
CREATE OR REPLACE FUNCTION app_private.canonical_factory_product(p_name text) RETURNS text LANGUAGE sql STABLE SET search_path=public,app_private AS $$
 SELECT coalesce((SELECT p.name FROM inventory_product_aliases a JOIN factory_products p ON p.id=a.target_product_id AND p.active WHERE a.alias_key=lower(regexp_replace(btrim(app_private.base_factory_product(p_name)),'[[:space:]]+',' ','g'))),app_private.base_factory_product(p_name))
$$;
ALTER FUNCTION app_private.canonical_hybild_json(jsonb) STABLE;
CREATE OR REPLACE FUNCTION app_private.request_shipping_product_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE product_name text:=app_private.canonical_factory_product(new.inventory_product);k text:=lower(regexp_replace(btrim(app_private.base_factory_product(new.inventory_product)),'[[:space:]]+',' ','g'));s shipping_shipments%ROWTYPE;
BEGIN
 IF NOT new.inventory_managed OR new.size='drawdown' OR btrim(coalesce(product_name,''))='' THEN RETURN new; END IF;
 IF EXISTS(SELECT 1 FROM factory_products WHERE active AND name_key=lower(product_name)) THEN RETURN new;END IF;
 SELECT * INTO s FROM shipping_shipments WHERE id=new.shipment_id;
 IF s.status='CANCELED' THEN RETURN new;END IF;
 INSERT INTO shipping_product_reviews(alias_key,source_name,latest_shipment_id,packing_slip,customer,package_size,quantity) VALUES(k,product_name,s.id,coalesce(s.packing_slip,s.shipment_number),s.customer,new.size,new.qty)
 ON CONFLICT(alias_key) DO UPDATE SET latest_shipment_id=EXCLUDED.latest_shipment_id,packing_slip=EXCLUDED.packing_slip,customer=EXCLUDED.customer,package_size=EXCLUDED.package_size,quantity=EXCLUDED.quantity,status='PENDING',target_product_id=NULL,resolved_by=NULL,resolved_at=NULL,updated_at=now();
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.request_shipping_product_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER shipping_lines_90_product_review AFTER INSERT OR UPDATE OF inventory_product,inventory_managed ON shipping_lines FOR EACH ROW EXECUTE FUNCTION app_private.request_shipping_product_review();
CREATE OR REPLACE FUNCTION app_private.assert_shipping_products_approved(p_shipment uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE missing text;
BEGIN
 SELECT string_agg(DISTINCT inventory_product,', ') INTO missing FROM shipping_lines l WHERE shipment_id=p_shipment AND inventory_managed AND size<>'drawdown' AND NOT EXISTS(SELECT 1 FROM factory_products p WHERE p.active AND p.name_key=lower(app_private.canonical_factory_product(l.inventory_product)));
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Product review required: %. Management must link these names to an existing product or approve a new product in Inventory before shipment confirmation.',missing;END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.assert_shipping_products_approved(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.resolve_shipping_product(p_review uuid,p_target uuid DEFAULT NULL,p_new_name text DEFAULT NULL,p_category text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE r shipping_product_reviews%ROWTYPE;t factory_products%ROWTYPE;n text;ship_ids uuid[];who text;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist']) THEN RAISE EXCEPTION 'Management access required' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM shipping_product_reviews WHERE id=p_review FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Product review not found';END IF;
 IF r.status='RESOLVED' THEN RETURN jsonb_build_object('ok',true,'duplicate',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('product_alias:'||r.alias_key,0));
 IF p_target IS NOT NULL THEN
  SELECT * INTO t FROM factory_products WHERE id=p_target AND active FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active company product';END IF;
 ELSE
  IF p_category IS NULL OR p_category NOT IN ('sport','residential','cleaner') THEN RAISE EXCEPTION 'Choose Sport Floors, Residential or Cleaner';END IF;
  n:=app_private.base_factory_product(p_new_name);IF length(btrim(coalesce(n,''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter the new product name';END IF;
  IF EXISTS(SELECT 1 FROM factory_products WHERE name_key=lower(n)) THEN RAISE EXCEPTION 'This product already exists. Use Link to existing product.';END IF;
  INSERT INTO factory_products(name,category,active) VALUES(n,p_category,true) RETURNING * INTO t;
 END IF;
 IF EXISTS(SELECT 1 FROM factory_products WHERE active AND lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=r.alias_key AND id<>t.id) THEN RAISE EXCEPTION 'This name already belongs to a different company product';END IF;
 IF r.alias_key<>lower(regexp_replace(btrim(t.name),'[[:space:]]+',' ','g')) THEN
  INSERT INTO inventory_product_aliases(alias_key,alias_name,target_product_id,created_by) VALUES(r.alias_key,r.source_name,t.id,auth.uid());
 END IF;
 SELECT array_agg(DISTINCT l.shipment_id) INTO ship_ids FROM shipping_lines l JOIN shipping_shipments s ON s.id=l.shipment_id WHERE s.status IN ('DRAFT','READY') AND lower(regexp_replace(btrim(app_private.base_factory_product(l.inventory_product)),'[[:space:]]+',' ','g'))=r.alias_key;
 UPDATE shipping_lines l SET inventory_product=t.name FROM shipping_shipments s WHERE s.id=l.shipment_id AND s.status IN ('DRAFT','READY') AND lower(regexp_replace(btrim(app_private.base_factory_product(l.inventory_product)),'[[:space:]]+',' ','g'))=r.alias_key;
 UPDATE shipping_shipments SET pallet_plan=app_private.canonical_hybild_json(pallet_plan),updated_at=now() WHERE id=ANY(coalesce(ship_ids,'{}'));
 UPDATE shipping_product_reviews SET status='RESOLVED',target_product_id=t.id,resolved_by=auth.uid(),resolved_at=now(),updated_at=now() WHERE id=r.id;
 SELECT display_name INTO who FROM profiles WHERE id=auth.uid();INSERT INTO activity_logs(product,dept,event_type,extra,actor) VALUES(t.name,'manager','product_alias',r.source_name||' linked to '||t.name,who);
 RETURN jsonb_build_object('ok',true,'product',t.name);
END $$;
CREATE OR REPLACE FUNCTION public.resolve_shipping_product(p_review uuid,p_target uuid DEFAULT NULL,p_new_name text DEFAULT NULL,p_category text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.resolve_shipping_product(p_review,p_target,p_new_name,p_category) $$;
REVOKE ALL ON FUNCTION app_private.resolve_shipping_product(uuid,uuid,text,text),public.resolve_shipping_product(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.resolve_shipping_product(uuid,uuid,text,text),public.resolve_shipping_product(uuid,uuid,text,text) TO authenticated;
-- Review existing open shipments only. Closed shipment history remains intact.
INSERT INTO shipping_product_reviews(alias_key,source_name,latest_shipment_id,packing_slip,customer,package_size,quantity)
SELECT DISTINCT ON (lower(regexp_replace(btrim(app_private.base_factory_product(l.inventory_product)),'[[:space:]]+',' ','g'))) lower(regexp_replace(btrim(app_private.base_factory_product(l.inventory_product)),'[[:space:]]+',' ','g')),l.inventory_product,s.id,coalesce(s.packing_slip,s.shipment_number),s.customer,l.size,l.qty FROM shipping_lines l JOIN shipping_shipments s ON s.id=l.shipment_id WHERE s.status IN ('DRAFT','READY') AND l.inventory_managed AND l.size<>'drawdown' AND NOT EXISTS(SELECT 1 FROM factory_products p WHERE p.active AND p.name_key=lower(app_private.canonical_factory_product(l.inventory_product))) ON CONFLICT(alias_key) DO NOTHING;
