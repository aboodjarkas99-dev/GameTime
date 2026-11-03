CREATE OR REPLACE FUNCTION app_private.ensure_label_stock_pair() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,app_private AS $$
BEGIN
 IF new.package_type IN ('gallon','quart_can') THEN INSERT INTO fill_line_label_stock(product,package_type) VALUES(new.product,CASE WHEN new.package_type='gallon' THEN 'quart_can' ELSE 'gallon' END) ON CONFLICT(product_key,package_type) DO NOTHING; END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION app_private.ensure_label_stock_pair() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER label_stock_pair AFTER INSERT ON public.fill_line_label_stock FOR EACH ROW EXECUTE FUNCTION app_private.ensure_label_stock_pair();
