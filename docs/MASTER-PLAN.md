# XamCode AI – Master Build Plan

| ☐ |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |

Oct 23, 2026 · @Achudhan

## 1. What we are building and what is blocking it

XamCode turns an uploaded study PDF into a visual, topic-by-topic course with animated lessons, cheat sheets, 8 Vaathiyar modes, quizzes and an AI tutor (AURA). The demo works because it was hand-made; six problems stand between it and a product that real users pay for.

| # | Problem | Root cause | Fix (section) |
| --- | --- | --- | --- |
| 1 | Uploaded PDFs do not produce the demo structure | One large free-form AI call, no enforced output schema | Strict JSON schema per step + validator (3) |
| 2 | Visuals are always two boxes and two arrows | One generic renderer; AI is never asked to choose a visual type | Subject Packs + visual registry + richness check (4) |
| 3 | A 300-page PDF takes about 15 minutes | Sequential calls, huge prompts, everything generated up front | Unit 1 in about 2 minutes, rest in background, modes on demand (3) |
| 4 | Plan to pool many free API keys for 1000 users | Breaks provider terms, one ban stops every user | Provider router, caching, per-user caps, paid API once revenue starts (5) |
| 5 | Paid library that users cannot download or share | No storage or access design yet | Private storage, signed URLs, subscription lock (6) |
| 6 | Dark theme does not suit the product | Not designed for a premium look | Light 3D design direction (7) |

Build order matters: fix reliability (1, 3) before visuals (2), visuals before payments (4, 5), and payments before the redesign (6).

## 2. Architecture and free-first stack

Keep the existing Node.js server as the API, but move state out of JSON files into Postgres and move generation into a separate always-on worker, because background work cannot live inside a sleeping free web service.

| Part | Choice | Why | Cost note (verify current limits) |
| --- | --- | --- | --- |
| Frontend | React or Next.js, React Three Fiber, GSAP | 3D landing plus fast flat workspace | Free on Cloudflare Pages or Vercel |
| API | Existing Node server, grown into modules | Reuse what works | Free host while small |
| Database, auth, realtime | Supabase (Postgres, Google login, Realtime) | One service for users, jobs, progress push | Free tier, paid when you pass limits |
| PDF storage | Cloudflare R2, private bucket | No download fees, signed URLs | About 10 GB free, then cents per GB |
| Worker | Node process that pulls jobs from a Postgres `jobs` table | Runs generation in background | Oracle Cloud Always Free VM, or a small paid host once revenue starts |
| AI | Provider router: Gemini Flash-class first, Groq and OpenRouter as fallback | No single point of failure | Free for beta, paid tier at launch (section 5) |
| Payments | Razorpay Subscriptions with UPI AutoPay | Monthly Rs 69 plan | About 2 percent per payment plus GST handling |
| Monitoring | Sentry, PostHog | Errors and usage | Free tiers |

### Data model (Postgres)

- `users`: id, email, plan, plan\_expires\_at
- `documents`: id, user\_id, pdf\_hash, r2\_key, pages, subject, status
- `units`: document\_id, idx, title, page\_start, page\_end, status (pending, generating, ready, failed)
- `topics`: unit\_id, idx, title, json (lesson, visual, cheatcode, quiz), visual\_type, validated
- `mode_cache`: topic\_id, mode (one of 8), json
- `jobs`: type, payload, priority, status, attempts, error, run\_after
- `usage`: user\_id, month, pages\_used, pdfs\_used, tokens\_used
- `subscriptions`: user\_id, razorpay\_id, status, current\_period\_end

Turn on row-level security so a user can only read rows that carry their own user\_id.

## 3. Background generation: Unit 1 in about 2 minutes

Target: the student reads Unit 1 within 2 minutes of upload while Units 2 to N finish silently in the background, even if the tab is closed. Times below are targets to measure, not promises.

1. **Upload (under 10 s).** Save the PDF to private storage, compute its SHA-256. If this user already processed the same hash, reuse the result instantly.
2. **Extract text per page (5 to 20 s).** Use pdf.js. If a page has almost no text, send that page to OCR (Tesseract) inside the worker.
3. **Outline call (15 to 30 s).** One fast, cheap model call that sees only headings and the first lines of each page, not the full text. It returns units, topics and page ranges. Show the Topic Tree immediately; every topic starts as "preparing".
4. **Queue jobs.** One job per topic. Unit 1 jobs get high priority, all others low.
5. **Generate Unit 1 in parallel (60 to 90 s).** Run 4 to 5 topic jobs at once. Each job sends only that topic's 3 to 6 pages and asks for one schema-bound JSON: lesson, key points, PDF excerpt with page number, visual plan, cheat sheet, 4 to 5 quiz questions.
6. **Unlock Unit 1.** The browser listens on Supabase Realtime, so the unit flips from "preparing" to "ready" without refresh.
7. **Units 2 to N in background.** Worker keeps 3 to 5 jobs running within provider rate limits, with retry and exponential backoff. Jobs are resumable: a crash never restarts the whole book.
8. **Vaathiyar modes on demand.** Do not pre-generate 8 modes for every topic. Generate a mode when the student opens it, cache it, and prefetch only Crash Lesson and Flashcards for the topic they are reading.
9. **Validate every result.** Check the JSON schema, string-match the PDF excerpt against the real page text, check visual parameters are in range and the scene is rich enough (section 4). One retry with the error message, then the fallback provider, then a generic visual. Never block the whole unit for one bad topic.
10. **Tell the student.** Show per-unit progress in the app and send an email or notification when everything is ready.

Why it takes 15 minutes today: calls run one after another, prompts carry too many pages, and all 8 modes are generated up front. Steps 5 to 8 remove each of these.

## 4. Subject Packs and the visual system

Visuals are always two boxes and arrows because the AI is never asked what kind of visual fits. The fix: the AI chooses from a fixed menu of visual types and fills in parameters, and your own renderers draw them. The AI never draws pixels or writes SVG.

### How a topic gets its visual

1. The student picks a subject before upload. That loads the Subject Pack.
2. Planner step: the AI reads the topic and returns `visual.type` from the allowed list for that subject, plus a one-line reason.
3. Fill step: the AI returns parameters and 4 to 8 steps with captions, as JSON that matches that type's schema.
4. Richness check in code: reject any scene with fewer than 3 distinct elements, fewer than 4 steps, or no captions. Retry once with "make it richer", then fall back to a better generic type.
5. The renderer animates the scene. Same renderer, new values, works for any PDF in that subject.

