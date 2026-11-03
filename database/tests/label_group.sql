BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE role='manager' AND active LIMIT 1),true);
INSERT INTO work_orders(id,product,batch,work_date,quart,gallon,five,batch_status) VALUES(-990011,'GROUP TEST','T',current_date,'4','8','36','done'),(-990012,'GROUP TEST','T2',current_date,'6','12','0','done');
DO $$ DECLARE stock uuid; snapshot jsonb; op uuid:=gen_random_uuid(); result jsonb; BEGIN
 IF app_private.canonical_factory_product('Omega Satin - / per Case')<>'Omega Satin' OR app_private.canonical_factory_product('Hydra 1k Matte - / per Case')<>'Hydra Matte' THEN RAISE EXCEPTION 'Name mismatch'; END IF;
 SELECT stock_id INTO stock FROM label_requests WHERE work_order_id=-990011 AND package_type='gallon';
 SELECT jsonb_agg(jsonb_build_object('id',id,'version',version) ORDER BY id) INTO snapshot FROM label_requests WHERE stock_id=stock;
 result:=public.update_label_group(stock,snapshot,'print',20,op);
 PERFORM public.update_label_group(stock,snapshot,'print',20,op);
 IF (SELECT stock_units FROM fill_line_label_stock WHERE id=stock)<>20 OR (SELECT sum(printed_units) FROM label_requests WHERE stock_id=stock)<>20 OR EXISTS(SELECT 1 FROM label_requests WHERE stock_id=stock AND status<>'READY') THEN RAISE EXCEPTION 'Grouped print mismatch or duplicate'; END IF;
 result:=public.update_label_group(stock,snapshot,'need');IF NOT (result->>'conflict')::boolean THEN RAISE EXCEPTION 'Stale group accepted'; END IF;
 IF (SELECT count(*) FROM label_requests WHERE work_order_id IN (-990011,-990012))<>4 THEN RAISE EXCEPTION 'Unexpected package count'; END IF;
END $$;
SELECT 'Canonical name and grouped label print, totals, retry and stale snapshot checks passed' as result;
ROLLBACK;
