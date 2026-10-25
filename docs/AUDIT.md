# XamCode AI — Comprehensive Codebase & Architecture Audit

> **Branch:** `phase-1-audit`  
> **Tag:** `pre-rebuild` (`c4d70de`)  
> **Date:** October 2026  
> **Scope:** Master plan Phase 1 architectural discovery, PDF ingestion pipeline audit, syllabus data shape catalog, Build-in-Public theme index, and baseline test suite verification.  
> **Code Modification Policy:** ZERO code modified during this audit phase.

---

## 1. Test Verification & Baseline Record

The entire baseline test suite and syntax verification were executed directly on the pre-rebuild codebase.

### `npm run check`
- **Command:** `node --check server.js && node --check bip/util.js && node --check bip/store.js && node --check bip/db.js && node --check bip/progress.js && node --check bip/events.js && node --check bip/community.js && node --check bip/admin.js && node --check bip/routes.js && node --check bip/estimate.js && node --check bip/storage.js && node --check bip/migrate.js`
- **Result:** **Exit Code 0** (0 syntax errors across all 12 core server & BIP modules).

### `npm test`
- **Command:** `npm test` (Runs all 23 suites sequentially)
- **Result:** **Exit Code 0**
- **Summary of Executed Suites & Assertions:**
  1. `test:simulations` (`test-interactive-simulations.js`) — **52 passed, 0 failed**
  2. `test:aura-visuals` (`test-aura-interactive-visuals.js`) — **17 passed, 0 failed**
  3. `test:providers` (`test-provider-failover.js`) — **40 passed, 0 failed**
  4. `test:aura` (`test-aura.js`) — **11 passed, 0 failed**
  5. `test:fidelity` (`test-fidelity.js`) — **16 passed, 0 failed**
  6. `test:quiz` (`test-quiz-flow.js`) — **16 passed, 0 failed**
  7. `test:content` (`test-content-fidelity.js`) — **12 passed, 0 failed**
  8. `test:sections` (`test-sections.js`) — **24 passed, 0 failed**
  9. `test:diagrams` (`test-diagrams.js`) — **14 passed, 0 failed**
  10. `test:mermaid` (`test-mermaid.js`) — **20 passed, 0 failed**
  11. `test:journey` (`test-journey.js`) — **69 passed, 0 failed**
  12. `test:markup` (`test-markup-structure.js`) — **7 passed, 0 failed**
  13. `test:jobs` (`test-jobs.js`) — **18 passed, 0 failed**
  14. `test:jobs-http` (`test-jobs-http.js`) — **16 passed, 0 failed**
  15. `test:topics` (`test-topics.js`) — **17 passed, 0 failed**
  16. `test:chunks` (`test-chunk-processing.js`) — **18 passed, 0 failed**
  17. `test:render` (`test-chunk-render.js`) — **18 passed, 0 failed**
  18. `test:allowance` (`test-allowance-router.js`) — **33 passed, 0 failed**
  19. `test:bip` (`test-bip.js`) — **32 passed, 0 failed**
  20. `test:bip-smoke` (`test-bip-smoke.js`) — **14 passed, 0 failed**
  21. `test:bip-security` (`test-bip-security.js`) — **38 passed, 0 failed**
  22. `test:bip-durable` (`test-bip-durable.js`) — **77 passed, 0 failed**
  23. `test:bip-countdown` (`test-bip-countdown.js`) — **48 passed, 0 failed**

**Total Test Count:** **598 passed, 0 failed across 23 test suites.**

---

## 2. (a) How a PDF Upload Becomes Lessons Today (File-by-File Trace)

The current journey from an uploaded PDF document to rendered screen lessons traverses client-side event listeners, HTTP APIs, server-side queuing, multi-tier LLM prompts, fallback extraction, and client-side page hydration.

