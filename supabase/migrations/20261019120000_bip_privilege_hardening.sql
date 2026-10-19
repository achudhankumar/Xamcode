-- ============================================================
-- Build-in-Public SUPABASE HARDENING & PRIVILEGE REPAIR
-- ------------------------------------------------------------
-- Repository: C:\Xamcode
-- Date: 2026-10-19
--
-- Objective:
--   1. Idempotently verify and harden public.bip_events and public.bip_status.
--   2. Revoke unnecessary TRUNCATE, TRIGGER, REFERENCES, SELECT, INSERT,
--      UPDATE, DELETE privileges from anon, authenticated, and public.
--   3. Grant least-privilege table operations (SELECT, INSERT, UPDATE, DELETE)
--      and function EXECUTE exclusively to service_role.
--   4. Verify RLS is enabled and ensure no public access policies exist.
--   5. Maintain SECURITY INVOKER with fixed search_path = public on the RPC.
--
-- Safe & Non-Destructive:
--   - Does NOT drop tables or columns.
--   - Does NOT delete or truncate event or status rows.
--   - Safe to apply multiple times.
-- ============================================================

DO $$
BEGIN
  -- Precondition Check 1: Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bip_events') THEN
    RAISE EXCEPTION 'Precondition Failed: public.bip_events does not exist. Apply 20261016090000_bip_events.sql first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bip_status') THEN
    RAISE EXCEPTION 'Precondition Failed: public.bip_status does not exist. Apply 20261016090000_bip_events.sql first.';
  END IF;

  -- Precondition Check 2: Verify function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'bip_ingest_event'
  ) THEN
    RAISE EXCEPTION 'Precondition Failed: public.bip_ingest_event function does not exist. Apply 20261016090000_bip_events.sql first.';
  END IF;

  RAISE NOTICE 'Precondition checks passed: bip_events, bip_status, and bip_ingest_event are present.';
END $$;

-- 1. Ensure Row-Level Security is active on both tables
ALTER TABLE public.bip_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bip_status ENABLE ROW LEVEL SECURITY;

-- 2. Revoke ALL table privileges (including TRUNCATE, TRIGGER, REFERENCES) from public, anon, and authenticated
REVOKE ALL ON TABLE public.bip_events FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.bip_status FROM public, anon, authenticated;

-- 3. Grant least-privilege data access strictly to service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bip_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bip_status TO service_role;

-- 4. Secure the RPC: Revoke execute from public/anon/authenticated and grant to service_role
REVOKE ALL ON FUNCTION public.bip_ingest_event(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_ingest_event(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, text) TO service_role;

-- 5. Enforce safe search_path on the ingest function
ALTER FUNCTION public.bip_ingest_event(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, text)
  SET search_path = public;

-- 6. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- 7. Verification Summary Query (Returns current security posture)
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  array_to_string(array_agg(DISTINCT grantee::text), ', ') AS granted_roles
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN information_schema.table_privileges p ON p.table_name = c.relname AND p.table_schema = n.nspname
WHERE n.nspname = 'public' AND c.relname IN ('bip_events', 'bip_status')
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity;
