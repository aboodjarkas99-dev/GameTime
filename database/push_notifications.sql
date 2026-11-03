CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE app_private.push_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),public_key text NOT NULL,private_key text NOT NULL,worker_secret text NOT NULL);
CREATE TABLE public.push_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,endpoint text NOT NULL UNIQUE,keys jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon,authenticated;
GRANT SELECT,DELETE ON public.push_subscriptions TO authenticated;
CREATE POLICY push_own_read ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY push_own_delete ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE TABLE app_private.push_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,event_key text NOT NULL,kind text NOT NULL,work_id bigint,label_id uuid,state text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,claim uuid,available_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,event_key));
CREATE INDEX push_jobs_pending ON app_private.push_jobs(state,available_at);
ALTER TABLE app_private.push_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.push_config,app_private.push_jobs FROM PUBLIC,anon,authenticated;
CREATE POLICY push_config_private ON app_private.push_config FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY push_jobs_private ON app_private.push_jobs FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE OR REPLACE FUNCTION app_private.push_public_key() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active) THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;RETURN (SELECT public_key FROM app_private.push_config WHERE id);END $$;
CREATE OR REPLACE FUNCTION public.push_public_key() RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.push_public_key() $$;
CREATE OR REPLACE FUNCTION app_private.register_push(p_endpoint text,p_keys jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active) THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_endpoint !~ '^https://' OR length(p_endpoint)>2048 OR length(coalesce(p_keys->>'p256dh','')) NOT BETWEEN 40 AND 200 OR length(coalesce(p_keys->>'auth','')) NOT BETWEEN 15 AND 100 THEN RAISE EXCEPTION 'Invalid push subscription'; END IF;
 INSERT INTO push_subscriptions(user_id,endpoint,keys) VALUES(auth.uid(),p_endpoint,p_keys) ON CONFLICT(endpoint) DO UPDATE SET user_id=auth.uid(),keys=EXCLUDED.keys;