Example scene (sliding window):

```json
{
  "type": "sliding_window",
  "protocol": "go_back_n",
  "window_size": 4,
  "total_frames": 10,
  "steps": [
    {"action": "send", "frames": [0,1,2,3], "caption": "Sender transmits a full window"},
    {"action": "ack", "frame": 0, "caption": "ACK 0 slides the window right"},
    {"action": "lost", "frame": 2, "caption": "Frame 2 is lost, receiver discards later frames"}
  ]
}
```

### Generic visual library (build these first, they cover most subjects)

`process_flow`, `timeline`, `hierarchy_tree`, `cycle`, `concept_map`, `matrix_2x2`, `comparison_visual`, `chart` (data taken from the PDF only), `equation_steps`, `formula_slider`, `state_machine`, `code_trace`, `labeled_diagram` (a figure cropped from the PDF page with clickable hotspots).

### Subject Packs

Each pack is one file holding: the subject prompt (tone, terms, what a good explanation looks like), the allowed visual types, the layout emphasis, and the quiz style.

| Subject | Layout emphasis | Subject-specific visuals |
| --- | --- | --- |
| Computer Networks | Protocol steps, packet animation | `topology`, `packet_flow`, `sliding_window`, `hamming`, `collision_timeline`, `osi_encapsulation` |
| Programming (Python, Java) | Code panel with step-through variables | `code_trace`, `memory_stack_heap`, `flowchart` |
| SQL | Table before and after each step | `join_tables`, `query_steps` |
| Civil and Mechanical | Formula, worked example, diagram | `beam_load`, `truss`, `free_body`, `gear_train`, `pv_diagram` |
| Finance and MBA | Chart plus case study | `chart`, `cashflow_timeline`, `matrix_2x2`, `formula_slider` |
| Nursing and Medical | Labeled figure, mnemonic, clinical case | `labeled_diagram`, `process_flow`, `timeline` |
| Arts and Humanities | Timeline, concept map, key quotes | `timeline`, `concept_map`, `comparison_visual` |

Start with two packs (Computer Networks, Python) and make them excellent before adding any other.

### Rules that protect trust

- A chart may only use numbers that appear in the PDF. Mark anything the AI estimated as "AI estimate", or leave it out.
- Label History and Real-Life content as "Extra knowledge, not from your PDF" so the PDF-grounded promise of AURA stays honest.
- AR is a later phase and only for 3D objects (engine, heart, gearbox). Use Google model-viewer with glTF models; do 2D well first.

## 5. Quotas, the Rs 69 plan, and API cost for 1000 users

Do not pool many free API keys to serve paying users. Free quotas are per project, and creating many accounts or projects to multiply them goes against provider terms, so one ban can take the product down for everyone. Free tiers may also use submitted data to improve the provider's models, which is not acceptable for students' uploaded books once you charge money.

### Plan

1. **Beta (up to about 50 users):** free tier, with a clear note in the terms that content is processed by a third-party AI provider.
2. **Launch:** switch to the provider's paid pay-as-you-go tier on a cheap fast model (Gemini Flash-Lite class). Subscription revenue pays for it.
3. **Provider router:** ordered list of providers, a rate limiter per provider, and a circuit breaker that skips a provider after repeated errors. Groq and OpenRouter are fallbacks for outages, not a way to multiply free quota.
4. **Measure first:** log input tokens, output tokens and rupees for every job. Within the first beta week you will know the real cost of one 300-page book. A rough estimate is Rs 5 to Rs 15 per book on a Flash-Lite class model, but check current pricing and use your own logs.

### Cost controls (all cheap to build)

- Cache by PDF hash so a re-upload costs nothing.
- Page cap per PDF (suggest 300 pages) and file cap (suggest 30 MB).
- Generate the 8 modes lazily (section 3).
- A monthly token budget per user, and a global daily spending cap that pauses new jobs.
- Retry at most once per step.

### Quota model (needs your decision)

Your message could mean two things for the paid plan, so this is my assumption, not a fact: Free is 5 PDFs per month, and Rs 69 per month unlocks the library plus a larger allowance. Counting PDFs is risky because a 20-page and a 300-page PDF cost very different amounts, so count pages instead.

|  | Free | Plus (Rs 69 per month) |
| --- | --- | --- |
| PDFs per month | 5 | Unlimited uploads within page budget |
| Pages per month | 300 | 1,000 |
| Library access to saved courses | Only while within free usage | Yes, while subscribed |
| Extra pages | Not available | Top-up packs |

Sanity check: if one 300-page book costs Rs 10, then 1,000 pages cost about Rs 33 in AI, which leaves a thin but positive margin after payment fees and tax on Rs 69. If your measured cost is higher, reduce pages or raise the price. Ask an accountant about GST on subscriptions.

If the subscription lapses, saved courses become locked (not deleted) for 60 days, then deleted. Say this in the terms and show it in the account page.

## 6. Library security, legal and privacy

You can make downloading hard and sharing risky, but you cannot stop screenshots or screen recording. Design for deterrence, not perfection.

### What to build

- Private storage bucket with no public URLs. The app hands out signed URLs that expire in 5 minutes and only for the owner's own files.
- Do not offer the original PDF for download. Lessons render from the generated JSON, so the PDF is rarely needed after processing.
- Google login through Supabase Auth, with row-level security on every table.
- A faint watermark with the user's email inside the workspace, a limit on simultaneous sessions, and rate limits on the API.
- Subscription check on every library request, not only at login.
- Upload limits: 30 MB, 300 pages, PDF only, per-IP and per-user rate limits.

### Protect the AI step

Text inside a PDF may contain instructions aimed at the AI. Treat PDF text strictly as data, give the model no tools, and rely on the schema validator and excerpt check so injected text cannot change the app's behaviour.

### Legal and privacy (get a lawyer to review before charging money)

- Students will upload textbooks they may not own. The terms must say the user confirms they have the right to use the file, that content is private to their account, and that you remove content on request.
- Do not share generated courses between users at first. A shared cache for identical books saves money but raises copyright questions; revisit with legal advice.
- India's Digital Personal Data Protection Act applies: a privacy policy, clear consent, account and data deletion, and honest disclosure of the AI providers you use.
- Keep a takedown contact email on the site.

## 7. New design: light, premium, 3D where it earns its place

Study award-winning sites to learn techniques and quality, then build an original identity. Copying one site's layout, illustrations or 3D assets is a copyright and trade-dress risk, and an exact clone also would not carry your brand. Your own Build-in-Public themes are the exception: reusing them is the plan (section 10, Phase 9), and that five-theme system replaces the single light theme described below.

