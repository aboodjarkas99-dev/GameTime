BEGIN;
DO $$
DECLARE order_id bigint:=-(1000000000000+floor(random()*1000000000000)::bigint);
BEGIN
 INSERT INTO work_orders(id,product,batch,work_date,batch_work_date,prod_work_date,five,batch_checked,prod_checked,actual_five)
 VALUES(order_id,'__UNDO_DONE_TEST__','',DATE '2026-11-02',DATE '2026-11-02',DATE '2026-11-02','10',true,true,10);
 PERFORM set_config('test.work_done_id',order_id::text,true);
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE active AND role='manager' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE id bigint:=current_setting('test.work_done_id')::bigint; result jsonb; qty numeric; count_before bigint;
BEGIN
 result:=public.toggle_work_done(id,'batch','ready');
 IF result->'order'->>'batch_status'<>'done' THEN RAISE EXCEPTION 'Batch completion failed'; END IF;
 result:=public.toggle_work_done(id,'batch','done');
 IF result->'order'->>'batch_status'<>'progress' OR result->'order'->>'batch_made_date' IS NOT NULL THEN RAISE EXCEPTION 'Batch undo failed'; END IF;
 result:=public.toggle_work_done(id,'batch','progress');
 result:=public.toggle_work_done(id,'prod','ready');
 -- Manager can read the aggregate stock view.
 SELECT stock_units INTO qty FROM inventory_current_stock WHERE product='__UNDO_DONE_TEST__' AND package_type='five_gallon_pail';
 IF qty<>10 THEN RAISE EXCEPTION 'First completion stock mismatch: %',qty; END IF;
 result:=public.toggle_work_done(id,'prod','ready');
 IF NOT (result->>'conflict')::boolean THEN RAISE EXCEPTION 'Stale retry toggled work'; END IF;
 result:=public.toggle_work_done(id,'prod','done');
 SELECT stock_units INTO qty FROM inventory_current_stock WHERE product='__UNDO_DONE_TEST__' AND package_type='five_gallon_pail';
 IF qty<>0 THEN RAISE EXCEPTION 'Undo did not reverse inventory: %',qty; END IF;
 result:=public.toggle_work_done(id,'prod','progress');
 SELECT stock_units INTO qty FROM inventory_current_stock WHERE product='__UNDO_DONE_TEST__' AND package_type='five_gallon_pail';
 IF qty<>10 THEN RAISE EXCEPTION 'Redo duplicated inventory: %',qty; END IF;
 result:=public.owner_dashboard(DATE '2026-11-01',DATE '2026-11-30');
 IF jsonb_typeof(result->'orders')<>'array' OR jsonb_array_length(result->'monthly')<>12 THEN RAISE EXCEPTION 'Owner dashboard payload failed'; END IF;
END $$;
RESET ROLE;
-- Fill Line employees can undo and complete their own department.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE active AND role='prod' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result:=public.toggle_work_done(current_setting('test.work_done_id')::bigint,'prod','done');
 IF result->'order'->>'prod_status'<>'progress' THEN RAISE EXCEPTION 'Fill Line employee undo denied'; END IF;
 result:=public.toggle_work_done(current_setting('test.work_done_id')::bigint,'prod','progress');
 IF result->'order'->>'prod_status'<>'done' THEN RAISE EXCEPTION 'Fill Line employee completion denied'; END IF;
 IF EXISTS(SELECT 1 FROM activity_logs) THEN RAISE EXCEPTION 'Fill Line employee can see manager activity'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM activity_logs WHERE product='__UNDO_DONE_TEST__' AND event_type='reopened' AND actor<>'Unknown') THEN RAISE EXCEPTION 'Reopening actor missing from activity'; END IF;
END $$;
-- Exercise genuine read-only authorization using a temporary profile role change.
SELECT set_config('test.viewer_id',(SELECT id::text FROM profiles WHERE active AND role='prod' LIMIT 1),true);
UPDATE profiles SET role='viewer',page_roles='{}' WHERE id=current_setting('test.viewer_id')::uuid;
SELECT set_config('request.jwt.claim.sub',current_setting('test.viewer_id'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; affected bigint;
BEGIN
 result:=public.owner_dashboard(DATE '2026-11-01',DATE '2026-11-30');
 IF jsonb_typeof(result->'inventory')<>'array' OR jsonb_typeof(result->'shipments')<>'array' THEN RAISE EXCEPTION 'Viewer read failed'; END IF;
 IF EXISTS(SELECT 1 FROM activity_logs) THEN RAISE EXCEPTION 'Viewer can read manager activity'; END IF;
 UPDATE work_orders SET held=true WHERE id=current_setting('test.work_done_id')::bigint;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Viewer updated work'; END IF;
 BEGIN
  PERFORM public.toggle_work_done(current_setting('test.work_done_id')::bigint,'prod','done');
  RAISE EXCEPTION 'Viewer toggled work';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.clear_shipping_drafts(ARRAY[gen_random_uuid()]);
  RAISE EXCEPTION 'Viewer modified shipping';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.record_fill_line_supply(gen_random_uuid(),'pallet','count',100,'forbidden');
  RAISE EXCEPTION 'Viewer modified supplies';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE active AND role='batch' AND NOT(page_roles&&ARRAY['viewer','chemist']) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.toggle_work_done(current_setting('test.work_done_id')::bigint,'prod','done');
  RAISE EXCEPTION 'Batch worker changed Fill Line';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.owner_dashboard(DATE '2026-11-01',DATE '2026-11-30');
  RAISE EXCEPTION 'Batch worker accessed owner view';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
