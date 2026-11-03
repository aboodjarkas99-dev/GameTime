-- Wake-up transport contains no secrets or user data. Claims and payloads remain service-role-only.
CREATE OR REPLACE FUNCTION app_private.wake_push() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE token text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM app_private.push_jobs WHERE state='pending' AND available_at<=now()) THEN RETURN;END IF;
 SELECT worker_secret INTO token FROM app_private.push_config WHERE id;IF token IS NULL THEN RETURN;END IF;
 PERFORM net.http_post(url:='https://bqnptjfdsxzbxtkzigim.supabase.co/functions/v1/send-work-push',body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json'),timeout_milliseconds:=10000);
END $$;
CREATE OR REPLACE FUNCTION app_private.claim_push(p_secret text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$ DECLARE config app_private.push_config%ROWTYPE;jobs jsonb; BEGIN
 SELECT * INTO config FROM app_private.push_config WHERE id;-- This RPC is executable only by service_role; HTTP wake-ups carry no credentials.
 IF NOT pg_try_advisory_xact_lock(hashtextextended('gametime_push_claim',0)) THEN RETURN jsonb_build_object('public_key',config.public_key,'private_key',config.private_key,'jobs','[]'::jsonb);END IF;
 UPDATE app_private.push_jobs SET state='pending',available_at=now() WHERE state='processing' AND available_at<now()-interval '5 minutes' AND attempts<5;
 WITH candidates AS (SELECT id FROM app_private.push_jobs WHERE state='pending' AND available_at<=now() AND attempts<5 ORDER BY created_at LIMIT 30 FOR UPDATE SKIP LOCKED), claimed AS (UPDATE app_private.push_jobs j SET state='processing',attempts=attempts+1,claim=gen_random_uuid(),available_at=now() FROM candidates c WHERE j.id=c.id RETURNING j.id,j.claim) SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO jobs FROM claimed;
 RETURN jsonb_build_object('public_key',config.public_key,'private_key',config.private_key,'jobs',jobs);
END $$;