### Direction

- Light theme: warm off-white background, near-black ink text, the XamCode orange as the single strong accent, and one soft colour per subject (Networks blue, Finance green, Medical red).
- 3D objects that change with the subject: floating network nodes, a molecule, gears, chart bars. They tilt toward the cursor and respond to scroll.
- 3D lives only where it helps: landing hero, subject picker (3D cards), the upload moment (the PDF breaks into floating unit cards), and unit-complete celebrations.
- The study workspace stays flat, calm and fast. Students spend hours there; heavy 3D would hurt reading and battery.

### Tools (free)

React Three Fiber with drei, GSAP ScrollTrigger, Lenis smooth scroll, Spline for quick scenes, glTF models compressed with Draco.

### Performance budget (many users have mid-range Android phones on 4G)

- Largest content paint under 2.5 seconds on 4G.
- Hero 3D under 3 MB, lazy-loaded, with a static image fallback.
- Detect weak GPUs (drei PerformanceMonitor) and respect reduced-motion settings; fall back to a flat design automatically.
- Keyboard access and readable contrast everywhere.

### Screens

Landing, pricing, subject picker, upload with live progress, library, course workspace, topic page with Visual, CheatCode and Vaathiyar tabs, account and billing.

## 8. Roadmap with a done-test for each phase

Weeks assume one person working with an AI coding agent. Do not start a phase until the previous done-test passes.

| Phase | Weeks | Deliverable | Done when |
| --- | --- | --- | --- |
| 0 Foundations | 1 | Supabase project, schema, login, private R2 bucket; sample course moved into the database | The sample course renders from stored JSON |
| 1 Reliable generation | 2 to 3 | Text extraction, outline call, schema-bound topic call, validator, job table | 5 different PDFs produce a valid topic tree and at least 90 percent of topics pass validation |
| 2 Background pipeline | 4 | Parallel Unit 1, background units, realtime progress, resumable jobs | A 300-page PDF shows Unit 1 within 2 minutes and finishes in the background; killing the worker mid-run loses nothing |
| 3 Visual system | 5 to 7 | 13 generic renderers, Computer Networks and Python packs, richness check | No topic renders with fewer than 3 elements; 20 sampled topics each rated 4 out of 5 or better by you |
| 4 Modes and quiz | 8 | Lazy 8 modes with cache, source labels, quiz explanations | Every mode opens in under 10 seconds and re-opens instantly |
| 5 Accounts and money | 9 to 10 | Quotas, Razorpay subscription, library lock, signed URLs, usage and cost logging | A test payment unlocks the library; cancelling locks it; a user cannot read another user's files |
| 6 New design | 11 to 12 | Light 3D landing, subject picker, flat workspace, performance budget | Meets the budget on a mid-range Android phone |
| 7 Private beta | 13 to 14 | 50 real students, feedback loop | Measured cost per PDF is below your price assumption; top 10 bugs fixed |
| 8 Public launch and growth | 15 onward | More Subject Packs, AR for a few topics, spaced repetition, AURA improvements | Add one subject at a time, only after it passes the Phase 3 test |

## 9. Prompts to paste into Antigravity, in order

Put this whole document in the repo as `docs/MASTER-PLAN.md` first. Give the agent one prompt at a time, and do not move on until its tests pass. Section 10 is the newer, complete 13-phase version; where the two differ, follow section 10. Replace anything in angle brackets.

### Prompt 0: rules file

```text
Create AGENTS.md at the repo root. Rules: read docs/MASTER-PLAN.md before every task; implement only the phase I name; keep the stack free-first; never hard-code API keys; every AI output must pass a JSON schema validator; write tests for each module and run them; after each task list what changed and what is still open.
```

### Prompt 1: audit

```text
Read the whole repo and docs/MASTER-PLAN.md. Produce docs/AUDIT.md: (1) how a PDF upload becomes lessons today, file by file; (2) where the sample course data lives and its exact JSON shape; (3) why uploaded PDFs do not match that shape; (4) which parts are reusable and which must be rewritten. Do not change any code yet.
```

### Prompt 2: schema and storage (Phase 0)

```text
Implement Phase 0 of docs/MASTER-PLAN.md. Create the Supabase SQL migration for the tables in section 2 with row-level security so users only access rows with their own user_id. Add Google login. Add a private Cloudflare R2 bucket client that issues signed URLs expiring in 5 minutes. Write a script that loads the sample Computer Networks course into the topics table. Done when the sample course renders from the database.
```

### Prompt 3: reliable generation (Phase 1)

```text
Implement Phase 1. From the sample course, derive JSON schemas for: outline, topic (lesson, key_points, pdf_excerpt with page, visual, cheatcode, quiz), and each of the 8 Vaathiyar modes. Build: per-page text extraction with pdf.js; the outline call using headings and first lines only; the topic call using only that topic's pages with structured JSON output enforced by the model's response schema; a validator that checks the schema, string-matches pdf_excerpt against the page text, and retries once with the error message. Test with 5 different PDFs and report the validation pass rate.
```

### Prompt 4: background pipeline (Phase 2)

```text
Implement Phase 2. Add a jobs table and a separate worker process that claims jobs with FOR UPDATE SKIP LOCKED. Flow: upload, outline, queue one job per topic, Unit 1 jobs high priority and run 4 at a time, other units low priority and run 3 at a time, per-provider rate limiting, retry with exponential backoff, resumable after a crash. Push unit status to the browser with Supabase Realtime and show progress in the Topic Tree. Measure and report time to Unit 1 for a 300-page PDF.
```

### Prompt 5: visual system (Phase 3)

```text
Implement Phase 3. Build a visual registry: each visual type has a JSON schema and a renderer component. First build topology, packet_flow, sliding_window, hamming, process_flow, timeline, comparison_visual and chart. Add the planner step (AI picks visual.type from the subject pack's allowed list), the fill step, and the richness check (at least 3 distinct elements, 4 steps, captions on every step; retry once, then fall back to a generic type). The AI must never output SVG or code. Add Subject Packs as files in /subjects with prompt, allowed visuals, layout and quiz style; create computer-networks and python. Show me 20 generated topics for review.
```

### Prompt 6: modes and trust labels (Phase 4)

```text
Implement Phase 4. Generate each Vaathiyar mode only when opened, cache it in mode_cache, prefetch Crash Lesson and Flashcards for the current topic. Charts may use only numbers found in the PDF, otherwise show an AI estimate label. Label History and Real-Life content as extra knowledge, not from the PDF. Rename the quiz panel to Practice Quiz and fix the check and cross icons.
```

