ALTER TABLE app_private.push_jobs ADD COLUMN review_id uuid REFERENCES public.shipping_product_reviews(id);
CREATE OR REPLACE FUNCTION app_private.push_payload(p_id uuid,p_claim uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE j app_private.push_jobs%ROWTYPE;p profiles%ROWTYPE;items text[]:='{}';title text;link text:='/index.html';r record;roles text[];cnt integer:=0;today date:=(now() AT TIME ZONE 'America/Chicago')::date; BEGIN
 SELECT * INTO j FROM app_private.push_jobs WHERE id=p_id AND claim=p_claim AND state='processing';IF NOT FOUND THEN RETURN NULL; END IF;
 IF j.kind='REMINDER' AND (extract(isodow FROM now() AT TIME ZONE 'America/Chicago')>5 OR extract(hour FROM now() AT TIME ZONE 'America/Chicago')<8 OR extract(hour FROM now() AT TIME ZONE 'America/Chicago')>=15 OR j.created_at<now()-interval '90 minutes') THEN RETURN NULL; END IF;
 SELECT * INTO p FROM profiles WHERE id=j.user_id AND active AND ((j.kind='PRODUCT_REVIEW' AND (role IN ('manager','chemist') OR page_roles&&ARRAY['chemist'])) OR (j.kind<>'PRODUCT_REVIEW' AND role<>'manager'));IF NOT FOUND THEN RETURN NULL; END IF;roles:=array_append(coalesce(p.page_roles,'{}'),p.role);
 IF j.kind='PRODUCT_REVIEW' THEN
  FOR r IN SELECT * FROM shipping_product_reviews WHERE id=j.review_id AND status='PENDING' LOOP items:=array_append(items,r.source_name||' · Packing slip '||coalesce(r.packing_slip,''));END LOOP;title:='GameTime · Product name needs review';link:='/index.html?review-products=1';
 ELSIF j.kind='NEW_LABEL' THEN
  IF NOT('labels'=ANY(roles)) THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM label_requests WHERE id=j.label_id AND active AND status<>'READY' LOOP items:=array_append(items,r.product||' · Batch '||r.batch);END LOOP;title:='GameTime · New labels';link:='/labels.html';
 ELSE
  FOR r IN SELECT w.* FROM work_orders w WHERE w.deleted_at IS NULL AND NOT w.hold_line AND NOT w.held AND (j.work_id IS NULL OR w.id=j.work_id) AND (
   (roles&&ARRAY['batch','chemist'] AND w.batch_active AND NOT w.production_only AND w.batch_status<>'done' AND (j.kind='NEW_WORK' OR coalesce(w.batch_work_date,w.work_date)<=today)) OR
   (roles&&ARRAY['prod','chemist'] AND w.prod_active AND w.prod_status<>'done' AND (j.kind='NEW_WORK' OR w.batch_status='done' AND coalesce(w.prod_work_date,w.work_date)<=today))) ORDER BY coalesce(w.work_date,today),w.id LOOP
   cnt:=cnt+1;IF cnt<=5 THEN items:=array_append(items,r.product||' · Batch '||coalesce(r.batch,''));END IF;
  END LOOP;
  IF j.kind='REMINDER' AND 'labels'=ANY(roles) THEN
   FOR r IN SELECT * FROM label_requests WHERE active AND status<>'READY' AND coalesce(batch_date,due_date)<=today ORDER BY due_date LIMIT 5 LOOP items:=array_append(items,r.product||' · Labels · Batch '||r.batch);END LOOP;
   IF NOT(roles&&ARRAY['batch','prod','chemist']) THEN link:='/labels.html';END IF;
  END IF;
  title:=CASE WHEN j.kind='NEW_WORK' THEN 'GameTime · New work' ELSE 'GameTime · Work not marked done' END;
 END IF;
 IF cardinality(items)=0 THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('title',title,'body',array_to_string(items,E'\n')||CASE WHEN cnt>5 THEN E'\n+'||(cnt-5)||' more' ELSE '' END,'url',link,'tag','gametime-'||j.id,'subscriptions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'endpoint',s.endpoint,'keys',s.keys)),'[]'::jsonb) FROM push_subscriptions s WHERE s.user_id=p.id));
END $$;

CREATE OR REPLACE FUNCTION app_private.queue_product_review_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN
 IF new.status<>'PENDING' THEN RETURN new;END IF;
 IF TG_OP='UPDATE' AND old.status='PENDING' THEN RETURN new;END IF;
 INSERT INTO app_private.push_jobs(user_id,event_key,kind,review_id) SELECT p.id,'product_review:'||new.id,'PRODUCT_REVIEW',new.id FROM profiles p WHERE p.active AND (p.role IN ('manager','chemist') OR p.page_roles&&ARRAY['chemist']) AND EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.user_id=p.id) ON CONFLICT(user_id,event_key) DO NOTHING;
 PERFORM app_private.wake_push();RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.queue_product_review_push() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER product_review_push AFTER INSERT OR UPDATE OF status ON shipping_product_reviews FOR EACH ROW EXECUTE FUNCTION app_private.queue_product_review_push();
