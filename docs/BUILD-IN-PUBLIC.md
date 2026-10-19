# Build-in-Public dashboard

The public site lives at **`/build`** on the same server and JSON store as
the study app — **no separate database, server, or hosting account**. It
shows *verified* development progress and lets visitors take part in shaping
the product.

This document describes what is actually implemented, the HTTP contract, and
the automation setup. Nothing here is aspirational: every route, status, and
limit below is enforced in `bip/*.js`.

## What is implemented

| Feature | Where | Status |
| --- | --- | --- |
| Weighted progress dashboard | `/build` + `/api/bip/progress` | Live |
| Official roadmap | `/api/bip/roadmap` | Live (admin-controlled) |
| Development activity feed | `/api/bip/activity` | Live (seeded/admin/CI/webhook) |
| Build / test / deploy status board | `/api/bip/status` | Live |
| Community chat (SSE realtime) | `/api/bip/chat`, `/api/bip/stream` | Live |
| Ideas board + voting + comments | `/api/bip/ideas/*` | Live |
| Abuse reporting | `/api/bip/reports` | Live (admin resolves) |
| Waitlist (consent + dedupe) | `/api/bip/waitlist` | Live |
| Launch countdown / readiness | `/build` panel + `/api/bip/launch` | Live |
| Deterministic effort estimate | `/build` countdown panel + `/api/bip/estimate`, `/api/bip/estimate/history` | Live (public reads; admin writes) |
| GitHub webhook ingestion | `/api/bip/webhooks/github` | **Dormant until `GITHUB_WEBHOOK_SECRET` is set** |
| CI event ingestion | `/api/bip/events/ingest` | **Dormant until `BIP_INGEST_TOKEN` is set** |

Until the two secret env vars are configured, `/build` shows an honest
**"integration not configured"** badge instead of faking live activity. That
is intentional — see [Incomplete integrations](#incomplete-integrations).

## Progress model (no fabricated percentages)

```
overall % = Σ weight(verified milestones) / Σ weight(all milestones) × 100
```

- 10 seeded milestones, weights sum to **100** (adaptable in `bip/progress.js`).
- A milestone is `verified` **only** when an admin confirms it *and* it has
  non-empty verification criteria (`POST .../verify`). Commits, CI runs, and
  chat messages **never** flip a milestone on their own.
- Verification is reversible: `POST .../reopen` moves it back to
  `needs_review` and the percentage drops. Reopening requires the milestone
  to currently be `verified` or `needs_review`.
- The seeded baseline (from `docs/ROADMAP.md` and the real test suites)
  evaluates to **56%** — 5 verified milestones totalling 56 weight. This is
  a starting point for you to adjust, not a claim of product readiness.

## Data model

One JSON document at `bip-data/store.json` (git-ignored; tests use temp
dirs via `BIP_DATA_DIR`). Collections:

`milestones`, `devEvents`, `chatMessages`, `ideas`, `ideaVotes`
(one row per `(idea, visitor)` — uniqueness is vote integrity),
`ideaComments`, `waitlist`, `reports`, `roadmapItems`, `deliveries`
(processed webhook ids for idempotency), and `settings` (launch target,
phase, build/test/deploy board, blockers).

Bounded histories keep a free host safe: `devEvents` 500, `chatMessages` 500,
`deliveries` 1000, `reports` 500. Writes are atomic (temp file + rename).

### Durable storage (Supabase)

Render Free wipes the local filesystem on every redeploy and restart, so the
JSON store cannot hold the public activity feed or the build/test/deploy
status board durably. When `BIP_STORAGE=supabase` is set, BIP events and the
status board are written to Supabase Postgres through `bip/db.js` (PostgREST
REST API, Node global fetch, no new dependencies) instead of the JSON store.

Required server-side variables (never committed, never sent to the browser):

| Variable | Purpose |
|---|---|
| `BIP_STORAGE` | `supabase` opts into durable storage; unset/any other value keeps the legacy JSON store |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS; server-side only) |

Before enabling durable mode, apply
`supabase/migrations/20261016090000_bip_events.sql` in the Supabase SQL
editor. It creates `bip_events` and `bip_status`, the atomic
`bip_ingest_event()` function, enables RLS with zero public policies, and
locks the function to the service role.

Durable mode is **fail-closed**: if the URL/key is missing or the database is
unreachable, BIP reads and writes answer `503 DURABLE_STORAGE_UNAVAILABLE`
instead of silently falling back to the ephemeral filesystem, and the
service-role credential never appears in any HTTP response.

## HTTP API

