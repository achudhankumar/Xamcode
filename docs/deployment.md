# XamCode AI — Deployment Guide

Single-service deployment: one Node process serves the study app, the
JSON APIs, and the `/build` dashboard from the same origin. There is no
build step, no separate frontend host, and no database server.

## 1. Architecture recap

```
Browser ──HTTPS──▶ Render web service (node server.js :PORT)
                      ├── /            study app (XamCode.html + js/ + css/)
                      ├── /api/*       PDF/AI/quota/BIP JSON APIs
                      └── /build       public dashboard (build.html)
                                       + bip-data/store.json (local JSON)
```

## 2. Render (supported target, `render.yaml` at repo root)

1. Push `main` to GitHub.
2. Render Dashboard → New → Blueprint → select this repo.
3. When prompted, paste `GEMINI_API_KEY` (stored as a secret, never committed).
4. Deploy. Blueprint sets:
   - `NODE_ENV=production`, `HOST=0.0.0.0` (binds all interfaces so the
     host can route traffic; locally the server binds `127.0.0.1`),
   - `MAX_REQUESTS_PER_HOUR=12` (protects the free AI quota),
   - `GEMINI_MODEL=gemini-3.8-flash`, optional failover keys as secrets,
   - health check `GET /api/health`.
5. Verify: `/api/health` → `{ ok: true, service: "xamcode-ai" }`,
   `/api/providers` shows ready models, `/build` loads the dashboard.

Free-plan notes (from `render.yaml`): 512 MB RAM, spins down after
15 min idle (~1 min wake), **local files wiped on every redeploy AND
restart** — a persistent disk is not available on the free plan. The
Build-in-Public activity feed + CI status therefore live in Supabase
Postgres: apply `supabase/migrations/20261016090000_bip_events.sql`
first, then set `BIP_STORAGE=supabase`, `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` on the service. Without them, BIP writes
answer 503 `DURABLE_STORAGE_UNAVAILABLE` instead of silently storing
to the wiped disk. Milestones/community data stay in
`bip-data/store.json` (re-seeded on boot); learner progress lives in
browser localStorage and is unaffected.

## 3. Required production environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Real key, set as Render secret |
| `NODE_ENV` | Yes | `production` — enables HSTS + `0.0.0.0` bind |
| `HOST` | On Render | `0.0.0.0` (blueprint sets it). **Inert in code** — the server derives the bind from `NODE_ENV`, but keep it for clarity |
| `TRUST_PROXY` | On Render | `true`. **Inert in code** — `bip/util.js clientIp()` trusts `X-Forwarded-For` unconditionally, so any direct-to-origin deployment lets clients spoof IP-based rate limits. Keep Render's proxy in front |
| `MAX_REQUESTS_PER_HOUR` | Recommended | `12` on free tier |
| `BIP_ADMIN_TOKEN` | For admin actions | Milestone verify, roadmap/launch, moderation, waitlist CSV |
| `GITHUB_WEBHOOK_SECRET` | For live feed | Must match repo webhook secret |
| `BIP_INGEST_TOKEN` | For CI events | Must match Actions secret |
| `BIP_SESSION_SECRET` | Recommended | ≥16 chars; set explicitly so votes survive redeploys |
| `BIP_STORAGE` | For durable BIP feed | `supabase` — BIP events + build/test/deploy status persist in Postgres and survive redeploys/restarts. Unset = legacy JSON store (ephemeral on Render Free) |
| `SUPABASE_URL` | With `BIP_STORAGE=supabase` | `https://<project-ref>.supabase.co`. Server-side only; apply the BIP migration first |
| `SUPABASE_SERVICE_ROLE_KEY` | With `BIP_STORAGE=supabase` | Service-role key (bypasses RLS). Server-side only — never the anon key, never in responses, logs, or CI |
| `BIP_DATA_DIR` | Optional | Alternate JSON-store location (ephemeral on Render Free) |

Full reference with placeholders: `.env.example`. Never commit `.env`.

## 4. CI behavior

`.github/workflows/ci.yml` runs on pushes/PRs to `main`:
`npm ci` → `npm run check` → `npm test`. No secrets, no quota spend, no
deploy step. Live tests (`test:e2e`, `test-chunk-live.js`,
`test-pdf-allowance.js`, `test:smoke`) never run in CI.
A final `if: always()` step reports the test result to
`POST /api/bip/events/ingest` and fails visibly unless the response
body confirms the event was stored (or was a legitimate duplicate) —
HTTP 200 alone is not trusted. The step never changes the test step's
own outcome.

