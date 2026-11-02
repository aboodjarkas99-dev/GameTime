CREATE OR REPLACE FUNCTION app_private.toggle_work_done(p_order_id bigint,p_department text,p_expected_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,app_private AS $$
DECLARE item public.work_orders%ROWTYPE; current_status text; reopening boolean;
BEGIN
 IF auth.uid() IS NULL OR p_department IS NULL OR p_department NOT IN ('batch','prod') OR NOT app_private.has_any_app_role(ARRAY['manager','chemist',p_department]) THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM public.work_orders WHERE id=p_order_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;
 current_status:=CASE WHEN p_department='batch' THEN item.batch_status ELSE item.prod_status END;
 IF p_expected_status IS DISTINCT FROM current_status THEN RETURN jsonb_build_object('ok',false,'conflict',true,'order',to_jsonb(item)); END IF;
 reopening:=current_status='done';
 IF NOT reopening THEN
  IF p_department='batch' AND NOT item.batch_checked OR p_department='prod' AND NOT item.prod_checked THEN RAISE EXCEPTION 'Complete PRE-CHECK first'; END IF;
  IF p_department='prod' THEN
   IF item.batch_status<>'done' THEN RAISE EXCEPTION 'Waiting for Batch Maker — finish the batch first'; END IF;
   IF (coalesce(substring(item.quart from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND item.actual_quart IS NULL)
    OR (coalesce(substring(item.gallon from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND item.actual_gallon IS NULL)
    OR (coalesce(substring(item.five from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND item.actual_five IS NULL)
    OR (item.jerry_enabled AND coalesce(substring(item.jerry from '-?[0-9]+(?:[.][0-9]+)?'),'0')::numeric>0 AND item.actual_jerry IS NULL) THEN RAISE EXCEPTION 'Enter actual filled quantities first'; END IF;
  END IF;
 END IF;
 IF p_department='batch' THEN
  UPDATE public.work_orders SET batch_status=CASE WHEN reopening THEN 'progress' ELSE 'done' END,batch_made_date=CASE WHEN reopening THEN NULL ELSE batch_made_date END WHERE id=item.id RETURNING * INTO item;
 ELSE
  UPDATE public.work_orders SET prod_status=CASE WHEN reopening THEN 'progress' ELSE 'done' END WHERE id=item.id RETURNING * INTO item;
 END IF;
 RETURN jsonb_build_object('ok',true,'reopened',reopening,'order',to_jsonb(item));
END $$;
CREATE OR REPLACE FUNCTION public.toggle_work_done(p_order_id bigint,p_department text,p_expected_status text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.toggle_work_done(p_order_id,p_department,p_expected_status) $$;
REVOKE ALL ON FUNCTION app_private.toggle_work_done(bigint,text,text),public.toggle_work_done(bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.toggle_work_done(bigint,text,text),public.toggle_work_done(bigint,text,text) TO authenticated;
-- Activity is visible only to accounts with management access.
ALTER POLICY activity_logs_read_active ON public.activity_logs USING(app_private.has_any_app_role(ARRAY['manager','chemist']));
