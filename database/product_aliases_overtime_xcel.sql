-- Match factory product names to packing slips; preserve catalyst/finish separation.
GRANT USAGE ON SCHEMA app_private TO service_role;
CREATE OR REPLACE FUNCTION app_private.canonical_factory_product(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE lower(regexp_replace(btrim(p_name),'[[:space:]-]+','','g'))
 WHEN 'hybild' THEN 'Hybild Sealer' WHEN 'hybildsealer' THEN 'Hybild Sealer'
 WHEN 'overtime' THEN 'OverTime Finish' WHEN 'overtimefinish' THEN 'OverTime Finish'
 WHEN 'overtimecatalyst' THEN 'OverTime Catalyst'
 WHEN 'xcela' THEN 'X-cel 2k High Solids Part A' WHEN 'xcelparta' THEN 'X-cel 2k High Solids Part A' WHEN 'xcel2khighsolidsparta' THEN 'X-cel 2k High Solids Part A'
 WHEN 'xcelb' THEN 'X-cel Catalyst Part B' WHEN 'xcelpartb' THEN 'X-cel Catalyst Part B' WHEN 'xcelcatalystpartb' THEN 'X-cel Catalyst Part B'
 ELSE p_name END
$$;
CREATE OR REPLACE FUNCTION app_private.normalize_hybild_ledger_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$
DECLARE canonical text:=app_private.canonical_factory_product(new.product);
BEGIN
 IF canonical IN ('Hybild Sealer','OverTime Finish','OverTime Catalyst','X-cel 2k High Solids Part A','X-cel Catalyst Part B') THEN new.product:=canonical;new.product_key:=lower(canonical); END IF;
 RETURN new;
END $$;