## 5. Deploy procedure

1. `npm run check` + `npm test` green locally (42/42).
2. Push to `main` → CI runs the same checks.
3. Render auto-deploys (`autoDeploy: true` in `render.yaml`).
4. Verify `/api/health`, `/api/quota`, and `/build` on the live URL.

## 6. Build-in-Public deploy lifecycle (Render webhooks)

CI reports build status (`build_started` / `build_passed` / `build_failed`) to
`POST /api/bip/events/ingest`. Render deploy lifecycle events flow through a
separate path: Render → `POST /api/bip/webhooks/render` → build status board.

### Prerequisite: Render Pro plan
Render webhooks are a **Pro plan** feature. This service runs on the **Free**
tier, so deploy status stays `unknown` on the `/build` dashboard until the
service is upgraded to Pro and the webhook is configured. (Documented in
`render.yaml` comments; `RENDER_WEBHOOK_SECRET` is set `sync: false` so it
never drifts from the dashboard.)

### Setup
1. Upgrade the Render web service to a **Pro** plan.
2. Render Dashboard → service → **Webhooks** → **Add webhook**.
3. Destination URL:
   `https://<service>.onrender.com/api/bip/webhooks/render`
4. Events to send: `deploy_started`, `deploy_ended`.
5. Secret: create a strong random value (e.g. `openssl rand -base64 32`),
   set it as a Render **Environment Variable** named `RENDER_WEBHOOK_SECRET`
   (matching `render.yaml`, `sync: false`).
6. Save. Render sends a `ping` event on creation — it is ignored by the
   allowlist mapper (only `deploy_*` events are stored), so no spurious
   status appears.

### What the webhook handler does
- Verifies each request with **Standard Webhooks (Svix) HMAC-SHA256**: header
  `webhook-signature: v1,<hex>` over `id.timestamp.body`, key =
  `base64_decode(strip(whsec_, secret))`, ±5 min replay window.
- Dedupe via `webhook-id` (replayed deliveries are reported but not re-stored).
- Maps only confirmed statuses: `deploy_started` → `deploy_started`
  (status `running`); `deploy_ended` with `succeeded` → `deploy_succeeded`
  (`passed`); `deploy_ended` with `failed` → `deploy_failed` (`failed`).
  `deploy_ended` with no status and all other notification types are
  **ignored** — the board never guesses.
- Fails closed: `503 WEBHOOK_NOT_CONFIGURED` when `RENDER_WEBHOOK_SECRET`
  is unset; `401 BAD_SIGNATURE` on forged/missing signatures.

### Verification
After configuring, trigger a deploy and watch `/api/bip/status`:
`deploy.state` moves `running` → `passed`/`failed`. The `/build` dashboard
reflects it without a page refresh (polling).

## 7. Rollback

1. Render Dashboard → service → Deploys → **Rollback** to the last good
   deploy (fastest, no code change), or `git revert HEAD` + push.
2. Restart is automatic on redeploy.
3. Verify `/api/health` then spot-check `/build` activity feed.
4. Note: rollback does not restore `bip-data/` — without a disk, store
   state (votes, chat, waitlist) resets on every deploy regardless.

## 8. Custom domain + HTTPS

1. Render Dashboard → service → Settings → Custom Domains → add domain.
2. Add the `CNAME` record Render shows at your DNS provider
   (apex domains: follow Render's ALIAS/ANAME instructions).
3. Render provisions and renews the TLS certificate automatically; HSTS
   is already sent when `NODE_ENV=production`.
4. Wait for DNS propagation, then verify `https://<domain>/api/health`.

## 9. Pre-launch security checklist

- [ ] `.env` not committed; secrets only in Render dashboard
- [ ] `NODE_ENV=production` set (HSTS on, production bind)
- [ ] `BIP_ADMIN_TOKEN` ≥ 8 chars; `BIP_SESSION_SECRET` ≥ 16 chars
- [ ] Webhook secret matches GitHub; ingest token matches Actions secret
- [ ] `/api/bip/*` returns no emails, tokens, or source (smoke test covers this)
- [ ] Rate limits sane for expected traffic
- [ ] Persistent disk attached if votes/chat/waitlist must survive redeploys