### Prompt 7: accounts and payments (Phase 5)

```text
Implement Phase 5. Page-based quotas (free 300 pages per month, Plus 1000), usage logging with tokens and rupee cost per job, a global daily spend cap that pauses new jobs, Razorpay Subscriptions with UPI AutoPay at Rs 69 per month with webhook verification, a library that locks (not deletes) on lapse and deletes after 60 days, and a provider router with circuit breaker. Add tests proving a user cannot read another user's files or documents.
```

### Prompt 8: design (Phase 6)

```text
Implement Phase 6. Create an original light design system: warm off-white background, near-black text, XamCode orange accent, one soft colour per subject. Build the landing page with a 3D hero using React Three Fiber and GSAP ScrollTrigger, a 3D subject picker, and an upload animation. Keep the study workspace flat and fast. Meet the performance budget in section 7, add a static fallback for weak GPUs and reduced-motion, and report Lighthouse results for mobile.
```

### After each prompt

Run the tests yourself, open the app, and check the phase's done-test in section 8. If the agent drifts, paste back the relevant section of this document and say "follow this exactly".

## 10. Full 13-phase master prompt for Antigravity

This replaces the phase numbers in sections 8 and 9. Paste the master header once at the start of every new Antigravity session, then paste one phase at a time. Do not start the next phase until the current one's done-test passes, and run `git tag phase-N` after each.

Your Build-in-Public page already holds five finished themes (Vibe Coding Studio, Bubblegum Playground, Liquid Glass 3D, Neo-Brutalist Creative Lab and Soft Minimal Studio). Phase 9 ports those into the main app, so the main app's current look is replaced and the themes stay shared between both pages. Phase 9 can move up to right after Phase 5 if you want the new look sooner, but not earlier, because the visuals must be built on theme tokens first. Audit finding (docs/AUDIT.md): uploads fail mainly because the hand-made sample course and AI-generated courses use two different data shapes and two different render paths. So run Phase 3 before Phase 2, and make Phase 3 unify them.

### Master header (paste first, every session)

```text
You are building XamCode AI. Read docs/MASTER-PLAN.md fully before any task.
Product: the user picks a subject, uploads a PDF, and gets visual unit-by-unit lessons (animated visuals, CheatCode, 8 Vaathiyar modes, quiz, AURA tutor). Free-first stack: Node server, Supabase, Cloudflare R2, Gemini with fallback providers.
Rules:
1. Work only on the phase I name.
2. Never commit secrets. All keys come from env. Keep .env.example updated.
3. Every AI output must pass a JSON schema validator. The AI never outputs HTML, SVG or UI code.
4. Keep npm run check and npm test green. Add tests for every new module.
5. The Build-in-Public dashboard (/build, bip/, build-parts/) must keep working. build.html is generated by build-parts/concat.js, so never edit build.html directly.
6. Use one git branch per phase. End every task with: what changed, how to run it, what is still open.
7. If a requirement is unclear, choose the simplest option, state the assumption, and continue.
```

### Phase 1: audit and safety net

```text
PHASE 1. Create branch phase-1-audit and tag the current main as pre-rebuild. Read the whole repo. Write docs/AUDIT.md covering: (a) how a PDF upload becomes lessons today, file by file; (b) where the sample course data lives and its exact JSON shape for every tab (Visual steps, CheatCode, each of the 8 Vaathiyar modes, quiz); (c) why uploaded PDFs do not produce that shape; (d) what is reusable and what must be rewritten; (e) a catalogue of the five Build-in-Public themes: names, CSS variables, fonts, 3D libraries, and the build-parts files that hold them. Run npm run check and npm test and record the results. Change no code.
DONE WHEN: AUDIT.md exists, tests are recorded, the pre-rebuild tag exists.
```

### Phase 2: foundations

```text
PHASE 2. Create Supabase SQL migrations for the tables in section 2 (users, documents, units, topics, mode_cache, jobs, usage, subscriptions) with row-level security so users only access rows with their own user_id. Add Google login. Add a private Cloudflare R2 client that issues signed URLs expiring in 5 minutes. Validate env vars at boot. Write a seed script that loads the sample Computer Networks course into topics.
DONE WHEN: the sample course renders from the database for a logged-in user, and an automated test proves a second user cannot read it.
```

### Phase 3: reliable generation

```text
PHASE 3. From the sample course, derive JSON schemas for: outline, topic (lesson, key_points, pdf_excerpt with page, visual, cheatcode, quiz) and each of the 8 Vaathiyar modes. Build: per-page text extraction with pdf.js (flag pages with almost no text for OCR); the outline call using headings and first lines only; the topic call using only that topic's pages with the model's structured-output response schema; a validator that checks schema, string-matches pdf_excerpt against the page text, and checks quiz answers point to a real option; one retry with the error message; a provider router interface with Gemini plus one fallback provider. Add golden tests with fixture PDFs. Also unify rendering: the hand-made sample course (js/data-topics.js, data-cheatcodes.js, data-vaathiyar.js, data-visuals.js) and AI-generated courses must use the same JSON shape and the same render path. Convert the sample data to the new schema, remove the separate aiStudyView, and keep the in-memory job store until Phase 4. The AI must not generate raw SVG.
DONE WHEN: 5 different PDFs produce valid topic trees and at least 90 percent of topics pass validation. Report the pass rate per PDF, and show one uploaded course rendering in the same layout as the sample course. Tests that use a mock model or generated fixture PDFs do not count toward this: run it with 5 real PDFs of 20 or more pages and the real model, and report real failures instead of adjusting the mock to pass.
```

### Phase 4: background pipeline

```text
PHASE 4. The upload endpoint returns immediately. Add a jobs table and a separate worker process claiming jobs with FOR UPDATE SKIP LOCKED. Flow: store PDF, extract, outline, queue one job per topic. Unit 1 jobs are high priority and run 4 at a time; other units are low priority and run 3 at a time. Add per-provider rate limiting, retry with exponential backoff, and resumable jobs. Push unit status to the browser with Supabase Realtime and show Preparing, Ready or Failed per unit in the Topic Tree. Log the time to Unit 1 and total time for every document.
DONE WHEN: a 300-page PDF shows Unit 1 within 2 minutes (report the real number), the rest finish in the background, and killing the worker mid-run then restarting it loses no completed work.
```

### Phase 5: visual system core

