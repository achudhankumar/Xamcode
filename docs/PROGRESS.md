# XamCode AI Build Progress

## Current Architecture & Phase Status

### Phase 1: Repo Audit & Safety Net
- **Gate Status:** PASS
- **Artifact:** `docs/AUDIT.md`
- **Tag:** `pre-rebuild`

### Phase 3: Reliable Generation
- **Gate Status:** PASS (`node scripts/gate.js 3`)
- **Measured Metrics:**
  - `real_model_calls`: 96 real calls to Google Gemini API (`gemini-flash-lite-latest`)
  - `pdf_count`: 5 real multi-page PDFs
  - `pdf_min_pages`: 24 pages (all $\ge 20$ pages; one 100 pages)
  - `first_pass_rate`: 100% (96/96 topics passed validation on first attempt)
  - `final_pass_rate`: 100% (96/96 topics passed validation)
  - `api_error_share`: 0.0 (0% API failure rate)
  - `npm_test`: 0 (1,411 passed assertions across 24 test suites)
- **Artifacts:** `docs/PHASE3-REPORT.md`, `reports/phase-3.json`
- **Tag:** `phase-3`

---

### Phase 2: Foundations
- **Status:** Evaluated via `reports/phase-2.json` / pending gate configuration.
- **Components:** Supabase SQL migrations, RLS policies, Cloudflare R2 client architecture, seed script.

---

### Phase 4: Background Pipeline
- **Gate Status:** PASS (`node scripts/gate.js 4`)
- **Components:**
  - `bip_jobs_table`: 1
  - `bip_save_job_rpc`: 1
  - `bip_claim_job_rpc`: 1
  - `bip_finish_job_rpc`: 1
  - `server_module_exports`: 1
  - `server_exports_complete`: 1
- **Artifact:** `reports/phase-4.json`
- **Tag:** `phase-4`

---

### Phase 5: Visual System Core
- **Gate Status:** PASS (`node scripts/gate.js 5`)
- **Components:**
  - `schemas_loaded`: 1
  - `schemas_count`: 13 generic renderers
  - `engine_component`: 1 (`AuraVisualEngine.jsx`)
  - `visual_registry_exports`: 1
  - `server_visual_pipeline`: 1
- **Artifact:** `reports/phase-5.json`
- **Tag:** `phase-5`

---

### Phase 6: Subject Packs
- **Gate Status:** PASS (`node scripts/gate.js 6`)
- **Components:**
  - `packs_count`: 2 (`computer-networks`, `python`)
  - `topics_generated`: 40 topics generated across packs from real PDFs
  - `richness_pass_rate`: 100% (40/40 passed pedagogical criteria: $\ge 3$ distinct elements, full captions)
  - `specialized_visual_share`: 87.5% ($\ge 70\%$)
  - `process_flow_fallback_share`: 12.5% ($\le 30\%$)
  - `gallery_generated`: 1 (`subjects-gallery.html`)
- **Artifact:** `reports/phase-6.json`, `subjects-gallery.html`
- **Tag:** `phase-6`

---

### Phase A5: Photo Upload
- **Gate Status:** PASS (`node test-photo-upload.js` — 11/11 passed)
- **Components:**
  - `lib/photo-extractor.js`: Handles up to 20 textbook photos (JPG, PNG, WEBP, HEIC)
  - Blurry/cropped photo detection heuristics (flags images < 400px)
  - Seamless transformation into standard `{ numPages, pages }` structure
  - Valid topic tree generation matching the PDF generation schema
- **Tag:** `phase-a5`

---

### Phase 7: Modes, CheatCode and Quiz
- **Gate Status:** PASS (`node scripts/gate.js 7`)
- **Components:**
  - `modes_implemented`: 8 (`crash`, `compare`, `solve`, `life`, `history`, `flash`, `exam`, `eli5`)
  - `second_open_served_from_cache`: 1 (instantaneous retrieval < 5ms)
  - `label_rules_enforced`: 1 (`AI estimate` on ungrounded comparisons; `Extra knowledge, not from your PDF` on real-life & history)
  - Full mesh topology diagram generated with all 10 links explicitly drawn
  - Renamed quiz panel to `Practice Quiz` with crisp inline SVG check/cross icons
  - Fixed sample-page title overlap on sticky header
- **Artifact:** `reports/phase-7.json`, `lib/mode-cache.js`, `test-modes-quiz.js`
- **Tag:** `phase-7`

---

### Phase A1: Study Plan Generator
- **Gate Status:** PASS (`node test-study-plan.js` — 11/11 passed)
- **Components:**
  - `lib/study-plan-generator.js`: Builds deterministic plans for 7, 30, and 90 days
  - Spaced repetition schedules (Day 1, 3, 7, 14) and weekly mock tests
  - Reserves last 20% of schedule for comprehensive review
  - Adaptive rescheduling for missed days strictly capped at $\le 2\times$ daily minutes
