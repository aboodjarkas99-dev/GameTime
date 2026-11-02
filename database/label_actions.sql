CREATE OR REPLACE FUNCTION app_private.record_label_stock(p_operation uuid,p_stock uuid,p_kind text,p_quantity bigint,p_note text DEFAULT '',p_label_request uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE s fill_line_label_stock%ROWTYPE; m fill_line_label_movements%ROWTYPE; balance bigint; who text;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','labels','prod','inventory']) THEN RAISE EXCEPTION 'Label inventory access required' USING ERRCODE='42501'; END IF;
 IF p_kind='printed' AND NOT app_private.has_any_app_role(ARRAY['manager','chemist','labels']) OR p_kind='use' AND NOT app_private.has_any_app_role(ARRAY['manager','chemist','prod','inventory']) THEN RAISE EXCEPTION 'Action not allowed' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_quantity IS NULL OR p_quantity<0 OR p_kind NOT IN ('count','printed','use') OR p_kind IS NULL THEN RAISE EXCEPTION 'Invalid movement'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO m FROM fill_line_label_movements WHERE id=p_operation;
 IF FOUND THEN
  IF m.stock_id<>p_stock OR m.kind<>p_kind OR m.quantity<>p_quantity OR m.actor_id<>auth.uid() OR m.label_request_id IS DISTINCT FROM p_label_request OR m.note IS DISTINCT FROM coalesce(p_note,'') THEN RAISE EXCEPTION 'Operation already used'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'balance',m.result_units);
 END IF;
 SELECT * INTO s FROM fill_line_label_stock WHERE id=p_stock FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Label stock not found'; END IF;
 balance:=CASE p_kind WHEN 'count' THEN p_quantity WHEN 'printed' THEN s.stock_units+p_quantity ELSE s.stock_units-p_quantity END;
 IF balance<0 THEN RAISE EXCEPTION 'Not enough labels in stock'; END IF;
 SELECT display_name INTO who FROM profiles WHERE id=auth.uid() AND active;
 UPDATE fill_line_label_stock SET stock_units=balance,updated_at=now() WHERE id=s.id;
 INSERT INTO fill_line_label_movements(id,stock_id,label_request_id,kind,quantity,delta,previous_units,result_units,note,actor_id,actor_name) VALUES(p_operation,s.id,p_label_request,p_kind,p_quantity,balance-s.stock_units,s.stock_units,balance,coalesce(p_note,''),auth.uid(),who);
 INSERT INTO activity_logs(product,dept,event_type,extra,actor) VALUES(s.product,'prod','labels',p_kind||': '||p_quantity||' labels · '||s.package_type,who);
 RETURN jsonb_build_object('ok',true,'balance',balance);
END $$;
CREATE OR REPLACE FUNCTION public.record_label_stock(p_operation uuid,p_stock uuid,p_kind text,p_quantity bigint,p_note text DEFAULT '') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.record_label_stock(p_operation,p_stock,p_kind,p_quantity,p_note,NULL) $$;
CREATE OR REPLACE FUNCTION app_private.update_label_request(p_request uuid,p_version integer,p_action text,p_quantity bigint DEFAULT 0,p_operation uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE r label_requests%ROWTYPE; result jsonb; who text; m fill_line_label_movements%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','labels']) THEN RAISE EXCEPTION 'Labels access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM label_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF p_action IN ('have','print') THEN
  IF p_operation IS NULL THEN RAISE EXCEPTION 'Operation ID required'; END IF;
  SELECT * INTO m FROM fill_line_label_movements WHERE id=p_operation;
  IF FOUND THEN
   IF m.label_request_id IS DISTINCT FROM r.id OR m.actor_id<>auth.uid() OR m.quantity IS DISTINCT FROM p_quantity OR m.kind<>(CASE WHEN p_action='have' THEN 'count' ELSE 'printed' END) THEN RAISE EXCEPTION 'Operation already used'; END IF;
   RETURN jsonb_build_object('ok',true,'duplicate',true);
  END IF;
 END IF;
 IF NOT r.active THEN RAISE EXCEPTION 'This request is closed. Refresh the sheet.'; END IF;
 IF r.version IS DISTINCT FROM p_version THEN RETURN jsonb_build_object('ok',false,'conflict',true); END IF;
 IF p_action NOT IN ('have','need','start','print') OR p_action IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;
 SELECT display_name INTO who FROM profiles WHERE id=auth.uid() AND active;
 IF p_action IN ('have','print') THEN
  IF p_action='print' AND (p_quantity IS NULL OR p_quantity<=0) THEN RAISE EXCEPTION 'Enter printed quantity greater than zero'; END IF;
  result:=app_private.record_label_stock(p_operation,r.stock_id,CASE WHEN p_action='have' THEN 'count' ELSE 'printed' END,p_quantity,'Label request',r.id);
  IF coalesce((result->>'duplicate')::boolean,false) THEN RETURN result; END IF;
 END IF;
 UPDATE label_requests SET printed_units=printed_units+CASE WHEN p_action='print' THEN p_quantity ELSE 0 END,
  status=CASE p_action WHEN 'need' THEN 'NEEDED' WHEN 'start' THEN 'PREPARING' WHEN 'have' THEN CASE WHEN p_quantity>=requested_units THEN 'READY' ELSE 'NEEDED' END WHEN 'print' THEN CASE WHEN printed_units+p_quantity>=requested_units THEN 'READY' ELSE 'PREPARING' END END,
  availability=CASE p_action WHEN 'have' THEN CASE WHEN p_quantity>=requested_units THEN 'HAVE' WHEN p_quantity>0 THEN 'PARTIAL' ELSE 'NONE' END WHEN 'need' THEN 'NONE' WHEN 'print' THEN CASE WHEN printed_units+p_quantity>=requested_units THEN 'HAVE' ELSE 'PARTIAL' END ELSE availability END,
  version=version+1,updated_by=who,updated_at=now() WHERE id=r.id;
 IF p_action IN ('need','start') THEN INSERT INTO activity_logs(product,dept,event_type,extra,actor) VALUES(r.product,'prod','labels',CASE WHEN p_action='need' THEN 'Labels needed' ELSE 'Preparing labels' END,who); END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.update_label_request(p_request uuid,p_version integer,p_action text,p_quantity bigint DEFAULT 0,p_operation uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.update_label_request(p_request,p_version,p_action,p_quantity,p_operation) $$;
REVOKE ALL ON FUNCTION app_private.record_label_stock(uuid,uuid,text,bigint,text,uuid),public.record_label_stock(uuid,uuid,text,bigint,text),app_private.update_label_request(uuid,integer,text,bigint,uuid),public.update_label_request(uuid,integer,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_label_stock(uuid,uuid,text,bigint,text,uuid),public.record_label_stock(uuid,uuid,text,bigint,text),app_private.update_label_request(uuid,integer,text,bigint,uuid),public.update_label_request(uuid,integer,text,bigint,uuid) TO authenticated;
