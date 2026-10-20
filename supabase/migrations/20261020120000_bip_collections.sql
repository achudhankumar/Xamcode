-- ============================================================
-- Build-in-Public DURABLE COLLECTIONS
-- ------------------------------------------------------------
-- Repository: C:\Xamcode
-- Date: 2026-10-20
--
-- Objective:
--   Persist EVERY Build-in-Public collection (milestones, roadmap,
--   chat, ideas, votes, comments, waitlist, reports, settings and
--   webhook delivery ids) in Postgres, so a redeploy that wipes the
--   local filesystem cannot lose admin decisions or community data.
--
--   The dev-event feed and the build/test/deploy status board keep
--   their own relational tables (bip_events / bip_status from
--   20261016090000_bip_events.sql) — this migration only adds the
--   remaining document-shaped collections.
--
-- Design:
--   public.bip_collections(collection text primary key, doc jsonb)
--   One row per logical collection; the row holds the collection
--   exactly as bip/store.js keeps it in memory, so the JSON import
--   format and the live format are the same document.
--
--   RPCs (service_role only, SECURITY INVOKER, search_path = public):
--     bip_load_document()        -> jsonb  (all collections merged)
--     bip_save_document(jsonb)   -> void   (upsert given collections)
--     bip_import_document(jsonb) -> jsonb  (repeatable full replace)
--
-- Safe & Non-Destructive:
--   - Does NOT touch bip_events / bip_status.
--   - Does NOT drop anything.
--   - Safe to apply multiple times.
-- ============================================================

-- 1. Table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bip_collections (
  collection  text        PRIMARY KEY,
  doc         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bip_collections IS
  'One row per Build-in-Public collection; doc holds the collection as JSON.';

-- 2. Row Level Security ------------------------------------------------
ALTER TABLE public.bip_collections ENABLE ROW LEVEL SECURITY;

-- 3. Privileges: service_role only ------------------------------------
REVOKE ALL ON TABLE public.bip_collections FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bip_collections TO service_role;

-- 4. Load: all collections as one object ------------------------------
CREATE OR REPLACE FUNCTION public.bip_load_document()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  out jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(collection, doc), '{}'::jsonb)
    INTO out
    FROM public.bip_collections;
  RETURN out;
END;
$$;

-- 5. Save: upsert only the collections present in the payload ----------
CREATE OR REPLACE FUNCTION public.bip_save_document(p_collections jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  k text;
  n int := 0;
BEGIN
  IF p_collections IS NULL THEN
    RETURN jsonb_build_object('saved', 0);
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_collections) LOOP
    INSERT INTO public.bip_collections (collection, doc, updated_at)
    VALUES (k, COALESCE(p_collections -> k, '[]'::jsonb), now())
    ON CONFLICT (collection) DO UPDATE
      SET doc = EXCLUDED.doc, updated_at = now();
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('saved', n, 'updatedAt', now());
END;
$$;

-- 6. Import: repeatable full replace of the managed collections -------
--    Importing the same document twice yields the same state; the
--    function only ever writes the keys it is given, so unrelated
--    rows in the table are left untouched.
CREATE OR REPLACE FUNCTION public.bip_import_document(p_doc jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  k text;
  n int := 0;
BEGIN
  IF p_doc IS NULL OR jsonb_typeof(p_doc) <> 'object' THEN
    RAISE EXCEPTION 'bip_import_document: document must be a JSON object.';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_doc) LOOP
    INSERT INTO public.bip_collections (collection, doc, updated_at)
    VALUES (k, COALESCE(p_doc -> k, '[]'::jsonb), now())
    ON CONFLICT (collection) DO UPDATE
      SET doc = EXCLUDED.doc, updated_at = now();
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('collections', n, 'importedAt', now());
END;
$$;

-- 7. Function privileges ------------------------------------------------
REVOKE ALL ON FUNCTION public.bip_load_document() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.bip_save_document(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.bip_import_document(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_load_document() TO service_role;
GRANT EXECUTE ON FUNCTION public.bip_save_document(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bip_import_document(jsonb) TO service_role;

-- 8. Reload PostgREST schema cache --------------------------------------
NOTIFY pgrst, 'reload schema';

-- 9. Verification summary ------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  array_to_string(array_agg(DISTINCT grantee::text), ', ') AS granted_roles
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN information_schema.table_privileges p ON p.table_name = c.relname AND p.table_schema = n.nspname
WHERE n.nspname = 'public' AND c.relname = 'bip_collections'
GROUP BY c.relname, c.relrowsecurity;
  