```text
PHASE 5. Build a visual registry. Each visual type has a JSON schema and a renderer component with a step controller (play, pause, next, previous) and a caption per step. Build 13 generic renderers: process_flow, timeline, hierarchy_tree, cycle, concept_map, matrix_2x2, comparison_visual, chart (numbers from the PDF only), equation_steps, formula_slider, state_machine, code_trace, labeled_diagram. Add the planner step (the AI picks visual.type from the subject pack's allowed list), the fill step, and the richness check (at least 3 distinct elements, at least 4 steps, a caption on every step; retry once, then fall back to a generic type). All colours, fonts and spacing in renderers must come from CSS variables so they work in every theme. Add a /dev/visuals page that shows every renderer with fixture JSON.
DONE WHEN: every renderer passes unit tests with fixture scenes and the gallery page shows them all.
```

### Phase 6: Subject Packs

```text
PHASE 6. Create /subjects with one file per Subject Pack, each exporting: id, name, system prompt (tone, terms, what a good explanation looks like), allowed visual types, layout emphasis, quiz style. Build two packs. computer-networks: add renderers topology (bus, ring, star, mesh, with link count shown), packet_flow (simplex, half duplex, full duplex), sliding_window (go-back-N and selective repeat), hamming (clickable bits, parity updates), collision_timeline (ALOHA, CSMA/CD), osi_encapsulation, bit_flip. python: add code_trace (step through lines with a variables panel), memory_stack_heap, flowchart. Add a subject picker before upload and pass the chosen pack into the pipeline.
DONE WHEN: I can generate 20 topics from one PDF per pack and view them on a gallery page, and every one passes the richness check.
```

### Phase 7: modes, CheatCode and quiz

```text
PHASE 7. Generate each of the 8 Vaathiyar modes (Crash Lesson, Compare, Solve Problem, Real-Life, History, Flashcards, Exam Mode, ELI5 to Engg) only when the student opens it. Cache in mode_cache and prefetch Crash Lesson and Flashcards for the current topic. Rules: charts and Compare tables may only use facts and numbers found in the PDF, otherwise label them AI estimate; History and Real-Life content carries a label Extra knowledge, not from your PDF. Solve Problem must draw the actual diagram (a full mesh with every link drawn, not a row of dots). Quiz: 4 to 5 questions with hint, why correct, why each wrong option is wrong, and the PDF page. Rename the quiz panel to Practice Quiz. Replace the broken check and cross glyphs with inline SVG icons. Fix the sample-page issue where the title overlaps the top bar.
DONE WHEN: each mode opens in under 10 seconds the first time and instantly the second time, and the label rules are enforced by tests.
```

### Phase 8: AURA grounded tutor

```text
PHASE 8. Split each document's pages into chunks of about 500 to 800 tokens, create embeddings with the Gemini embedding model, and store them in Supabase pgvector (use keyword search as a fallback). AURA answers only from the top retrieved chunks and cites page numbers. If the answer is not in the PDF it says so and labels any extra explanation as outside knowledge. AURA may answer with a visual by returning a scene JSON that passes the Phase 5 validator. Add per-user rate limits.
DONE WHEN: on 20 test questions at least 90 percent cite the correct page, and questions outside the PDF are clearly labelled.
```

### Phase 9: theme system ported from Build-in-Public

```text
PHASE 9. Goal: replace the main app's current look with the five-theme system from my Build-in-Public page. These themes are my own work, so copy them faithfully, including CSS and 3D elements. The five themes, as shown in the Choose Your Website Experience dialog at https://xamcode-ai.onrender.com/build, are: 01 Vibe Coding Studio (dark, asymmetric, 3D tesseract), 02 Bubblegum Playground (pastel, 3D clay spheres), 03 Liquid Glass 3D (frosted glass, prisms), 04 Neo-Brutalist Creative Lab (3px borders, acid yellow, 3D monolith), 05 Soft Minimal Studio (warm alabaster, serif, hairline grids, 3D armillary). Use these names exactly. The choice is currently saved in localStorage.
1. Using docs/AUDIT.md, extract each theme from build-parts into shared/themes/<name>/ with: tokens.css (CSS variables for colour, type, spacing, radius, shadow, motion), scene.js for 3D where the theme has it (lazy-loaded), and theme.json (name, description, cost: light or heavy).
2. Make both /build and the main app load themes from shared/themes so a change appears in both. Keep the build-parts pipeline and its tests working. In section 06 of the page the text 56% Readiness Weight appears in the static HTML; make sure it is filled from /api/bip/summary, otherwise it contradicts the nothing-fabricated promise.
3. Add a theme switcher in the top bar. Save the choice in localStorage and in the user profile.
4. Each theme keeps its own 3D scene, loaded lazily only while that theme is active (never load the other four). Soft Minimal Studio is the battery-friendly choice for phones, but it still has a 3D armillary, so give every scene a lite mode: pixel ratio capped at 1.5, 30 fps cap, rendering paused when the tab is hidden or the canvas is off screen, no continuous animation after load unless the user interacts, and a static image fallback. Soft Minimal Studio in lite mode must be the lowest-power option, with system or light fonts, no blur and small shadows.
5. Recommend Soft Minimal Studio to phone users: when the pointer is coarse, or deviceMemory is 4 or less, or hardwareConcurrency is 4 or less, or Save-Data is on, or the user prefers reduced motion, show a dismissible one-time banner (Battery saver: Soft Minimal Studio recommended). Never force it. Use navigator.getBattery only when available and never depend on it.
6. Rebuild these screens on the new system: landing, subject picker, upload with live progress, library, workspace, topic page with Visual, CheatCode and Vaathiyar tabs, account. Our subjects and content stay; only the design and experience are replaced. Delete the old UI only after npm run test:smoke passes on the new screens.
7. Every Phase 5 renderer must read colours from tokens and look correct in all five themes. Save screenshots of each theme on 3 key screens in docs/theme-screens/.
8. Any heavy theme falls back to Soft Minimal Studio in lite mode automatically if the frame rate stays under 30 fps for 3 seconds.
DONE WHEN: all five themes switch live on every screen without a reload, Lighthouse mobile reports for Soft Minimal Studio and Vibe Coding Studio are attached, and the Build-in-Public tests (test-bip-render, test-bip-security) still pass.
```

### Phase 10: accounts, quotas, payments, security

