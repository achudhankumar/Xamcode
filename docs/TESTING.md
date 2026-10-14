# XamCode AI — Testing Guide

## 1. The two tiers

| Tier | Command | Cost | In CI? |
|---|---|---|---|
| Offline unit suite | `npm test` | Free, no keys, no network | Yes |
| Live / manual tests | `npm run test:e2e`, `test:smoke`, `node test-chunk-live.js`, `node test-pdf-allowance.js` | Real quota / ports / PDFs | No |

`npm test` chains 17 offline suites. Every one uses stubbed providers,
scratch quota files, or scratch `BIP_DATA_DIR`s — nothing in the chain
spends paid credits or a real Gemini generation.

## 2. Run the main suite

```bash
npm test
```

Expected (verified 2026-10-13): **42/42 passing** across the chain, ending
with the BIP suites. If any suite fails, the chain stops at that `&&` —
fix it before proceeding; do not delete or weaken the test.

## 3. Individual suites

```bash
npm run test:providers   # multi-key failover walk (stubbed)
npm run test:aura        # AURA diagram recipe + prompt shape
npm run test:fidelity    # subject-fidelity guard
npm run test:quiz        # quiz flow
npm run test:content     # Vaathiyar content rules
npm run test:sections    # study/plan/bank schemas
npm run test:diagrams    # diagram engine
npm run test:mermaid     # mermaid routing
npm run test:journey     # end-to-end journey (stubbed)
npm run test:markup      # markup structure
npm run test:jobs        # analyze job lifecycle (stubbed provider)
npm run test:jobs-http   # analyze HTTP surface
npm run test:topics      # topic image prompts
npm run test:chunks      # chunked unit builds
npm run test:render      # chunk rendering
npm run test:allowance   # daily allowance gate (exhausted-model path)
npm run test:bip         # BIP units: progress, HMAC, votes, waitlist, launch
npm run test:bip-smoke   # BIP HTTP smoke over a scratch server + data dir
npm run test:wiring      # AURA visual engine wiring
npm run test:bunq        # studio-chrome layer
npm run check            # node --check over server.js + all bip/*.js
```

`parallel-check.js` exists at the repo root but has **no package script** —
run it directly (`node parallel-check.js`) if you want it.

## 4. Live / manual tests (NOT in CI, NOT in `npm test`)

| Test | What it spends | Run |
|---|---|---|
| `npm run test:e2e` (`test-pdf-subject-e2e.js`) | **One real Gemini generation** | Manual only, when you accept the quota cost |
| `node test-chunk-live.js` | Real pipeline vs sample PDFs on port 4204 | Manual only |
| `node test-pdf-allowance.js` | Burns the caller's whole daily allowance by design | Manual only |
| `npm run test:smoke` (`test-journey-smoke.js`) | Boots the server on fixed port 4199 | Manual only |

These are excluded from `.github/workflows/ci.yml` deliberately. CI runs
`npm ci` → `npm run check` → `npm test` with no secrets and no network
dependency.

## 5. Unit results vs real-model E2E results

Passing `npm test` proves the code paths, validation rules, and API shapes
hold under stubs. It does **not** prove the live model returns good study
content — only `test:e2e` (real key, real PDF, real generation) shows that,
and its result is only valid for the key/quota/model that ran it. Report
the two separately: "42/42 unit, E2E passed on <date> against <model>".

## 6. BIP test isolation

`test-bip-units.js` (42 assertions) and `test-bip-smoke.js` point
`BIP_DATA_DIR` at temp dirs, so the real `bip-data/store.json` is never
touched. Fresh-store progress is **56** (verified weights 8+14+16+8+10 of
100) — if seed milestones change, update the assertion, don't fudge it.
