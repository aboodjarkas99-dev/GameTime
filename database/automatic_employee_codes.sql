CREATE TABLE app_private.employee_codes(code text PRIMARY KEY CHECK(code ~ '^[0-9]{2}$'),profile_id uuid NOT NULL UNIQUE,legacy_code text,assigned_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE app_private.employee_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.employee_codes FROM PUBLIC,anon,authenticated;
CREATE POLICY employee_codes_private ON app_private.employee_codes FOR ALL TO authenticated USING(false) WITH CHECK(false);
-- Keep valid existing numbers; allocate only numbers that are not in use.
INSERT INTO app_private.employee_codes(code,profile_id,legacy_code) SELECT employee_code,id,employee_code FROM profiles WHERE role<>'manager' AND employee_code ~ '^[0-9]{2}$';
DO $$ DECLARE p record; next_code text; BEGIN
 FOR p IN SELECT id,employee_code FROM profiles WHERE role<>'manager' AND (employee_code IS NULL OR employee_code !~ '^[0-9]{2}$') ORDER BY CASE WHEN employee_code ~ '^0+[0-9]{1,2}$' THEN 0 ELSE 1 END,created_at,id LOOP
  next_code:=NULL;
  IF p.employee_code ~ '^0+[0-9]{1,2}$' THEN
   SELECT lpad((p.employee_code::integer)::text,2,'0') INTO next_code WHERE p.employee_code::integer BETWEEN 1 AND 99 AND NOT EXISTS(SELECT 1 FROM app_private.employee_codes WHERE code=lpad((p.employee_code::integer)::text,2,'0')) AND NOT EXISTS(SELECT 1 FROM profiles WHERE employee_code=lpad((p.employee_code::integer)::text,2,'0'));
  END IF;
  IF next_code IS NULL THEN SELECT lpad(n::text,2,'0') INTO next_code FROM generate_series(1,99) n WHERE NOT EXISTS(SELECT 1 FROM app_private.employee_codes WHERE code=lpad(n::text,2,'0')) AND NOT EXISTS(SELECT 1 FROM profiles WHERE employee_code=lpad(n::text,2,'0')) ORDER BY n LIMIT 1; END IF;
  IF next_code IS NULL THEN RAISE EXCEPTION 'All two-digit employee codes are assigned'; END IF;
  INSERT INTO app_private.employee_codes(code,profile_id,legacy_code) VALUES(next_code,p.id,p.employee_code);
  UPDATE profiles SET employee_code=next_code WHERE id=p.id;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION app_private.assign_employee_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE next_code text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF old.role<>'manager' AND new.employee_code IS DISTINCT FROM old.employee_code THEN RAISE EXCEPTION 'Employee codes are assigned automatically and cannot be edited'; END IF;
  RETURN new;
 END IF;
 IF new.role='manager' THEN RETURN new; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('gametime_employee_codes',0));
 SELECT lpad(n::text,2,'0') INTO next_code FROM generate_series(1,99) n WHERE NOT EXISTS(SELECT 1 FROM app_private.employee_codes WHERE code=lpad(n::text,2,'0')) AND NOT EXISTS(SELECT 1 FROM profiles WHERE employee_code=lpad(n::text,2,'0')) ORDER BY n LIMIT 1;
 IF next_code IS NULL THEN RAISE EXCEPTION 'All two-digit Employee Codes (01–99) are assigned'; END IF;
 new.employee_code:=next_code;
 INSERT INTO app_private.employee_codes(code,profile_id) VALUES(next_code,new.id);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.assign_employee_code() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profiles_00_automatic_code BEFORE INSERT OR UPDATE OF employee_code ON public.profiles FOR EACH ROW EXECUTE FUNCTION app_private.assign_employee_code();
CREATE OR REPLACE FUNCTION app_private.employee_login_identity(p_login text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,app_private AS $$
 WITH matches AS (
 SELECT p.id,u.email,CASE WHEN lower(regexp_replace(btrim(p.display_name),'[[:space:]]+',' ','g'))=p_login THEN 0 WHEN lower(p.employee_code)=p_login THEN 1 ELSE 2 END priority
 FROM profiles p JOIN auth.users u ON u.id=p.id LEFT JOIN app_private.employee_codes c ON c.profile_id=p.id
 WHERE p.active AND p.role<>'manager' AND (lower(regexp_replace(btrim(p.display_name),'[[:space:]]+',' ','g'))=p_login OR lower(p.employee_code)=p_login OR lower(c.legacy_code)=p_login)
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email)) FILTER(WHERE priority=(SELECT min(priority) FROM matches)),'[]'::jsonb) FROM matches
$$;
CREATE OR REPLACE FUNCTION public.employee_login_identity(p_login text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.employee_login_identity(p_login) $$;
REVOKE ALL ON FUNCTION app_private.employee_login_identity(text),public.employee_login_identity(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.employee_login_identity(text),public.employee_login_identity(text) TO service_role;