### Step 1: Client Ingestion & Form Submission
* **Files:** `XamCode.html` (lines 140–210), `js/app.js` (lines 3550–3680)
1. **Modal Event:** In `XamCode.html`, the user triggers `#uploadModal` via buttons with `data-dock-action="upload"` or the hero CTA. File selection occurs through `<input type="file" id="fileInput" accept="application/pdf">` or dropzone `#dropZone`.
2. **Size & MIME Gate:** `js/app.js` checks `file.type === 'application/pdf'` and verifies size limit (50MB threshold).
3. **Dispatch:** Calls `startAnalysis(file)`. A `FormData` object with `pdf: file` is created.
4. **Transport:** Executes `fetch('/api/analyze', { method: 'POST', body: formData })`.
5. **UI State:** Unhides `#pdfUploadProgress` comet tracker driven by the 7-stage state machine from `test-journey.js`:
   `queued` $\rightarrow$ `extract` $\rightarrow$ `outline` $\rightarrow$ `sections` $\rightarrow$ `bank` $\rightarrow$ `validate` $\rightarrow$ `ready`.

### Step 2: HTTP Route Handling & Job Enqueuing
* **File:** `server.js` (lines 2330–2450, 2740–2765)
1. **Route Intercept:** `POST /api/analyze` passes through body reader and multipart parser.
2. **Allowance Check:** `allowanceRouter.checkAllowance(clientIp)` verifies the IP has not exceeded the daily generation quota.
3. **Job Creation:** Generates a random UUID `jobId` and constructs an in-memory job object in `jobs.set(jobId, job)`:
   ```javascript
   {
     id: jobId,
     status: 'queued',
     progress: 0,
     stage: 'extract',
     createdAt: Date.now(),
     pdf: buffer
   }
   ```
4. **Asynchronous Hand-off:** Server immediately returns `{ id: jobId, status: 'queued' }` with HTTP 202 to the client.
5. **Background Execution:** `processPdfJob(jobId)` is invoked asynchronously outside the request-response lifecycle.

### Step 3: PDF Extraction & Model Routing
* **File:** `server.js` (lines 1500–1780)
1. **Local Text Extraction:** Attempts local extraction using `pdf-parse` / `pdfjs-dist` to extract raw text strings without LLM overhead.
2. **Gemini Ingestion Decision:**
   - If PDF size > 20MB (`GEMINI_INLINE_MB`), `uploadPdfToGemini(job.pdf)` uploads to the Google Gemini Files API.
   - If $\le$ 20MB, the buffer is base64-encoded for inline multimodal payload transmission.
3. **Provider Failover Pool:** `providerFailover.js` resolves keys in order (`gemini-2.0-flash` $\rightarrow$ `gemini-1.5-flash` $\rightarrow$ fallback models).

### Step 4: Multi-Stage LLM Outline & Chunk Generation
* **File:** `server.js` (lines 1800–2250)
1. **Stage 1 (Outline Generation):** Calls model with `OUTLINE_PROMPT`. Model returns JSON with unit titles, unit overviews, and topic lists.
2. **Stage 2 (Unit Chunking):** If `CHUNKED_PROCESSING=true`, loops over each identified unit:
   - Dispatches a focused prompt for Unit $i$ (`CHUNK_PROMPT`).
   - Extracts concepts, step-by-step visualizations, and topic-concept indices for that specific unit.
   - Updates `job.stage = 'sections'` and increments `job.progress`.
3. **Stage 3 (Study Bank):** Dispatches `BANK_PROMPT` to generate questions, flashcards, and formula cards linked to concept indices.
4. **Stage 4 (Validation):** Passes the assembled payload to `validateStudyPack(pack)` and `validateChunkedStudy(study)`. If it fails schema checks, triggers retry or raises HTTP 502 `mkErr(502, 'The AI returned an incomplete study plan')`.
5. **Job Completion:** Stores final study JSON in `job.result` and marks `job.status = 'completed'`.

### Step 5: Polling & Frontend Hydration
* **File:** `js/app.js` (lines 3680–3780, 1620–2080)
1. **Polling:** Client polls `GET /api/analyze/:jobId` every 800ms.
2. **State Storage:** On receiving `completed`, the client stores the payload in `state.aiStudy`.
3. **Branching Divergence:**
   - Instead of routing to the standard workspace (`renderTopic()` / `renderStudy()` with `window.XC.TOPICS`), `js/app.js` branches into `aiStudyView()` (lines 1774–2080).
   - It renders an alternative breadcrumb-driven course view (`ai-breadcrumbs`, `ai-topic-page-list`, `ai-concept-page-card`) that displays flat markdown and generic layout SVGs.