```text
PHASE 10. Page-based quotas (Free 300 pages per month, Plus 1000; read the final numbers from a config file). Log tokens and rupee cost per job. Add a global daily spend cap that pauses new jobs. Add Razorpay Subscriptions with UPI AutoPay at Rs 69 per month, with webhook signature verification. The library locks (not deletes) when a subscription lapses and deletes after 60 days. Security: signed URLs only, no original-PDF download route, a faint watermark with the user's email in the workspace, limits on simultaneous sessions, upload limits (30 MB, 300 pages, PDF only), per-IP and per-user rate limits, and treat PDF text strictly as data. Scaffold terms, privacy and takedown pages with placeholders for legal text, plus account deletion and data export.
DONE WHEN: a test payment unlocks the library, cancelling locks it, quotas block the 301st page, and tests prove a user cannot read another user's files.
```

### Phase 11: AI quality and cost (what training means here)

```text
PHASE 11. We do not train a model. We measure, tune prompts and re-measure. Build an eval set of 20 PDFs across the subject packs. Write a script that runs the full pipeline on each and scores: schema pass rate, excerpt match rate, visual richness, time to Unit 1, tokens and rupee cost. Keep prompts in prompts/v1, prompts/v2 and so on, add a few best hand-checked outputs as examples inside the prompts, and add a command that compares two prompt versions on the same PDFs. Add a cost dashboard page for me.
DONE WHEN: schema pass rate is at least 95 percent, I know the real rupee cost of one 300-page book, and the report is saved in docs/EVAL.md.
```

### Phase 12: deploy and reliability

```text
PHASE 12. Set up staging and production: frontend on Cloudflare Pages or Vercel, API on the chosen host, the worker as an always-on process (systemd or pm2 on an Oracle Always Free VM, or a small paid host). Add CI that runs npm run check and npm test. Add Sentry, health checks, database backups, a rollback document, and a k6 load test with 100 concurrent users covering login, upload and job processing. Update docs/DEPLOYMENT.md.
DONE WHEN: an end-to-end run passes on staging and the load-test report is saved.
```

### Phase 13: private beta, launch and growth

```text
PHASE 13. Add a feedback widget, analytics events (upload, unit ready, topic completed, mode opened, theme chosen), and automatic changelog entries on the Build-in-Public page from commits using the existing webhook. Add a short onboarding tour and share cards. After the 50-user beta, add new Subject Packs one at a time, each only after it passes the Phase 6 test. Then add AR with model-viewer for 2 to 3 topics and spaced repetition (SM-2) for flashcards.
DONE WHEN: 50 beta students have used it, the top 10 bugs are fixed, and the measured cost per user is below the price assumption.
```

### Your answers that change these prompts

- Which theme is the default on desktop (I assumed Vibe Coding Studio, since it is the active one now).
- The final free and paid quotas (see the comment in section 5).
- Which host runs the worker: Oracle free VM or a small paid server.

## 11. Add-on phases (A1 to A13), including Kannada

These extra features keep the 13 phases above unchanged; each add-on slots in at the point shown. Use the master header from section 10 before each prompt. The spaced repetition here replaces the SM-2 line at the end of Phase 13.

| Add-on | Insert after | Why there |
| --- | --- | --- |
| A1 Study Plan generator | Phase 7 | Needs units and topic lengths |
| A2 Spaced repetition and daily review | Phase 7 | Needs flashcards and quiz data |
| A3 Languages: English, Tamil, Hindi, Telugu, Kannada | Phase 8 | Needs schemas, modes and AURA stable |
| A4 Report a problem button | Phase 7 | Feeds the Phase 11 quality loop |
| A5 Photo upload | Phase 6 | Needs the extraction pipeline |
| A6 Streak and daily goal | Phase 10 | Needs accounts |
| A7 Mock test mode | Phase 10 | Needs accounts and usage |
| A8 Referral | Phase 10 | Needs quotas |
| A9 Text to speech | A3 | Needs languages |
| A10 PWA and low-data mode | Phase 12 | Needs a stable deployment |
| A11 Share clip of an animated lesson | After Phase 13 beta | Growth feature, heavy to build |
| A12 Teacher and class plan | After beta and legal review | Copyright questions |
| A13 YouTube or lecture-video input | After beta | Cost and copyright |

### A1: Study Plan generator

```text
A1. Add a study_plans table. After a course is ready, ask the student for: exam date (optional), minutes per day, and level (beginner, intermediate, advanced). Build the plan in plain code, not with AI: weight each unit by pages times a difficulty score (the outline call may return difficulty 1 to 5), split the available minutes across days in proportion to the weights, schedule revision on day 1, 3, 7 and 14 after each topic, add a weekly mock test slot, and give the last 20 percent of days to revision only. The default topic length is 15 minutes. Show the plan as a calendar with today's task highlighted and let the student reschedule missed days automatically.
DONE WHEN: a unit test covers plans for 7, 30 and 90 days; missing 3 days reschedules without overloading any single day (cap at 2x the daily minutes).
```

### A2: spaced repetition and daily review

```text
A2. Add srs_cards (user_id, topic_id, card json, ease, interval_days, due_at). Create cards from Flashcards mode and missed quiz questions. Implement SM-2 scheduling with Again, Hard, Good and Easy buttons. Add a Daily Review screen that shows due cards across all courses, capped at 20 per session with a Continue option.
DONE WHEN: tests prove SM-2 intervals for a sequence of ratings and a card due today appears in Daily Review.
```

### A3: languages (English, Tamil, Hindi, Telugu, Kannada)

```text
A3. Add a language setting (en, ta, hi, te, kn) stored in the user profile and shown in the top bar. Rules: JSON keys and schemas stay in English; only text values are generated in the chosen language. Keep technical terms in English with a short local explanation in brackets the first time. The PDF excerpt always stays in the original PDF language. Generate a topic's text in the chosen language on demand, cache by (topic_id, mode, language), and never regenerate the visual structure, only the captions and labels. Add a style option for casual mode (Tanglish-style romanised mixing for Tamil, and the same idea for the other languages) used only by Crash Lesson and ELI5. Fonts: load Noto Sans Tamil, Devanagari, Telugu or Kannada only for the chosen script, with font-display: swap; in lite mode use system fonts with the lang attribute set; check line-height so Indic scripts do not clip. If the uploaded PDF is in an Indian language, enable OCR language packs (tam, hin, tel, kan) and test with one sample each. Mark Telugu and Kannada as Beta until reviewed.
DONE WHEN: I can switch language mid-topic and every tab updates; 20 sample topics per language are saved in docs/lang-review/ for a native speaker to score, and the Beta label is removed only after two native reviewers score at least 4 out of 5.
```

