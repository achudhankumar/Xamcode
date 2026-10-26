-- XamCode AI v2.0 Supabase Schema (Users, ₹69 Subscriptions & SHA-256 PDF Study Cache)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  is_pro BOOLEAN DEFAULT FALSE,
  plan_tier TEXT DEFAULT 'FREE_TRIAL',
  pdfs_analyzed INTEGER DEFAULT 0,
  preferred_3d_theme TEXT DEFAULT 'quantum-holo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pdf_study_cache (
  cache_key TEXT PRIMARY KEY,
  pdf_sha256 TEXT NOT NULL,
  exam_days_mode TEXT NOT NULL,
  title TEXT,
  study_pack JSONB NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
