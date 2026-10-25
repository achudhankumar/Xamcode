-- ============================================================
-- XamCode AI Core Schema — Phase 2: Foundations
-- ------------------------------------------------------------
-- Tables: users, documents, units, topics, mode_cache, jobs, usage, subscriptions
-- Row-Level Security (RLS) enabled on all tables
-- ============================================================

-- 1. Users ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  plan            text NOT NULL DEFAULT 'free',
  plan_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_owner_select ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_owner_update ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 2. Documents -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pdf_hash    text NOT NULL,
  r2_key      text NOT NULL,
  pages       integer NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_owner_all ON public.documents
  FOR ALL USING (auth.uid() = user_id);

-- 3. Units ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  idx         integer NOT NULL,
  title       text NOT NULL,
  page_start  integer NOT NULL,
  page_end    integer NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY units_owner_all ON public.units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = units.document_id AND d.user_id = auth.uid()
    )
  );

-- 4. Topics --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  idx         integer NOT NULL,
  title       text NOT NULL,
  json        jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_type text,
  validated   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY topics_owner_all ON public.topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.documents d ON d.id = u.document_id
      WHERE u.id = topics.unit_id AND d.user_id = auth.uid()
    )
  );

-- 5. Mode Cache (8 Vaathiyar Modes on demand) ----------------
CREATE TABLE IF NOT EXISTS public.mode_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  mode        text NOT NULL,
  json        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(topic_id, mode)
);

ALTER TABLE public.mode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY mode_cache_owner_all ON public.mode_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.topics t
      JOIN public.units u ON u.id = t.unit_id
      JOIN public.documents d ON d.id = u.document_id
      WHERE t.id = mode_cache.topic_id AND d.user_id = auth.uid()
    )
  );

-- 6. Jobs (Worker Queue) -------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority    integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'queued',
  attempts    integer NOT NULL DEFAULT 0,
  error       text,
  run_after   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Jobs are managed by backend workers with service_role key
REVOKE ALL ON TABLE public.jobs FROM public, anon, authenticated;
GRANT ALL ON TABLE public.jobs TO service_role;

-- 7. Usage ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month       text NOT NULL,
  pages_used  integer NOT NULL DEFAULT 0,
  pdfs_used   integer NOT NULL DEFAULT 0,
  tokens_used bigint NOT NULL DEFAULT 0,
  UNIQUE(user_id, month)
);

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_owner_select ON public.usage
  FOR SELECT USING (auth.uid() = user_id);

-- 8. Subscriptions -------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_id        text NOT NULL UNIQUE,
  status             text NOT NULL DEFAULT 'active',
  current_period_end timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_owner_select ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