### A4: report a problem button

```text
A4. Add a Report this button on every topic, visual, quiz question and AURA answer with reasons (wrong fact, confusing, visual broken, wrong language, other) and an optional note. Store in a reports table with the prompt version and model used. Add an admin page listing reports grouped by prompt version, and a command that adds reported topics to the Phase 11 eval set.
DONE WHEN: a report creates a row with the prompt version and the admin page filters by reason.
```

### A5: photo upload

```text
A5. Allow up to 20 photos (JPG, PNG, HEIC converted to JPG) of textbook pages to be uploaded as one document. Compress images in the browser to at most 1600 px on the long side, order them by the student, send them to the vision model for text extraction page by page, and feed the result into the same outline and topic pipeline. Count each photo as one page in the quota. Warn when the text is blurry or cropped.
DONE WHEN: 10 phone photos of a printed page produce a valid topic tree in the same format as a PDF.
```

### A6: streak and daily goal

```text
A6. Add a streaks table and a daily goal (default: one 15-minute topic). A day counts when the goal is met in the student's local time zone. Show the streak on the top bar and a gentle reminder card on the library page. Allow one streak freeze per month. No guilt messages and no dark patterns; the reminder can be switched off.
DONE WHEN: tests cover time zone boundaries, freeze use, and the streak resetting after a missed day.
```

### A7: mock test mode

```text
A7. Add a Mock Test button per unit and per course: choose question count (10, 20, 30) and a timer. Draw questions from existing quizzes and Exam Mode, mixing difficulty. No hints during the test. At the end show score, time per question, a weak-topics list with links back to those topics, and add missed questions to spaced repetition (A2). Never generate new questions at test time unless the pool has fewer than the chosen count; then generate lazily and cache.
DONE WHEN: a 20-question test runs offline from cached questions and the report lists weak topics correctly.
```

### A8: referral

```text
A8. Add referral codes. When a new user signs up with a code and uploads their first PDF, both users get 50 bonus pages for that month. Cap at 500 bonus pages per user per month, block self-referrals and repeated sign-ups from the same device or payment method, and log every grant.
DONE WHEN: tests cover the cap, self-referral blocking and bonus expiry.
```

### A9: text to speech

```text
A9. Add a Listen button for lessons, CheatCode and Crash Lesson using the browser's built-in speech synthesis, choosing a voice that matches the selected language (en, ta, hi, te, kn). If no matching voice exists on the device, hide the button for that language instead of reading it with the wrong voice. Highlight the sentence being read. No paid speech API.
DONE WHEN: Listen works in at least Chrome on Android for English, Tamil and Hindi, and is hidden gracefully for any language without a voice.
```

### A10: PWA and low-data mode

```text
A10. Make the app installable (manifest, icons, service worker). Cache the app shell and any lesson the student has opened as generated JSON only, never the original PDF. Add a Low-data toggle: it disables 3D scenes (forces the lite theme), turns off prefetching, and loads smaller images. The cache is cleared on logout and when the subscription lapses, and is checked against the subscription on every online visit. Add an offline banner.
DONE WHEN: Lighthouse PWA checks pass, an opened lesson works with airplane mode on, and a lapsed subscription removes cached lessons on next online visit.
```

### A11: share clip (after beta)

```text
A11. Add Share this lesson: record the animated visual (canvas or SVG) in the browser with MediaRecorder as a short vertical video (up to 30 seconds) with the XamCode watermark and the topic title. Never include PDF text beyond the topic title and key point. Offer download of the clip and a link to the landing page.
DONE WHEN: a clip generated on a mid-range Android phone plays in WhatsApp and Instagram.
```

### A12 and A13: later, only after beta and legal review

- **A12 Teacher and class plan:** a teacher uploads material and shares one course with a class code; students get read access only while the teacher's plan is active. Needs terms covering who owns the uploaded material.
- **A13 YouTube or lecture-video input:** take a transcript the user provides or a public captions track, then run the same outline and topic pipeline. Check platform terms and copyright before building this.

### Open decisions for these add-ons

- CheatCode export: default is no download, view-only with a watermark. Say if you want a watermarked image export for personal use.
- Which languages ship in the first release: I suggest English and Tamil first, then Hindi, then Telugu and Kannada as Beta once reviewers are found.
- Who reviews Kannada, Telugu and Hindi text. You can review Tamil yourself; the others need native speakers.

## 12. Autopilot: one prompt, all phases, with gates and a problem playbook

This section replaces pasting one phase at a time. The agent works through the phases in order, but it can only move on when a script it cannot edit says PASS. This exists because earlier runs reported success on failures (0 percent marked complete, 3-page PDFs counted as real, a mock counted as a model).

### Current state (start here)

Phase 1 audit is done. Phase 3 is NOT passed: the live eval must run on at least 5 real PDFs of 20 or more pages and reach a final pass rate of 90 percent or more. Start at the Phase 3 gate.

### What only the human can provide

The agent must never fake these. When one is missing it writes the exact request to docs/BLOCKERS.md, skips to the next phase that does not depend on it, and keeps going.

- Real PDFs in fixtures/real (5 or more, each 20 or more pages, one over 100 pages, different subjects).
- Keys and accounts: Gemini key with billing and a spend cap, Groq and OpenRouter keys, Supabase project, Cloudflare R2 bucket, Razorpay test keys.
- Native speakers to review Tamil, Hindi, Telugu and Kannada output (Beta label stays until they do).
- Legal review of terms and privacy pages, real beta users, final price and quota numbers.

### The paste prompt (the only thing you paste, once per session)

```text
You are the build agent for XamCode AI. Read docs/MASTER-PLAN.md completely, then run Section 12 (Autopilot) from the current state until you hit a BLOCKER that needs a human or a gate that fails five repair attempts. Re-read Section 12 and docs/PROGRESS.md at the start of every phase and whenever you are unsure what to do. Never write complete or a checkmark unless node scripts/gate.js <phase> printed PASS. Stop and report only when blocked or finished.
```

### Prime directives

