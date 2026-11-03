-- Populate label count cells without changing any existing physical counts.
INSERT INTO fill_line_label_stock(product,package_type)
SELECT name,kind FROM factory_products CROSS JOIN (VALUES('gallon'),('quart_can')) p(kind)
WHERE active AND category<>'sport' ON CONFLICT(product_key,package_type) DO NOTHING;
