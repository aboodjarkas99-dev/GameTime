CREATE OR REPLACE FUNCTION app_private.canonical_factory_product(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH cleaned AS (SELECT btrim(regexp_replace(regexp_replace(p_name,'\yper[[:space:]-]+cases?\y',' ','gi'),'^[[:space:]/(),-]+|[[:space:]/(),-]+$','','g')) AS name), matched AS (SELECT name,regexp_match(name,'^(Omega|Alpha|Phoenix|Hydra)[[:space:]]+(?:1k[[:space:]]+)?(Matte|Satin|Gloss|Semi[[:space:]-]*(?:Gloss|Glass))$','i') AS family FROM cleaned)
 SELECT CASE WHEN family IS NOT NULL THEN initcap(family[1])||' '||CASE WHEN lower(family[2]) LIKE 'semi%' THEN CASE WHEN lower(family[1]) IN ('phoenix','hydra') THEN 'SemiGlass' ELSE 'Semi Gloss' END ELSE initcap(family[2]) END ELSE CASE lower(regexp_replace(name,'[[:space:]-]+','','g'))
 WHEN '1k' THEN 'AND1k' WHEN 'and1k' THEN 'AND1k'
 WHEN 'hybild' THEN 'Hybild Sealer' WHEN 'hybildsealer' THEN 'Hybild Sealer'
 WHEN 'overtime' THEN 'OverTime Finish' WHEN 'overtimefinish' THEN 'OverTime Finish'
 WHEN 'overtimecatalyst' THEN 'OverTime Catalyst'
 WHEN 'xcela' THEN 'X-cel 2k High Solids Part A' WHEN 'xcelparta' THEN 'X-cel 2k High Solids Part A' WHEN 'xcel2khighsolidsparta' THEN 'X-cel 2k High Solids Part A'
 WHEN 'xcelb' THEN 'X-cel Catalyst Part B' WHEN 'xcelpartb' THEN 'X-cel Catalyst Part B' WHEN 'xcelcatalystpartb' THEN 'X-cel Catalyst Part B'
 ELSE name END END FROM matched
$$;

CREATE OR REPLACE FUNCTION app_private.normalize_hybild_ledger_row() RETURNS trigger LANGUAGE plpgsql SET search_path=public,app_private AS $$ BEGIN new.product:=app_private.canonical_factory_product(new.product);new.product_key:=lower(new.product);RETURN new;END $$;