- **Tag:** `phase-a1`

---

### Phase A2: Spaced Repetition (SM-2) & Daily Review
- **Gate Status:** PASS (`node test-srs.js` — 10/10 passed)
- **Components:**
  - `lib/srs-engine.js`: SuperMemo-2 scheduling implementation (Again, Hard, Good, Easy)
  - Card generator from Flashcards mode and missed quiz answers
  - Daily Review queue aggregating due cards across all courses
  - 20-card session cap with seamless "Continue" flow
- **Tag:** `phase-a2`

---

### Phase A4: Report a Problem Button & Quality Pipeline
- **Gate Status:** PASS (`node test-problem-reporting.js` — 11/11 passed)
- **Components:**
  - `lib/problem-reporter.js`: Captures issues on topics, visuals, quiz items, and AURA answers
  - Metadata tracking: prompt version (`v2.1`), model slug (`gemini-flash-lite-latest`), timestamp, user ID
  - Admin queries filtering by reason (`wrong_fact`, `confusing`, `visual_broken`, etc.)
  - Auto-export to Phase 11 evaluation set for iterative prompt calibration
- **Tag:** `phase-a4`

---

### Phase 8: AURA Grounded Tutor
- **Gate Status:** PASS (`node scripts/gate.js 8`)
- **Components:**
  - `lib/aura-grounded-tutor.js`: Document chunking (500-800 tokens), BM25-style term retrieval with whole-word regex
  - Citation grounding: 100% (15/15) in-scope test questions cited exact page numbers ($\ge 90\%$)
  - Out-of-scope identification: 100% (5/5) labeled with `Outside knowledge, not from your PDF` ($\ge 95\%$)
  - Structured visual scene generation matching Phase 5 validator
  - Per-user rate limiting (max 30 queries per minute)
- **Artifact:** `reports/phase-8.json`, `lib/aura-grounded-tutor.js`, `test-aura-grounded.js`
- **Tag:** `phase-8`

---

### Phase A3: Languages (English, Tamil, Hindi, Telugu, Kannada)
- **Gate Status:** PASS (`node test-multilingual.js` — 35/35 passed)
- **Components:**
  - `lib/i18n-engine.js`: Multilingual architecture supporting `en`, `ta`, `hi`, `te` (Beta), `kn` (Beta)
  - Strict preservation of English JSON schema keys, verbatim original PDF quotes, and visual scene structures
  - Indic font line-height clipping prevention ($\ge 1.65$)
  - 20 review sample topics generated per language and archived in `docs/lang-review/`
- **Tag:** `phase-a3`

---

### Phase A9: Text to Speech (TTS)
- **Gate Status:** PASS (`node test-speech-synthesis.js` — 11/11 passed)
- **Components:**
  - `lib/speech-synthesis-engine.js`: Web Speech API implementation (zero paid speech API)
  - Matching voices for English, Tamil (`ta-IN`), Hindi (`hi-IN`) on Android Chrome
  - Graceful degradation: hides Listen button when target voice is absent (prevents mismatched language reading)
  - Step-through sentence boundary tracking and active sentence highlighting
- **Tag:** `phase-a9`

---

### Phase 9: Theme System Ported from Build-in-Public
- **Gate Status:** PASS (`node scripts/gate.js 9`)
- **Components:**
  - `shared/themes/`: Extracted all 5 themes (`01 Vibe Coding Studio`, `02 Bubblegum Playground`, `03 Liquid Glass 3D`, `04 Neo-Brutalist Creative Lab`, `05 Soft Minimal Studio`) with tokens, lazy 3D scenes, and theme manifests
  - Live switching without page reload (`applyThemeLive`)
  - Battery-saver recommendation for mobile devices (`Soft Minimal Studio` recommended when coarse pointer, RAM $\le 4$GB, cores $\le 4$, or Save-Data is active)
  - Section 06 dynamic readiness weight wiring from `/api/bip/summary`
  - 15 screenshots saved in `docs/theme-screens/`
- **Artifact:** `reports/phase-9.json`, `shared/themes/`, `test-themes.js`
- **Tag:** `phase-9`

---

### Phase 10: Accounts, Quotas, Payments & Security
- **Gate Status:** PASS (`node scripts/gate.js 10`)
- **Components:**
  - `lib/account-billing-security.js`: 300-page monthly allowance (Free), 1000-page allowance (Plus @ Rs 69/mo)
  - Quota overage guard: strictly blocks the 301st page
  - Razorpay Webhook HMAC verification for UPI AutoPay subscription lifecycle
  - Library locks (without deletion) on lapse; 60-day retention grace period
  - Multi-tenant RLS isolation: cross-user access denied
  - Subtle student email watermarking on study canvases
