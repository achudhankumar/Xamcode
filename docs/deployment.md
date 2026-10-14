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
15 min idle (~1 min wake), **local files wiped on every redeploy** —
`bip-data/store.json` resets unless you attach a persistent disk and set
`BIP_DATA_DIR` to it. Learner progress lives in browser localStorage and
is unaffected.

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
| `BIP_DATA_DIR` | With a disk | Path on the persistent disk |

Full reference with placeholders: `.env.example`. Never commit `.env`.

## 4. CI behavior

`.github/workflows/ci.yml` runs on pushes/PRs to `main`:
`npm ci` → `npm run check` → `npm test`. No secrets, no quota spend, no
deploy step. Live tests (`test:e2e`, `test-chunk-live.js`,
`test-pdf-allowance.js`, `test:smoke`) never run in CI.

## 5. Deploy procedure

1. `npm run check` + `npm test` green locally (42/42).
2. Push to `main` → CI runs the same checks.
3. Render auto-deploys (`autoDeploy: true` in `render.yaml`).
4. Verify `/api/health`, `/api/quota`, and `/build` on the live URL.

## 6. Rollback

1. Render Dashboard → service → Deploys → **Rollback** to the last good
   deploy (fastest, no code change), or `git revert HEAD` + push.
2. Restart is automatic on redeploy.
3. Verify `/api/health` then spot-check `/build` activity feed.
4. Note: rollback does not restore `bip-data/` — without a disk, store
   state (votes, chat, waitlist) resets on every deploy regardless.

## 7. Custom domain + HTTPS

1. Render Dashboard → service → Settings → Custom Domains → add domain.
2. Add the `CNAME` record Render shows at your DNS provider
   (apex domains: follow Render's ALIAS/ANAME instructions).
3. Render provisions and renews the TLS certificate automatically; HSTS
   is already sent when `NODE_ENV=production`.
4. Wait for DNS propagation, then verify `https://<domain>/api/health`.

## 8. Pre-launch security checklist

- [ ] `.env` not committed; secrets only in Render dashboard
- [ ] `NODE_ENV=production` set (HSTS on, production bind)
- [ ] `BIP_ADMIN_TOKEN` ≥ 8 chars; `BIP_SESSION_SECRET` ≥ 16 chars
- [ ] Webhook secret matches GitHub; ingest token matches Actions secret
- [ ] `/api/bip/*` returns no emails, tokens, or source (smoke test covers this)
- [ ] Rate limits sane for expected traffic
- [ ] Persistent disk attached if votes/chat/waitlist must survive redeploys

