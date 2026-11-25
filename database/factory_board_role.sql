-- Dedicated Factory Board account: read only, no other employee workspace permissions.
BEGIN;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['manager','batch','prod','viewer','chemist','shipping','inventory','labels','factory_board']::text[]));
ALTER TABLE public.profiles DROP CONSTRAINT profiles_page_roles_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_page_roles_check CHECK (page_roles <@ ARRAY['batch','prod','viewer','chemist','shipping','inventory','labels','factory_board']::text[]);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_factory_board_read_only_check CHECK (
 (role = 'factory_board' AND coalesce(page_roles,'{}'::text[]) <@ ARRAY['factory_board']::text[])
 OR (role <> 'factory_board' AND NOT ('factory_board' = ANY(coalesce(page_roles,'{}'::text[]))))
);
COMMIT;
-- No additional table or mutation privileges are granted. The factory-display Edge Function
-- validates the current authenticated profile and returns only its read-only snapshot.
