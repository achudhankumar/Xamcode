# XamCode AI

Turn a boring lecture PDF into an interactive visual tutor: animated unit-by-unit lessons, AURA (the document-grounded AI tutor with diagram recipes), quiz + Vaathiyar modes, flashcards, a formula bank, and a personal library — all in the browser, powered by a zero-dependency Node.js server.

A public **Build-in-Public dashboard** lives at `/build`: weighted development progress, roadmap, changelog feed, ideas board with voting, community chat, launch countdown, and waitlist. Same server, same store, no separate database.

## Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (ships with Node)
- A Gemini API key (free tier works) — https://aistudio.google.com
- Optional: Groq / OpenRouter / Experiential Labs keys for failover

## Quick start (local)

```bash
git clone https://github.com/achudhankumar/Xamcode.git
cd Xamcode
cp .env.example .env        # then put your GEMINI_API_KEY in .env
npm start                   # serves the app on http://127.0.0.1:4173
```

Open `http://127.0.0.1:4173` for the study app, `http://127.0.0.1:4173/build` for the public dashboard.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the server (production bind when `NODE_ENV=production`, else localhost) |
| `npm run check` | Syntax-check `server.js` + all `bip/*.js` modules |
| `npm test` | Full offline unit suite (no API keys, no quota spent) |
| `npm run test:e2e` | Live E2E through the real pipeline — **spends one real Gemini generation** (manual only, not in CI) |
| `npm run test:smoke` | Journey smoke: serves the app, checks assets reach the browser |
| `npm run test:wiring` / `test:bunq` | AURA visual engine + studio-chrome wiring checks |
| Individual suites | `test:providers test:aura test:fidelity test:quiz test:content test:sections test:diagrams test:mermaid test:journey test:markup test:jobs test:jobs-http test:topics test:chunks test:render test:allowance test:bip test:bip-smoke` |

CI (`.github/workflows/ci.yml`) runs `npm ci` → `npm run check` → `npm test` on pushes/PRs to `main`.

## Environment

Copy `.env.example` to `.env`. Every variable is documented there with safe placeholders. The essentials:

- `GEMINI_API_KEY` (required) — extra keys via `GEMINI_API_KEY_2.._9` or `GEMINI_API_KEYS=a,b,c` multiply free quota
- `PORT` (default 4173), `NODE_ENV`, `PDF_GENERATIONS_PER_DAY` (default 5)
- Failover providers: `GROQ_*`, `OPENROUTER_*`, `EXPLABS_*`, `OPENAI_*` (+ `ENABLE_OPENAI_FAILOVER=1`)
- Build-in-Public (all server-only, optional for local dev): `BIP_ADMIN_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `BIP_INGEST_TOKEN`, `BIP_SESSION_SECRET`, `BIP_DATA_DIR`

Never commit `.env`. `bip-data/`, quota files, caches, and logs are git-ignored.

## Project structure

```
server.js              # zero-dependency HTTP server + PDF/AI pipeline
XamCode.html           # study app shell
js/ css/               # frontend
aura-visuals/          # AURA diagram engine
bip/                   # Build-in-Public backend (util, store, progress, events, community, admin, routes)
build.html             # Build-in-Public dashboard (vanilla HTML/CSS/JS)
bip-data/              # JSON store (git-ignored; tests use temp dirs)
test-*.js              # offline suites + manual live tests
.github/workflows/ci.yml
docs/                  # SETUP, TESTING, DEPLOYMENT, ARCHITECTURE, BUILD-IN-PUBLIC, ...
## Build pipeline (Build-in-Public dashboard)

`build.html` is assembled from source parts in `build-parts/` and is NOT edited directly.

| File / Step | Purpose |
| --- | --- |
| `build-parts/p01.txt` – `p13.txt` | Semantic parts of the HTML shell (head, CSS, sections, JS) |
| `build-parts/concat.js` | Joins the parts into `build.html`, reports duplicate IDs and missing IDs |
| `build-parts/syncheck.js` | Optional node syntax check for the assembled inline script |

Workflow:

```bash
# 1. edit the .txt parts (or keep build.new.html as the staged target)
# 2. rebuild
node build-parts/concat.js
# 3. syntax-check the inlined script
node build-parts/syncheck.js
# 4. validate render + security
node test-bip-render.js
node test-bip-security.js
```

The concat step blocks on `DUP_IDS` or `MISSING` reports before writing `build.html`.
Intermediate and generated files (`build.new.html`, `tmp-*.html`, `tmp-audit.js`,
`build.html`) are git-ignored; commit the `build-parts/` source parts instead.
```

## Docs

- `docs/SETUP.md` — step-by-step local setup + troubleshooting
- `docs/TESTING.md` — what each suite covers, how to run, what costs quota
- `docs/deployment.md` — Render deploy, env vars, rollback, domain/HTTPS
- `docs/architecture.md` — how the pieces fit
- `docs/BUILD-IN-PUBLIC.md` — dashboard design, API, webhook setup
- `docs/ROADMAP.md` — project roadmap & status tracker

