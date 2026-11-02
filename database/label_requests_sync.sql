CREATE OR REPLACE FUNCTION app_private.sync_label_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE pkg text; qty bigint; stock uuid; needed uuid[]:='{}'; product_name text:=app_private.canonical_factory_product(new.product);
BEGIN
 IF TG_OP='UPDATE' THEN
  IF EXISTS(SELECT 1 FROM label_requests WHERE work_order_id=new.id) AND row(old.product,old.quart,old.gallon,old.jerry_enabled,old.jerry,old.fill_packaging,old.batch,old.prod_work_date,old.hold_line,old.deleted_at,old.prod_status='done') IS NOT DISTINCT FROM row(new.product,new.quart,new.gallon,new.jerry_enabled,new.jerry,new.fill_packaging,new.batch,new.prod_work_date,new.hold_line,new.deleted_at,new.prod_status='done') THEN RETURN new; END IF;
 END IF;
 IF new.deleted_at IS NULL AND NOT new.hold_line AND new.prod_status<>'done' THEN
  FOR pkg,qty IN SELECT * FROM (VALUES
   ('quart_can',ceil(greatest(0,coalesce(substring(new.quart from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric))::bigint),
   (CASE WHEN new.fill_packaging->>'gallon_style'='f_style' THEN 'f_style' ELSE 'gallon' END,ceil(greatest(0,coalesce(substring(new.gallon from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric))::bigint),
   ('jerry_1_25',CASE WHEN new.jerry_enabled THEN ceil(greatest(0,coalesce(substring(new.jerry from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric))::bigint ELSE 0 END)
  ) items(package_type,quantity) LOOP
   IF qty<=0 THEN CONTINUE; END IF;
   INSERT INTO fill_line_label_stock(product,package_type) VALUES(product_name,pkg) ON CONFLICT(product_key,package_type) DO UPDATE SET product=EXCLUDED.product RETURNING id INTO stock;
   needed:=array_append(needed,stock);
   INSERT INTO label_requests AS r(work_order_id,stock_id,product,package_type,batch,due_date,requested_units)
   VALUES(new.id,stock,product_name,pkg,coalesce(new.batch,''),coalesce(new.prod_work_date,new.work_date),qty)
   ON CONFLICT(work_order_id,stock_id) DO UPDATE SET
    requested_units=EXCLUDED.requested_units,product=EXCLUDED.product,batch=EXCLUDED.batch,due_date=EXCLUDED.due_date,active=true,
    status=CASE WHEN r.requested_units<>EXCLUDED.requested_units THEN CASE WHEN r.printed_units>=EXCLUDED.requested_units THEN 'READY' ELSE 'PENDING' END ELSE r.status END,
    availability=CASE WHEN r.requested_units<>EXCLUDED.requested_units THEN CASE WHEN r.printed_units>=EXCLUDED.requested_units THEN 'HAVE' ELSE 'UNKNOWN' END ELSE r.availability END,
    version=r.version+CASE WHEN row(r.requested_units,r.batch,r.due_date,r.active) IS DISTINCT FROM row(EXCLUDED.requested_units,EXCLUDED.batch,EXCLUDED.due_date,true) THEN 1 ELSE 0 END,
    updated_at=CASE WHEN row(r.requested_units,r.batch,r.due_date,r.active) IS DISTINCT FROM row(EXCLUDED.requested_units,EXCLUDED.batch,EXCLUDED.due_date,true) THEN now() ELSE r.updated_at END;
  END LOOP;
 END IF;
 UPDATE label_requests SET active=false,version=version+1,updated_at=now() WHERE work_order_id=new.id AND active AND NOT(stock_id=ANY(needed));
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.sync_label_requests() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_orders_50_label_requests AFTER INSERT OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION app_private.sync_label_requests();
-- Seed only scheduled unfinished work; finished work and Hold Line do not create requests.
UPDATE public.work_orders SET fill_packaging=fill_packaging WHERE deleted_at IS NULL AND NOT hold_line AND prod_status<>'done';
