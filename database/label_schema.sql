ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK(role IN ('manager','batch','prod','viewer','chemist','shipping','inventory','labels'));
ALTER TABLE profiles DROP CONSTRAINT profiles_page_roles_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_page_roles_check CHECK(page_roles<@ARRAY['batch','prod','viewer','chemist','shipping','inventory','labels']::text[]);
CREATE TABLE public.fill_line_label_stock(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product text NOT NULL,product_key text GENERATED ALWAYS AS(lower(btrim(product))) STORED,
 package_type text NOT NULL CHECK(package_type IN ('quart_can','gallon','jerry_1_25','f_style')),
 stock_units bigint NOT NULL DEFAULT 0 CHECK(stock_units>=0),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(product_key,package_type)
);
CREATE TABLE public.label_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),work_order_id bigint NOT NULL REFERENCES public.work_orders(id),stock_id uuid NOT NULL REFERENCES public.fill_line_label_stock(id),
 product text NOT NULL,package_type text NOT NULL CHECK(package_type IN ('quart_can','gallon','jerry_1_25','f_style')),batch text NOT NULL DEFAULT '',due_date date,
 requested_units bigint NOT NULL CHECK(requested_units>0),printed_units bigint NOT NULL DEFAULT 0 CHECK(printed_units>=0),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','NEEDED','PREPARING','READY')),
 availability text NOT NULL DEFAULT 'UNKNOWN' CHECK(availability IN ('UNKNOWN','HAVE','NONE','PARTIAL')),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,note text NOT NULL DEFAULT '',updated_by text,updated_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(work_order_id,stock_id)
);
CREATE INDEX label_requests_active_due ON public.label_requests(active,due_date);
CREATE TABLE public.fill_line_label_movements(
 id uuid PRIMARY KEY,stock_id uuid NOT NULL REFERENCES public.fill_line_label_stock(id),label_request_id uuid REFERENCES public.label_requests(id),
 kind text NOT NULL CHECK(kind IN ('count','printed','use')),quantity bigint NOT NULL CHECK(quantity>=0),delta bigint NOT NULL,previous_units bigint NOT NULL,result_units bigint NOT NULL CHECK(result_units>=0),
 note text NOT NULL DEFAULT '',actor_id uuid NOT NULL REFERENCES public.profiles(id),actor_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fill_line_label_movements_stock_recent ON public.fill_line_label_movements(stock_id,created_at DESC);
ALTER TABLE public.fill_line_label_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fill_line_label_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fill_line_label_stock,public.label_requests,public.fill_line_label_movements FROM anon,authenticated;
GRANT SELECT ON public.fill_line_label_stock,public.label_requests,public.fill_line_label_movements TO authenticated;
CREATE POLICY label_stock_read ON public.fill_line_label_stock FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist','labels','prod','inventory']));
CREATE POLICY label_requests_read ON public.label_requests FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist','labels','prod']));
CREATE POLICY label_movements_read ON public.fill_line_label_movements FOR SELECT TO authenticated USING(app_private.has_any_app_role(ARRAY['manager','chemist','labels','prod','inventory']));
