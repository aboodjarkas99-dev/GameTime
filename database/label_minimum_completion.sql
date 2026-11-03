ALTER TABLE public.fill_line_label_stock ADD COLUMN minimum_units bigint CHECK(minimum_units>=0);
CREATE TABLE app_private.label_completions(id uuid PRIMARY KEY,actor_id uuid NOT NULL,stock_id uuid NOT NULL,printed bigint NOT NULL,on_hand bigint NOT NULL,requests jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE app_private.label_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.label_completions FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.finish_label_group(p_stock uuid,p_requests jsonb,p_printed bigint,p_on_hand bigint,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE receipt app_private.label_completions%ROWTYPE; result jsonb; count_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','labels']) THEN RAISE EXCEPTION 'Labels access required' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_printed IS NULL OR p_printed<0 OR p_on_hand IS NULL OR p_on_hand<0 THEN RAISE EXCEPTION 'Enter whole quantities, 0 or higher'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('label_completion:'||p_operation::text,0));
 SELECT * INTO receipt FROM app_private.label_completions WHERE id=p_operation;
 IF FOUND THEN
  IF receipt.actor_id<>auth.uid() OR receipt.stock_id<>p_stock OR receipt.printed<>p_printed OR receipt.on_hand<>p_on_hand OR receipt.requests IS DISTINCT FROM p_requests THEN RAISE EXCEPTION 'Operation already used'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true);
 END IF;
 result:=app_private.update_label_group(p_stock,p_requests,'finish',p_printed,p_operation);
 IF coalesce((result->>'conflict')::boolean,false) THEN RETURN result; END IF;
 count_id:=md5(p_operation::text||':on_hand')::uuid;
 PERFORM app_private.record_label_stock(count_id,p_stock,'count',p_on_hand,'On hand after labels completed',NULL);
 INSERT INTO app_private.label_completions(id,actor_id,stock_id,printed,on_hand,requests) VALUES(p_operation,auth.uid(),p_stock,p_printed,p_on_hand,p_requests);
 RETURN jsonb_build_object('ok',true,'balance',p_on_hand);
END $$;
CREATE OR REPLACE FUNCTION public.finish_label_group(p_stock uuid,p_requests jsonb,p_printed bigint,p_on_hand bigint,p_operation uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.finish_label_group(p_stock,p_requests,p_printed,p_on_hand,p_operation) $$;
CREATE OR REPLACE FUNCTION app_private.set_label_minimum(p_stock uuid,p_minimum bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist']) THEN RAISE EXCEPTION 'Management access required' USING ERRCODE='42501'; END IF;
 IF p_minimum<0 THEN RAISE EXCEPTION 'Minimum must be 0 or higher'; END IF;
 UPDATE fill_line_label_stock SET minimum_units=p_minimum,updated_at=now() WHERE id=p_stock;
 IF NOT FOUND THEN RAISE EXCEPTION 'Label stock not found'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.set_label_minimum(p_stock uuid,p_minimum bigint) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.set_label_minimum(p_stock,p_minimum) $$;
REVOKE ALL ON FUNCTION app_private.finish_label_group(uuid,jsonb,bigint,bigint,uuid),public.finish_label_group(uuid,jsonb,bigint,bigint,uuid),app_private.set_label_minimum(uuid,bigint),public.set_label_minimum(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.finish_label_group(uuid,jsonb,bigint,bigint,uuid),public.finish_label_group(uuid,jsonb,bigint,bigint,uuid),app_private.set_label_minimum(uuid,bigint),public.set_label_minimum(uuid,bigint) TO authenticated;
-- Give each product already used in quart/gallon labels both editable size counts.
INSERT INTO fill_line_label_stock(product,package_type) SELECT DISTINCT s.product,p.kind FROM fill_line_label_stock s CROSS JOIN (VALUES('quart_can'),('gallon')) p(kind) WHERE s.package_type IN ('quart_can','gallon') ON CONFLICT(product_key,package_type) DO NOTHING;
