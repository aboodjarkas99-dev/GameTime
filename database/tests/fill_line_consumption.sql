BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE role='manager' AND active LIMIT 1),true);
UPDATE fill_line_supplies SET stock_units=1000;
INSERT INTO work_orders(id,product,batch,work_date,quart,gallon,five,jerry,jerry_enabled,batch_status,prod_checked,actual_quart,actual_gallon,actual_five,actual_jerry)
VALUES(-990041,'Omega Satin','MATERIAL TEST',current_date,'8','12','36','2',true,'done',true,8,12,36,2);
UPDATE fill_line_label_stock SET stock_units=1000 WHERE product='Omega Satin';
DO $$ DECLARE v integer; r jsonb; usage jsonb:='{"boxes":{"quart_box":2,"four_gallon_box":3,"phoenix_box":1},"pallets":2,"pail_type":"five_water"}'; before_events bigint; BEGIN
 SELECT version INTO v FROM work_orders WHERE id=-990041;
 r:=public.preview_fill_line_consumption(-990041);
 IF r->'fixed'->>'gallon_can'<>'12' OR r->'boxes'->>'four_gallon_box'<>'3' THEN RAISE EXCEPTION 'Incorrect preview'; END IF;
 -- A label shortage must roll back container consumption, status, and finished goods.
 UPDATE fill_line_label_stock SET stock_units=0 WHERE product='Omega Satin' AND package_type='quart_can';
 SELECT count(*) INTO before_events FROM inventory_events WHERE source_ref='-990041';
 BEGIN
  PERFORM public.complete_fill_line(-990041,v,usage);
  RAISE EXCEPTION 'Shortage was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Not enough labels%' THEN RAISE; END IF; END;
 IF (SELECT stock_units FROM fill_line_supplies WHERE id='gallon_can')<>1000 OR (SELECT prod_status FROM work_orders WHERE id=-990041)='done' OR (SELECT count(*) FROM inventory_events WHERE source_ref='-990041')<>before_events THEN RAISE EXCEPTION 'Shortage was not atomic'; END IF;
 UPDATE fill_line_label_stock SET stock_units=1000 WHERE product='Omega Satin';
 r:=public.complete_fill_line(-990041,v,usage);
 IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'Completion failed'; END IF;
 IF (SELECT stock_units FROM fill_line_supplies WHERE id='gallon_can')<>988 OR (SELECT stock_units FROM fill_line_supplies WHERE id='quart_can')<>992 OR (SELECT stock_units FROM fill_line_supplies WHERE id='five_water')<>964 OR (SELECT stock_units FROM fill_line_supplies WHERE id='pallet')<>998 OR (SELECT stock_units FROM fill_line_supplies WHERE id='phoenix_box')<>999 OR (SELECT stock_units FROM fill_line_label_stock WHERE product='Omega Satin' AND package_type='gallon')<>988 THEN RAISE EXCEPTION 'Consumption incorrect'; END IF;
 r:=public.complete_fill_line(-990041,v,usage);
 IF NOT (r->>'conflict')::boolean OR (SELECT stock_units FROM fill_line_supplies WHERE id='gallon_can')<>988 THEN RAISE EXCEPTION 'Duplicate completion deducted twice'; END IF;
 BEGIN UPDATE work_orders SET actual_gallon=99 WHERE id=-990041; RAISE EXCEPTION 'Completed quantities changed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Undo Work Done%' THEN RAISE; END IF; END;
 PERFORM public.toggle_work_done(-990041,'prod','done');
 PERFORM public.toggle_work_done(-990041,'prod','done'); -- stale retry must not complete again
 IF (SELECT stock_units FROM fill_line_supplies WHERE id='gallon_can')<>1000 OR (SELECT stock_units FROM fill_line_label_stock WHERE product='Omega Satin' AND package_type='gallon')<>1000 OR (SELECT active FROM fill_line_consumption WHERE work_order_id=-990041) THEN RAISE EXCEPTION 'Undo did not restore exactly once'; END IF;
 BEGIN PERFORM public.toggle_work_done(-990041,'prod','progress'); RAISE EXCEPTION 'Old plan reused'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Review Fill Line materials%' THEN RAISE; END IF; END;
 SELECT version INTO v FROM work_orders WHERE id=-990041;
 r:=public.complete_fill_line(-990041,v,usage);
 IF (SELECT stock_units FROM fill_line_supplies WHERE id='gallon_can')<>988 THEN RAISE EXCEPTION 'Redo mismatch'; END IF;
 PERFORM public.toggle_work_done(-990041,'prod','done');
 -- Explicit physical pallet/box count, whole units, counted stock, and permissions.
 SELECT version INTO v FROM work_orders WHERE id=-990041;
 BEGIN PERFORM public.complete_fill_line(-990041,v,usage-'pallets'); RAISE EXCEPTION 'Missing pallets accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Enter actual new pallets%' THEN RAISE; END IF; END;
 UPDATE fill_line_supplies SET stock_units=NULL WHERE id='gallon_can';
 BEGIN PERFORM public.complete_fill_line(-990041,v,usage); RAISE EXCEPTION 'Uncounted stock accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Set the opening physical count%' THEN RAISE; END IF; END;
 UPDATE fill_line_supplies SET stock_units=1000 WHERE id='gallon_can';
 UPDATE profiles SET role='labels',page_roles=ARRAY['labels'] WHERE id=auth.uid();
 BEGIN PERFORM public.complete_fill_line(-990041,v,usage); RAISE EXCEPTION 'Labels staff completed work'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'PASS: actual consumption, shortage rollback, finished-goods atomicity, retries, undo/redo, counted stock and permissions' AS result;
ROLLBACK;
