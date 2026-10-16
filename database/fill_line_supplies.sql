-- Separate physical packaging supplies from manufactured-product inventory.
CREATE TABLE public.fill_line_supplies (
 id text PRIMARY KEY,name text NOT NULL,category text NOT NULL CHECK(category IN ('boxes','containers','lids','pallets')),
 description text NOT NULL DEFAULT '',units_per_box integer CHECK(units_per_box>0),
 stock_units bigint CHECK(stock_units>=0),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fill_line_supply_movements (
 id uuid PRIMARY KEY, supply_id text NOT NULL REFERENCES public.fill_line_supplies(id),
 kind text NOT NULL CHECK(kind IN ('count','receive','use')),quantity bigint NOT NULL CHECK(quantity>=0),
 delta bigint NOT NULL,previous_units bigint,result_units bigint NOT NULL CHECK(result_units>=0),
 note text NOT NULL DEFAULT '',actor_id uuid NOT NULL REFERENCES public.profiles(id),actor_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fill_line_supply_movements_recent ON public.fill_line_supply_movements(created_at DESC);
ALTER TABLE public.fill_line_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fill_line_supply_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fill_line_supplies,public.fill_line_supply_movements FROM anon,authenticated;
GRANT SELECT ON public.fill_line_supplies,public.fill_line_supply_movements TO authenticated;
CREATE POLICY fill_supplies_read ON public.fill_line_supplies FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist','prod','inventory']));
CREATE POLICY fill_supply_movements_read ON public.fill_line_supply_movements FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist','prod','inventory']));
INSERT INTO public.fill_line_supplies(id,name,category,description,units_per_box) VALUES
 ('four_gallon_box','4 Gallon Box','boxes','4 × 1 gallon. Phoenix and Omega: Matte, Satin, Semi-gloss.',4),
 ('phoenix_box','Phoenix Box','boxes','2 × Jerry Can. All Phoenix and Hydra finishes; all Jerry Can products.',2),
 ('quart_box','Quart Box','boxes','4 × quart cans. Alpha, Omega, and all quart products.',4),
 ('full_court_box','Full Court Box','boxes','Xcel B and all F Style products. Box capacity not yet specified.',NULL),
 ('single_gallon_box','Single Gallon Box','boxes','1 × 1 gallon container.',1),
 ('pallet','Pallet','pallets','Empty pallets available for the Fill Line.',NULL),
 ('jerry_can','Jerry Can 1.25G','containers','Empty Jerry Can containers.',NULL),
 ('gallon_can','1 Gallon Can','containers','Standard empty 1 gallon containers.',NULL),
 ('quart_can','Quart Can','containers','Empty quart containers.',NULL),
 ('five_water','5 Gallon Pail — Water Based','containers','Empty pails for water based products.',NULL),
 ('five_oil','5 Gallon Pail — Oil Based','containers','Empty pails for oil based products.',NULL),
 ('f_style','F Style — 1 Gallon','containers','Empty 1 gallon F Style containers.',NULL),
 ('f_lid_sponge','F Style Lid — Sponge','lids','F Style lids with a sponge liner.',NULL),
 ('f_lid_seal','F Style Lid — Seal','lids','F Style lids with a seal liner.',NULL);
CREATE FUNCTION app_private.record_fill_line_supply(p_request_id uuid,p_supply_id text,p_kind text,p_quantity bigint,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE item public.fill_line_supplies%ROWTYPE; movement public.fill_line_supply_movements%ROWTYPE; result bigint; delta bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.has_any_app_role(ARRAY['manager','chemist','prod','inventory']) THEN RAISE EXCEPTION 'Fill Line inventory access required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_quantity IS NULL OR p_quantity<0 OR p_kind IS NULL OR p_kind NOT IN ('count','receive','use') THEN RAISE EXCEPTION 'Choose a valid action and whole quantity'; END IF;
 -- Serialize retries of the same request before the per-item row lock.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO movement FROM public.fill_line_supply_movements WHERE id=p_request_id;
 IF FOUND THEN
  IF movement.actor_id<>auth.uid() OR movement.supply_id<>p_supply_id OR movement.kind<>p_kind OR movement.quantity<>p_quantity OR movement.note<>coalesce(p_note,'') THEN RAISE EXCEPTION 'Request ID already used'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'stock_units',movement.result_units);
 END IF;
 SELECT * INTO item FROM public.fill_line_supplies WHERE id=p_supply_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supply not found'; END IF;
 IF p_kind<>'count' AND item.stock_units IS NULL THEN RAISE EXCEPTION 'Set the physical stock count first'; END IF;
 result:=CASE p_kind WHEN 'count' THEN p_quantity WHEN 'receive' THEN item.stock_units+p_quantity ELSE item.stock_units-p_quantity END;
 IF result<0 THEN RAISE EXCEPTION 'Not enough stock. Check the physical count first.'; END IF;
 delta:=result-coalesce(item.stock_units,0);
 UPDATE public.fill_line_supplies SET stock_units=result,updated_at=now() WHERE id=item.id;
 INSERT INTO public.fill_line_supply_movements(id,supply_id,kind,quantity,delta,previous_units,result_units,note,actor_id,actor_name)
 VALUES(p_request_id,item.id,p_kind,p_quantity,delta,item.stock_units,result,coalesce(p_note,''),auth.uid(),coalesce(app_private.current_display_name(),'Staff'));
 RETURN jsonb_build_object('ok',true,'stock_units',result);
END $$;
CREATE FUNCTION public.record_fill_line_supply(p_request_id uuid,p_supply_id text,p_kind text,p_quantity bigint,p_note text DEFAULT '')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.record_fill_line_supply(p_request_id,p_supply_id,p_kind,p_quantity,p_note) $$;
REVOKE ALL ON FUNCTION app_private.record_fill_line_supply(uuid,text,text,bigint,text),public.record_fill_line_supply(uuid,text,text,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_fill_line_supply(uuid,text,text,bigint,text),public.record_fill_line_supply(uuid,text,text,bigint,text) TO authenticated;
ALTER TABLE public.work_orders ADD COLUMN fill_packaging jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_fill_packaging_check CHECK(jsonb_typeof(fill_packaging)='object' AND fill_packaging-ARRAY['gallon_style','f_style_lid']::text[]='{}'::jsonb AND coalesce(fill_packaging->>'gallon_style','standard') IN ('standard','f_style') AND coalesce(fill_packaging->>'f_style_lid','sponge') IN ('sponge','seal'));
CREATE FUNCTION app_private.fill_packaging_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF new.carryover_from IS NOT NULL AND new.fill_packaging='{}'::jsonb THEN SELECT fill_packaging INTO new.fill_packaging FROM public.work_orders WHERE id=new.carryover_from; new.fill_packaging:=coalesce(new.fill_packaging,'{}'::jsonb); END IF;
 ELSIF new.fill_packaging IS DISTINCT FROM old.fill_packaging THEN new.version:=greatest(new.version,old.version+1);
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.fill_packaging_before_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_orders_15_fill_packaging BEFORE INSERT OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION app_private.fill_packaging_before_write();
CREATE OR REPLACE FUNCTION public.enforce_work_order_permissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE allowed text[]:=array['held','updated_by','updated_from','updated_at','version'];
BEGIN
 IF auth.uid() IS NULL THEN RETURN new; END IF;
 IF app_private.has_any_app_role(array['manager','chemist']) THEN RETURN new; END IF;
 IF NOT app_private.has_any_app_role(array['prod','batch']) THEN RAISE EXCEPTION 'Work access required' USING errcode='42501'; END IF;
 IF app_private.has_any_app_role(array['batch']) THEN allowed:=allowed||array['batch_checked','batch_status','batch_made_date']; END IF;
 IF app_private.has_any_app_role(array['prod']) THEN allowed:=allowed||array['prod_checked','prod_status','actual','actual_quart','actual_gallon','actual_five','actual_jerry','fill_packaging']; END IF;
 IF (to_jsonb(old)-allowed) IS DISTINCT FROM (to_jsonb(new)-allowed) THEN RAISE EXCEPTION 'Employee cannot modify planning or unassigned department fields' USING errcode='42501'; END IF;
 RETURN new;
END $$;
