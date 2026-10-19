BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE result jsonb; name text; expected text; before_rows bigint; after_rows bigint;
BEGIN
 FOR name,expected IN SELECT * FROM (VALUES('OverTime','OverTime Finish'),('Xcel A','X-cel 2k High Solids Part A'),('Xcel B','X-cel Catalyst Part B'),('OverTime Catalyst','OverTime Catalyst'),('Hybild','Hybild Sealer')) names(alias,canonical) LOOP
  IF app_private.canonical_factory_product(name)<>expected THEN RAISE EXCEPTION 'Wrong alias for %',name; END IF;
  result:=public.set_inventory_stock_classified_service('alias_test_'||name,current_date,name,'quart_can',212,.25,'Rollback stock test',null,'sport');
  IF NOT EXISTS(SELECT 1 FROM inventory_current_stock WHERE product=expected AND package_type='quart_can' AND stock_units=212) THEN RAISE EXCEPTION 'Save missing for %',name; END IF;
  SELECT count(*) INTO before_rows FROM inventory_events;
  result:=public.set_inventory_stock_classified_service('alias_retry_'||name,current_date,name,'quart_can',212,.25,'Rollback retry test',null,'sport');
  SELECT count(*) INTO after_rows FROM inventory_events;
  IF NOT (result->>'no_change')::boolean OR before_rows<>after_rows THEN RAISE EXCEPTION 'Retry duplicated %',name; END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.set_inventory_stock_classified_service(text,date,text,text,numeric,numeric,text,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Client privileged RPC exposed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
