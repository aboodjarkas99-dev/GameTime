CREATE OR REPLACE FUNCTION app_private.update_label_group(p_stock uuid,p_requests jsonb,p_action text,p_quantity bigint DEFAULT 0,p_operation uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE r label_requests%ROWTYPE; snapshot jsonb; n integer:=0; total bigint:=0; remaining bigint:=p_quantity; allocated bigint; result jsonb; who text; m fill_line_label_movements%ROWTYPE; ids uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','labels']) THEN RAISE EXCEPTION 'Labels access required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('have','need','start','print','finish') OR jsonb_typeof(p_requests) IS DISTINCT FROM 'array' OR jsonb_array_length(p_requests)=0 THEN RAISE EXCEPTION 'Invalid label group'; END IF;
 SELECT array_agg((x->>'id')::uuid) INTO ids FROM jsonb_array_elements(p_requests) x;
 -- All request locks precede the stock movement; stale groups fail as a unit.
 FOR r IN SELECT * FROM label_requests WHERE id=ANY(ids) ORDER BY id FOR UPDATE LOOP
  n:=n+1; total:=total+r.requested_units;
 END LOOP;
 IF p_action IN ('have','print','finish') THEN
  IF p_operation IS NULL THEN RAISE EXCEPTION 'Operation ID required'; END IF;
  SELECT * INTO m FROM fill_line_label_movements WHERE id=p_operation;
  IF FOUND THEN
   IF m.stock_id<>p_stock OR m.actor_id<>auth.uid() OR m.quantity IS DISTINCT FROM p_quantity OR m.note IS DISTINCT FROM ('Label group '||p_requests::text) OR m.kind<>(CASE WHEN p_action='have' THEN 'count' ELSE 'printed' END) THEN RAISE EXCEPTION 'Operation already used'; END IF;
   RETURN jsonb_build_object('ok',true,'duplicate',true);
  END IF;
 END IF;
 IF n<>jsonb_array_length(p_requests) THEN RAISE EXCEPTION 'Label group changed. Refresh the sheet.'; END IF;
 FOR snapshot IN SELECT value FROM jsonb_array_elements(p_requests) LOOP
  SELECT * INTO r FROM label_requests WHERE id=(snapshot->>'id')::uuid;
  IF NOT r.active OR r.stock_id<>p_stock OR r.version IS DISTINCT FROM (snapshot->>'version')::integer THEN RETURN jsonb_build_object('ok',false,'conflict',true); END IF;
 END LOOP;
 IF p_action IN ('have','print','finish') THEN
  IF p_quantity IS NULL OR p_quantity<0 OR p_action='print' AND p_quantity=0 THEN RAISE EXCEPTION 'Enter a valid whole quantity'; END IF;
  result:=app_private.record_label_stock(p_operation,p_stock,CASE WHEN p_action='have' THEN 'count' ELSE 'printed' END,p_quantity,'Label group '||p_requests::text,NULL);
  IF coalesce((result->>'duplicate')::boolean,false) THEN RETURN result; END IF;
 END IF;
 SELECT display_name INTO who FROM profiles WHERE id=auth.uid() AND active;
 FOR r IN SELECT * FROM label_requests WHERE id=ANY(ids) ORDER BY due_date NULLS LAST,created_at,id LOOP
  n:=n-1;allocated:=CASE WHEN p_action IN ('print','finish') THEN CASE WHEN n=0 THEN remaining ELSE least(remaining,greatest(0,r.requested_units-r.printed_units)) END ELSE 0 END;remaining:=remaining-allocated;
  UPDATE label_requests SET printed_units=printed_units+allocated,
   status=CASE p_action WHEN 'need' THEN 'NEEDED' WHEN 'start' THEN 'PREPARING' WHEN 'finish' THEN 'READY' ELSE CASE WHEN (result->>'balance')::bigint>=total THEN 'READY' ELSE CASE WHEN p_action='have' THEN 'NEEDED' ELSE 'PREPARING' END END END,
   availability=CASE p_action WHEN 'need' THEN 'NONE' WHEN 'start' THEN availability ELSE CASE WHEN (result->>'balance')::bigint>=total THEN 'HAVE' WHEN (result->>'balance')::bigint>0 THEN 'PARTIAL' ELSE 'NONE' END END,
   version=version+1,updated_by=who,updated_at=now() WHERE id=r.id;
 END LOOP;
 IF p_action IN ('need','start') THEN INSERT INTO activity_logs(product,dept,event_type,extra,actor) VALUES(r.product,'prod','labels',CASE WHEN p_action='need' THEN 'Labels needed' ELSE 'Preparing labels' END,who); END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.update_label_group(p_stock uuid,p_requests jsonb,p_action text,p_quantity bigint DEFAULT 0,p_operation uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.update_label_group(p_stock,p_requests,p_action,p_quantity,p_operation) $$;
REVOKE ALL ON FUNCTION app_private.update_label_group(uuid,jsonb,text,bigint,uuid),public.update_label_group(uuid,jsonb,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.update_label_group(uuid,jsonb,text,bigint,uuid),public.update_label_group(uuid,jsonb,text,bigint,uuid) TO authenticated;