END $$;
CREATE OR REPLACE FUNCTION public.register_push(p_endpoint text,p_keys jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.register_push(p_endpoint,p_keys) $$;
REVOKE ALL ON FUNCTION app_private.push_public_key(),public.push_public_key(),app_private.register_push(text,jsonb),public.register_push(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.push_public_key(),public.push_public_key(),app_private.register_push(text,jsonb),public.register_push(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION app_private.wake_push() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE token text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM app_private.push_jobs WHERE state='pending' AND available_at<=now()) THEN RETURN;END IF;
 SELECT worker_secret INTO token FROM app_private.push_config WHERE id;IF token IS NULL THEN RETURN;END IF;
 PERFORM net.http_post(url:='https://bqnptjfdsxzbxtkzigim.supabase.co/functions/v1/send-work-push',body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json'),timeout_milliseconds:=10000);
END $$;
CREATE OR REPLACE FUNCTION app_private.queue_work_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN
 IF TG_OP='UPDATE' AND NOT(old.hold_line AND NOT new.hold_line) THEN RETURN new; END IF;
 IF new.deleted_at IS NOT NULL OR new.hold_line THEN RETURN new; END IF;
 INSERT INTO app_private.push_jobs(user_id,event_key,kind,work_id)
 SELECT p.id,'new_work:'||new.id,'NEW_WORK',new.id FROM profiles p WHERE p.active AND p.role<>'manager' AND EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.user_id=p.id) AND (
 (new.batch_active AND NOT new.production_only AND new.batch_status<>'done' AND (p.role IN ('batch','chemist') OR p.page_roles&&ARRAY['batch','chemist'])) OR
 (new.prod_active AND new.prod_status<>'done' AND (p.role IN ('prod','chemist') OR p.page_roles&&ARRAY['prod','chemist']))) ON CONFLICT(user_id,event_key) DO NOTHING;
 PERFORM app_private.wake_push();RETURN new;
END $$;
CREATE TRIGGER work_orders_90_push AFTER INSERT OR UPDATE OF hold_line ON public.work_orders FOR EACH ROW EXECUTE FUNCTION app_private.queue_work_push();
CREATE OR REPLACE FUNCTION app_private.queue_label_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN
 IF NOT new.active THEN RETURN new; END IF;
 INSERT INTO app_private.push_jobs(user_id,event_key,kind,label_id) SELECT p.id,'new_label:'||new.id,'NEW_LABEL',new.id FROM profiles p WHERE p.active AND p.role<>'manager' AND (p.role='labels' OR 'labels'=ANY(p.page_roles)) AND EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.user_id=p.id) ON CONFLICT(user_id,event_key) DO NOTHING;
 PERFORM app_private.wake_push();RETURN new;
END $$;
CREATE TRIGGER label_requests_90_push AFTER INSERT ON public.label_requests FOR EACH ROW EXECUTE FUNCTION app_private.queue_label_push();
CREATE OR REPLACE FUNCTION app_private.queue_work_reminders(p_now timestamptz DEFAULT now()) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE local_time timestamp:=p_now AT TIME ZONE 'America/Chicago';n integer; BEGIN
 IF extract(isodow FROM local_time)>5 OR extract(hour FROM local_time) NOT IN (10,12,14) THEN RETURN 0; END IF;
 INSERT INTO app_private.push_jobs(user_id,event_key,kind)
 SELECT DISTINCT p.id,'reminder:'||to_char(local_time,'YYYY-MM-DD-HH24'),'REMINDER' FROM profiles p JOIN push_subscriptions s ON s.user_id=p.id WHERE p.active AND p.role<>'manager' AND (p.role IN ('batch','prod','chemist','labels') OR p.page_roles&&ARRAY['batch','prod','chemist','labels']) ON CONFLICT(user_id,event_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;PERFORM app_private.wake_push();RETURN n;
END $$;
CREATE OR REPLACE FUNCTION app_private.claim_push(p_secret text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE config app_private.push_config%ROWTYPE;jobs jsonb; BEGIN
 SELECT * INTO config FROM app_private.push_config WHERE id;-- This RPC is executable only by service_role; HTTP wake-ups carry no credentials.
 IF NOT pg_try_advisory_xact_lock(hashtextextended('gametime_push_claim',0)) THEN RETURN jsonb_build_object('public_key',config.public_key,'private_key',config.private_key,'jobs','[]'::jsonb);END IF;
 UPDATE app_private.push_jobs SET state='pending',available_at=now() WHERE state='processing' AND available_at<now()-interval '5 minutes' AND attempts<5;
 WITH candidates AS (SELECT id FROM app_private.push_jobs WHERE state='pending' AND available_at<=now() AND attempts<5 ORDER BY created_at LIMIT 30 FOR UPDATE SKIP LOCKED), claimed AS (UPDATE app_private.push_jobs j SET state='processing',attempts=attempts+1,claim=gen_random_uuid(),available_at=now() FROM candidates c WHERE j.id=c.id RETURNING j.id,j.claim) SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO jobs FROM claimed;
 RETURN jsonb_build_object('public_key',config.public_key,'private_key',config.private_key,'jobs',jobs);
END $$;
CREATE OR REPLACE FUNCTION app_private.push_payload(p_id uuid,p_claim uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE j app_private.push_jobs%ROWTYPE;p profiles%ROWTYPE;items text[]:='{}';title text;link text:='/index.html';r record;roles text[];cnt integer:=0;today date:=(now() AT TIME ZONE 'America/Chicago')::date; BEGIN
 SELECT * INTO j FROM app_private.push_jobs WHERE id=p_id AND claim=p_claim AND state='processing';IF NOT FOUND THEN RETURN NULL; END IF;
 IF j.kind='REMINDER' AND (extract(isodow FROM now() AT TIME ZONE 'America/Chicago')>5 OR extract(hour FROM now() AT TIME ZONE 'America/Chicago')<8 OR extract(hour FROM now() AT TIME ZONE 'America/Chicago')>=15 OR j.created_at<now()-interval '90 minutes') THEN RETURN NULL; END IF;
 SELECT * INTO p FROM profiles WHERE id=j.user_id AND active AND role<>'manager';IF NOT FOUND THEN RETURN NULL; END IF;roles:=array_append(coalesce(p.page_roles,'{}'),p.role);
 IF j.kind='NEW_LABEL' THEN
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
CREATE OR REPLACE FUNCTION app_private.finish_push(p_id uuid,p_claim uuid,p_state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ BEGIN
 IF p_state NOT IN ('delivered','skipped','retry') THEN RAISE EXCEPTION 'Invalid result'; END IF;
 UPDATE app_private.push_jobs SET state=CASE WHEN p_state='retry' AND attempts<5 THEN 'pending' WHEN p_state='retry' THEN 'failed' ELSE p_state END,available_at=now()+interval '2 minutes' WHERE id=p_id AND claim=p_claim AND state='processing';
END $$;
CREATE OR REPLACE FUNCTION public.claim_push(p_secret text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.claim_push(p_secret) $$;
CREATE OR REPLACE FUNCTION public.push_payload(p_id uuid,p_claim uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.push_payload(p_id,p_claim) $$;
CREATE OR REPLACE FUNCTION public.finish_push(p_id uuid,p_claim uuid,p_state text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.finish_push(p_id,p_claim,p_state) $$;
REVOKE ALL ON FUNCTION app_private.wake_push(),app_private.queue_work_push(),app_private.queue_label_push(),app_private.queue_work_reminders(timestamptz),app_private.claim_push(text),app_private.push_payload(uuid,uuid),app_private.finish_push(uuid,uuid,text),public.claim_push(text),public.push_payload(uuid,uuid),public.finish_push(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.claim_push(text),app_private.push_payload(uuid,uuid),app_private.finish_push(uuid,uuid,text),public.claim_push(text),public.push_payload(uuid,uuid),public.finish_push(uuid,uuid,text) TO service_role;
SELECT cron.schedule('gametime-work-reminders','0 * * * *',$$SELECT app_private.queue_work_reminders();$$);
SELECT cron.schedule('gametime-push-retry','* * * * *',$$SELECT app_private.wake_push();$$);
GRANT SELECT,DELETE ON public.push_subscriptions TO service_role;
