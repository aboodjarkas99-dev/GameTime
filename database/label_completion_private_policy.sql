CREATE POLICY label_completions_private_only ON app_private.label_completions FOR ALL TO authenticated USING(false) WITH CHECK(false);
