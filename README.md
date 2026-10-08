# XAMCODE AI

## Project status (paused)

| Area | State |
|---|---|
| Vaathiyar quiz content | **15/29 topics** complete |
| Provider failover | Gemini → Groq → OpenRouter, working live |
| Tests | 532 passing across 3 suites |
| Git / Render deploy | Not started |

**Vaathiyar topics still to write (14):**
`hierarchical`, `congestion`, `transport-services`, `tcp-segment`, `tcp-handshake`,
`tcp-window`, `tcp-congestion`, `udp`, `dns`, `www-http`, `ftp`, `smtp`, `telnet`, `rtp`

**Not yet built:** roadmap / future-updates section, intro VFX & motion pass, client walkthrough.

Each Vaathiyar topic needs all 16 sub-modes (`crash`, `crashExplain`, `compare`,
`compareExplain`, `solve`, `solveExplain`, `life`, `lifeExplain`, `history`,
`historyExplain`, `flash`, `flashExplain`, `exam`, `examExplain`, `eli5`,
`eli5Explain`). `npm run test:content` enforces this and fails the build on a
malformed topic, so no partial topic can ship. It also prints current coverage.

Run everything with `npm test`. This includes `test:diagrams` (layout variety, canvas bounds and edge integrity for the diagram engine), `test:journey` (the processing-journey arena scene driven against a stub DOM, including that a failed run tears it down), `test:allowance` (the daily-allowance refusal reaches the user in the server's own words, with the panel and the scene both settling correctly) and `test:smoke` (boots the real server and asserts the journey and diagram assets are actually served). `test-pdf-allowance.js` is deliberately **not** in the chain: it reaches the cap by spending the caller's whole daily allowance, so it must be run by hand on a day you are willing to spend.

---

XAMCODE includes a sample Computer Networks course and a Gemini-powered PDF study workflow. The AI workflow uses Google's Interactions API through a small Node.js server, so the Gemini API key never goes into browser code. The default model is `gemini-3.8-flash` (override with `GEMINI_MODEL` in `.env`). The site opens in its Bubblegum glass theme, ships four Gen-Z themes with light/dark modes, and theme changes remain saved in the browser.

> **AI quota note:** free-tier keys are capped at 20 requests per day **per model**, and that cap is per project, not per person. XAMCODE therefore rotates across every model in `GEMINI_MODELS`; each entry is a separate 20/day bucket, so the list is what makes capacity large. When a model's cap is hit the API returns `429` and XAMCODE rotates to the next one. For real traffic, enable billing on the Google Cloud project that owns the key.
>
> **Daily allowance per user:** `PDF_GENERATIONS_PER_DAY` (default `5`) caps how many PDFs one caller may generate per day, so a single user cannot drain the shared pool and lock everyone else out. The upload dialog shows the caller's remaining count. Set it to `0` to disable the cap.
>
> **What that cap cannot do:** it is keyed on **client IP address, not on an account**. Accounts in `js/auth.js` are stored in browser `localStorage` with no server-side check, so a user id sent by a browser can be edited in devtools and cannot be trusted to police a limit. The IP address is at least something the caller cannot choose for itself, and it is persisted only as a salted SHA-256 digest. The trade-off is that everyone behind one NAT or campus network shares a single allowance. Real per-account quotas need a server-side account system, which this project does not have.

> **Provider failover:** text requests (AURA, `/api/ask`) walk the pool Gemini → Groq → OpenRouter → Experiential Labs, moving on when a provider returns 429/5xx or the network drops. Add a key to `.env` and restart; no code change needed. Check `GET /api/providers` to see what was picked up (it never returns key values).
>
> **PDF analysis:** runs on the document-capable providers only, in order — Gemini first, then Experiential Labs if a key is configured. Groq and OpenRouter stay text-only on purpose: routing a PDF to a model that cannot read it returns a fluent but fabricated study pack. Keeping Gemini first also means the gateway only spends credits when Gemini is out of quota.
>
> **Experiential Labs:** an OpenAI-compatible gateway over roughly 1,000 models (`EXPLABS_API_KEY`, `EXPLABS_MODEL`). It is **credit-based, not a free tier** — platform-funded calls draw down a balance, and BYOK calls are billed by that provider. `EXPLABS_MODEL` must be a catalog slug that accepts PDF/file input, otherwise a PDF upload returns HTTP 400; browse the catalog at `platform.experientiallabs.ai/models`. With no key set the provider is simply absent from the pool and nothing changes.

> **Groq model note:** `llama-3.3-70b-versatile` was decommissioned by Groq and now returns 404. The default is `openai/gpt-oss-120b`. Verify availability for your own key with `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`.

## Run locally

1. Create a Gemini API key in Google AI Studio.
2. Copy `.env.example` to `.env` and replace the placeholder with your key. Never put the key in HTML, JavaScript, or a committed file. Set `GEMINI_MODEL` to a model enabled for your API key if your account has different model access.
3. Start the server from this folder: `node server.js`
4. Open `http://127.0.0.1:4173`.

> **Do not use VS Code Live Server (or any static preview such as port 5500).** A static preview cannot serve `/api/health` or `/api/analyze` and triggers the "health check HTTP 404" error. Only `node server.js` on port 4173 is the XAMCODE AI server.

The project uses Node.js 20 or newer and has no npm dependencies. The server loads the local `.env` file without serving it to browsers.

The upload flow checks `/api/health` before sending a PDF. A healthy server identifies itself as `xamcode-ai` with API version `1`. If that check fails or upload reports HTTP 405, the browser may be connected to a stale server or a static preview instead of this Node server. Check the owner of port 4173 in PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId, CommandLine
```

Only stop the listener after confirming its command line points to this XAMCODE `server.js` process: `Stop-Process -Id <PID>`. Then run `node server.js` from `C:\Xamcode`, open `http://127.0.0.1:4173`, and retry. Closing or restarting a terminal does not necessarily stop a Node process that is still listening.

Without `GEMINI_API_KEY`, the static sample course works, while PDF analysis and AI Q&A return a clear configuration error.

## AI study workflow

- Upload or drag in a readable PDF up to 20 MB, preview the selected file, and choose an explanation level. The centered progress panel reports local PDF preparation and actual network-transfer percentages, then switches to an indeterminate status with elapsed time while the AI analyzes the document.
- **Processing journey.** While the PDF is being prepared, a whiteboard-style battle plays out in the panel: a cyan hero opens seated at a desk in the middle of a field of white stick figures, then stands, raises a staff and works through the field as the real milestones land — one figure per server stage, so the number of bodies on the floor *is* the percentage, and the horizon lights up to the same place. The hero is the only cyan figure and the scene keeps its own palette rather than borrowing the theme's accent, so he never dissolves into the crowd and the arena looks the same in every theme. The crystal at the right only rises and charges once the returned study has passed validation, so the scene can never reach its finale in a workspace that is not genuinely ready. A failed run tears the scene down and shows the real error, including the daily-allowance refusal. The scene is `aria-hidden` and the existing `role="progressbar"` carries the accessible value, and `prefers-reduced-motion` replaces every animation with a static readable pose.
- **Async analysis jobs.** `POST /api/analyze` returns `202` with a `jobId` in a few milliseconds instead of holding one request open for the whole build. The server then emits real stage events — reading, lessons, CheatCodes, questions, validation — which `GET /api/analyze/:id` reports, and `DELETE /api/analyze/:id` cancels. The progress panel and the processing journey are driven by those events, so the scene is no longer an elapsed-time guess. Cancelling or abandoning a run stops the server at its next stage boundary, so a run that nobody is waiting for can no longer keep spending quota in the background. Jobs live in memory, expire after 15 minutes, and release the decoded PDF as soon as they settle.
- Gemini builds a subject-neutral course plan for each PDF, organized into units, topics, and individual concept lessons with learning goals. The plan is checked so every generated lesson belongs to exactly one topic.
- Every concept opens as its own lesson page, using the sample teaching method: PDF excerpt and page reference, key points, an animated and accessible 2D diagram sequence, side-by-side comparison, worked problem, real-life connections, source-grounded origin story, lesson flashcards, exam practice, and simple-to-advanced explanations. Related questions appear alongside each lesson.
- **Topic-specific diagrams.** The diagram archetype is chosen in the browser from the concept's own text rather than trusted from the model, so a lesson cannot render as another lesson's picture. Keyword hints pick a semantically fitting shape (a "stack" draws as layers, a "repeat" as a cycle, "versus" as a comparison) and an FNV-1a hash of the concept text breaks ties, which guarantees variety while keeping a given concept stable across re-renders. Ten archetypes — flow, cycle, hierarchy, compare, layers, stack, stepchain, timeline, tree and matrix — each draw different chrome, so the pictures differ structurally and not just in their labels.
- **Mermaid for structured shapes.** Four diagram types the custom engine cannot express — sequence diagrams, state machines, entity relationships and class structure — are upgraded to Mermaid (MIT). Mermaid is lazy-loaded from a CDN only when a concept actually needs one of those shapes, so the common case never pays for it. The upgrade is strictly additive: each slot renders the bespoke SVG first and Mermaid replaces it only on success, with a nine-second timeout, so a blocked CDN, an offline machine or a parse error leaves a correct diagram on screen. Labels are sanitised before they reach the parser, and the syntax is built from the concept's own node labels so the picture stays grounded in the PDF.
- The study space also includes a full practice page, relevant formulas, flashcards, and follow-up AI Q&A.
- Open each generated unit, topic, and concept from the study plan or course outline. Ask follow-up questions against the generated study pack.
- The server does not write uploaded PDFs or study packs to disk. Study content and chat remain in browser memory and are cleared when the page is refreshed.
- PDFs are sent to the configured Gemini API for analysis. Review Google's current API terms and data handling before uploading confidential documents.
- Study requests ask Gemini not to retain Interaction objects (`store: false`); the PDF is still processed by Google, so review the provider's current terms and controls before sending sensitive documents.
- Transient provider and connection failures are retried with bounded backoff. Incomplete or malformed study output receives one schema-constrained retry. If an API response is still unreadable, the dialog displays the HTTP status and request reference so the matching server log can be found. The health check and upload error also distinguish an incompatible or stale local server from an AI-provider failure.
- To keep generation consistent and reduce truncation, AI studies are capped at 4 to 6 concepts, 2 visual scenes per concept, and 8 practice questions and flashcards.

The local server binds to `127.0.0.1`. The included Render configuration binds to the platform interface, honors Render's forwarded client address for rate limiting, and limits each client address to 12 combined AI requests per hour in one process. This in-memory cap resets when the free service restarts or sleeps and is not a substitute for account-based quotas on a high-traffic public service.

## Deploy to Render

The project includes [`render.yaml`](./render.yaml) for a free Render web service. Render runs the existing Node server directly, so the 20 MB PDF flow does not pass through a serverless request-body limit.

1. Push this project to a private or public GitHub repository and connect that repository in the Render dashboard as a Blueprint.
2. When Render prompts for `GEMINI_API_KEY`, enter the key as a secret in the Render dashboard. Do not add `.env` or the key to GitHub. Confirm the service's environment variables include `NODE_ENV`, `HOST`, `GEMINI_MODEL`, `MAX_REQUESTS_PER_HOUR`, and `TRUST_PROXY`.
3. Deploy, wait for the `/` health check, then test one PDF upload and one follow-up question on the generated `onrender.com` site. Review Render and Google AI Studio usage limits before sharing the URL.

This workspace is not connected to a Git repository or hosting account, so a public deployment cannot be created from here. The free Render service may sleep while idle; its in-memory request limit resets when it restarts and is not durable abuse protection. Protect the Gemini project's usage/quota in AI Studio, review API usage after launch, and add sign-in with persistent per-user quotas before promoting an unrestricted AI endpoint.

Vercel is not the selected host because this app sends PDFs up to 20 MB (about 27 MB when base64 encoded) to its backend; serverless request-size limits require redesigning the upload flow before a Vercel migration. Note that Google's Gemini API caps an inline-data request at 20 MB, so PDFs above roughly 14 MB may be rejected by the provider; raising that ceiling requires switching to the Gemini Files API. Neon is not needed for the current browser-only study experience, but a production account system and durable usage quotas would need persistent storage and authorization.