1. Never run git restore, git clean, git reset, git checkout of files, or delete files without listing them first. Use git revert for a bad commit. Commit after every working step.
2. Gates decide, not you. Create scripts/gate.js and gates.json (thresholds below). Never change them. If a threshold looks wrong, write the reason to docs/BLOCKERS.md and continue elsewhere.
3. No mock counts as a result. Quality numbers must come from real model calls on real PDFs, with token counts taken from the provider response.
4. Code never invents content: no made-up quiz questions, steps, quotes or numbers. Fields the code already knows (ids, unit numbers, page ranges) are set by code, not requested from the model.
5. Make small edits. Never rewrite a whole file through a script, and never leave helper scripts in the repo.
6. Never weaken, skip or delete a test or a validator rule to get green.
7. Keep the Build-in-Public page working: build.html is generated by build-parts/concat.js; never edit build.html directly.
8. Secrets only in environment variables, never in flags, logs or commits.
9. Windows project (c:\\Xamcode): use path.join, handle CRLF line endings, and avoid shell-specific commands.

### Loop for every phase

1. Read the phase text (Section 10, plus add-ons in Section 11 where they are scheduled below).
2. Write the plan and what you will measure into docs/PROGRESS.md.
3. Implement in small steps; run npm run check and npm test after each; commit.
4. Produce reports/phase-N.json with the real measured numbers (the gate reads this file).
5. Run node scripts/gate.js N.
6. PASS: git tag phase-N, add the evidence (numbers, commands) to docs/PROGRESS.md, move on.
7. FAIL: find the symptom in the playbook below and apply the fix. Maximum 5 repair attempts per failing metric. After that, write docs/BLOCKERS.md with the evidence and stop; do not move on.
8. Phase report (15 lines at most): gate result, metrics, files changed, playbook entries used, blockers.

### Gates (gates.json)

| Phase | Report file | Pass conditions |
| --- | --- | --- |
| 3 Reliable generation | reports/phase-3.json | real\_model\_calls greater than 0 with provider token counts; at least 5 PDFs; every PDF 20 or more pages; first\_pass\_rate 0.70 or more; final\_pass\_rate 0.90 or more; api\_error\_share 0.10 or less (otherwise rerun later); npm test exit code 0 |
| 2 Foundations | reports/phase-2.json | migrations apply cleanly; a second user cannot read the first user's rows (test); signed URL expiry 300 seconds or less; sample course renders from the database |
| 4 Background pipeline | reports/phase-4.json | test PDF 200 or more pages; unit1\_ready\_seconds 120 or less; all units eventually ready; jobs lost after killing the worker equals 0 |
| 5 Visual core | reports/phase-5.json | 13 renderers each with tests; thin scenes (under 3 elements, under 4 steps or no captions) are rejected; /dev/visuals page builds |
| 6 Subject Packs | reports/phase-6.json | 2 packs; at least 40 topics generated from real PDFs; richness\_pass\_rate 0.95 or more; process\_flow fallback share 0.30 or less |
| 7 Modes and quiz | reports/phase-7.json | 8 modes implemented; first open p95 10 seconds or less; second open served from cache; label tests pass; icon bug fixed |
| 8 AURA | reports/phase-8.json | at least 20 test questions; correct page cited rate 0.90 or more; out-of-scope questions labelled 0.95 or more |
| 9 Theme system | reports/phase-9.json | 5 themes load from shared/themes; live switching without reload; at least 15 screenshots; Lighthouse mobile performance 80 or more for Soft Minimal Studio; BIP tests pass |
| 10 Accounts and money | reports/phase-10.json | test-mode payment unlocks the library; lapse locks it; quotas enforced; cross-user access tests pass |
| 11 AI quality | reports/phase-11.json | eval set of 20 or more PDFs; schema pass rate 0.95 or more; real rupee cost per 300-page book measured |
| 12 Deploy | reports/phase-12.json | CI green; staging end-to-end passes; load test error rate 0.01 or less |
| 13 Beta and launch | manual | cannot be gated by a script; needs real users |

Order to run: 3, 2, 4, 5, 6, A5, 7, A1, A2, A4, 8, A3, A9, 9, 10, A6, A7, A8, 11, 12, A10, 13. Add-on gates: their unit tests pass; A3 language quality also needs native reviewers, so those languages stay Beta.

After gate.js and gates.json are first created, the human marks them read-only and checks git diff on them after every phase. This is the only protection against an agent editing its own gate.

### Problem playbook: if you see this, do that

| Symptom | Do this |
| --- | --- |
| Every topic fails validation | Print raw model response and the exact validation errors for one topic. Classify. Missing fields the code knows: set them in code and remove them from the model schema. Array too short: state the exact count in the prompt, add minItems to the response schema where supported, then repair only the failing fields with a model call. Provider rejects the schema: simplify the schema and keep strict checks in Zod. |
| Pass rate suddenly worse than the last passing tag | git diff from that tag; find the change; fix it with a small edit or git revert that commit. Do not rewrite files. |
| 429 or quota errors | Count them separately from validation failures. Per-minute limit: wait and lower concurrency. Per-day limit: switch to the next allowed provider; if none is left, pause the run and write BLOCKERS.md saying quota resets at midnight Pacific time (about 12:30 pm IST until 1 November 2026, then 1:30 pm IST). Never create extra Google accounts or projects. |
| JSON cut off or invalid | Raise the output token limit, split one big call into one call per tab, and ask for fewer fields per call. |
| Model quote not found in the PDF page | Require copying a sentence from the provided text; compare with normalised whitespace; if it still fails, let code select a real sentence from that page. Never accept an invented quote. |
| Visuals mostly fall back to process\_flow | Improve the planner prompt and add the missing renderer. Do not widen the fallback. |
| Generation too slow | Run topics in parallel up to the provider limit, send only the topic's pages, cache by PDF hash, generate modes on demand, measure tokens per call. |
| Cost per book too high | Shorten output fields, generate the next unit just in time when the student is halfway through the current one, use the cheaper model for simple steps. Report the measured rupee cost. |
| Provider returns a different shape | Add a small adapter that normalises it before validation. Record which provider and model produced each result. |
| Tests fail after a change | Fix the code or revert the commit. Never edit the test to pass. |
| Stream error, timeout or network drop | Retry with backoff; resume from docs/PROGRESS.md; do not restart the phase. |
| A file went missing or was deleted | Stop, list what is missing from git status, and write BLOCKERS.md. Do not restore anything yourself. |
| You lose track of what to do | Re-read Section 12 and docs/PROGRESS.md; continue from the last PASS tag. |
| A step needs a human item | Write the exact request to docs/BLOCKERS.md with the steps for the human, then move to the next phase that does not depend on it. |
| Anything not listed here | Write the symptom, evidence and two options to docs/BLOCKERS.md and stop that phase. Do not guess. |

### Final report when finished or blocked

One table: phase, gate result, key numbers, open blockers. No celebratory text. A phase counts as done only if its gate printed PASS.
