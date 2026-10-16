-- Clear only explicitly selected draft snapshots. Retain numbers and audit history.
CREATE FUNCTION app_private.clear_shipping_drafts(p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE item record; cleared uuid[]:='{}';
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.shipping_role_ok() THEN RAISE EXCEPTION 'Shipping access required' USING errcode='42501'; END IF;
 IF p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>1000 THEN RAISE EXCEPTION 'Select 1 to 1000 drafts'; END IF;
 FOR item IN SELECT id FROM public.shipping_shipments WHERE id=ANY(p_ids) AND status='DRAFT' ORDER BY id FOR UPDATE LOOP
  UPDATE public.shipping_shipments SET status='CANCELED',updated_by=auth.uid(),pallet_plan=jsonb_set(coalesce(pallet_plan,'{}'::jsonb),'{draft_cleanup}',jsonb_build_object('at',now(),'by',auth.uid(),'previous_status','DRAFT')) WHERE id=item.id AND status='DRAFT';
  IF FOUND THEN cleared:=array_append(cleared,item.id); END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'cleared_ids',cleared,'cleared',cardinality(cleared),'skipped',cardinality(p_ids)-cardinality(cleared));
END $$;
CREATE FUNCTION public.clear_shipping_drafts(p_ids uuid[]) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.clear_shipping_drafts(p_ids) $$;
REVOKE ALL ON FUNCTION app_private.clear_shipping_drafts(uuid[]),public.clear_shipping_drafts(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.clear_shipping_drafts(uuid[]),public.clear_shipping_drafts(uuid[]) TO authenticated;
