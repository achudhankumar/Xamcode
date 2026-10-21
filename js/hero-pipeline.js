/* ============================================================
   XAMCODE.AI — HERO TRANSFORMATION PIPELINE SIMULATOR
   Interactive 5-Step Scrubber:
   PDF Ingest -> Semantic Decomp -> 3D Simulation -> In-Situ Quiz -> Exam Cheat Sheet
   ============================================================ */

(function(){
'use strict';

window.XC = window.XC || {};

const PIPELINE_STEPS = [
  {
    id: 'ingest',
    num: '01',
    name: 'PDF Ingestion & OCR',
    short: 'Ingest PDF',
    badge: 'STAGE 1: MULTI-MODAL INGESTION',
    file: 'parser/pdf-stream-ast.ts',
    desc: 'Deep multi-modal document decomposition: extracts 342 pages, table schemas, mathematical formulas, and hierarchical diagrams into zero-copy semantic tokens.'
  },
  {
    id: 'decomp',
    num: '02',
    name: 'Semantic Decomposition',
    short: 'Units & Topics',
    badge: 'STAGE 2: CURRICULUM ARCHITECTURE',
    file: 'engine/curriculum-dag.json',
    desc: 'Gemini reasoning decomposes unorganized text into an instructional DAG: 5 structured units, prerequisite dependencies, and targeted micro-learning concepts.'
  },
  {
    id: 'simulation',
    num: '03',
    name: 'Pedagogical 3D Simulation',
    short: '3D Simulation',
    badge: 'STAGE 3: SPATIAL MECHANICS',
    file: 'simulations/four-stroke-kinematics.js',
    desc: 'Kinematic 3D/SVG simulation running at educational slow-motion (0.25x – 0.5x speed). Drag the HUD scrubber to inspect exact cycle strokes and isolate components.'
  },
  {
    id: 'quiz',
    num: '04',
    name: 'In-Situ Active Recall',
    short: 'Continuous Quiz',
    badge: 'STAGE 4: SOCRATIC VERIFICATION',
    file: 'tutor/diagnostic-evaluator.ts',
    desc: 'Instant verification after every visual concept. Features targeted diagnostic feedback explaining why distractors fail and why the correct principle holds.'
  },
  {
    id: 'cheatsheet',
    num: '05',
    name: 'Exam Readiness & Mnemonics',
    short: 'Cheat Sheets',
    badge: 'STAGE 5: EXAM MASTERY',
    file: 'cards/high-yield-summary.md',
    desc: 'High-yield recall cards, memory cheat codes, formula derivation matrices, and quick revision sheets ready for the night before your exam.'
  }
];

let state = {
  currentStep: 2, // Default to 3D Simulation (most visually striking)
  isPlaying: false,
  timer: null,
  simSpeed: 0.25,
  simStroke: 0, // 0: Intake, 1: Compression, 2: Power, 3: Exhaust
  simAngle: 0,
  simAnimId: null,
  quizAnswered: null
};

function getTerminalCode(stepIndex){
  switch(stepIndex){
    case 0:
      return `<span class="wc-tok-com">// 01 · PDF Stream Extraction & Multi-Modal Tokenization</span>
<span class="wc-tok-kwd">import</span> { DocumentPipeline, BoundingBox } <span class="wc-tok-kwd">from</span> <span class="wc-tok-str">'@xamcode/parser'</span>;

<span class="wc-tok-kwd">export async function</span> <span class="wc-tok-fn">ingestAcademicPDF</span>(buffer: <span class="wc-tok-tag">ArrayBuffer</span>) {
  <span class="wc-tok-kwd">const</span> doc = <span class="wc-tok-kwd">await</span> DocumentPipeline.<span class="wc-tok-fn">load</span>(buffer);
  
  <span class="wc-tok-com">// Process 20 to 400+ page technical textbook</span>
  <span class="wc-tok-kwd">const</span> stats = {
    pages: doc.<span class="wc-tok-fn">pageCount</span>(),       <span class="wc-tok-com">// 342 pages</span>
    tokens: <span class="wc-tok-num">142890</span>,              <span class="wc-tok-com">// semantic tokens</span>
    diagramsFound: <span class="wc-tok-num">87</span>,           <span class="wc-tok-com">// bounding boxes extracted</span>
    formulaEquations: <span class="wc-tok-num">44</span>        <span class="wc-tok-com">// LaTeX mathematical forms</span>
  };

  <span class="wc-tok-kwd">return</span> doc.<span class="wc-tok-fn">streamChunks</span>({
    targetChunkTokens: <span class="wc-tok-num">12000</span>,
    overlapPercent: <span class="wc-tok-num">0.12</span>,
    preserveHierarchy: <span class="wc-tok-kwd">true</span>
  });
}`;

    case 1:
      return `<span class="wc-tok-com">// 02 · Structured Curriculum DAG (Units & Topic Hierarchy)</span>
{
  <span class="wc-tok-str">"course"</span>: <span class="wc-tok-str">"Thermodynamics & IC Engines"</span>,
  <span class="wc-tok-str">"units"</span>: [
    {
      <span class="wc-tok-str">"unitId"</span>: <span class="wc-tok-num">1</span>,
      <span class="wc-tok-str">"title"</span>: <span class="wc-tok-str">"Four-Stroke Otto & Diesel Cycles"</span>,
      <span class="wc-tok-str">"weight"</span>: <span class="wc-tok-num">0.28</span>,
      <span class="wc-tok-str">"concepts"</span>: [
        {
          <span class="wc-tok-str">"id"</span>: <span class="wc-tok-str">"c-101"</span>,
          <span class="wc-tok-str">"name"</span>: <span class="wc-tok-str">"Four-Stroke Reciprocating Piston Mechanics"</span>,
          <span class="wc-tok-str">"pedagogicalType"</span>: <span class="wc-tok-str">"spatial-mechanical"</span>,
          <span class="wc-tok-str">"targetCadence"</span>: <span class="wc-tok-str">"0.25x (45 RPM slow-motion)"</span>,
          <span class="wc-tok-str">"prerequisites"</span>: [<span class="wc-tok-str">"crankshaft-rotation"</span>, <span class="wc-tok-str">"valvetrain"</span>]
        }
      ]
    }
  ]
}`;

    case 2:
      return `<span class="wc-tok-com">// 03 · Pedagogical Kinematic Simulation Loop (45 RPM Baseline)</span>
<span class="wc-tok-kwd">class</span> <span class="wc-tok-tag">EngineSimulator</span> {
  <span class="wc-tok-fn">constructor</span>(canvas, hud) {
    <span class="wc-tok-kwd">this</span>.speed = <span class="wc-tok-num">0.25</span>; <span class="wc-tok-com">// Human-friendly educational speed</span>
    <span class="wc-tok-kwd">this</span>.strokeMap = [<span class="wc-tok-str">'Intake'</span>, <span class="wc-tok-str">'Compression'</span>, <span class="wc-tok-str">'Power'</span>, <span class="wc-tok-str">'Exhaust'</span>];
    <span class="wc-tok-kwd">this</span>.r = <span class="wc-tok-num">36</span>;  <span class="wc-tok-com">// Crank radius</span>
    <span class="wc-tok-kwd">this</span>.l = <span class="wc-tok-num">105</span>; <span class="wc-tok-com">// Connecting rod length</span>
  }

  <span class="wc-tok-fn">computePistonY</span>(angleRad) {
    <span class="wc-tok-com">// Slider-crank exact geometric position</span>
    <span class="wc-tok-kwd">const</span> { r, l } = <span class="wc-tok-kwd">this</span>;
    <span class="wc-tok-kwd">return</span> r * Math.<span class="wc-tok-fn">cos</span>(angleRad) + Math.<span class="wc-tok-fn">sqrt</span>(l*l - r*r * Math.<span class="wc-tok-fn">sin</span>(angleRad)**<span class="wc-tok-num">2</span>);
  }

  <span class="wc-tok-fn">inspectStroke</span>(strokeIndex) {
    <span class="wc-tok-com">// Scrub cycle to view exact intake/exhaust valve state</span>
    <span class="wc-tok-kwd">return this</span>.<span class="wc-tok-fn">renderIsolatedState</span>(<span class="wc-tok-kwd">this</span>.strokeMap[strokeIndex]);
  }
}`;

    case 3:
      return `<span class="wc-tok-com">// 04 · Continuous In-Situ Diagnostic Evaluator</span>
<span class="wc-tok-kwd">export function</span> <span class="wc-tok-fn">evaluateAnswer</span>(questionId: <span class="wc-tok-tag">string</span>, chosenIdx: <span class="wc-tok-tag">number</span>) {
  <span class="wc-tok-kwd">const</span> q = <span class="wc-tok-fn">getQuestion</span>(questionId);
  <span class="wc-tok-kwd">const</span> isCorrect = (chosenIdx === q.correctAnswer);

  <span class="wc-tok-kwd">return</span> {
    status: isCorrect ? <span class="wc-tok-str">'MASTERY_CONFIRMED'</span> : <span class="wc-tok-str">'MISCONCEPTION_DETECTED'</span>,
    xpAwarded: isCorrect ? <span class="wc-tok-num">50</span> : <span class="wc-tok-num">0</span>,
    diagnostic: isCorrect 
      ? <span class="wc-tok-str">'Correct! During the Power stroke, spark ignition rapidly increases chamber pressure.'</span>
      : q.distractorFeedback[chosenIdx] <span class="wc-tok-com">// Explain exact misconception</span>
  };
}`;

    case 4:
      return `<span class="wc-tok-com">// 05 · High-Yield Formula Matrix & Recall Cheat Sheet</span>
# Four-Stroke Otto Cycle — Exam Cheat Code

* **Stroke Sequence Mnemonic:** **I** **C**an **P**ass **E**xams
  - **I**ntake (Intake valve OPEN, air-fuel drawn in)
  - **C**ompression (Both valves CLOSED, piston rises to TDC)
  - **P**ower (Spark ignition, explosive expansion downwards)
  - **E**xhaust (Exhaust valve OPEN, gases expelled)

* **Thermal Efficiency (η_otto):**
  $$ \\eta = 1 - \\frac{1}{r^{(\\gamma - 1)}} $$
  *(Where r = compression ratio, γ = specific heat ratio ≈ 1.4)*
* **Key Trap:** Spark occurs *before* TDC, not during the intake stroke!`;
  }
}

function renderStagePreview(stepIndex){
  switch(stepIndex){
    case 0:
      return `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#E2E8F0;font-family:var(--wc-font-mono);position:relative;">
          <div style="width:240px;height:180px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;">
              <span style="font-size:11px;color:#38BDF8;font-weight:700;">📄 Textbook_Ch04.pdf</span>
              <span style="font-size:10px;color:#94A3B8;">342 pgs</span>
            </div>
            <div style="height:6px;width:75%;background:rgba(255,255,255,0.2);border-radius:3px;margin-bottom:8px;"></div>
            <div style="height:6px;width:90%;background:rgba(255,255,255,0.12);border-radius:3px;margin-bottom:8px;"></div>
            <div style="height:6px;width:60%;background:rgba(255,255,255,0.12);border-radius:3px;margin-bottom:8px;"></div>
            <div style="margin-top:14px;padding:8px;border-radius:6px;background:rgba(56,189,248,0.1);border:1px dashed rgba(56,189,248,0.3);font-size:10px;color:#38BDF8;">
              ◈ OCR &amp; Diagram Vectorization Active
            </div>
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:#38BDF8;box-shadow:0 0 12px #38BDF8;animation:wcScanLine 2.5s infinite linear;"></div>
          </div>
          <div style="margin-top:18px;display:flex;gap:14px;font-size:11px;color:#94A3B8;">
            <span><b style="color:#10B981;">142.8k</b> tokens parsed</span>
            <span><b style="color:#38BDF8;">87</b> diagrams mapped</span>
          </div>
        </div>
        <style>
          @keyframes wcScanLine {
            0% { top: 0%; opacity: 0.8; }
            50% { top: 100%; opacity: 1; }
            100% { top: 0%; opacity: 0.8; }
          }
        </style>
      `;

    case 1:
      return `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:16px;color:#E2E8F0;font-family:var(--wc-font-body);">
          <div style="font-family:var(--wc-font-mono);font-size:11px;color:#38BDF8;font-weight:700;margin-bottom:12px;">CURRICULUM DECOMPOSITION GRAPH</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;">
              <span style="font-family:var(--wc-font-mono);font-size:9.5px;color:#10B981;font-weight:700;">UNIT 1 · COMPLETED</span>
              <div style="font-size:12.5px;font-weight:600;margin:4px 0 2px;">Four-Stroke IC Cycles</div>
              <span style="font-size:10.5px;color:#94A3B8;">6 concepts · 2 simulations</span>
            </div>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;">
              <span style="font-family:var(--wc-font-mono);font-size:9.5px;color:#38BDF8;font-weight:700;">UNIT 2 · READY</span>
              <div style="font-size:12.5px;font-weight:600;margin:4px 0 2px;">Valve Timing &amp; Camshaft</div>
              <span style="font-size:10.5px;color:#94A3B8;">5 concepts · 1 simulation</span>
            </div>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;">
              <span style="font-family:var(--wc-font-mono);font-size:9.5px;color:#F59E0B;font-weight:700;">UNIT 3 · MAPPED</span>
              <div style="font-size:12.5px;font-weight:600;margin:4px 0 2px;">Thermal Efficiency η</div>
              <span style="font-size:10.5px;color:#94A3B8;">7 formulas · 3 quizzes</span>
            </div>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;">
              <span style="font-family:var(--wc-font-mono);font-size:9.5px;color:#A855F7;font-weight:700;">UNIT 4 · DERIVATION</span>
              <div style="font-size:12.5px;font-weight:600;margin:4px 0 2px;">Exhaust &amp; Emissions</div>
              <span style="font-size:10.5px;color:#94A3B8;">4 concepts · 1 cheat code</span>
            </div>
          </div>
        </div>
      `;

    case 2:
      // Pedagogical 4-Stroke IC Engine interactive simulation with HUD
      return `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;position:relative;" id="wcEngineStageContainer">
          <svg id="wcEngineSvg" viewBox="0 0 360 270" style="width:100%;height:100%;max-height:270px;">
            <defs>
              <linearGradient id="pistonGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#475569"/>
                <stop offset="50%" stop-color="#94A3B8"/>
                <stop offset="100%" stop-color="#334155"/>
              </linearGradient>
              <radialGradient id="combustionGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#F97316" stop-opacity="1"/>
                <stop offset="70%" stop-color="#EF4444" stop-opacity="0.6"/>
                <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
              </radialGradient>
            </defs>

            <!-- Cylinder Wall -->
            <rect x="110" y="25" width="140" height="150" fill="none" stroke="#475569" stroke-width="4" rx="4"/>
            <line x1="90" y1="25" x2="270" y2="25" stroke="#64748B" stroke-width="6"/>

            <!-- Intake Valve (left) -->
            <g id="wcValIntake" transform="translate(140,25)">
              <line x1="0" y1="-8" x2="0" y2="4" stroke="#38BDF8" stroke-width="3"/>
              <polygon points="-8,4 8,4 0,9" fill="#38BDF8"/>
              <text x="-18" y="-12" font-size="8.5" fill="#38BDF8" font-family="monospace">IN</text>
            </g>

            <!-- Spark Plug (center) -->
            <g transform="translate(180,25)">
              <rect x="-4" y="-10" width="8" height="10" fill="#E2E8F0"/>
              <line x1="0" y1="0" x2="0" y2="5" stroke="#F59E0B" stroke-width="2"/>
              <circle id="wcSparkGlow" cx="0" cy="8" r="10" fill="url(#combustionGlow)" opacity="0"/>
            </g>

            <!-- Exhaust Valve (right) -->
            <g id="wcValExhaust" transform="translate(220,25)">
              <line x1="0" y1="-8" x2="0" y2="4" stroke="#F43F5E" stroke-width="3"/>
              <polygon points="-8,4 8,4 0,9" fill="#F43F5E"/>
              <text x="6" y="-12" font-size="8.5" fill="#F43F5E" font-family="monospace">EX</text>
            </g>

            <!-- Combustion Chamber Flame -->
            <rect id="wcFlameBox" x="115" y="30" width="130" height="20" fill="url(#combustionGlow)" opacity="0" rx="4"/>

            <!-- Reciprocating Piston -->
            <g id="wcPistonGroup" transform="translate(120,60)">
              <rect width="120" height="45" rx="5" fill="url(#pistonGrad)" stroke="#1E293B" stroke-width="1.5"/>
              <!-- Piston Rings -->
              <line x1="4" y1="8" x2="116" y2="8" stroke="#1E293B" stroke-width="1.5"/>
              <line x1="4" y1="14" x2="116" y2="14" stroke="#1E293B" stroke-width="1.5"/>
              <!-- Wrist Pin -->
              <circle cx="60" cy="24" r="6" fill="#1E293B"/>
            </g>

            <!-- Connecting Rod -->
            <line id="wcConnRod" x1="180" y1="84" x2="180" y2="200" stroke="#94A3B8" stroke-width="7" stroke-linecap="round"/>

            <!-- Crankshaft Disk & Pin -->
            <circle cx="180" cy="210" r="38" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="4 3"/>
            <circle cx="180" cy="210" r="10" fill="#334155"/>
            <g id="wcCrankPin" transform="translate(180,180)">
              <circle cx="0" cy="0" r="6" fill="#F59E0B"/>
            </g>
          </svg>

          <!-- Persistent Pedagogical Floating HUD -->
          <div class="wc-pedagogical-hud">
            <div class="wc-hud-speed-group" aria-label="Playback speed">
              <span style="font-family:var(--wc-font-mono);font-size:9px;color:#94A3B8;margin-right:4px;">SPEED:</span>
              <button type="button" class="wc-hud-speed-btn" data-speed="0.1">0.1x</button>
              <button type="button" class="wc-hud-speed-btn active" data-speed="0.25">0.25x</button>
              <button type="button" class="wc-hud-speed-btn" data-speed="0.5">0.5x</button>
              <button type="button" class="wc-hud-speed-btn" data-speed="1.0">1.0x</button>
            </div>

            <div class="wc-hud-scrubber-group">
              <span id="wcCurrentStrokeBadge" style="font-family:var(--wc-font-mono);font-size:10.5px;color:#38BDF8;font-weight:700;white-space:nowrap;">STROKE: POWER</span>
              <input type="range" class="wc-hud-scrubber" id="wcStrokeScrubber" min="0" max="720" value="360" aria-label="Stroke cycle timeline scrubber">
            </div>

            <div style="display:flex;gap:6px;">
              <button type="button" class="wc-hud-action-btn" id="wcHudPauseBtn">❚❚ Pause</button>
              <button type="button" class="wc-hud-action-btn" id="wcHudIsolateBtn" style="color:#38BDF8;">Focus</button>
            </div>
          </div>
        </div>
      `;

    case 3:
      return `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:18px;color:#E2E8F0;font-family:var(--wc-font-body);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-family:var(--wc-font-mono);font-size:10px;color:#A855F7;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(168,85,247,0.15);">IN-SITU KNOWLEDGE CHECK</span>
            <span style="font-family:var(--wc-font-mono);font-size:11px;color:#F59E0B;font-weight:700;">★ +50 XP</span>
          </div>
          <div style="font-size:14px;font-weight:700;margin-bottom:14px;color:#F8FAFC;">
            Which stroke produces positive mechanical work on the crankshaft?
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="wc-pipeline-quiz-opt" data-opt="0" style="padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#E2E8F0;font-size:12.5px;text-align:left;cursor:pointer;">A) Compression Stroke</button>
            <button class="wc-pipeline-quiz-opt" data-opt="1" style="padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#E2E8F0;font-size:12.5px;text-align:left;cursor:pointer;">B) Power (Expansion) Stroke</button>
            <button class="wc-pipeline-quiz-opt" data-opt="2" style="padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#E2E8F0;font-size:12.5px;text-align:left;cursor:pointer;">C) Exhaust Stroke</button>
          </div>
          <div id="wcPipelineQuizFeedback" style="display:none;margin-top:12px;padding:8px 12px;border-radius:6px;font-size:11.5px;line-height:1.4;"></div>
        </div>
      `;

    case 4:
      return `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:18px;color:#E2E8F0;font-family:var(--wc-font-body);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-family:var(--wc-font-mono);font-size:10px;color:#10B981;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(16,185,129,0.15);">EXAM MASTERY CARD</span>
            <span style="font-family:var(--wc-font-mono);font-size:10.5px;color:#94A3B8;">UNIT 1 SUMMARY</span>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="font-family:var(--wc-font-mono);font-size:11px;color:#F59E0B;font-weight:700;margin-bottom:4px;">⚡ RECALL CHEAT CODE</div>
            <div style="font-size:13px;font-weight:600;color:#F8FAFC;">"I Can Pass Exams" (Intake → Compression → Power → Exhaust)</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;">
            <div style="font-family:var(--wc-font-mono);font-size:11px;color:#38BDF8;font-weight:700;margin-bottom:4px;">📐 CORE FORMULA</div>
            <div style="font-family:var(--wc-font-mono);font-size:12px;color:#F8FAFC;">η = 1 - (1 / r^(γ - 1))</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:2px;">Higher compression ratio r directly increases thermal efficiency η.</div>
          </div>
        </div>
      `;
  }
}

function mountPipeline(container){
  if(!container) return;

  const current = PIPELINE_STEPS[state.currentStep];

  container.innerHTML = `
    <div class="wc-pipeline-container">
      <div class="wc-pipeline-header">
        <div class="wc-pipeline-title-group">
          <span class="wc-pipeline-badge" id="wcPipelineBadge">${current.badge}</span>
          <span class="wc-pipeline-title" id="wcPipelineTitle">${current.name}</span>
        </div>
        <div class="wc-pipeline-controls">
          <button type="button" class="wc-pipeline-play-btn" id="wcPipelineAutoPlay">
            <span>▶</span> <span id="wcPlayBtnLabel">Auto Play Pipeline</span>
          </button>
        </div>
      </div>

      <!-- 5-Step Scrubber -->
      <div class="wc-step-scrubber" role="tablist">
        ${PIPELINE_STEPS.map((s, idx) => `
          <button type="button" class="wc-step-btn ${idx === state.currentStep ? 'active' : ''}" data-step="${idx}" role="tab" aria-selected="${idx === state.currentStep}">
            <span class="wc-step-num">${s.num}</span>
            <span class="wc-step-name">${s.short}</span>
          </button>
        `).join('')}
      </div>

      <!-- Viewport: Code Terminal on Left + Live Preview on Right -->
      <div class="wc-pipeline-viewport">
        <div class="wc-terminal-card">
          <div class="wc-terminal-top">
            <div class="wc-terminal-dots"><i></i><i></i><i></i></div>
            <span class="wc-terminal-file" id="wcTerminalFile">${current.file}</span>
            <span style="font-size:9.5px;color:#64748B;font-family:var(--wc-font-mono);">AST EXTRACTOR</span>
          </div>
          <div class="wc-terminal-body" id="wcTerminalBody">
            ${getTerminalCode(state.currentStep)}
          </div>
        </div>

        <div class="wc-preview-card">
          <div class="wc-preview-stage" id="wcPreviewStage">
            ${renderStagePreview(state.currentStep)}
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  container.querySelectorAll('.wc-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepIdx = parseInt(btn.dataset.step, 10);
      setStep(stepIdx, container);
    });
  });

  const playBtn = container.querySelector('#wcPipelineAutoPlay');
  if(playBtn){
    playBtn.addEventListener('click', () => {
      togglePlay(container);
    });
  }

  setupStageEvents(container);
}

function setStep(stepIdx, container){
  state.currentStep = stepIdx;
  const current = PIPELINE_STEPS[stepIdx];

  // Update tabs
  container.querySelectorAll('.wc-step-btn').forEach((b, idx) => {
    b.classList.toggle('active', idx === stepIdx);
    b.setAttribute('aria-selected', idx === stepIdx ? 'true' : 'false');
  });

  // Update headers
  const badgeEl = container.querySelector('#wcPipelineBadge');
  const titleEl = container.querySelector('#wcPipelineTitle');
  const fileEl = container.querySelector('#wcTerminalFile');
  const termBody = container.querySelector('#wcTerminalBody');
  const stageEl = container.querySelector('#wcPreviewStage');

  if(badgeEl) badgeEl.textContent = current.badge;
  if(titleEl) titleEl.textContent = current.name;
  if(fileEl) fileEl.textContent = current.file;
  if(termBody) termBody.innerHTML = getTerminalCode(stepIdx);
  if(stageEl) stageEl.innerHTML = renderStagePreview(stepIdx);

  setupStageEvents(container);
}

function togglePlay(container){
  state.isPlaying = !state.isPlaying;
  const label = container.querySelector('#wcPlayBtnLabel');
  if(label){
    label.textContent = state.isPlaying ? 'Pause Walkthrough' : 'Auto Play Pipeline';
  }

  if(state.isPlaying){
    state.timer = setInterval(() => {
      const nextStep = (state.currentStep + 1) % PIPELINE_STEPS.length;
      setStep(nextStep, container);
    }, 4500);
  } else {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function setupStageEvents(container){
  // 1. Engine Simulation Loop if Step 2
  if(state.currentStep === 2){
    startEngineLoop(container);

    // Speed buttons
    container.querySelectorAll('.wc-hud-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.wc-hud-speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.simSpeed = parseFloat(btn.dataset.speed);
      });
    });

    // Scrubber
    const scrubber = container.querySelector('#wcStrokeScrubber');
    if(scrubber){
      scrubber.addEventListener('input', (e) => {
        state.simAngle = (parseFloat(e.target.value) * Math.PI) / 180;
        updateEnginePositions(container);
      });
    }

    // Pause button
    const pauseBtn = container.querySelector('#wcHudPauseBtn');
    if(pauseBtn){
      let paused = false;
      pauseBtn.addEventListener('click', () => {
        paused = !paused;
        pauseBtn.textContent = paused ? '▶ Play' : '❚❚ Pause';
        if(paused){
          cancelAnimationFrame(state.simAnimId);
        } else {
          startEngineLoop(container);
        }
      });
    }

    // Isolate button
    const isolateBtn = container.querySelector('#wcHudIsolateBtn');
    if(isolateBtn){
      let isolated = false;
      isolateBtn.addEventListener('click', () => {
        isolated = !isolated;
        isolateBtn.textContent = isolated ? 'Reset View' : 'Focus Piston';
        const connRod = container.querySelector('#wcConnRod');
        const crank = container.querySelector('#wcCrankPin');
        if(connRod) connRod.style.opacity = isolated ? '0.15' : '1';
        if(crank) crank.style.opacity = isolated ? '0.15' : '1';
      });
    }
  } else {
    if(state.simAnimId){
      cancelAnimationFrame(state.simAnimId);
      state.simAnimId = null;
    }
  }

  // 2. Interactive Quiz handling if Step 3
  if(state.currentStep === 3){
    container.querySelectorAll('.wc-pipeline-quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const opt = parseInt(btn.dataset.opt, 10);
        const fb = container.querySelector('#wcPipelineQuizFeedback');
        container.querySelectorAll('.wc-pipeline-quiz-opt').forEach(b => {
          b.style.borderColor = 'rgba(255,255,255,0.12)';
          b.style.background = 'rgba(255,255,255,0.06)';
        });

        if(opt === 1){ // Correct
          btn.style.borderColor = '#10B981';
          btn.style.background = 'rgba(16,185,129,0.18)';
          btn.style.color = '#10B981';
          if(fb){
            fb.style.display = 'block';
            fb.style.background = 'rgba(16,185,129,0.15)';
            fb.style.border = '1px solid #10B981';
            fb.style.color = '#6EE7B7';
            fb.innerHTML = '<b>✓ Correct (+50 XP):</b> The Power (Expansion) stroke is the only stroke where burning gases force the piston down, delivering positive work to the crank.';
          }
        } else { // Wrong
          btn.style.borderColor = '#F43F5E';
          btn.style.background = 'rgba(244,63,94,0.18)';
          btn.style.color = '#F43F5E';
          if(fb){
            fb.style.display = 'block';
            fb.style.background = 'rgba(217,119,6,0.15)';
            fb.style.border = '1px solid #F59E0B';
            fb.style.color = '#FCD34D';
            fb.innerHTML = '<b>✕ Diagnostic:</b> In the compression/exhaust stroke, work is <i>consumed</i> to compress gas or push it out. Only the Power stroke produces net output.';
          }
        }
      });
    });
  }
}

function startEngineLoop(container){
  let lastTime = performance.now();

  function loop(time){
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    // Advance angle at educational slow-motion baseline
    // 0.25x = ~45 RPM => (45 * 2pi) / 60 = ~4.7 rad/sec
    const baseSpeedRad = 4.71 * state.simSpeed;
    state.simAngle = (state.simAngle + baseSpeedRad * delta) % (4 * Math.PI);

    updateEnginePositions(container);
    state.simAnimId = requestAnimationFrame(loop);
  }

  if(state.simAnimId) cancelAnimationFrame(state.simAnimId);
  state.simAnimId = requestAnimationFrame(loop);
}

function updateEnginePositions(container){
  const theta = state.simAngle % (2 * Math.PI); // crank angle 0..2pi
  const r = 36;
  const l = 105;

  // Crank pin coordinates
  const cx = 180;
  const cy = 210;
  const pinX = cx + r * Math.sin(theta);
  const pinY = cy - r * Math.cos(theta);

  // Slider-crank piston position
  // piston sits between y=40 (TDC) and y=112 (BDC)
  const pistonWristY = pinY - Math.sqrt(Math.max(0, l*l - (pinX - cx)**2));
  const pistonTopY = pistonWristY - 24;

  const pistonGroup = container.querySelector('#wcPistonGroup');
  const connRod = container.querySelector('#wcConnRod');
  const crankPin = container.querySelector('#wcCrankPin');
  const flameBox = container.querySelector('#wcFlameBox');
  const sparkGlow = container.querySelector('#wcSparkGlow');
  const valIntake = container.querySelector('#wcValIntake');
  const valExhaust = container.querySelector('#wcValExhaust');
  const badge = container.querySelector('#wcCurrentStrokeBadge');
  const scrubber = container.querySelector('#wcStrokeScrubber');

  if(pistonGroup){
    pistonGroup.setAttribute('transform', `translate(120, ${pistonTopY})`);
  }

  if(connRod){
    connRod.setAttribute('x1', String(cx));
    connRod.setAttribute('y1', String(pistonWristY));
    connRod.setAttribute('x2', String(pinX));
    connRod.setAttribute('y2', String(pinY));
  }

  if(crankPin){
    crankPin.setAttribute('transform', `translate(${pinX}, ${pinY})`);
  }

  // 4-Stroke identification: 720 degrees total cycle
  const degTotal = (state.simAngle * 180 / Math.PI) % 720;
  let strokeName = 'INTAKE';
  let flameOp = 0;
  let sparkOp = 0;
  let inOpen = 0;
  let exOpen = 0;

  if(degTotal < 180){
    strokeName = 'STROKE 1: INTAKE (Air-Fuel In)';
    inOpen = 6;
  } else if(degTotal < 360){
    strokeName = 'STROKE 2: COMPRESSION (TDC)';
    if(degTotal > 340) sparkOp = 1;
  } else if(degTotal < 540){
    strokeName = 'STROKE 3: POWER (Expansion 🔥)';
    flameOp = Math.max(0, 1 - (degTotal - 360) / 140);
  } else {
    strokeName = 'STROKE 4: EXHAUST (Gases Out)';
    exOpen = 6;
  }

  if(badge) badge.textContent = strokeName;
  if(flameBox) flameBox.setAttribute('opacity', String(flameOp));
  if(sparkGlow) sparkGlow.setAttribute('opacity', String(sparkOp));
  if(valIntake) valIntake.setAttribute('transform', `translate(140, ${25 + inOpen})`);
  if(valExhaust) valExhaust.setAttribute('transform', `translate(220, ${25 + exOpen})`);
  if(scrubber) scrubber.value = String(Math.round(degTotal));
}

window.XC.heroPipeline = {
  init: mountPipeline,
  setStep: setStep,
  togglePlay: togglePlay
};

})();
