BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM profiles WHERE role='manager' AND active LIMIT 1),true);
DO $$ DECLARE ship uuid;r shipping_product_reviews%ROWTYPE;j app_private.push_jobs%ROWTYPE;token uuid:=gen_random_uuid();payload jsonb;result jsonb;BEGIN
 INSERT INTO push_subscriptions(user_id,endpoint,keys) VALUES(auth.uid(),'https://fcm.googleapis.com/review-test-'||gen_random_uuid(),'{"auth":"test","p256dh":"test"}');
 ship:=public.save_shipping_shipment(NULL,jsonb_build_object('shipment_number','REVIEW_NEW_'||gen_random_uuid()),jsonb_build_array(jsonb_build_object('description','Review New Cleaner Label','inventory_product','Review New Cleaner Label','size','gal1','qty',7)),'{}','{}');
 SELECT * INTO r FROM shipping_product_reviews WHERE alias_key='review new cleaner label';
 SELECT * INTO j FROM app_private.push_jobs WHERE user_id=auth.uid() AND review_id=r.id;IF NOT FOUND THEN RAISE EXCEPTION 'Manager notification missing';END IF;
 UPDATE app_private.push_jobs SET state='processing',claim=token WHERE id=j.id;
 -- Use a separate variable name to avoid matching the claim column.
 SELECT pj.claim INTO token FROM app_private.push_jobs pj WHERE pj.id=j.id;
 payload:=app_private.push_payload(j.id,token);IF payload IS NULL OR payload->>'title'<>'GameTime · Product name needs review' THEN RAISE EXCEPTION 'Manager payload missing';END IF;
 BEGIN PERFORM public.resolve_shipping_product(r.id,NULL,'Review New Cleaner',NULL);RAISE EXCEPTION 'Missing category accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Missing category accepted' THEN RAISE;END IF;END;
 result:=public.resolve_shipping_product(r.id,NULL,'Review New Cleaner','cleaner');
 IF NOT EXISTS(SELECT 1 FROM factory_products WHERE name='Review New Cleaner' AND category='cleaner' AND active) THEN RAISE EXCEPTION 'New catalog product missing';END IF;
 IF (SELECT qty FROM shipping_lines WHERE shipment_id=ship)<>7 THEN RAISE EXCEPTION 'New product units changed';END IF;
 IF app_private.push_payload(j.id,token) IS NOT NULL THEN RAISE EXCEPTION 'Resolved review still sends notification';END IF;
END $$;
SELECT 'Manager push, resolved-alert suppression, required product category and new catalog creation passed' as result;
ROLLBACK;