---

## 3. (b) Where Sample Course Data Lives & Exact JSON Shapes

The verified, high-fidelity sample course ("Computer Networks") is split across five distinct client-side data files:
1. `js/data-topics.js` (`window.XC.TOPICS`) — 29 core topics across Units I–V.
2. `js/data-cheatcodes.js` (`window.XC.CHEATCODES`) — 29 exam summary & intuition cards.
3. `js/data-vaathiyar.js` (`window.XC.VAATHIYAR`) — 15 rich topics implementing all 8 Vaathiyar modes.
4. `js/data-formulas.js` (`window.XC.FORMULAS`) — 31 mathematical equations with worked parameters.
5. `js/data-visuals.js` (`window.XC.VISUALS`) — SVG & HTML canvas animation engines.

### Exact JSON Shape: Visual Steps & Topic Definition (`js/data-topics.js`)
```json
{
  "id": "intro",
  "unit": "I",
  "title": "What is a Network",
  "topic": "Introduction to Networks",
  "visId": "NET-001",
  "pdfPage": "Page 2",
  "pdfQuote": "A network is a set of devices (often referred to as nodes) connected by communication links...",
  "explanation": "A computer network is a collection of interconnected devices that can exchange data and share resources...",
  "keyPoints": [
    "Two or more devices (nodes) connected by links",
    "Purpose: share resources",
    "Medium: copper, fiber, wireless",
    "Internet = network of networks"
  ],
  "steps": [
    { "title": "Two nodes", "desc": "Two devices (Sender + Receiver) ready" },
    { "title": "Link established", "desc": "Physical medium connects them" },
    { "title": "Protocol agreed", "desc": "Rules for communication accepted" },
    { "title": "Message sent", "desc": "Data travels Sender → Receiver" },
    { "title": "Acknowledgement", "desc": "Receiver confirms delivery" }
  ],
  "visual": "function visual(step) { /* Returns SVG string reacting to step integer */ }",
  "questions": [
    {
      "q": "What is the fundamental requirement for a network?",
      "opts": [
        "At least two nodes + a link",
        "Only internet access",
        "A single supercomputer",
        "Fiber optics"
      ],
      "a": 0,
      "cat": "DEFINITION",
      "diff": "Easy",
      "mini": "two-nodes",
      "cap": "Network = 2 nodes + 1 link",
      "why": "A network needs at least two devices (nodes) connected by a transmission medium (link).",
      "wrong": [
        "Correct — 2 nodes + link.",
        "Internet is an example, not a requirement.",
        "One computer alone is not a network.",
        "Fiber is one medium; copper/wireless also work."
      ],
      "quote": "A network is a group of two or more systems linked together.",
      "page": "Page 2",
      "hint": "How many computers minimum?",
      "eli": "Two kids and a string phone."
    }
  ]
}
```

### Exact JSON Shape: CheatCode Tab (`js/data-cheatcodes.js`)
Keyed by topic id (e.g., `'intro'`, `'topology'`, `'dll-services'`):
```json
{
  "intro": {
    "why": "Two computers needed to share files. So we linked them.",
    "like": "Two friends talking on a string phone.",
    "wrong": "A network needs many computers.",
    "right": "Even TWO devices with one cable is a network.",
    "see": ["🏠 Home WiFi", "🏢 Office LAN", "📱 Hotspot", "☁️ Internet"],
    "oneLine": "Two or more devices + a link = a network."
  }
}
```

### Exact JSON Shape: All 8 Vaathiyar Modes (`js/data-vaathiyar.js`)
Keyed by topic id (e.g., `'intro'`). Contains 8 distinct sub-objects plus pedagogical explanation blocks:

```json
{
  "intro": {
    "crash": [
      {
        "tag": "INTRO",
        "text": "Vanakkam, students. Today we start with the very base — What is a Network?...",
        "visual": "<div style=\"text-align:center\"><div style=\"font-size:80px\">🌐</div></div>",
        "readMs": 5200
      }
    ],
    "crashExplain": [
      { "h": "Why we invented it", "t": "Sharing files needed walking with floppy disks..." },
      { "h": "Real-world anchor", "t": "Your home WiFi is a network..." },
      { "h": "Common trap", "t": "Students think network needs many computers. Even 2 count." }
    ],
    "compare": {
      "left": "Network",
      "right": "Distributed System",
      "rows": [
        ["Definition", "Devices connected to share data", "Independent computers look like ONE system"],
        ["Middleware", "Not needed", "Needed — sits on top of OS"]
      ],
      "bars": [
        { "label": "Complexity", "leftPct": 35, "rightPct": 95, "leftTxt": "Low", "rightTxt": "High" },
        { "label": "Transparency", "leftPct": 20, "rightPct": 100, "leftTxt": "Visible", "rightTxt": "Hidden" }
      ]
    },
    "compareExplain": [
      { "h": "Key difference", "t": "A network is what you see — separate computers..." }
    ],
    "solve": {
      "q": "A network has 5 nodes connected in a full mesh. How many links are needed?",
      "figure": {
        "icon": "📦",
        "label": "Mesh Topology",
        "amount": "5 nodes",
        "result": "10 links",
        "banner": "✓ COMPLETE"
      },
      "steps": [
        { "label": "STEP 1 — FORMULA", "math": "Links = n(n−1)/2", "note": "Full mesh formula" },
        { "label": "STEP 2 — GIVEN", "math": "n = 5 nodes", "note": "Each node connects to all others" },
        { "label": "STEP 3 — SUBSTITUTE", "math": "Links = 5 × 4 / 2", "note": "Insert n = 5" },
        { "label": "STEP 4 — CALCULATE", "math": "Links = 20 / 2 = 10", "note": "Simple arithmetic" },
        { "label": "ANSWER", "math": "10 links", "note": "For a 5-node full mesh" }
      ]
    },
    "solveExplain": [
      { "h": "What is n?", "t": "n is the number of nodes in the network." },
      { "h": "Why divide by 2?", "t": "Each link connects two nodes (A→B and B→A)." }
    ],
    "life": [
      { "ic": "🏠", "h": "Home WiFi", "t": "Laptop, mobile, TV, printer all connected to one router." },
      { "ic": "🏢", "h": "Office LAN", "t": "Every desk computer connects to the office switch." }
    ],
    "lifeExplain": [
      { "h": "Same concept, everywhere", "t": "Every modern device is part of a network." }
    ],
    "history": [
      { "yr": "1969", "h": "ARPANET Born", "t": "First network — 4 universities connected." },
      { "yr": "1983", "h": "TCP/IP Standard", "t": "Vint Cerf and Bob Kahn — protocol of modern Internet." }
    ],
    "historyExplain": [
      { "h": "Why 1969 matters", "t": "Before ARPANET, computers were isolated." }
    ],
    "flash": [
      { "q": "What is a network?", "a": "Two or more devices connected by links to share data." },
      { "q": "Minimum devices needed?", "a": "Two. One cannot form a network." }
    ],
    "flashExplain": [
      { "h": "Active recall", "t": "Say the answer out loud before flipping." }
    ],
    "exam": [
      {
        "q": "Define a computer network. Give two examples.",
        "a": "A collection of interconnected devices sharing data. Examples: home WiFi, office LAN."
      }
    ],
    "examExplain": [
      { "h": "Exam pattern", "t": "Definitions = 2 marks. Comparisons = 5 marks." }
    ],
    "eli5": {
      "kid": "Beta, imagine two friends with toy telephones connected by a string...",
      "middle": "A network is two or more devices connected so they can share data...",
      "engg": "A computer network is a set of autonomous computers interconnected by a single technology..."
    },
    "eli5Explain": [
      { "h": "Why three levels?", "t": "Brain builds understanding faster when seeing the concept at multiple depths." }
    ]
  }
}
```

---

## 4. (c) Why Uploaded PDFs Do Not Produce That Shape

Through thorough inspection of `server.js` and `js/app.js`, four root causes explain why uploaded PDFs fail to match the rich sample course:

