# XamCode AI — Project Roadmap & Status Tracker

> **Note on dates:** the original plan targeted "end of Q4 2024," which has
> already passed (today is Oct 2026). This doc is therefore kept as a
> **living status tracker**, not a fixed calendar. Weeks 1–26 are retained as
> the work sequence; re-anchor the calendar dates when a real launch date is set.
>
> Status key: **✅ done** · **⚠️ partial** · **⬜ not started**
> Last reviewed: 2026-10-09

---

## Phase 1 — Planning & Design (Weeks 1–4)

- [x] **Week 1 — Scope, requirements, KPIs**
  - [x] Scope + feature set → `docs/requirements.md`
  - [ ] Formal KPI definitions (activation, PDF success rate, time-to-study) — ⚠️ not written down
- [x] **Week 2 — Wireframes & UI mockups**
  - [x] Design system + live UI built (surpasses static mockups): `css/` theme layers, vibe-coding hero
- [x] **Week 3 — Technical architecture & data schema**
  - [x] `docs/architecture.md` (client/server split, IndexedDB, JSON stores)
  - [x] Data model defined (study JSON, library entries, quota)
  - [ ] SQL schema — **N/A by design** (zero-dependency stack; browser IndexedDB + on-disk JSON)
- [ ] **Week 4 — Finalize plan, resources, risk** — ⚠️ this roadmap covers the plan; resource/risk register ⬜

## Phase 2 — Development (Weeks 5–20)

- [x] **Weeks 5–8 — Env, core backend, authentication**
  - [x] Dev env + scripts (`package.json`, `server.js`, `node --version` verified)
  - [x] Core backend services (`server.js`: analyze pipeline, quota, providers, billing, images)
  - [x] User auth (`js/auth.js`: sign-in + guest gate)
- [x] **Weeks 9–12 — Frontend components + API integration**
  - [x] `js/app.js` renders all views and calls `/api/*` (quota, providers, analyze, topic-images, library, billing)
  - [x] Landing, Workspace, Plan, Unit, Quiz, Formulas, Library views
- [x] **Weeks 13–16 — Key features & business logic**
  - [x] PDF → study pipeline with **unit-by-unit chunking** (Unit 1 first, rest unlock)   - [x] Visual learning (15-layout SVG engine + local-SVG still generator)
  - [x] Quiz + flashcards + Vaathiyar explanations
  - [x] AURA tutor, formula bank, search
  - [x] Library (IndexedDB) + 30-day trial logic (`js/library.js`)
  - [x] **Subscription/billing** — Razorpay ₹69 tier (`js/billing.js` + server handlers, dev mode)
- [x] **Weeks 17–20 — Unit + integration testing**
  - [x] 14 test suites, all green (providers, quiz, content 596, sections, diagrams, mermaid, journey, markup, jobs, jobs-http, topics, chunks, render, allowance)

## Phase 3 — Testing & QA (Weeks 21–24)

- [ ] **Weeks 21–22 — System / UAT / performance testing** — ⚠️
  - [x] Automated system coverage (the 14 suites above)
  - [ ] Formal UAT with real users on sample PDFs
  - [ ] Performance budgets / load test (image cascade, large-PDF path)
- [ ] **Week 23 — Bug fixing** — ⬜ ongoing; tracked via `requestId` in server logs
- [ ] **Week 24 — Documentation + deploy prep** — ⚠️
  - [x] Docs pack: classification, requirements, architecture, security, compliance, deployment (`docs/`)
  - [x] Legal pages (privacy, terms, accessibility) + robots/sitemap + security headers
  - [ ] Production env vars + secrets checklist finalized

## Phase 4 — Deployment & Post-Launch (Weeks 25–26)

- [ ] **Week 25 — Deploy to production** — ⬜
  - [x] Deploy config present (`render.yaml`, `NODE_ENV=production`, `TRUST_PROXY`)
  - [ ] Actually deploy + verify live URL + SSL
- [ ] **Week 26 — Monitor, feedback, iterate** — ⬜
  - [ ] Uptime/error monitoring
  - [ ] Feedback loop + iteration plan

---

## Where the project actually stands

**Roughly 70% complete.** The bulk of Phase 1–2 (design, backend, frontend,
features, automated tests) is built and passing. The real remaining work is:

1. **Phase 3 hardening** — formal UAT + performance/load testing of the large-PDF
   and image paths; KPI definitions.
2. **Phase 4 launch** — production deploy, monitoring, feedback loop.
3. **Known open items** (not on the original roadmap but discovered while building):
   - MiniMax **image** balance was `insufficient` → the Pollinations fallback was replaced by the deterministic local SVG generator ($0, inline data URI, no key, no network); the paid MiniMax lane was later removed entirely, so stills stay free for life.
   - Re-anchor the launch calendar to a real date.

## How to use this tracker
Tick boxes as work lands. When a phase's boxes are all `[x]`, that phase is done.
Keep `docs/index.md` linking here as the entry point.
