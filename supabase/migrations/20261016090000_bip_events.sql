-- ============================================================
-- Build-in-Public DURABLE STORAGE (Xamcode)
-- ----------------------------------------
-- Render Free wipes the local filesystem on every redeploy and
-- restart, so bip-data/store.json cannot hold the public activity
-- feed. These tables give BIP events + the build/test/deploy status
-- board a durable Postgres home in the Supabase project.
--
-- APPLY THIS IN THE SUPABASE SQL EDITOR (or `supabase db push`)
-- BEFORE setting BIP_STORAGE=supabase on the Render service.
--
-- Security model:
--   * RLS is ENABLED on both tables and NO policies are created, so
--     anon/authenticated roles can read or write NOTHING.
--   * The service-role key (server-side only) bypasses RLS; it is
--     used exclusively by server.js via bip/db.js.
--   * EXECUTE on the ingest function is revoked from public/anon/
--     authenticated so the RPC cannot be called without the
--     service-role credential.
--   * These tables are dedicated to the main API's BIP feed and are
--     separate from any public-dashboard mirror tables.
-- Nothing here touches or overwrites existing tables.
-- ============================================================

create table if not exists public.bip_events (
  id          text primary key,
  type        text not null,
  summary     text not null,
  detail      text not null default '',
  ref         text not null default '',
  status      text not null default 'info',
  source      text not null default 'ci',
  at          timestamptz not null default now(),
  dedupe_key  text,
  created_at  timestamptz not null default now()
);

-- Atomic deduplication: concurrent CI retries with the same key
-- result in exactly one stored row (ON CONFLICT in the function
-- below targets this unique index). NULL keys never conflict.
create unique index if not exists bip_events_dedupe_key_key
  on public.bip_events (dedupe_key);

-- Public feed reads: newest first.
create index if not exists bip_events_at_desc_idx
  on public.bip_events (at desc);

create index if not exists bip_events_type_idx
  on public.bip_events (type);

create table if not exists public.bip_status (
  slot       text primary key check (slot in ('build', 'tests', 'deploy')),
  state      text not null,
  at         timestamptz,
  ref        text,
  updated_at timestamptz not null default now()
);

-- Row Level Security: enabled with zero policies => no public
-- (anon/authenticated) access at all.
alter table public.bip_events enable row level security;
alter table public.bip_status enable row level security;


-- ============================================================
-- Atomic ingest: event insert + status-board upsert in ONE
-- transaction, so a stored event and its build/test/deploy state
-- can never disagree. SECURITY INVOKER: the caller (service role)
-- needs the table grants and bypasses RLS; anon gets nothing.
-- Returns jsonb { "stored": true|false, "id": text|null } —
-- stored=false means the dedupe_key already existed.
-- ============================================================
create or replace function public.bip_ingest_event(
  p_id           text,
  p_type         text,
  p_summary      text,
  p_detail       text  default '',
  p_ref          text  default '',
  p_status       text  default 'info',
  p_source       text  default 'ci',
  p_at           timestamptz default now(),
  p_dedupe_key   text  default null,
  p_status_slot  text  default null,
  p_status_state text  default null,
  p_status_at    timestamptz default null,
  p_status_ref   text  default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stored boolean := true;
  v_id     text;
begin
  insert into public.bip_events
    (id, type, summary, detail, ref, status, source, at, dedupe_key)
  values
    (p_id, p_type, p_summary, p_detail, p_ref, p_status, p_source, p_at, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning bip_events.id into v_id;

  if not found then
    v_stored := false;
    v_id := null;
  end if;

  if p_status_slot is not null and v_stored then
    insert into public.bip_status (slot, state, at, ref, updated_at)
    values (p_status_slot, p_status_state, p_status_at, p_status_ref, now())
    on conflict (slot) do update
      set state      = excluded.state,
          at         = excluded.at,
          ref        = excluded.ref,
          updated_at = now();
  end if;

  return jsonb_build_object('stored', v_stored, 'id', v_id);
end;
$$;

-- Lock the function down: only the service-role credential may
-- execute it. (Anon also cannot reach the tables: RLS + no policies.)
revoke execute on function public.bip_ingest_event(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.bip_ingest_event(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, text) to service_role;

-- Ask PostgREST to reload its schema cache promptly.
notify pgrst, 'reload schema';
