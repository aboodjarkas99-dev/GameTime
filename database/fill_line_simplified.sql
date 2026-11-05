ALTER TABLE factory_products ADD COLUMN five_pail_type text CHECK(five_pail_type IN ('five_water','five_oil'));
INSERT INTO fill_line_supplies(id,name,category,description) VALUES('five_unclassified','5 Gallon Pail — Type not set','containers','Usage for products without a saved pail type. Review these movements after classifying the product.');
ALTER TABLE fill_line_supplies DROP CONSTRAINT fill_line_supplies_stock_units_check;
ALTER TABLE fill_line_label_stock DROP CONSTRAINT fill_line_label_stock_stock_units_check;
ALTER TABLE fill_line_supply_movements DROP CONSTRAINT fill_line_supply_movements_result_units_check;
ALTER TABLE fill_line_label_movements DROP CONSTRAINT fill_line_label_movements_result_units_check;
CREATE FUNCTION public.set_product_pail_type(p_id uuid,p_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager']) THEN RAISE EXCEPTION 'Manager access required' USING ERRCODE='42501'; END IF;
 UPDATE factory_products SET five_pail_type=p_type WHERE id=p_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_product_pail_type(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_product_pail_type(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION app_private.fill_material_spec(item public.work_orders) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE q numeric:=coalesce(item.actual_quart,0); g numeric:=coalesce(item.actual_gallon,0); f numeric:=coalesce(item.actual_five,0); j numeric:=CASE WHEN item.jerry_enabled THEN coalesce(item.actual_jerry,0) ELSE 0 END;
 fixed jsonb:='{}'; boxes jsonb:='{}'; labels jsonb:='{}'; details jsonb:='[]'; pkg text; qty bigint; s public.fill_line_label_stock%ROWTYPE;
 product_name text:=app_private.canonical_factory_product(item.product); fs boolean:=item.fill_packaging->>'gallon_style'='f_style';
BEGIN
 IF least(q,g,f,j)<0 OR q<>trunc(q) OR g<>trunc(g) OR f<>trunc(f) OR j<>trunc(j) THEN RAISE EXCEPTION 'Actual container quantities must be whole numbers'; END IF;
 IF q>0 THEN fixed:=fixed||jsonb_build_object('quart_can',q); boxes:=boxes||jsonb_build_object('quart_box',ceil(q/4)); END IF;
 IF g>0 THEN
  IF coalesce(fs,false) THEN
   fixed:=fixed||jsonb_build_object('f_style',g,CASE WHEN item.fill_packaging->>'f_style_lid'='seal' THEN 'f_lid_seal' ELSE 'f_lid_sponge' END,g);
   boxes:=boxes||jsonb_build_object('full_court_box',NULL);
  ELSE
   fixed:=fixed||jsonb_build_object('gallon_can',g);
   IF product_name='X-cel Catalyst Part B' THEN boxes:=boxes||jsonb_build_object('full_court_box',NULL);
   ELSIF product_name ~* '^(Phoenix|Omega) (Matte|Satin|Semi.?Gloss)$' THEN boxes:=boxes||jsonb_build_object('four_gallon_box',ceil(g/4));
   ELSE boxes:=boxes||jsonb_build_object('single_gallon_box',g); END IF;
  END IF;
 END IF;
 IF j>0 THEN fixed:=fixed||jsonb_build_object('jerry_can',j); boxes:=boxes||jsonb_build_object('phoenix_box',ceil(j/2)); END IF;
 FOR pkg,qty IN SELECT * FROM (VALUES('quart_can',q::bigint),(CASE WHEN coalesce(fs,false) THEN 'f_style' ELSE 'gallon' END,g::bigint),('jerry_1_25',j::bigint)) v(p,n) WHERE n>0 LOOP
  SELECT * INTO s FROM public.fill_line_label_stock WHERE product_key=lower(btrim(product_name)) AND package_type=pkg;
  IF NOT FOUND THEN INSERT INTO fill_line_label_stock(product,package_type) VALUES(product_name,pkg) ON CONFLICT(product_key,package_type) DO UPDATE SET product=EXCLUDED.product RETURNING * INTO s; END IF;
  labels:=labels||jsonb_build_object(s.id::text,qty);
  details:=details||jsonb_build_array(jsonb_build_object('id',s.id,'product',s.product,'package_type',pkg,'quantity',qty,'stock_units',s.stock_units));
 END LOOP;
 RETURN jsonb_build_object('fixed',fixed,'boxes',boxes,'labels',labels,'label_details',details,'five',f);
END $$;
REVOKE ALL ON FUNCTION app_private.fill_material_spec(public.work_orders) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.capture_fill_materials() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE receipt public.fill_line_consumption%ROWTYPE; spec jsonb; usage jsonb; supplies jsonb; labels jsonb; k text; v jsonb; n bigint;
 s public.fill_line_supplies%ROWTYPE; l public.fill_line_label_stock%ROWTYPE; sign integer; who uuid; who_name text; note_text text;
BEGIN
 SELECT * INTO receipt FROM fill_line_consumption WHERE work_order_id=new.id FOR UPDATE;
 IF old.prod_status='done' AND new.prod_status='done' AND receipt.active AND
  row(old.product,old.actual_quart,old.actual_gallon,old.actual_five,old.actual_jerry,old.jerry_enabled,old.fill_packaging,old.deleted_at)
  IS DISTINCT FROM row(new.product,new.actual_quart,new.actual_gallon,new.actual_five,new.actual_jerry,new.jerry_enabled,new.fill_packaging,new.deleted_at) THEN
  RAISE EXCEPTION 'Undo Work Done before changing quantities, product, packaging or deleting this order';
 END IF;
 IF old.prod_status IS NOT DISTINCT FROM new.prod_status OR (old.prod_status<>'done' AND new.prod_status<>'done') THEN RETURN new; END IF;
 IF new.prod_status='done' THEN
  IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','prod']) THEN RAISE EXCEPTION 'Fill Line access required' USING ERRCODE='42501'; END IF;
  IF new.deleted_at IS NOT NULL OR new.hold_line OR new.held THEN RAISE EXCEPTION 'Release this order before Work Done'; END IF;
  IF new.batch_status<>'done' OR NOT new.prod_checked THEN RAISE EXCEPTION 'Finish Batch Maker and Fill Line PRE-CHECK first'; END IF;
  IF (coalesce(substring(new.quart from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND new.actual_quart IS NULL)
   OR (coalesce(substring(new.gallon from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND new.actual_gallon IS NULL)
   OR (coalesce(substring(new.five from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND new.actual_five IS NULL)
   OR (new.jerry_enabled AND coalesce(substring(new.jerry from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND new.actual_jerry IS NULL) THEN RAISE EXCEPTION 'Enter actual filled quantities first'; END IF;
  IF new.fill_consumption_plan IS NULL OR new.fill_consumption_plan->>'confirmation' IS NOT DISTINCT FROM old.fill_consumption_plan->>'confirmation'
   OR new.fill_consumption_plan->>'for_version' IS DISTINCT FROM old.version::text THEN RAISE EXCEPTION 'Review Fill Line materials before Work Done. Refresh this page.'; END IF;
  spec:=app_private.fill_material_spec(new); usage:=new.fill_consumption_plan->'usage';
  supplies:=spec->'fixed'; labels:=spec->'labels';
  FOR k,v IN SELECT key,value FROM jsonb_each(spec->'boxes') LOOP
   IF v='null'::jsonb THEN
    v:=usage->'boxes'->k;
    IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR v::text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Enter actual Full Court boxes used'; END IF;
   END IF;
   supplies:=supplies||jsonb_build_object(k,v::text::bigint);
  END LOOP;
  supplies:=supplies||jsonb_build_object('pallet',ceil(coalesce(new.actual_quart,0)/720.0)+ceil(coalesce(new.actual_gallon,0)/120.0)+ceil(coalesce(new.actual_five,0)/36.0)+CASE WHEN new.jerry_enabled AND coalesce(new.actual_jerry,0)>0 THEN greatest(0,coalesce((usage->>'jerry_pallets')::integer,0)) ELSE 0 END);
  IF (spec->>'five')::bigint>0 THEN
   SELECT five_pail_type INTO k FROM factory_products WHERE name_key=lower(app_private.canonical_factory_product(new.product));
   supplies:=supplies||jsonb_build_object(coalesce(k,'five_unclassified'),(spec->>'five')::bigint);
  END IF;
  sign:=-1; who:=auth.uid();
 ELSE
  -- Old completions have no receipt and must not add invented packaging stock.
  IF NOT coalesce(receipt.active,false) THEN RETURN new; END IF;
  supplies:=receipt.supplies; labels:=receipt.labels; sign:=1; who:=coalesce(auth.uid(),receipt.actor_id);
 END IF;
 who_name:=coalesce((SELECT display_name FROM profiles WHERE id=who),'Staff');
 note_text:=CASE WHEN sign=-1 THEN 'Work Done' ELSE 'Undo Work Done' END||' · '||new.product||' · Batch '||coalesce(new.batch,'')||' · Work #'||new.id;
 FOR k,v IN SELECT key,value FROM jsonb_each(supplies) ORDER BY key LOOP
  n:=v::text::bigint; IF n=0 THEN CONTINUE; END IF;
  SELECT * INTO s FROM fill_line_supplies WHERE id=k FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown supply %',k; END IF;
  UPDATE fill_line_supplies SET stock_units=coalesce(stock_units,0)+sign*n,updated_at=now() WHERE id=k;
  INSERT INTO fill_line_supply_movements(id,supply_id,kind,quantity,delta,previous_units,result_units,note,actor_id,actor_name)
   VALUES(gen_random_uuid(),k,CASE WHEN sign=-1 THEN 'use' ELSE 'undo' END,n,sign*n,s.stock_units,coalesce(s.stock_units,0)+sign*n,note_text,who,who_name);
 END LOOP;
 FOR k,v IN SELECT key,value FROM jsonb_each(labels) ORDER BY key LOOP
  n:=v::text::bigint;
  SELECT * INTO l FROM fill_line_label_stock WHERE id=k::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Label stock missing'; END IF;
  UPDATE fill_line_label_stock SET stock_units=coalesce(stock_units,0)+sign*n,updated_at=now() WHERE id=l.id;
  INSERT INTO fill_line_label_movements(id,stock_id,kind,quantity,delta,previous_units,result_units,note,actor_id,actor_name)
   VALUES(gen_random_uuid(),l.id,CASE WHEN sign=-1 THEN 'use' ELSE 'undo' END,n,sign*n,l.stock_units,l.stock_units+sign*n,note_text,who,who_name);
 END LOOP;
 INSERT INTO fill_line_consumption(work_order_id,active,supplies,labels,actor_id)
 VALUES(new.id,sign=-1,supplies,labels,who)
 ON CONFLICT(work_order_id) DO UPDATE SET active=EXCLUDED.active,supplies=EXCLUDED.supplies,labels=EXCLUDED.labels,actor_id=EXCLUDED.actor_id,updated_at=now();
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.capture_fill_materials() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.preview_fill_line_consumption(p_order_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE item public.work_orders%ROWTYPE; spec jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','prod']) THEN RAISE EXCEPTION 'Fill Line access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM work_orders WHERE id=p_order_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;
 spec:=app_private.fill_material_spec(item);
 RETURN spec||jsonb_build_object('pail_type',(SELECT five_pail_type FROM factory_products WHERE name_key=lower(app_private.canonical_factory_product(item.product))),'order',to_jsonb(item),'stock',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM fill_line_supplies s));
END $$;
REVOKE ALL ON FUNCTION public.preview_fill_line_consumption(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_fill_line_consumption(bigint) TO authenticated;

