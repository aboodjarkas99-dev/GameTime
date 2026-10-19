-- Canonical product alias; leave tinted Hybild variants distinct.
CREATE OR REPLACE FUNCTION app_private.canonical_factory_product(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN lower(regexp_replace(btrim(p_name),'\s+',' ','g')) IN ('hybild','hybild sealer') THEN 'Hybild Sealer' ELSE p_name END
$$;
REVOKE ALL ON FUNCTION app_private.canonical_factory_product(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.canonical_factory_product(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION app_private.canonical_hybild_json(p_value jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,app_private AS $$
DECLARE result jsonb;
BEGIN
 CASE jsonb_typeof(p_value)
 WHEN 'string' THEN RETURN to_jsonb(app_private.canonical_factory_product(p_value#>>'{}'));
 WHEN 'array' THEN SELECT coalesce(jsonb_agg(app_private.canonical_hybild_json(value) ORDER BY ord),'[]'::jsonb) INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(value,ord); RETURN result;
 WHEN 'object' THEN SELECT coalesce(jsonb_object_agg(key,app_private.canonical_hybild_json(value)),'{}'::jsonb) INTO result FROM jsonb_each(p_value); RETURN result;
 ELSE RETURN p_value;
 END CASE;
END $$;
REVOKE ALL ON FUNCTION app_private.canonical_hybild_json(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.canonical_hybild_json(jsonb) TO authenticated,service_role;
