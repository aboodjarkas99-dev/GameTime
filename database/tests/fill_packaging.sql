BEGIN;
DO $$
DECLARE order_id bigint:=-(1000000000000+floor(random()*1000000000000)::bigint); child_id bigint; v bigint;
BEGIN
 INSERT INTO public.work_orders(id,product,batch,work_date,batch_work_date,prod_work_date,gallon,fill_packaging)
 VALUES(order_id,'__F_STYLE_TEST__','',DATE '2026-10-16',DATE '2026-10-16',DATE '2026-10-16','12','{"gallon_style":"f_style","f_style_lid":"seal"}');
 child_id:=order_id-1;
 INSERT INTO public.work_orders(id,product,batch,work_date,batch_work_date,prod_work_date,carryover_from)
 VALUES(child_id,'__F_STYLE_TEST__','',DATE '2026-10-19',DATE '2026-10-19',DATE '2026-10-19',order_id);
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE id=child_id AND fill_packaging->>'gallon_style'='f_style' AND fill_packaging->>'f_style_lid'='seal') THEN RAISE EXCEPTION 'Carryover lost packaging'; END IF;
 PERFORM set_config('test.fill_order',order_id::text,true);
 SELECT version INTO v FROM work_orders WHERE id=order_id;
 PERFORM set_config('test.fill_version',v::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE active AND role='prod' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 UPDATE public.work_orders SET fill_packaging='{"gallon_style":"f_style","f_style_lid":"sponge"}' WHERE id=current_setting('test.fill_order')::bigint;
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE id=current_setting('test.fill_order')::bigint AND fill_packaging->>'f_style_lid'='sponge' AND version>current_setting('test.fill_version')::bigint) THEN RAISE EXCEPTION 'Employee packaging update/version failed'; END IF;
 BEGIN
  UPDATE public.work_orders SET product='__UNAUTHORIZED_EDIT__' WHERE id=current_setting('test.fill_order')::bigint;
  RAISE EXCEPTION 'Planning update accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE active AND role='batch' AND NOT(page_roles&&ARRAY['prod','chemist']) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  UPDATE public.work_orders SET fill_packaging='{"gallon_style":"standard"}' WHERE id=current_setting('test.fill_order')::bigint;
  RAISE EXCEPTION 'Batch-only changed packaging';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
