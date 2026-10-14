# XamCode AI — Local Setup

Step-by-step setup for a working local environment. No build step, no
database, no `npm install` needed — the server uses only Node.js builtins.

## 1. Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 9+ (ships with Node) | `npm --version` |
| A Gemini API key | free tier works | https://aistudio.google.com |
| Git | any recent | `git --version` |

Optional: Groq / OpenRouter / Experiential Labs keys for AI failover.
Optional: `BIP_ADMIN_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `BIP_INGEST_TOKEN`
for the Build-in-Public integrations (local dev works without them).

## 2. Clone and configure

```bash
git clone https://github.com/achudhankumar/Xamcode.git
cd Xamcode
cp .env.example .env        # then edit .env
```

Put at least your key in `.env`:

```
GEMINI_API_KEY=paste-your-key-here
```

Every variable is documented with safe placeholders in `.env.example`.
Required for AI features: `GEMINI_API_KEY`. Everything else has working
defaults (`PORT=4173`, 5 PDF generations/day). The BIP block at the bottom
of `.env.example` is optional — unset integrations report
"not configured" honestly instead of pretending to be live.

To generate a local BIP admin token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Run

```bash
npm start                   # or: node server.js
```

Open `http://127.0.0.1:4173` for the study app and
`http://127.0.0.1:4173/build` for the public Build-in-Public dashboard.

The server binds `127.0.0.1` locally. In production (`NODE_ENV=production`)
it binds `0.0.0.0` — see `docs/DEPLOYMENT.md`.

## 4. Verify it works

```bash
npm run check               # syntax-check server.js + all bip/*.js
npm test                    # full offline unit suite (no keys, no quota)
```

Then in the browser:

1. `GET /api/health` returns `{ ok: true, service: "xamcode-ai", ... }`.
2. `GET /api/providers` shows your key count and ready models.
3. `GET /api/bip/summary` returns the dashboard payload (progress 56
   on a fresh store, empty activity/ideas/chat).
4. Upload a small PDF in the study app — a job runs through the
   queued → extract → outline → sections → bank → validate → ready stages.

To run the live end-to-end test (spends one real Gemini generation):

```bash
npm run test:e2e
```

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `0 of N models ready` on `/api/quota` | Key hit its daily cap — every model on that key 429s at once. Add independent keys (`GEMINI_API_KEY_2`, …) or wait for reset. |
| HTTP 429 `DAILY_LIMIT_REACHED` on PDF upload | Used all `PDF_GENERATIONS_PER_DAY` (default 5). Raise it in `.env` or wait for the daily window. |
| `/build` shows "integration not configured" | Expected without `GITHUB_WEBHOOK_SECRET` / `BIP_INGEST_TOKEN`. Set them to go live (see `docs/BUILD-IN-PUBLIC.md`). |
| `BIP_DATA_DIR` permission errors | Point it at a writable dir; tests use temp dirs automatically. |
| Port already in use | Change `PORT` in `.env`. Smoke tests use scratch ports (4199+) and are unaffected. |
| `npm test` hangs on Windows PowerShell | Run suites individually (`npm run test:bip`, …) to isolate; see `docs/TESTING.md`. |

## 6. What not to commit

`.env`, `bip-data/`, quota files (`.xamcode-quota*.json`), image/training
caches, `*.log`, and scratch probe files are all in `.gitignore`. Never
paste a real key into `.env.example` — it is committed; `.env` is not.
