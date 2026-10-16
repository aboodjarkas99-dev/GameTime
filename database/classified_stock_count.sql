CREATE OR REPLACE FUNCTION public.set_inventory_stock_classified_service(
 p_event_id text,p_event_date date,p_product text,p_package_type text,
 p_target_units numeric,p_gallons_per_unit numeric,p_note text,p_actor uuid,p_category text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF p_category IS NULL OR p_category NOT IN ('sport','residential','cleaner') THEN
  RAISE EXCEPTION 'Choose Sport Floors, Residential, or Cleaner';
 END IF;
 result:=public.set_inventory_stock_service(p_event_id,p_event_date,p_product,p_package_type,p_target_units,p_gallons_per_unit,p_note,p_actor);
 INSERT INTO public.factory_products(name,category)
 VALUES (regexp_replace(btrim(p_product),'\s+',' ','g'),p_category)
 ON CONFLICT(name_key) DO UPDATE SET category=EXCLUDED.category;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.set_inventory_stock_classified_service(text,date,text,text,numeric,numeric,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_inventory_stock_classified_service(text,date,text,text,numeric,numeric,text,uuid,text) TO service_role;
