# XamCode AI — Remaining Roadmap (Upcoming Days)

> Grounded in the actual code, not the calendar. "Day 0" = **2026-10-09**.
> Estimates are the **shape** of the work, not promises — I move fast, but the
> QA/deploy items have genuine unknowns (real-user behavior, live Razorpay, prod
> hosting). Treat durations as rough.
>
> Status key: **✅ done** · **🔄 in progress** · **⬜ todo**

---

## Day 0–1 — Load & performance testing (the item we started today)

- [x] Build a load harness that does **not** burn real quota → `setup/load-test.js`
      (uses `XAMCODE_QUOTA_FILE` scratch file; times analyze + image lanes)
- [ ] Run it against the 18.8 MB Java PDF → record per-stage timing
- [ ] Set performance budgets, e.g.:
      - Unit 1 first delivery **< 180 s** for a ≤20 MB PDF
      - `/api/health` + `/api/quota` p95 **< 300 ms** under 20 concurrent
      - Image lane: local SVG **< 50 ms** per topic (free, deterministic), always
- [ ] Confirm graceful behavior when the image lane 429-throttles (batch must survive)

## Day 2 — Large-PDF hardening follow-ups

- [ ] Verify Units 2..N unlock reliably while Unit 1 is studied (no dropped unlocks)
- [ ] Add a clear "queue" state on the plan page for slow units
- [ ] Decide `IMAGE_PARALLEL` for prod (SVG worker pool, 1-10; each worker renders ~1ms so even 1 is plenty)

## Day 3–4 — UAT (formal, with real users)

- [ ] 3–5 testers × one real PDF each (mix: textbook, notes, slides)
- [ ] Capture: PDF success rate, time-to-first-study, confusing moments
- [ ] Fix the top 3 friction points found

## Day 5 — KPI definitions (Week 1 gap)

- [ ] Write down: activation %, PDF success rate, median time-to-study, image success %

## Day 6–7 — Production deploy prep

- [ ] Production env vars + secrets checklist (see below) finalized
- [ ] `BILLING_MODE=live` only after Razorpay account is approved (KYC)
- [ ] No image spend to plan: the local SVG lane is free for life (the paid MiniMax lane was removed)

## Day 8 — Deploy to production (Week 25)

- [ ] Push to host (Render/Koyeb/Fly) using `render.yaml`
- [ ] Verify: live URL + HTTPS + `/api/health` green
- [ ] Smoke test on the live URL (upload one small PDF end-to-end)

## Day 9+ — Monitor & iterate (Week 26)

- [ ] Uptime + error monitoring on `/api/health`
- [ ] Feedback loop + first iteration list

---

## Production deploy checklist (concrete, from the code)

| # | Step | Where / command |
|---|---|---|
| 1 | Run full suite green | `npm test` (14 suites) |
| 2 | Set `NODE_ENV=production` | enables HSTS + hardening |
| 3 | Set `TRUST_PROXY=true` | correct client IP behind host proxy (quota key) |
| 4 | Set `PORT` | host usually injects it; default falls back |
| 5 | Secrets | `GEMINI_API_KEY`, `GROQ_API_KEY`; `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET`) |
| 6 | Choose image lane | the local SVG lane only (free; `IMAGE_PROVIDER` is kept for compat and ignored) |
| 7 | Tune quotas | `PDF_GENERATIONS_PER_DAY=5`, `MAX_PDF_MB=20`, `UNIT_SPLIT_MB=8`, `GEMINI_INLINE_MB=14` |
| 8 | Confirm `.gitignore` hides `.env`, `.xamcode-quota.json`, `.billing.json`, `.training/`, `.image-cache/` | never commit secrets/state |
| 9 | HTTPS on | host-managed (Render/Fly do this) |
| 10 | Health check | `GET /api/health` → `{ok:true}` |
| 11 | Rollback ready | redeploy previous commit; `/api/health` verify |

## Open items discovered while building (not original roadmap)

- MiniMax image `insufficient balance` → local SVG fallback already wired (deterministic, inline, $0); the paid MiniMax lane was later removed entirely, so stills are free for life.
- Re-anchor launch calendar to a real date once hosting is chosen.

## How to run the load harness
```bash
# from c:\Xamcode — uses a scratch quota file, does NOT touch your daily 5
node setup/load-test.js
node setup/load-test.js --pdf "C:\path\to\R20CSE2204-JAVA-PROGRAMMING.pdf"
```
It prints per-stage timing + image-lane latency, and a concurrency smoke on the
free endpoints (`/api/health`, `/api/quota`).
