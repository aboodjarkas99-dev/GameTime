CREATE OR REPLACE FUNCTION app_private.toggle_work_start(p_order_id bigint,p_department text,p_expected_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,app_private AS $$
DECLARE item public.work_orders%ROWTYPE; current_status text;
BEGIN
 IF auth.uid() IS NULL OR p_department IS NULL OR p_department NOT IN ('batch','prod') OR NOT app_private.has_any_app_role(ARRAY['manager','chemist',p_department]) THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM work_orders WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;
 current_status:=CASE WHEN p_department='batch' THEN item.batch_status ELSE item.prod_status END;
 IF p_expected_status IS DISTINCT FROM current_status THEN RETURN jsonb_build_object('ok',false,'conflict',true,'order',to_jsonb(item)); END IF;
 IF current_status='done' THEN RAISE EXCEPTION 'Undo Work Done before changing Start Work'; END IF;
 IF current_status='ready' THEN
  IF p_department='batch' AND NOT item.batch_checked OR p_department='prod' AND NOT item.prod_checked THEN RAISE EXCEPTION 'Complete PRE-CHECK first'; END IF;
  IF p_department='prod' AND item.batch_status<>'done' THEN RAISE EXCEPTION 'Waiting for Batch Maker'; END IF;
 END IF;
 IF p_department='batch' THEN UPDATE work_orders SET batch_status=CASE WHEN current_status='progress' THEN 'ready' ELSE 'progress' END WHERE id=item.id RETURNING * INTO item;
 ELSE UPDATE work_orders SET prod_status=CASE WHEN current_status='progress' THEN 'ready' ELSE 'progress' END WHERE id=item.id RETURNING * INTO item; END IF;
 RETURN jsonb_build_object('ok',true,'start_cleared',current_status='progress','order',to_jsonb(item));
END $$;
CREATE OR REPLACE FUNCTION public.toggle_work_start(p_order_id bigint,p_department text,p_expected_status text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.toggle_work_start(p_order_id,p_department,p_expected_status) $$;
REVOKE ALL ON FUNCTION app_private.toggle_work_start(bigint,text,text),public.toggle_work_start(bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.toggle_work_start(bigint,text,text),public.toggle_work_start(bigint,text,text) TO authenticated;