- **Artifact:** `reports/phase-10.json`, `lib/account-billing-security.js`, `test-billing-security.js`
- **Tag:** `phase-10`

---

### Phase A6: Streak and Daily Goal
- **Gate Status:** PASS (`node test-streak-goals.js` — 10/10 passed)
- **Components:**
  - `lib/streak-goal-engine.js`: Timezone-aware daily goal completion tracking
  - Handles timezone boundaries across UTC, IST (+5:30), EST (-5:00)
  - 1 monthly streak freeze preserving streaks during unexpected absences
  - Ethical UX with opt-out reminder controls and zero guilt messaging
- **Tag:** `phase-a6`

---

### Phase A7: Mock Test Mode
- **Gate Status:** PASS (`node test-mock-test.js` — 9/9 passed)
- **Components:**
  - `lib/mock-test-engine.js`: Assembles 10, 20, or 30-question tests from cached quizzes and Exam Mode
  - Strict exam condition: hints and ELI5 disabled during assessment
  - Diagnostic weak-topics report with direct links back to syllabus units
  - Automatic injection of missed questions into SM-2 spaced repetition queue (A2)
- **Tag:** `phase-a7`

---

### Phase A8: Referral Engine
- **Gate Status:** PASS (`node test-referral.js` — 9/9 passed)
- **Components:**
  - `lib/referral-engine.js`: Bilateral 50 bonus page reward on referee first PDF upload
  - Strict 500 bonus page monthly cap per user
  - Anti-fraud security: blocks self-referrals and duplicate device hardware fingerprints
  - Automated monthly bonus page expiration and audit logging
- **Tag:** `phase-a8`

---

### Phase 11: AI Quality, Prompt Tuning and Cost Calibration
- **Gate Status:** PASS (`node scripts/gate.js 11`)
- **Measured Metrics:**
  - `eval_pdf_count`: 20 real academic PDFs evaluated across STEM domains
  - `schema_pass_rate`: 100% (>= 95% threshold)
  - `excerpt_match_rate`: 100% exact lexical matches in source text
  - `cost_per_300p_book_inr`: ₹40.10 (well within ₹69/mo Plus subscription with 42% gross margin)
- **Artifacts:** `docs/EVAL.md`, `cost-dashboard.html`, `prompts/v1/`, `prompts/v2/`, `reports/phase-11.json`
- **Tag:** `phase-11`

---

### Phase 12: Deployment and Reliability
- **Gate Status:** PASS (`node scripts/gate.js 12`)
- **Measured Metrics:**
  - `ci_green`: 1 (100% passing syntax checks and unit tests)
  - `staging_e2e_passes`: 1 (simulated auth, upload, pipeline, and render)
  - `load_test_success_rate`: 100% (1,000 / 1,000 requests successful at 100 concurrent VUs, 0% error rate vs <1% threshold)
  - `load_test_p95_ms`: 101ms
- **Artifacts:** `ecosystem.config.js`, `tests/load/k6-load-test.js`, `test-deployment-reliability.js`, `docs/DEPLOYMENT.md`, `reports/phase-12.json`
- **Tag:** `phase-12`

---

### Phase A10: PWA and Low-Data Mode
- **Gate Status:** PASS (`node test-pwa-offline.js` — 12/12 passed)
- **Components:**
  - `public/manifest.json`: W3C PWA manifest with standalone display, app shortcuts, and icons
  - `public/sw.js`: Service worker with partitioned app shell and generated lesson caches; strictly enforces never-cache-PDF rule
  - `lib/pwa-low-data-engine.js`: Low-data mode toggle disabling 3D WebGL scenes, halting prefetching, and forcing 2D lite theme
  - Subscription lapse cache eviction: purges cached lesson JSON on subscription lapse or logout
  - Offline banner notification
- **Tag:** `phase-a10`

---

### Phase 13: Private Beta, Launch and Growth
- **Status:** PASS (`node test-beta-launch-growth.js` — 12/12 unit tests passed)
- **Components:**
  - `lib/feedback-widget.js`: In-app feedback collection across 5 categories with 1-5 star ratings
  - `lib/telemetry-analytics.js`: Privacy-preserving telemetry tracking all 5 key lifecycle events (`upload`, `unit_ready`, `topic_completed`, `mode_opened`, `theme_chosen`) with PII sanitization
  - `lib/share-card-generator.js`: SVG viral share cards, OpenGraph/Twitter card metadata, and AR `<model-viewer>` integration
  - Human items documented in `docs/BLOCKERS.md` (50 private beta users and native reviewers)
- **Tag:** `phase-13-ready`


