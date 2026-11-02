CREATE OR REPLACE FUNCTION app_private.owner_dashboard(p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE today date:=(now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','viewer']) THEN RAISE EXCEPTION 'Owner view access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>1096 THEN RAISE EXCEPTION 'Choose a valid date range of up to three years'; END IF;
 RETURN jsonb_build_object(
 'as_of',now(),'today',today,'from',p_from,'to',p_to,
 'metrics',(SELECT jsonb_build_object(
  'batch_completed',(SELECT count(*) FROM work_orders WHERE deleted_at IS NULL AND NOT hold_line AND batch_status='done' AND NOT production_only AND coalesce(batch_work_date,work_date) BETWEEN p_from AND p_to),
  'fill_completed',(SELECT count(*) FROM work_orders WHERE deleted_at IS NULL AND NOT hold_line AND prod_status='done' AND coalesce(prod_work_date,work_date) BETWEEN p_from AND p_to),
  'filled_gallons',coalesce(sum(l.gallons_delta) FILTER(WHERE e.event_type IN ('PRODUCTION','PRODUCTION_CORRECTION')),0),
  'shipped_gallons',-coalesce(sum(l.gallons_delta) FILTER(WHERE e.event_type IN ('SHIPPED','SHIPPING_CORRECTION')),0),
  'shipped_orders',(SELECT count(*) FROM shipping_shipments WHERE status='SHIPPED' AND coalesce(shipped_date,(shipped_at AT TIME ZONE 'America/Chicago')::date) BETWEEN p_from AND p_to),
  'ready_orders',(SELECT count(*) FROM shipping_shipments WHERE status='READY'),
  'preparing_orders',(SELECT count(*) FROM shipping_shipments WHERE status='DRAFT')
 ) FROM inventory_events e JOIN inventory_event_lines l ON l.inventory_event_id=e.id WHERE e.event_date BETWEEN p_from AND p_to AND coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'),
 'orders',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.prod_date,w.product) FROM (
 SELECT id,app_private.canonical_factory_product(product) product,batch,tank,quart,gallon,five,jerry_enabled,jerry,catalyst,fill_packaging,batch_note,prod_note,
 batch_status,prod_status,batch_checked,prod_checked,held,hold_line,production_only,batch_made_date,
 coalesce(batch_work_date,work_date) batch_date,coalesce(prod_work_date,work_date) prod_date,
 actual_quart,actual_gallon,actual_five,actual_jerry FROM work_orders WHERE deleted_at IS NULL AND (
 hold_line OR batch_status<>'done' OR prod_status<>'done' OR coalesce(batch_work_date,work_date) BETWEEN p_from AND p_to OR coalesce(prod_work_date,work_date) BETWEEN p_from AND p_to)
 ) w),'[]'::jsonb),
 'shipments',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.updated_at DESC) FROM (
 SELECT id,shipment_number,packing_slip,customer,status,totals,shipped_date,updated_at,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('product',CASE WHEN l.inventory_managed THEN app_private.canonical_factory_product(l.inventory_product) ELSE l.description END,'size',l.size,'qty',l.qty,'batch',l.batch) ORDER BY l.line_order),'[]'::jsonb) FROM shipping_lines l WHERE l.shipment_id=shipping_shipments.id) lines
 FROM shipping_shipments WHERE status IN ('DRAFT','READY') OR status='SHIPPED' AND coalesce(shipped_date,(shipped_at AT TIME ZONE 'America/Chicago')::date) BETWEEN p_from AND p_to
 ) s),'[]'::jsonb),
 'inventory',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.product,s.package_type) FROM inventory_current_stock s),'[]'::jsonb),
 'products',coalesce((SELECT jsonb_agg(jsonb_build_object('name',name,'category',category,'stock_limits',stock_limits) ORDER BY name) FROM factory_products WHERE active),'[]'::jsonb),
 'supplies',coalesce((SELECT jsonb_agg(jsonb_build_object('name',name,'category',category,'stock_units',stock_units) ORDER BY category,name) FROM fill_line_supplies),'[]'::jsonb),
 'monthly',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m."month") FROM (
 SELECT to_char(periods.month_start,'YYYY-MM') AS "month",
 coalesce(sum(l.gallons_delta) FILTER(WHERE e.event_type IN ('PRODUCTION','PRODUCTION_CORRECTION')),0) filled,
 -coalesce(sum(l.gallons_delta) FILTER(WHERE e.event_type IN ('SHIPPED','SHIPPING_CORRECTION')),0) shipped
 FROM generate_series(date_trunc('month',p_to::timestamp)-interval '11 months',date_trunc('month',p_to::timestamp),interval '1 month') AS periods(month_start)
 LEFT JOIN inventory_events e ON e.event_date>=periods.month_start::date AND e.event_date<(periods.month_start+interval '1 month')::date
 LEFT JOIN inventory_event_lines l ON l.inventory_event_id=e.id AND coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
 GROUP BY periods.month_start
 ) m),'[]'::jsonb),
 'by_product',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.gallons DESC) FROM (
 SELECT app_private.canonical_factory_product(l.product) product,sum(l.gallons_delta) gallons
 FROM inventory_event_lines l JOIN inventory_events e ON e.id=l.inventory_event_id WHERE e.event_date BETWEEN p_from AND p_to AND e.event_type IN ('PRODUCTION','PRODUCTION_CORRECTION') AND coalesce(l.metadata->>'excluded_from_factory_inventory','false')<>'true'
 GROUP BY app_private.canonical_factory_product(l.product)
 ) p),'[]'::jsonb)
 );
END $$;
CREATE OR REPLACE FUNCTION public.owner_dashboard(p_from date,p_to date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.owner_dashboard(p_from,p_to) $$;
REVOKE ALL ON FUNCTION app_private.owner_dashboard(date,date),public.owner_dashboard(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.owner_dashboard(date,date),public.owner_dashboard(date,date) TO authenticated;