Base: `/api/bip`. All JSON unless noted. Every response carries
`X-Request-Id` and the hardening headers `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### Public reads

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/summary` | One-call homepage payload (progress, launch, status, roadmap, activity, top ideas, counts) |
| GET | `/progress` | Weighted progress + all milestones |
| GET | `/roadmap` | Official roadmap items |
| GET | `/activity?limit=` | Latest sanitized dev events + integration flags |
| GET | `/status` | Build / tests / deploy board |
| GET | `/stream` | **SSE** text/event-stream (realtime) |
| GET | `/chat?limit=&after=` | Public messages (bounded) |
| GET | `/ideas?sort=top\|new` | Ideas board (`top` = most votes) |
| GET | `/ideas/:id` | One idea + its comment count |
| GET | `/ideas/:id/comments` | Comments on an idea |
| GET | `/launch` | Readiness %, estimated/confirmed dates, countdown |
| GET | `/estimate` | Deterministic effort estimate (remaining hours, velocity, projected date, confidence) |
| GET | `/estimate/history?limit=` | Estimate change history (newest first) |
| GET | `/waitlist/count` | Count only — **never** emails |

### Public writes (rate limited per IP / identity)

| Method | Path | Body | Limit |
| --- | --- | --- | --- |
| POST | `/chat` | `{ text, nickname }` | 5/min · text ≤ 1000, nickname ≤ 40 |
| POST | `/ideas` | `{ title, description }` | 3/min · title ≤ 120, body ≤ 2000 |
| POST | `/ideas/:id/vote` | — | 20/min · one vote per visitor, toggle off allowed |
| POST | `/ideas/:id/comments` | `{ text, nickname }` | 5/min · comment ≤ 1000 |
| POST | `/reports` | `{ kind, targetId, reason }` | 5/min · `kind` ∈ chat/idea/comment |
| POST | `/waitlist` | `{ email, nickname, consent }` | 5/min · consent required |

### Ingest (authenticated)

- `POST /webhooks/github` — GitHub delivery. Verifies `X-Hub-Signature-256`
  (HMAC-SHA256 of the **raw** body vs `GITHUB_WEBHOOK_SECRET`), then maps an
  **allowlist**: `push` → up to 5 commit events (message first line + branch,
  short SHA), `workflow_run` → build started/passed/failed (PR runs ignored),
  `release` published → release event. Idempotent per `X-GitHub-Delivery` +
  commit SHA. No source code, logs, emails, or tokens ever leave the payload.
- `POST /events/ingest` — GitHub Actions → backend. Requires
  `Authorization: Bearer $BIP_INGEST_TOKEN`. Accepts typed events:
  `commit_pushed`, `build_started/passed/failed`, `tests_passed/failed`,
  `deploy_started/succeeded/failed`, `milestone_verified`, `milestone_reopened`,
  `release_published`, `note`. Supply a `dedupeKey` to make replays idempotent.

### Admin (Bearer `BIP_ADMIN_TOKEN`; 503 if unset, 401 if wrong)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin/milestones/:id/verify` | Mark verified (requires criteria) |
| POST | `/admin/milestones/:id/reopen` | Reverse → `needs_review` |
| POST | `/admin/milestones/:id/status` | Set any status |
| POST | `/admin/milestones/:id/criteria` | Edit verification criteria |
| PUT | `/admin/launch` | Set estimated / confirmed date + note |
| PUT/POST | `/admin/estimate/tasks/:key` | Set task `effortHours` / `remainingHours` / `title` |
| PUT/POST | `/admin/estimate/tasks/:key/status` | Set task status; done-family zeroes remaining |
| PUT/POST | `/admin/estimate/bugs/new` or `/admin/estimate/bugs/:id` | File / update a bug (severity → effort: critical 16h, high 8h, medium 4h, low 2h) |
| PUT/POST | `/admin/estimate/blockers/new` or `/admin/estimate/blockers/:id` | Add / update / resolve a blocker (`resolved: true` removes its effort; titles overlapping an open bug are deduped) |
| PUT/POST | `/admin/estimate/velocity` | Calibrate `observedHoursPerDay` (or derive from `samples: [{hours}]`) |
| PUT | `/admin/roadmap/:key` | Change official roadmap status |
| PUT | `/admin/ideas/:id/status` | Move an idea through the lifecycle |
| GET | `/admin/reports` | Moderation queue |
| POST | `/admin/reports/:id/resolve` | Resolve / dismiss a report |
| DELETE | `/admin/chat/:id` | Delete a message |
| GET | `/admin/waitlist/export` | CSV export (server-only) |

