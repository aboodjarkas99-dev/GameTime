-- Transport queues contain internal authorization headers; access stays server-only.
REVOKE ALL ON SCHEMA net FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA net FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA net FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM PUBLIC,anon,authenticated;
UPDATE app_private.push_config SET worker_secret=encode(extensions.gen_random_bytes(32),'hex') WHERE id;