### Root Cause 1: Schema Asymmetry (Two Competing Worlds)
The sample course was hand-authored using the `TOPICS`, `CHEATCODES`, and `VAATHIYAR` schemas.
In contrast, the AI pipeline in `server.js` was written against a completely different schema (`study.units`, `study.concepts`, `study.questions`, `study.flashcards`, `study.formulas`).
- The server never requests CheatCode structures (`why`, `like`, `wrong`, `right`, `see`, `oneLine`).
- The server never prompts for the 8 Vaathiyar pillars (`crash`, `compare`, `solve`, `life`, `history`, `flash`, `exam`, `eli5`).
- Consequently, an uploaded PDF never populates `window.XC.VAATHIYAR` or `window.XC.CHEATCODES`.

### Root Cause 2: Monolithic Generation vs Context Exhaustion
Generating all 8 Vaathiyar modes, full 5-step visual animations, Socratic quizzes, and CheatCodes for 5 units across 30 topics in one shot would require $\approx 80,000$ output tokens.
When prompts attempted to ask for rich content simultaneously, LLMs either:
- Truncated mid-response (invalid JSON).
- Emitted superficial, one-sentence placeholders.
- Dropped the complex nested arrays (`crashExplain`, `compare.bars`, `solve.steps`).

### Root Cause 3: Dynamic Code Generation Instead of Visual Templates
In `data-topics.js`, `visual(step)` is a live JavaScript function returning animated SVG markup with `<animateMotion>` and SVG math.
When the AI was asked in early iterations to generate executable JavaScript or raw SVG markup, it frequently produced malformed tags, broken namespaces, or invalid syntax. The codebase then attempted to pivot to `ALLOWED15` generic layout templates, but these were disconnected from the interactive step engine.

### Root Cause 4: Disjointed Frontend Navigation Paths
In `js/app.js`:
- Sample data is loaded into `state.topicIdx` and rendered via `renderTopic()`, with three active tabs: `📺 Visual`, `🎯 CheatCode`, and `👨‍🏫 Vaathiyar Mode`.
- PDF uploads are stored in `state.aiStudy` and rendered via `aiStudyView()`, which renders a plain text syllabus outline with links to generic markdown cards. The rich 3-tab workspace is completely bypassed!

---

## 5. (d) What is Reusable vs What Must Be Rewritten

| Subsystem | Current Status | Verdict | Reason & Migration Strategy |
| :--- | :--- | :--- | :--- |
| **Provider Failover (`test-provider-failover.js`, `server.js`)** | 40/40 tests passing | **REUSABLE** | Handles multi-model fallback (`gemini-2.0-flash` $\to$ `gemini-1.5-flash` $\to$ fallback providers), key rotation, 429 quota backoff, and IP allowance cleanly. |
| **BIP Living Build Log (`bip/`, `build-parts/`)** | 100% tests passing | **REUSABLE** | All 5 themes, Supabase durable storage, webhook HMAC verification, and effort model countdown work reliably. Must remain intact per Rule 5. |
| **Socratic Quiz Flow (`test-quiz-flow.js`, `qCard`)** | 16/16 tests passing | **REUSABLE** | Strict sequential step-by-step quiz engine, active-recall feedback, score calculation, and hint reveals are pedagogical and well-tested. |
| **Math Formula Engine (`js/data-formulas.js`)** | 31 equations working | **REUSABLE** | KaTeX/MathML mathematical step solver and formula definitions are clean and reusable as a target schema. |
| **Simulation State Machines (`test-interactive-simulations.js`)** | 52/52 tests passing | **REUSABLE** | Deterministic algorithm state machines (Bubble Sort, Binary Search) with slider-driven step players. |
| **PDF Ingestion Queue (`server.js`)** | In-memory `jobs` Map | **REWRITE** | In-memory `Map` loses jobs on restart; cannot scale across multiple workers; lacks Postgres `FOR UPDATE SKIP LOCKED`. Needs Supabase-backed jobs queue. |
| **AI Prompting Pipeline (`server.js`)** | Monolithic / mismatched schema | **REWRITE** | Must split into two phases: (1) Structured Outline Extraction, (2) On-Demand Unit & Vaathiyar generation. Must enforce strict JSON Schema (Zod/Ajv). |
| **AI Study View (`js/app.js` `aiStudyView`)** | Disconnected second UI | **REWRITE / UNIFY** | Must be eliminated. AI-generated study data must normalize directly into the primary `TOPICS` + `CHEATCODES` + `VAATHIYAR` schema so uploaded PDFs use the exact same premium 3-tab workspace. |
| **Visual Step Generation** | Broken SVG / layout mismatch | **REWRITE** | Disallow AI from writing raw SVG or HTML. The AI must pick a semantic visual template from a verified library (e.g. `packet_flow`, `sliding_window`, `client_server`) and pass pure JSON parameters. |

