BEGIN;
-- Use an actual active manager, and roll back every fixture and count.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE active AND role='manager' LIMIT 1),true);
DO $$
DECLARE r jsonb; request uuid:=gen_random_uuid(); before_count bigint; after_count bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Test needs an active manager'; END IF;
 r:=public.record_fill_line_supply(request,'four_gallon_box','count',100,'rollback test');
 IF (r->>'stock_units')::bigint<>100 THEN RAISE EXCEPTION 'count failed'; END IF;
 r:=public.record_fill_line_supply(request,'four_gallon_box','count',100,'rollback test');
 IF NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'retry failed'; END IF;
 r:=public.record_fill_line_supply(gen_random_uuid(),'four_gallon_box','receive',20,'rollback test');
 r:=public.record_fill_line_supply(gen_random_uuid(),'four_gallon_box','use',7,'rollback test');
 IF (r->>'stock_units')::bigint<>113 THEN RAISE EXCEPTION 'receive/use failed'; END IF;
 BEGIN
  PERFORM public.record_fill_line_supply(gen_random_uuid(),'four_gallon_box','use',9999,'rollback test');
  RAISE EXCEPTION 'overdraw accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='overdraw accepted' THEN RAISE; END IF; END;
 IF has_table_privilege('authenticated','fill_line_supplies','UPDATE') OR has_table_privilege('authenticated','fill_line_supply_movements','INSERT') THEN RAISE EXCEPTION 'direct writes exposed'; END IF;
END $$;
RESET ROLE;
-- Check actual employee role permissions under authenticated RLS.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE active AND role='prod' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Test needs a Fill Line employee'; END IF;
 IF (SELECT count(*) FROM public.fill_line_supplies)<>14 THEN RAISE EXCEPTION 'Fill Line RLS read failed'; END IF;
 PERFORM public.record_fill_line_supply(gen_random_uuid(),'pallet','count',12,'employee rollback test');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE active AND role='batch' AND NOT (page_roles&&ARRAY['prod','inventory','chemist']) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Test needs a batch-only employee'; END IF;
 IF EXISTS(SELECT 1 FROM public.fill_line_supplies) THEN RAISE EXCEPTION 'Batch-only access exposed'; END IF;
 BEGIN
  PERFORM public.record_fill_line_supply(gen_random_uuid(),'pallet','count',99,'denied test');
  RAISE EXCEPTION 'Unauthorized write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
