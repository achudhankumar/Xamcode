-- ============================================================
-- Build-in-Public JOB QUEUE TABLE & RPCs — Phase 4
-- ------------------------------------------------------------
-- Repository: C:\\Xamcode
-- Date: 2026-10-21
--
-- Objective:
--   Create the bip_jobs table and three service-role-only RPCs
--   for managing the async job queue (save, claim, finish).
--
-- Design:
--   public.bip_jobs(job_id text primary key, job_type text not null,
--     payload jsonb not null default '{}'::jsonb, status text not null default 'queued',
--     created_at timestamptz not null default now(), completed_at timestamptz)
--   RLS is ENABLED, service_role bypasses RLS via SECURITY INVOKER RPCs.
--
--   bip_save_job(p_job_id text, p_status text) -> jsonb
--   bip_claim_job() -> jsonb  (returns available job or error)
--   bip_finish_job(p_job_id text, p_status text, p_stage text, p_progress numeric) -> jsonb
--
-- Safe & Non-Destructive:
--   Does NOT drop existing tables.
--   Safe to apply multiple times (uses IF NOT EXISTS for table, OR REPLACE for functions).
-- ============================================================

-- 1. Table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bip_jobs (
  job_id            text PRIMARY KEY,
  job_type          text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'queued',
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

COMMENT ON TABLE public.bip_jobs IS
  'Job queue for async processing; one row per job, status tracks queued/running/done.';

-- 2. Row Level Security ------------------------------------------------
ALTER TABLE public.bip_jobs ENABLE ROW LEVEL SECURITY;

-- 3. Privileges: service_role only ------------------------------------
REVOKE ALL ON TABLE public.bip_jobs FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bip_jobs TO service_role;

-- 4. Save: update a job's status -------------------------------------
CREATE OR REPLACE FUNCTION public.bip_save_job(
  p_job_id           text,
  p_status           text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text := COALESCE(p_status, 'queued');
BEGIN
  UPDATE public.bip_jobs
  SET status = v_status,
      completed_at = CASE WHEN v_status = 'done' THEN now() ELSE completed_at END
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object('saved', CASE WHEN found THEN 1 ELSE 0 END, 'job_id', p_job_id, 'status', v_status);
END;
$$;

-- 5. Claim: claim a job from the queue (status='queued' -> 'running')
CREATE OR REPLACE FUNCTION public.bip_claim_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job record;
BEGIN
  -- Lock one queued job and return it; use RETURNING to get the row
  UPDATE public.bip_jobs
  SET status = 'running'
  WHERE job_id = (
    SELECT job_id FROM public.bip_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING job_id, job_type, payload, status, created_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'error', 'No jobs available');
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'job', jsonb_build_object(
      'job_id', v_job.job_id,
      'job_type', v_job.job_type,
      'payload', v_job.payload,
      'status', v_job.status,
      'created_at', to_char(v_job.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  );
END;
$$;

-- 6. Finish: mark a job as done
CREATE OR REPLACE FUNCTION public.bip_finish_job(
  p_job_id           text,
  p_status           text,
  p_stage            text,
  p_progress         numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text := COALESCE(p_status, 'done');
BEGIN
  UPDATE public.bip_jobs
  SET status = v_status,
      stage = COALESCE(p_stage, stage),
      progress = COALESCE(p_progress, progress),
      completed_at = now()
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object('finished', CASE WHEN found THEN 1 ELSE 0 END, 'job_id', p_job_id, 'status', v_status);
END;
$$;

-- 6a. Set job stage (Phase 4) ----------------------------------------------
CREATE OR REPLACE FUNCTION public.bip_set_job_stage(
  p_job_id           text,
  p_stage            text,
  p_weight           numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bip_jobs
  SET stage = p_stage,
      progress = p_weight
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object('updated', CASE WHEN found THEN 1 ELSE 0 END, 'job_id', p_job_id, 'stage', p_stage, 'progress', p_weight);
END;
$$;

-- 7. Function privileges -----------------------------------------------
REVOKE ALL ON FUNCTION public.bip_save_job(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_save_job(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.bip_claim_job() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_claim_job() TO service_role;

REVOKE ALL ON FUNCTION public.bip_finish_job(text, text, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_finish_job(text, text, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.bip_set_job_stage(text, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bip_set_job_stage(text, text, numeric) TO service_role;

-- 8. Reload PostgREST schema cache -------------------------------------
NOTIFY pgrst, 'reload schema';