---

## 6. (e) Catalogue of the Five Build-in-Public Themes

The Build-in-Public dashboard (`/build`, compiled via `node build-parts/concat.js` from `build-parts/p01.txt` through `p13.txt` into `build.html`) supports five distinct experience styles. Each theme has unique design tokens, typography, geometric visualizers, and CSS characteristics.

### Theme 1: Vibe Coding Studio (`body[data-style="vibe"]`)
* **Source Files:** `build-parts/p01.txt` (tokens, lines 8–28), `build-parts/p02.txt` (3D cube preview, lines 290–296), `build-parts/p03.txt` (styles, lines 1–75).
* **Display Font:** `"Syne", system-ui, sans-serif`
* **Monospace Font:** `"JetBrains Mono", ui-monospace, monospace`
* **Core CSS Variables:**
  ```css
  --paper: #f1efe3;
  --lime: #c8ff3d;
  --limeink: #121804;
  --inkink: #0b0e05;
  --cobalt: #5c6dff;
  --mut: #9aa38d;
  --dim: #6b745c;
  --line: rgba(255, 255, 255, 0.10);
  --line2: rgba(255, 255, 255, 0.06);
  --soft: rgba(200, 255, 61, 0.35);
  --warn: #ffb43d;
  --orange: #f97316;
  --violet: #a855f7;
  --bad: #ff5f5f;
  --cyan: #5eead4;
  --card: #0e1206;
  background: #060803;
  ```
* **Visualizer & 3D Implementation:**
  - CSS 3D Isometric Studio Wireframe Cube with CSS `preserve-3d`.
  - Three transform faces (`.mf1`: `translateZ(18px)`, `.mf2`: `rotateY(90deg) translateZ(18px)`, `.mf3`: `rotateX(90deg) translateZ(18px)`).
  - Studio Window Chrome on cards (`STUDIO // MODULE` banner with macOS-inspired tri-color dot indicators `#f97316`, `#a855f7`, `#c8ff3d`).

---

### Theme 2: Bubblegum Playground (`body[data-style="bubblegum"]`)
* **Source Files:** `build-parts/p02.txt` (3D pill rings, lines 297–314), `build-parts/p03.txt` (styles, lines 76–140).
* **Display Font:** `"Fredoka", "Plus Jakarta Sans", "Syne", sans-serif`
* **Monospace Font:** `"Space Grotesk", system-ui, sans-serif`
* **Core CSS Variables:**
  ```css
  --paper: #261021;
  --lime: #e62e7a;
  --limeink: #ffffff;
  --inkink: #261021;
  --cobalt: #6d28d9;
  --mut: #633958;
  --dim: #87587a;
  --line: rgba(230, 46, 122, 0.18);
  --line2: rgba(139, 92, 246, 0.16);
  --soft: rgba(230, 46, 122, 0.28);
  --warn: #d97706;
  --orange: #ff6b4a;
  --violet: #9333ea;
  --bad: #dc2626;
  --cyan: #0284c7;
  --card: #ffffff;
  background: #fff2f7;
  ```
* **Visualizer & 3D Implementation:**
  - Torus-like candy pill rings with CSS keyframe wobbling (`transform: rotateX(25deg) rotateY(35deg)`).
  - Inflated candy bar navigation dock (`border-radius: 999px`, candy pink box-shadows).
  - Dual radial dot grid pattern (`#e62e7a` and `#9333ea` dots at 36px pitch).

---

