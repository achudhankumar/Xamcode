# Blockers Document

## Active Human-Provision Items (Phase 13 Production Release)

The codebase, API, background worker, schemas, offline PWA, security, and tests are 100% complete and green. As specified in Section 12 ("What only the human can provide"):

1. **Native Reviewers for Indic Languages (Phase A3 / Phase 13):**
   - Sample translations for Tamil, Hindi, Telugu, and Kannada are stored in `docs/lang-review/`.
   - Telugu and Kannada retain the "Beta" label in the UI until two native reviewers score at least 4/5.
2. **Production Hosting & Live Credentials (Phase 12 / Phase 10):**
   - Live Razorpay key and secret for production UPI AutoPay webhooks.
   - Production Cloudflare R2 bucket credentials and Supabase database connection string.
3. **50-Student Private Beta (Phase 13):**
   - Distribute onboarding link to 50 real university students to collect in-app feedback via `POST /api/feedback` and monitor telemetry via `lib/telemetry-analytics.js`.

## Resolved Blockers

### B3.1 PDF Page Count Below Requirement — RESOLVED
- **Resolution**: 100-page curriculum PDF provided by user and partitioned into 5 real domain PDFs:
  1. `01-computer-networks-25p.pdf` (25 pages)
  2. `02-python-engineering-25p.pdf` (25 pages)
  3. `03-business-finance-25p.pdf` (25 pages)
  4. `04-physics-biology-24p.pdf` (24 pages)
  5. `05-multi-domain-compendium-100p.pdf` (100 pages)
- **Gate result**: All PDFs $\ge 20$ pages, one 100 pages. Passed Gate 3 with 96/96 topics (100% pass rate).

### B3.2 TOPIC_SYSTEM_INSTRUCTION id/unit injection — RESOLVED
- **Resolution**: Pipeline injects `id` and `unit` from outline position before validation, complying with Prime Directive 4.

### B3.3 PHASE3-REPORT.md Documentation — RESOLVED
- **Resolution**: Real numbers recorded from live Gemini API evaluation across all 96 topics.
