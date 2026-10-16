BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE active AND role='manager' LIMIT 1),true);
DO $$
DECLARE draft uuid:=gen_random_uuid(); ready uuid:=gen_random_uuid(); finished uuid:=gen_random_uuid(); code text:=gen_random_uuid()::text; r jsonb; events_before bigint;
BEGIN
 INSERT INTO public.shipping_shipments(id,shipment_number,packing_slip,customer,status) VALUES
 (draft,'TEST-D-'||code,'TEST-D-'||code,'Rollback fixture','DRAFT'),
 (ready,'TEST-R-'||code,'TEST-R-'||code,'Rollback fixture','READY'),
 (finished,'TEST-F-'||code,'TEST-F-'||code,'Rollback fixture','SHIPPED');
 SELECT count(*) INTO events_before FROM public.inventory_events;
 r:=public.clear_shipping_drafts(ARRAY[draft,ready,finished]);
 IF (r->>'cleared')::int<>1 OR (r->>'skipped')::int<>2 THEN RAISE EXCEPTION 'Only-draft cleanup failed: %',r; END IF;
 IF NOT EXISTS(SELECT 1 FROM shipping_shipments WHERE id=ready AND status='READY') OR NOT EXISTS(SELECT 1 FROM shipping_shipments WHERE id=finished AND status='SHIPPED') THEN RAISE EXCEPTION 'Completed orders modified'; END IF;
 IF (SELECT count(*) FROM inventory_events)<>events_before THEN RAISE EXCEPTION 'Inventory changed during cleanup'; END IF;
 r:=public.clear_shipping_drafts(ARRAY[draft]);
 IF (r->>'cleared')::int<>0 THEN RAISE EXCEPTION 'Retry was not idempotent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app_private.shipping_order_numbers WHERE shipment_id=draft) THEN RAISE EXCEPTION 'Order number reservation lost'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE active AND role='prod' AND NOT (page_roles&&ARRAY['shipping','chemist']) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Test needs Fill Line only employee'; END IF;
 BEGIN
  PERFORM public.clear_shipping_drafts(ARRAY[gen_random_uuid()]);
  RAISE EXCEPTION 'Unauthorized cleanup accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