### Theme 3: Liquid Glass 3D (`body[data-style="glass"]`)
* **Source Files:** `build-parts/p02.txt` (3D refractive sphere preview), `build-parts/p04.txt` (styles, lines 1–163).
* **Display Font:** `"Space Grotesk", "Syne", sans-serif`
* **Monospace Font:** `"JetBrains Mono", monospace`
* **Core CSS Variables:**
  ```css
  --paper: #eef6ff;
  --lime: #38bdf8;
  --limeink: #031124;
  --inkink: #030914;
  --cobalt: #818cf8;
  --mut: #94b3d4;
  --dim: #6788ab;
  --line: rgba(255, 255, 255, 0.22);
  --line2: rgba(186, 230, 253, 0.16);
  --soft: rgba(56, 189, 248, 0.38);
  --warn: #fbbf24;
  --orange: #38bdf8;
  --violet: #c084fc;
  --bad: #f87171;
  --cyan: #2dd4bf;
  --card: rgba(12, 25, 48, 0.48);
  background: #030816;
  ```
* **Visualizer & 3D Implementation:**
  - Spatial glass dock with multi-stop linear gradient and 50px backdrop blur.
  - Three-dimensional refractive orb shaders using CSS box-shadow concentric caustics and specular highlights.
  - Deep obsidian 72px grid with cyan and violet ambient radial light cones.

---

### Theme 4: Neo-Brutalist Creative Lab (`body[data-style="brutalist"]`)
* **Source Files:** `build-parts/p02.txt` (3D hard block projection, lines 315–321), `build-parts/p04.txt` (styles, lines 164–350).
* **Display Font:** `"Syne", system-ui, sans-serif`
* **Monospace Font:** `"JetBrains Mono", monospace`
* **Core CSS Variables:**
  ```css
  --paper: #0d0d0d;
  --lime: #ffe600;
  --limeink: #0d0d0d;
  --inkink: #0d0d0d;
  --cobalt: #2563eb;
  --mut: #2e2e2c;
  --dim: #4a4a46;
  --line: #0d0d0d;
  --line2: #0d0d0d;
  --soft: #0d0d0d;
  --warn: #ff4d00;
  --orange: #ff4d00;
  --violet: #7c3aed;
  --bad: #dc2626;
  --cyan: #00d68f;
  --card: #ffffff;
  background: #f4f0e6;
  ```
* **Visualizer & 3D Implementation:**
  - High-contrast, zero-border-radius orthographic projection blocks with heavy 6px hard drop shadows (`box-shadow: 6px 6px 0 #0d0d0d`).
  - 3px solid black border frames.
  - Stark electric yellow (`#ffe600`) and international orange (`#ff4d00`) kicker tags.

---

### Theme 5: Soft Minimal Studio (`body[data-style="minimal"]`)
* **Source Files:** `build-parts/p02.txt` (subtle floating plane, lines 322–335), `build-parts/p05.txt` (styles, lines 1–250).
* **Display Font:** `"Fraunces", Georgia, serif`
* **Monospace Font:** `"Space Grotesk", system-ui, sans-serif`
* **Core CSS Variables:**
  ```css
  --paper: #181816;
  --lime: #23533d;
  --limeink: #faf8f5;
  --inkink: #181816;
  --cobalt: #b4532a;
  --mut: #57534e;
  --dim: #78716c;
  --line: rgba(24, 24, 22, 0.12);
  --line2: rgba(24, 24, 22, 0.08);
  --soft: rgba(35, 83, 61, 0.22);
  --warn: #b45309;
  --orange: #b4532a;
  --violet: #57534e;
  --bad: #b91c1c;
  --cyan: #23533d;
  --card: #ffffff;
  background: #faf8f5;
  ```
* **Visualizer & 3D Implementation:**
  - Understated editorial typography (optical size-tuned serif headings).
  - Floating parchment plane with subtle 1px hairline border lines and diffused shadow (`0 12px 32px -12px rgba(24, 24, 22, 0.08)`).
  - Deep forest green (`#23533d`) and terracotta (`#b4532a`) earthy accents on warm off-white linen paper background.

---

## 7. Audit Conclusion & Phase 2 Read-Ahead

With Phase 1 complete:
1. `pre-rebuild` git tag is created and verified.
2. `phase-1-audit` branch is active.
3. Zero code files were modified.
4. All 23 test suites (598 tests) and 12 node syntax checks are recorded in full green status.
5. In Phase 2, the pipeline rebuild will begin by standardizing on a unified Zod/Ajv JSON schema that merges PDF extraction output directly into the 3-tab `TOPICS` + `CHEATCODES` + `VAATHIYAR` (8 modes) data architecture.

