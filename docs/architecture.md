# XamCode AI — System Architecture

**Date:** 13 October 2026
**Status:** Matches the current codebase (verified against `server.js` and `bip/`)

---

## 1. Overview

XamCode AI turns an uploaded lecture PDF into interactive study material (animated unit-by-unit lessons, AURA tutor with diagram recipes, quiz + Vaathiyar modes, flashcards, formula bank, personal library). It runs on a **zero-dependency Node.js server** — no Express, no framework, no external database. A public **Build-in-Public dashboard** at `/build` shares the same server and store.

## 2. Runtime topology

```
                       ┌────────────────────┐
   Browser (vanilla    │  Node.js http      │   External AI providers
   HTML/CSS/JS)  ─────▶│  server.js         │──────────────┐
                       │  (no framework)    │              │
                       └─────────┬──────────┘              │
                                 │                         ▼
                    ┌────────────┼─────────────┐   Gemini (primary) + failover:
                    │            │             │   Groq, OpenRouter, Explabs, OpenAI
                    ▼            ▼             ▼   MiniMax (images)
              JSON files    bip-data/      (study app is client-rendered;
              (quota, etc.)  store.json     localStorage per user)
```

- **One process** serves both the study app (`/`, `/api/*`) and the dashboard (`/build`, `/api/bip/*`).
- **No database for the study app.** Persistence is JSON files (quota) and browser `localStorage` (study workspace).
- **Optional durable database for BIP.** When `BIP_STORAGE=supabase`, the Build-in-Public activity feed and build/test/deploy status board are stored in Supabase Postgres (`bip_events`, `bip_status` via `bip/db.js`) so they survive Render Free redeploys/restarts. Otherwise BIP falls back to `bip-data/store.json` (ephemeral on Render Free).

## 3. Components

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (`XamCode.html`, `js/`, `css/`) | No build step, no framework |
| Server | Node.js built-in `http` | Single request handler in `server.js` |
| Static serving | `serveStatic()` in `server.js` | Path-traversal guarded (`file.startsWith(__dirname)`) |
| AI (text) | Gemini primary; **failover** to Groq, OpenRouter, Experiential Labs, OpenAI | Keys via `GEMINI_API_KEY[_2.._9]`, `GROQ_*`, `OPENROUTER_*`, `EXPLABS_*`, `OPENAI_*` |
| AI (images) | MiniMax | `Hailuo` video is **disabled** (2D images only) |
| BIP backend | `bip/` modules (util, store, progress, events, community, admin, routes) | Mounted into `server.js` via `handleBip` |
| BIP store | `bip-data/store.json` (JSON, atomic temp+rename writes) | Collections documented in `bip/store.js` |
| Analytics | Google Analytics (browser) | Client-side only |

## 4. Request / data flow

**Study build (`/api/analyze`):**
1. Browser base64-encodes the PDF and POSTs it.
2. Server validates size (`MAX_PDF_MB`), checks/consumes the daily allowance, creates a job.
3. The job runs async (extract → outline → sections → bank → validate → ready); the browser polls `/api/analyze/:id`.
4. AI providers generate content with failover; results render client-side.

**Build-in-Public (`/build`, `/api/bip/*`):**
1. `handleBip` dispatches public reads, rate-limited community writes, the webhook, CI ingest, and admin routes.
2. Public events arrive via GitHub webhook (HMAC-verified) or CI ingest (Bearer token); both are **idempotent** and **field-allowlisted**.
3. Milestones flip to `verified` **only** via the admin token — a commit never auto-completes a feature.
4. Progress = verified milestone weights / total weights (never commit/LOC/time based).
5. The dashboard reads one `/api/bip/summary` payload and keeps chat/ideas live over SSE (`/api/bip/stream`).

## 5. Security boundaries

| Boundary | Implementation |
|---|---|
| Response headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (production only) |
| Content-Security-Policy | **Not set** in this codebase (documented honestly; add before hardening) |
| Rate limiting | Per-IP sliding window (`MAX_REQUESTS_PER_HOUR`); per-route limits in `bip/routes.js` for chat/ideas/votes/reports/waitlist |
| Input sanitization | `sanitizePublicText` / `sanitizeMultiline` strip control chars, HTML, and secret-looking tokens before storage; client renders with `textContent` |
| Secrets | Server-only via env; never in frontend. `bip-data/`, `.env`, quota/cache/log files are git-ignored |
| Private repo data | Webhook mapping publishes only allowlisted fields (message, short SHA, branch, run status) — never source, logs, or tokens |
| Admin actions | `Authorization: Bearer <BIP_ADMIN_TOKEN>`; endpoints return `503` when the token is unconfigured |

## 6. Key routes

| Route | Method | Purpose |
|---|---|---|
| `/` , `/build` | GET | Study app / public dashboard |
| `/api/health` | GET | Liveness probe (`service: xamcode-ai`) |
| `/api/analyze`, `/api/analyze/:id` | POST/GET/DELETE | PDF study build + job lifecycle |
| `/api/ask`, `/api/aura`, `/api/image`, `/api/topic-images` | POST | Tutor / diagram / image endpoints |
| `/api/quota` | GET | Usage allowance |
| `/api/bip/summary` | GET | Dashboard one-call payload |
| `/api/bip/stream` | GET | SSE realtime (chat/ideas/events) |
| `/api/bip/chat`, `/api/bip/ideas` | GET/POST | Community read/write (rate limited) |
| `/api/bip/webhooks/github` | POST | HMAC-verified GitHub delivery |
| `/api/bip/events/ingest` | POST | CI Bearer-token ingest |
| `/api/bip/admin/*` | * | Admin-only (token required) |

## 7. Deployment

Hosted on **Render** (see `render.yaml`, `docs/deployment.md`). `NODE_ENV=production` binds `0.0.0.0` and enables HSTS; otherwise it binds `127.0.0.1`. CI runs `npm ci` → `npm run check` → `npm test` (offline; no paid keys, no quota spent).

---

*See `docs/BUILD-IN-PUBLIC.md` for the dashboard design and `docs/ROADMAP.md` for delivery status.*