Idea lifecycle: `submitted → under_review → planned → in_development →
completed` (or `declined`). Only admins set these. **A public idea is not a
commitment and is never auto-added to the roadmap.**

## Security boundaries

- **Anonymous posting is allowed** but bounded: per-IP sliding-window rate
  limits, length caps, HTML stripped + secret-pattern redaction on every
  public text field, a moderation queue, and admin-only deletion.
- Output is rendered with `textContent` (never `innerHTML`) on the client —
  stored text is plain, and XSS has no path in.
- Visitor identity is a signed, `HttpOnly` cookie (`bip_vid`); only a short
  public `authorTag` is ever shown. IPs are used for rate limiting only and
  never stored.
- Webhook signatures are checked over raw bytes with `timingSafeEqual`;

## Connecting VS Code → GitHub → dashboard

The intended live flow:

```
VS Code → git push → GitHub → (webhook + Actions) → /api/bip/* → store → /build
```

Two independent, optional channels feed the dashboard:

### 1. GitHub webhook (repo activity + CI results)

1. `openssl rand -hex 32` → set **`GITHUB_WEBHOOK_SECRET`** in the server env.
2. In the repo: **Settings → Webhooks → Add webhook**.
   - **Payload URL:** `https://<your-domain>/api/bip/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** the value from step 1
   - **Events:** *Just the `push` event* **and** *Releases* **and**
     *Workflow runs* (the three the dispatcher understands). Everything else
     is received and safely ignored.
3. Push a commit / cut a release / let CI run. The activity feed and status
   board update within seconds; the `/build` badge flips to **"Live"**.

### 2. GitHub Actions → ingest (deploy + custom events)

Add a step to a workflow (e.g. after deploy) that posts a signed event:

```yaml
- name: Report deployment to Build-in-Public
  if: always()
  run: |
    curl -fsS -X POST "$PUBLIC_URL/api/bip/events/ingest" \
      -H "Authorization: Bearer ${{ secrets.BIP_INGEST_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{"type":"deploy_succeeded","summary":"Deploy succeeded","ref":"'"${{ github.sha }}"'","dedupeKey":"deploy-'"${{ github.run_id }}"'"}'
```

Set **`BIP_INGEST_TOKEN`** in both the server env and the repo secret. The
`dedupeKey` (here the workflow run id) makes retries idempotent — a repeated
delivery is counted as `duplicates`, never double-stored.

### Milestone verification stays manual

CI reporting a green build updates the **status board** only. It does **not**
verify a milestone. To advance real progress, an authorized admin calls:

```bash
curl -X POST "$PUBLIC_URL/api/bip/admin/milestones/core-setup/verify" \
  -H "Authorization: Bearer $BIP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"evidence":"Smoke suite green on 2026-10-13"}'
```

Set **`BIP_ADMIN_TOKEN`** to enable all admin endpoints. Without it, every
admin route returns `503 ADMIN_NOT_CONFIGURED` rather than silently allowing
privileged actions.

## Incomplete integrations (stated honestly)

- **Webhooks & CI ingest are dormant by default.** No `GITHUB_WEBHOOK_SECRET`
  or `BIP_INGEST_TOKEN` means the dashboard runs on seeded milestones +
  admin-recorded events and shows an **"integration not configured"** badge.
  It does not pretend to be live.
- **Real-time is in-memory SSE.** Broadcasts reach clients connected to the
  *same* server process. Across multiple instances you would add a shared
  pub/sub; not required for the single-process Render deployment described in
  `deployment.md`.
- **Moderation is a queue, not auto-filtering.** Reports are reviewed by an
  admin; there is no profanity/ML classifier.
- **Admin console is the HTTP API**, not a UI. Drive it with `curl` or a
  small script; no privileged admin panel is shipped.
- **The `/build` effort-model countdown is a projection, not a promise.**
  It is rendered from `GET /api/bip/estimate` (remaining effort ÷ velocity);
  the client only interpolates seconds between authoritative refreshes
  (60s interval + refocus). If the API is unreachable the panel shows an
  honest "unavailable" state instead of a stale or invented date.

## Related docs

- `docs/SETUP.md` — local env + running `/build`
- `docs/deployment.md` — Render deploy, custom domain, rollback
- `docs/architecture.md` — how the dashboard fits the server
- `docs/ROADMAP.md` — the milestones these weights came from

  ingest/admin use `Bearer` tokens via `timingSafeEqual`. A commit **cannot**
  verify a milestone; only the admin endpoint can.
- Secrets live only in server env vars. No key, token, `.env`, source, or
  private log is ever returned by any route.

