(function(){
'use strict';

/* ============================================================
   EXTERNAL DATA ALIASES — read from window.XC.*
   These are populated by js/data-topics.js, data-formulas.js, etc.
   ============================================================ */
const TOPICS     = window.XC.TOPICS;
const FORMULAS   = window.XC.FORMULAS;
const CHEATCODES = window.XC.CHEATCODES;
const VAATHIYAR  = window.XC.VAATHIYAR;

/* Upload size cap. Kept in one place so the dropzone label, the file
   picker validation and the server limit cannot drift apart. The server
   is authoritative and reads the same value from MAX_PDF_MB. */
const MAX_PDF_MB = 20;

/* ============================================================
   MINI VISUAL DISPATCHER — delegates to data-visuals.js
   ============================================================ */
function mini(type){
  return (window.XC && window.XC.SVG && window.XC.SVG.miniSvg)
    ? window.XC.SVG.miniSvg(type)
    : `<svg viewBox="0 0 200 100" style="width:100%;height:100px"><rect x="60" y="35" width="80" height="30" rx="6" fill="#111a2e" stroke="#2dd4bf"/><text x="100" y="54" text-anchor="middle" font-size="9" fill="#fff">?</text></svg>`;
}

/* ============================================================
   CONTENT
   ============================================================ */
/* ============================================================
   STATE
   ============================================================ */
const state = {
  view:'landing',
  topicIdx: 0,
  step: 0,
  studyTab: 'visual',
  answers: loadSavedAnswers(),
  /* Sequential quiz flow: qStep is the question on screen, qDone flips
     when the last question has been passed and the results screen
     takes over. Neither is persisted — they are per-topic session state
     re-seeded by resetQuizFlow() whenever a topic is opened. */
  qStep: 0,
  qDone: false,
  playing: true,
  autoTimer: null,
  resumeTimer: null,
  autoMs: 4000,
  fcIdx: 0,
  fcDeck: [],
  fcOpen: false,
  formulaId: null,
  vaathiyarMode: 'crash',
  vaathiyarCrashIdx: 0,
  vaathiyarCrashPlaying: false,
  vaathiyarCrashTimer: null,
  vaathiyarSolveStep: 0,
  vaathiyarSolveAuto: false,
  vaathiyarSolveTimer: null,
  vaathiyarFlashIdx: 0,
  vaathiyarFlashFlipped: false,
  vaathiyarEli5: 'kid',
  collapsedUnits: {},
  aiStudy: null,
  aiPage: {type:'plan'},
  aiLessonMode: 'crash',
  aiVisualStep: 0,
  aiVisualPlaying: false,
aiQuizVisualStep: 0,
  aiVisualTimer: null,
  aiLessonFlashIdx: 0,
  aiLessonFlashFlipped: false,
  aiExplanationLevel: 'simple',
  aiQuizAnswers: {},
  aiFlashIdx: 0,
  aiFlashFlipped: false,
  aiMessages: [],
  aiChatBusy: false,
  /* Per-topic 2D images (local SVG engine, one per concept). The job id that
     produced the finished study is kept so POST /api/topic-images can bind
     image requests to it — no new PDF is consumed, so the 5-PDF daily
     allowance stays the single gate. Motion stays in the animated SVG layer;
     the generated still is the lesson's header image. */
  aiJobId: null,
  aiTopicImages: {},
  aiTopicImageBusy: {},
  simStep: 0,
  simPlaying: false,
  simTimer: null,
  simSpeed: 1
};




function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);
}

function loadSavedAnswers(){
  const raw = localStorage.getItem('xc-progress');
  if(!raw) return {};



  let saved;
  try{
    saved = JSON.parse(raw);
  }catch(error){
    console.warn('Saved quiz progress could not be parsed; starting with empty progress.', error);
    return {};



  }
  if(!saved || typeof saved!=='object' || Array.isArray(saved)){
    console.warn('Saved quiz progress has an invalid shape; starting with empty progress.');
    return {};



  }
  const answers = {};



  Object.entries(saved).forEach(([key, value])=>{
    const match = /^(\d+)-(\d+)$/.exec(key);
    if(!match){
      console.warn('Skipping saved quiz answer with an invalid key:', key);
      return;
    }
    const topicIdx = Number(match[1]);
    const questionIdx = Number(match[2]);
    const question = TOPICS[topicIdx]?.questions[questionIdx];
    if(!question || !Number.isInteger(value) || value<0 || value>=question.opts.length){
      console.warn('Skipping an invalid saved quiz answer:', key);
      return;
    }
    answers[key] = value;
  });
  return answers;
}

function saveAnswers(){
  try{
    localStorage.setItem('xc-progress', JSON.stringify(state.answers));
  }catch(error){
    console.error('Could not save quiz progress to local storage.', error);
  }
}

/* §11 — cinematic theme/mode shift: a veil in the destination world's
   colors covers the swap, then the new theme fades back in (~850 ms).
   The first call (boot) commits instantly — no sweep on page load. */
let themeShiftTimers = [];
let themeShiftStart = 0;
function applyTheme(theme, mode){
  const commit = ()=>{
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-mode', mode);
    localStorage.setItem('xc-theme', theme);
    localStorage.setItem('xc-mode', mode);
    document.querySelectorAll('.theme-card').forEach(el=>{
      el.classList.toggle('active', el.dataset.setTheme===theme);
    });
    document.querySelectorAll('.mode-toggle').forEach(el=>{
      el.classList.toggle('active', el.dataset.setMode===mode);
    });
    const knob = document.querySelector('#themeBtn .knob');
    if(knob){
      knob.textContent = mode==='light'?'☀':'🌙';
      const label = mode==='light'?'Switch to dark mode':'Switch to light mode';
      knob.parentElement?.setAttribute('aria-label', label);
      knob.parentElement?.setAttribute('title', label);
    }
  };



  if(!applyTheme.ready){
    applyTheme.ready = true;
    commit();
    return;
  }
  const unchanged = document.body.getAttribute('data-theme')===theme
                 && document.body.getAttribute('data-mode')===mode;
  if(unchanged){ commit(); return; }
  const reduceShift = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceShift){ commit(); return; }
  themeShiftTimers.forEach(clearTimeout);
  themeShiftTimers = [];
  const waitCover = ()=>Math.max(0, 320 - (performance.now() - themeShiftStart));
  if(document.body.classList.contains('theme-shifting')){
    /* rapid re-tap mid-sweep — land the new theme behind the current cover */
    themeShiftTimers.push(setTimeout(commit, waitCover()));
    themeShiftTimers.push(setTimeout(()=>document.body.classList.remove('theme-shifting'), waitCover() + 40));
    return;
  }
  themeShiftStart = performance.now();
  document.body.classList.add('theme-shifting');
  themeShiftTimers.push(setTimeout(commit, 320));
  themeShiftTimers.push(setTimeout(()=>document.body.classList.remove('theme-shifting'), 360));
}

/* ============================================================
   AUTOPLAY
   ============================================================ */
function startAutoPlay(){
  stopAutoPlay();
  if(!state.playing) return;
  if(state.view!=='study' && state.view!=='formula') return;
  state.autoTimer = setInterval(()=>{
    const steps = state.view==='formula'
      ? (FORMULAS.find(x=>x.id===state.formulaId)||FORMULAS[0]).steps
      : (getTopic(state.topicIdx).steps || []);
    const next = (state.step + 1) % steps.length;
    setStepInternal(next);
  }, state.autoMs);
}
function stopAutoPlay(){
  if(state.autoTimer){ clearInterval(state.autoTimer); state.autoTimer = null; }
}
function refreshPlayBtn(){
  const btn = document.getElementById('playBtn');
  if(!btn) return;
  btn.textContent = state.playing ? '⏸ Pause' : '▶ Play';
  btn.classList.toggle('paused', !state.playing);
}

/* ============================================================
   HEADER
   ============================================================ */
/* Account chip in the header. auth.js owns the session and the
   dropdown; this only renders the button and returns '' when there is
   no session (guest mode, or auth.js unavailable). */
function accountButton(){
  const auth = window.XC && window.XC.auth;
  if(!auth || typeof auth.session!=='function') return '';
  const s = auth.session();
  if(!s) return '';
  const label = s.name || s.email || 'Account';
  return `<button type="button" class="acct-btn" data-acct-toggle aria-expanded="false" aria-haspopup="true" aria-label="Account menu for ${escapeHtml(label)}">
      <span class="acct-avatar" aria-hidden="true">${escapeHtml(label.charAt(0).toUpperCase())}</span>
      <span class="acct-name">${escapeHtml(label)}</span>
      <span class="acct-caret" aria-hidden="true">▾</span>
    </button>`;
}

function header(){
  const activeView = state.view==='study'?'workspace':state.view==='formula'?'formulas':state.view;
  const navItem = (view,label) => `<button type="button" data-nav="${view}" class="${activeView===view?'active':''}" ${activeView===view?'aria-current="page"':''}>${label}</button>`;
  return `<header class="header"><div class="h-inner">
    <div class="h-left">
      <button type="button" class="logo-wrap" data-nav="landing" aria-label="XamCode AI home">
        <span class="logo-mark" aria-hidden="true"><img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" class="logo-mark-img" style="width:24px;height:24px;object-fit:contain;display:block;"></span>
        <span class="brand">XamCode <span class="brand-ai">AI</span></span>
      </button>
      <nav class="nav" aria-label="Main navigation">
        ${navItem('landing','HOME')}
        ${navItem('workspace','WORKSPACE')}
        ${navItem('formulas','FORMULAS')}
        ${navItem('library','LIBRARY')}
      </nav>
    </div>
    <div class="h-center">
      <button type="button" class="search-trigger" data-search-open aria-label="Search topics and formulas">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
        <span class="search-trigger-text">Search topics &amp; formulas</span>
        <kbd class="search-trigger-kbd" id="searchKbd">/</kbd>
      </button>
    </div>
    <div class="h-right">
      <button class="style-trigger" id="styleBtn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="styleModal" aria-label="Experience style selector"><span class="st-cube-icon" aria-hidden="true"><span class="fc f1"></span><span class="fc f2"></span><span class="fc f3"></span></span><span class="st-trig-lbl">Experience</span><span class="st-trig-cur" id="styleCurrentBadge">Vibe Studio</span></button>
      <select id="xc-nav-exam-days" class="xc-dock-3d-select" title="Exam Countdown Mode (2 Days vs 10 Days)" aria-label="Exam Countdown Mode" onchange="var s=document.getElementById('xc-exam-days-select');if(s)s.value=this.value;try{localStorage.setItem('xc_exam_days_mode',this.value);}catch(e){}">
        <option value="10days" selected>🎯 10-Day Mastery</option>
        <option value="2days" >🔥 2-Day Crash</option>
      </select>
      <button type="button" class="btn-ghost nav-cta-workspace" data-nav="workspace">Workspace</button>
      <button type="button" class="btn-primary nav-cta-upload" data-open="upload">Upload PDF ↗</button>
      ${accountButton()}
      <button type="button" class="mobile-menu-toggle" data-mobile-menu aria-expanded="false" aria-controls="mobileNav" aria-label="Open navigation">☰</button>
    </div>
    <nav class="mobile-nav" id="mobileNav" aria-label="Main navigation">
      ${navItem('landing','HOME')}
      ${navItem('workspace','WORKSPACE')}
      ${navItem('formulas','FORMULAS')}
      ${navItem('library','LIBRARY')}
      <div style="padding:12px 16px;border-top:1px solid var(--line2);display:flex;gap:8px;">
        <button type="button" class="btn-primary" data-open="upload" style="flex:1;">Upload PDF ↗</button>
        <button type="button" class="btn-ghost" data-nav="workspace" style="flex:1;">Workspace</button>
      </div>
    </nav>
  </div></header>`;
}

function footer(){
  return `<footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-mark" aria-hidden="true"><img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" class="logo-mark-img" style="width:24px;height:24px;object-fit:contain;display:block;"></span>
            <span class="brand">XamCode <span class="brand-ai">AI</span></span>
          </div>
          <p class="footer-tagline">Autonomous pedagogical AI platform transforming 20 to 400+ page technical documents into interactive, spatial 3D learning spaces and exam-verified mastery.</p>
          <div class="footer-pill-row">
            <span class="footer-pill">DPDP Act Compliant</span>
            <span class="footer-pill">Zero Hallucinations</span>
            <span class="footer-pill">India Baseline</span>
          </div>
        </div>
        <div class="footer-nav-group">
          <h4>Platform</h4>
          <button type="button" data-nav="landing">Home</button>
          <button type="button" data-nav="workspace">Workspace</button>
          <button type="button" data-nav="formulas">Formula Studio</button>
          <button type="button" data-nav="library">My Library</button>
          <button type="button" data-open="upload">Upload PDF</button>
        </div>
        <div class="footer-nav-group">
          <h4>Pedagogy</h4>
          <button type="button" data-dock-action="simulation">3D Visual Engine</button>
          <button type="button" data-dock-action="quiz">Socratic Quizzes</button>
          <button type="button" data-dock-action="vaathiyar">Vaathiyar Mode</button>
          <button type="button" data-dock-action="curriculum">Sample Course</button>
        </div>
        <div class="footer-nav-group">
          <h4>Compliance & Legal</h4>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
          <a href="/accessibility-statement">Accessibility Statement</a>
          <a href="/robots.txt">Robots.txt</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 XamCode AI • Created By Achudhan • support@xamcode.ai</p>
        <p class="footer-disclaimer">Academic study tool grounded in user-provided documents. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function renderNetworkSvg(){
  return `<svg viewBox="0 0 640 440" width="560" height="340" role="img" aria-label="Illustration of data moving between devices through a network router" style="width:100%;max-width:560px;height:340px;display:block;margin:0 auto;">
    <defs>
      <linearGradient id="networkLine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6477ff" stop-opacity=".12"/><stop offset=".5" stop-color="#70e8d4" stop-opacity=".7"/><stop offset="1" stop-color="#6477ff" stop-opacity=".18"/></linearGradient>
      <linearGradient id="networkRouter" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#273b5d"/><stop offset="1" stop-color="#131e32"/></linearGradient>
      <radialGradient id="networkHalo"><stop stop-color="#47d8c3" stop-opacity=".22"/><stop offset="1" stop-color="#47d8c3" stop-opacity="0"/></radialGradient>
      <filter id="networkBlur"><feGaussianBlur stdDeviation="25"/></filter>
      <filter id="networkGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <pattern id="networkGrid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0v36" fill="none" stroke="#a7b6d1" stroke-opacity=".08"/></pattern>
    </defs>
    <rect width="640" height="440" fill="url(#networkGrid)"/>
    <circle cx="322" cy="218" r="210" fill="url(#networkHalo)" filter="url(#networkBlur)"/>
    <g fill="none" stroke="url(#networkLine)" stroke-width="2"><path d="M139 117 286 187M499 104 359 184M119 320l166-69m218 98-144-75M207 388l98-108"/><path d="M139 117 499 104 503 349 207 388 119 320z" stroke-opacity=".28" stroke-dasharray="4 10"/></g>
    <g class="network-device" transform="translate(286 172)">
      <path d="m0 28 72-39 72 39-72 42z" fill="#0c1727" stroke="#83f3e0" stroke-opacity=".55"/>
      <path d="m0 28 72 42v78L0 106z" fill="#17263b" stroke="#83f3e0" stroke-opacity=".38"/>
      <path d="m72 70 72-42v78l-72 42z" fill="#0e1a2c" stroke="#83f3e0" stroke-opacity=".32"/>
      <path d="m20 34 52-28 49 28-49 28z" fill="url(#networkRouter)" stroke="#91f9e7"/>
      <path d="m21 36 50 29v49L21 86z" fill="url(#networkRouter)" stroke="#61d9d2"/>
      <path d="m71 65 49-29v49l-49 29z" fill="#172740" stroke="#61d9d2"/>
      <path d="M42 75v10m14-2v10m14-2v10m14-22v10m14-18v10" stroke="#a3fff0" stroke-width="3" stroke-linecap="round" filter="url(#networkGlow)"/>
    </g>
    <g class="network-endpoint" transform="translate(103 78)"><rect width="72" height="88" rx="12" fill="#111e32" stroke="#91a4c5" stroke-opacity=".5"/><rect x="9" y="9" width="54" height="63" rx="6" fill="#182942"/><path d="m29 80 14 0m-7-8v8" stroke="#879ab9" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="40" r="11" fill="#78f0dc" fill-opacity=".16"/><path d="m33 35 8 5-8 5z" fill="#96f4e6"/></g>
    <g class="network-endpoint" transform="translate(462 67)"><rect width="76" height="68" rx="13" fill="#111e32" stroke="#91a4c5" stroke-opacity=".5"/><rect x="9" y="9" width="58" height="42" rx="6" fill="#182942"/><path d="M26 60h24m-12-9v9m-10-30h8m5 0h8m-21 7h20" stroke="#91f3e2" stroke-width="2" stroke-linecap="round"/></g>
    <g class="network-endpoint" transform="translate(82 290)"><rect width="76" height="54" rx="14" fill="#111e32" stroke="#91a4c5" stroke-opacity=".5"/><circle cx="19" cy="27" r="5" fill="#72ead9"/><circle cx="38" cy="27" r="5" fill="#667a9a"/><circle cx="57" cy="27" r="5" fill="#667a9a"/></g>
    <g class="network-endpoint" transform="translate(468 313)"><path d="M8 24 38 7l30 17v39l-30 17L8 63z" fill="#14243a" stroke="#91a4c5" stroke-opacity=".5"/><path d="m8 24 30 18 30-18M38 42v38" fill="none" stroke="#61d9d2"/><circle cx="38" cy="40" r="5" fill="#80f2df" filter="url(#networkGlow)"/></g>
    <g fill="#d6fff7" filter="url(#networkGlow)"><circle r="4"><animateMotion dur="3.2s" repeatCount="indefinite" path="M175 121 306 205"/></circle><circle r="4"><animateMotion dur="3.6s" begin="-1.2s" repeatCount="indefinite" path="M480 101 358 179"/></circle><circle r="4"><animateMotion dur="3.4s" begin="-2s" repeatCount="indefinite" path="M156 317 289 251"/></circle></g>
    <g font-family="ui-monospace,monospace" font-size="10" font-weight="600" letter-spacing="1.3" fill="#9baec9"><text x="101" y="184">CLIENT</text><text x="465" y="153">SERVER</text><text x="82" y="366">DEVICE 03</text><text x="466" y="407">GATEWAY</text></g>
  </svg>`;
}

let activePreviewPlayer = null;
function initInteractivePreview(){
  const stage = document.getElementById('pvStage');
  if(!stage) return;
  if(activePreviewPlayer && typeof activePreviewPlayer.destroy === 'function'){
    try { activePreviewPlayer.destroy(); } catch(e){}
    activePreviewPlayer = null;
  }
  
  function switchPreview(type){
    if(activePreviewPlayer && typeof activePreviewPlayer.destroy === 'function'){
      try { activePreviewPlayer.destroy(); } catch(e){}
      activePreviewPlayer = null;
    }
    stage.innerHTML = '';
    
    document.querySelectorAll('.pv-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.pvTab === type);
    });
    
    const titleEl = document.getElementById('pvTitle');
    const subEl = document.getElementById('pvSub');
    const askBtn = document.getElementById('pvAskAura');
    
    if(type === 'bicycle' && window.XC && window.XC.auraVisuals){
      activePreviewPlayer = window.XC.auraVisuals.createPlayer('bicycle', { cadence: 75, gearRatio: 2.5 });
      stage.appendChild(activePreviewPlayer.el);
      if(titleEl) titleEl.textContent = 'Kinematic Mechanical Drive';
      if(subEl) subEl.textContent = 'Pedal crank rotation, moving chain, gear ratio transmission & live km/h speed';
      if(askBtn) askBtn.onclick = () => { if(window.XC.aura){ window.XC.aura.open(); window.XC.aura.ask('How does a bicycle work?'); } };



    } else if(type === 'engine' && window.XC && window.XC.auraVisuals){
      activePreviewPlayer = window.XC.auraVisuals.createPlayer('engine', { rpm: 1800 });
      stage.appendChild(activePreviewPlayer.el);
      if(titleEl) titleEl.textContent = 'Four-Stroke Otto Cycle';
      if(subEl) subEl.textContent = 'Slider-crank kinematics, reciprocating piston, spark flame & 4-stroke cycle phases';
      if(askBtn) askBtn.onclick = () => { if(window.XC.aura){ window.XC.aura.open(); window.XC.aura.ask('Explain the four-stroke internal combustion engine cycle'); } };



    } else if(type === 'heart' && window.XC && window.XC.auraVisuals){
      activePreviewPlayer = window.XC.auraVisuals.createPlayer('heart', { bpm: 72 });
      stage.appendChild(activePreviewPlayer.el);
      if(titleEl) titleEl.textContent = 'Cardiac Cycle & ECG Waveform';
      if(subEl) subEl.textContent = 'Atrial/ventricular systole & diastole with real-time synchronized ECG voltage graph';
      if(askBtn) askBtn.onclick = () => { if(window.XC.aura){ window.XC.aura.open(); window.XC.aura.ask('How does the human heart pump blood through the cardiac chambers?'); } };



    } else if(type === 'sort' && window.XC && window.XC.interactiveSimulations){
      const steps = window.XC.interactiveSimulations.generateBubbleSortSteps([5, 1, 4, 2, 8]);
      const initialStep = steps[0] || {};



      stage.innerHTML = window.XC.interactiveSimulations.renderBubbleSortPlayerHtml('pvStageBubble', 0, steps.length, initialStep, 1, false);
      if(titleEl) titleEl.textContent = 'Algorithm State Machine';
      if(subEl) subEl.textContent = 'Bubble Sort deterministic trace with step-by-step comparisons, swaps & pseudocode';
      if(askBtn) askBtn.onclick = () => { if(window.XC.aura){ window.XC.aura.open(); window.XC.aura.ask('How does Bubble Sort work step by step?'); } };



    } else {
      stage.innerHTML = renderNetworkSvg();
      if(titleEl) titleEl.textContent = 'Network Layer Architecture';
      if(subEl) subEl.textContent = 'OSI 7-layer packet journey, router routing tables & TCP/IP stack';
      if(askBtn) askBtn.onclick = () => { if(window.XC.aura){ window.XC.aura.open(); window.XC.aura.ask('Explain the OSI 7-layer model vs TCP/IP architecture'); } };



    }
  }

  document.querySelectorAll('.pv-tab').forEach(b => {
    b.onclick = () => switchPreview(b.dataset.pvTab);
  });
  
  switchPreview('engine');
}


const VAATHIYAR_SHOWCASE_SECTIONS = [
  {
    title: '1. Overview & Core Intuition',
    tag: 'INTUITION',
    html: '<h4 style="margin:0 0 8px;font-size:16px;color:var(--paper);">Why Layered Architecture Exists</h4>' +
          '<p style="color:var(--mut);font-size:14px;line-height:1.6;margin:0 0 12px;">Without layering, every software program would need custom code to talk to Wi-Fi antennas, fiber cables, and satellite links. The OSI 7-Layer model divides network communication into seven independent abstraction layers where each layer performs a specific service for the layer above it.</p>' +
          '<div style="background:var(--card-alt);border:1px solid var(--line);border-radius:8px;padding:12px;font-family:var(--mono);font-size:12px;color:var(--lime);">' +
          'Principle: Changing the Physical layer (e.g., from copper wire to optical fiber) requires ZERO changes to your HTTP/Web browser application layer!' +
          '</div>'
  },
  {
    title: '2. Real-World Analogy',
    tag: 'ANALOGY',
    html: '<h4 style="margin:0 0 8px;font-size:16px;color:var(--paper);">The International Postal Letter Analogy</h4>' +
          '<p style="color:var(--mut);font-size:14px;line-height:1.6;margin:0 0 12px;">Imagine writing a letter to a friend in Tokyo. You write the text (<b>Application</b>), translate to common format (<b>Presentation</b>), start a correspondence (<b>Session</b>), seal it in an envelope with return guarantee (<b>Transport/TCP</b>), write street address (<b>Network/IP</b>), put in mail truck (<b>Data Link/Ethernet</b>), and drive on asphalt roads (<b>Physical wire</b>).</p>' +
          '<p style="color:var(--mut);font-size:13.5px;line-height:1.5;margin:0;">The postman does not read your private message — they only inspect the envelope headers.</p>'
  },
  {
    title: '3. Mechanical & Working Principles',
    tag: 'MECHANICS',
    html: '<h4 style="margin:0 0 8px;font-size:16px;color:var(--paper);">Data Encapsulation & Decapsulation</h4>' +
          '<p style="color:var(--mut);font-size:14px;line-height:1.6;margin:0 0 12px;">As user data moves downward through the OSI stack, each layer wraps the payload by prepending its own protocol header (PDU):</p>' +
          '<div style="display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:12px;">' +
          '<div style="background:var(--card-alt);padding:6px 12px;border-radius:6px;border-left:3px solid #7C3AED;">Layer 7-5: Application Data [Payload]</div>' +
          '<div style="background:var(--card-alt);padding:6px 12px;border-radius:6px;border-left:3px solid #2563EB;">Layer 4 (Transport): [TCP Header | Data] -&gt; <b>Segment</b></div>' +
          '<div style="background:var(--card-alt);padding:6px 12px;border-radius:6px;border-left:3px solid #06B6D4;">Layer 3 (Network): [IP Header | TCP Header | Data] -&gt; <b>Packet</b></div>' +
          '<div style="background:var(--card-alt);padding:6px 12px;border-radius:6px;border-left:3px solid #10B981;">Layer 2 (Data Link): [MAC Header | IP Header | TCP Header | Data | FCS] -&gt; <b>Frame</b></div>' +
          '</div>'
  },
  {
    title: '4. Multi-Level Explanation',
    tag: 'MULTI-LEVEL',
    html: '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">' +
          '<div style="background:var(--card-alt);padding:14px;border-radius:8px;border:1px solid var(--line);">' +
          '<span style="font-family:var(--mono);font-size:10.5px;font-weight:700;color:#10B981;">LEVEL 1: ELI5</span>' +
          '<p style="font-size:13px;color:var(--mut);line-height:1.5;margin:8px 0 0;">Russian nesting dolls. You pack your message into smaller and smaller boxes so trucks can ship it safely.</p>' +
          '</div>' +
          '<div style="background:var(--card-alt);padding:14px;border-radius:8px;border:1px solid var(--line);">' +
          '<span style="font-family:var(--mono);font-size:10.5px;font-weight:700;color:#2563EB;">LEVEL 2: EXAM DEFINITION</span>' +
          '<p style="font-size:13px;color:var(--mut);line-height:1.5;margin:8px 0 0;">A 7-tier reference framework (ISO/IEC 7498-1) standardizing communication functions regardless of underlying hardware architecture.</p>' +
          '</div>' +
          '<div style="background:var(--card-alt);padding:14px;border-radius:8px;border:1px solid var(--line);">' +
          '<span style="font-family:var(--mono);font-size:10.5px;font-weight:700;color:#7C3AED;">LEVEL 3: DEEP DIVE</span>' +
          '<p style="font-size:13px;color:var(--mut);line-height:1.5;margin:8px 0 0;">Kernel socket buffers (sk_buff), NIC ring descriptors, interrupt coalescing, and protocol demultiplexing via ethertype &amp; IP protocol numbers.</p>' +
          '</div>' +
          '</div>'
  },
  {
    title: '5. Traps & Common Exam Pitfalls',
    tag: 'TRAPS & TRUTHS',
    html: '<h4 style="margin:0 0 8px;font-size:16px;color:#EF4444;">Top 3 Mistakes Students Make in Anna Univ / GATE</h4>' +
          '<ul style="margin:0;padding-left:18px;color:var(--mut);font-size:13.5px;line-height:1.6;">' +
          '<li><b>Trap 1:</b> Thinking IP addresses deliver packets to specific applications. <i>Truth:</i> IP addresses reach the host machine; <b>Port numbers (Transport layer)</b> deliver to the specific application process.</li>' +
          '<li><b>Trap 2:</b> Believing OSI and TCP/IP have the same layer count. <i>Truth:</i> OSI has 7 layers; TCP/IP compresses Session &amp; Presentation into Application (4 or 5 layers).</li>' +
          '<li><b>Trap 3:</b> Confusing MAC address (hop-by-hop local link) with IP address (end-to-end host identifier).</li>' +
          '</ul>'
  },
  {
    title: '6. Comparison Matrix: TCP vs UDP',
    tag: 'COMPARISON',
    html: '<table style="width:100%;border-collapse:collapse;font-size:13px;color:var(--mut);">' +
          '<thead>' +
          '<tr style="border-bottom:1px solid var(--line);text-align:left;color:var(--paper);">' +
          '<th style="padding:8px 10px;">Metric</th>' +
          '<th style="padding:8px 10px;color:var(--lime);">TCP (Transmission Control)</th>' +
          '<th style="padding:8px 10px;color:var(--violet);">UDP (User Datagram)</th>' +
          '</tr>' +
          '</thead>' +
          '<tbody>' +
          '<tr style="border-bottom:1px solid var(--line);"><td style="padding:8px 10px;font-weight:600;">Connection</td><td style="padding:8px 10px;">Connection-oriented (3-way handshake)</td><td style="padding:8px 10px;">Connectionless (fire &amp; forget)</td></tr>' +
          '<tr style="border-bottom:1px solid var(--line);"><td style="padding:8px 10px;font-weight:600;">Reliability</td><td style="padding:8px 10px;">Guaranteed (ACK + retransmissions)</td><td style="padding:8px 10px;">Unreliable (no ACKs, packets may drop)</td></tr>' +
          '<tr style="border-bottom:1px solid var(--line);"><td style="padding:8px 10px;font-weight:600;">Header Overhead</td><td style="padding:8px 10px;">20 - 60 Bytes</td><td style="padding:8px 10px;">8 Bytes (fixed, lightweight)</td></tr>' +
          '<tr><td style="padding:8px 10px;font-weight:600;">Use Cases</td><td style="padding:8px 10px;">Web (HTTP), Email (SMTP), File transfer</td><td style="padding:8px 10px;">DNS, Video streaming, Multiplayer gaming</td></tr>' +
          '</tbody>' +
          '</table>'
  },
  {
    title: '7. Worked Problem & Formula',
    tag: 'WORKED EXAMPLE',
    html: '<div style="font-family:var(--mono);font-size:13px;color:var(--paper);background:var(--card-alt);padding:14px;border-radius:8px;border:1px solid var(--line);">' +
          '<div style="color:var(--lime);font-weight:700;margin-bottom:6px;">PROBLEM: Bandwidth-Delay Product (BDP)</div>' +
          '<p style="margin:0 0 8px;font-size:12.5px;color:var(--mut);font-family:var(--body);">A 100 Mbps fiber link has a Round-Trip Time (RTT) of 40 ms. How much data can be "in flight" on the wire?</p>' +
          '<div style="background:var(--card);color:var(--paper);padding:10px;border-radius:6px;border:1px solid var(--line);font-size:12px;margin-bottom:8px;">' +
          '<b>Formula:</b> BDP = Bandwidth × RTT<br>' +
          'BDP = (100 × 10^6 bits/sec) × (0.040 sec)<br>' +
          'BDP = 4,000,000 bits = <b>500 Kilobytes (0.5 MB)</b>' +
          '</div>' +
          '<span style="font-size:11.5px;color:#10B981;">Exam Insight: This represents the minimum TCP receive window needed to saturate the link!</span>' +
          '</div>'
  },
  {
    title: '8. Cheat Code & Recall Mnemonics',
    tag: 'CHEAT CODE',
    html: '<div style="background:var(--accent-soft);border:1px solid rgba(37,99,235,0.2);border-radius:8px;padding:16px;">' +
          '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--lime);margin-bottom:6px;">⚡ HIGH-YIELD MNEMONIC</div>' +
          '<div style="font-size:16px;font-weight:800;color:var(--paper);margin-bottom:8px;">' +
          '"Please Do Not Throw Sausage Pizza Away"' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;">' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>P</b>hysical</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>D</b>ata Link</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>N</b>etwork</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>T</b>ransport</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>S</b>ession</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>P</b>resentation</span>' +
          '<span style="background:var(--card);color:var(--paper);padding:3px 8px;border-radius:4px;border:1px solid var(--line);"><b>A</b>pplication</span>' +
          '</div>' +
          '</div>'
  }
];

function initVaathiyarTabs(){
  const container = document.getElementById('landingVaathiyarCard');
  if(!container) return;
  const content = document.getElementById('landingVaathiyarContent');
  if(!content) return;

  function renderVTab(idx){
    const item = VAATHIYAR_SHOWCASE_SECTIONS[idx] || VAATHIYAR_SHOWCASE_SECTIONS[0];
    content.innerHTML = item.html;
    container.querySelectorAll('.wc-vaathiyar-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === idx);
    });
  }

  container.querySelectorAll('.wc-vaathiyar-tab').forEach((tab, i) => {
    tab.onclick = () => renderVTab(i);
  });

  renderVTab(0);
}

function initLandingQuiz(){
  const card = document.getElementById('landingQuizCard');
  if(!card) return;
  const fb = document.getElementById('landingQuizFeedback');

  card.querySelectorAll('.wc-quiz-opt').forEach(opt => {
    opt.onclick = () => {
      const idx = parseInt(opt.dataset.landingOpt, 10);
      card.querySelectorAll('.wc-quiz-opt').forEach(o => {
        o.classList.remove('correct', 'wrong');
        const ind = o.querySelector('.wc-opt-indicator');
        if(ind) ind.textContent = 'Select';
      });

      if(idx === 1){ // Transport Layer - correct!
        opt.classList.add('correct');
        const ind = opt.querySelector('.wc-opt-indicator');
        if(ind) ind.textContent = '✓ Correct';
        if(fb){
          fb.className = 'wc-quiz-feedback visible success';
          fb.innerHTML = '<b>✓ Verified Mastery (+50 XP):</b> The Transport Layer (Layer 4) handles end-to-end communication, port addressing (TCP/UDP), segment sequencing, and reliable retransmissions.';
        }
      } else {
        opt.classList.add('wrong');
        const ind = opt.querySelector('.wc-opt-indicator');
        if(ind) ind.textContent = '✕ Incorrect';
        if(fb){
          fb.className = 'wc-quiz-feedback visible diagnostic';
          if(idx === 0){
            fb.innerHTML = '<b>✕ Diagnostic:</b> The Network Layer (IP) handles logical host-to-host routing across networks, but does NOT guarantee segment reliability or port-level multiplexing.';
          } else {
            fb.innerHTML = '<b>✕ Diagnostic:</b> The Data Link Layer operates solely on the local physical link (hop-by-hop framing via MAC addresses), not across end-to-end internet routes.';
          }
        }
      }
    };



  });
}

function landingView(){
  const totalQuestions = TOPICS.reduce((sum,t)=>sum+t.questions.length,0);
  const unitCount = new Set(TOPICS.map(t=>t.unit||'I')).size;
  return header() + '<main class="page-shell">' +
    '<!-- HERO SECTION -->' +
    '<section class="hero opening" id="opening">' +
      '<canvas id="heroCanvas" aria-hidden="true"></canvas>' +
      '<div class="shade" aria-hidden="true"></div>' +
      '<div class="hero-layout">' +
        '<div class="hero-copy hero-in">' +
          '<div class="tag kick"><span class="dot"></span><span>AI PEDAGOGICAL PLATFORM · GROUNDED KNOWLEDGE ENGINE</span></div>' +
          '<h1 class="frag">Transform 20 to 400+ Page PDFs Into <span class="hl hl-blue">Human-Paced,</span> <span class="out hl-accent">Interactive 3D Study Spaces.</span></h1>' +
          '<p class="sub lede"><b>XamCode AI</b> turns dense textbooks, lecture slides, and research papers into animated, unit-by-unit study lessons, pedagogical slow-motion simulations, and continuous Socratic quizzes for verified exam mastery.</p>' +
          '<div class="schip-row"><span class="schip">GROUNDED IN YOUR PDF · ZERO HALLUCINATIONS</span></div>' +
          '<div class="hp stats" aria-label="Sample course contents">' +
            '<span><b>' + unitCount + '</b><small>REFERENCE UNITS</small></span>' +
            '<span><b>' + TOPICS.length + '</b><small>GROUNDED CONCEPTS</small></span>' +
            '<span><b>' + totalQuestions + '</b><small>SOCRATIC QUESTIONS</small></span>' +
            '<span><b>5</b><small>3D STYLE ENGINES</small></span>' +
          '</div>' +
          '<div class="crow hero-btns">' +
            '<button class="btn lime primary btn-hero" data-open="upload">Upload PDF &amp; Build 3D Space <span aria-hidden="true">↗</span></button>' +
            '<button class="btn btn-hero-outline" data-nav="workspace">Open Interactive Workspace →</button>' +
            '<button class="btn btn-hero-outline" data-nav="formulas">Formula Matrix (31)</button>' +
          '</div>' +
          '<div class="hmeta"><span>CH.01–05 · SUBJECT-AGNOSTIC STUDY ENGINE</span><span>VAATHIYAR 8-PILLAR MASTERCLASS + AURA AI TUTOR</span></div>' +
        '</div>' +
        "<div class=\"hero-3d-stage\" id=\"hero3dStage\" aria-hidden=\"true\"><div class=\"scene-3d-root\" id=\"scene3dRoot\"><div class=\"orb-ring or-1\"></div><div class=\"orb-ring or-2\"></div><div class=\"orb-ring or-3\"></div><div class=\"poly-3d\"><div class=\"poly-face pf-front\"><span class=\"pf-tag\">CORE // ENGINE</span><span class=\"pf-code\">Subject-Agnostic<br>Syllabus Pipeline</span></div><div class=\"poly-face pf-back\"><span class=\"pf-tag\">AURA // TUTOR</span><span class=\"pf-code\">Context-Grounded<br>Visual Recipes</span></div><div class=\"poly-face pf-right\"><span class=\"pf-tag\">DEMO // COURSE</span><span class=\"pf-code\">Computer Networks<br>Sample Syllabus</span></div><div class=\"poly-face pf-left\"><span class=\"pf-tag\">PROOF // WEIGHT</span><span class=\"pf-code\">Deterministic<br>Milestone State</span></div><div class=\"poly-face pf-top\"><span class=\"pf-tag\">UNITS // CHUNKED</span><span class=\"pf-code\">Lexical Grounding</span></div><div class=\"poly-face pf-bottom\"><span class=\"pf-tag\">RECALL // QUIZ</span><span class=\"pf-code\">Vaathiyar Mode</span></div><div class=\"poly-core\"><div class=\"core-face cf-1\"></div><div class=\"core-face cf-2\"></div><div class=\"core-face cf-3\"></div><div class=\"core-face cf-4\"></div><div class=\"core-face cf-5\"></div><div class=\"core-face cf-6\"></div></div></div><div class=\"sat-3d s1\"><span class=\"sat-k\">Architecture</span><span class=\"sat-v\">Subject-Agnostic Core</span></div><div class=\"sat-3d s2\"><span class=\"sat-k\">Demo Course</span><span class=\"sat-v\">Computer Networks</span></div><div class=\"sat-3d s3\"><span class=\"sat-k\">Telemetry</span><span class=\"sat-v\">Verified Milestones</span></div></div></div>" +
      '</div>' +
      '<div class="ch-foot"><div class="scroll"><span class="mouse"></span><span>SCROLL TO ENTER THE STUDY ENGINE</span></div><span>LIVE INTERACTIVE PIPELINE ↓</span></div>' +
    '</section>' +

    '<!-- SECTION 1: INTERACTIVE PIPELINE & QUICK DOCK -->' +
    '<section class="wc-section" id="pipelineSection">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">ACT 01 · SUBJECT-AGNOSTIC TRANSFORMATION PIPELINE</span>' +
        '<h2 class="wc-section-title">From Raw PDF To Interactive Mastery.<br><span>Inspect Every Stage Live.</span></h2>' +
        '<p class="wc-section-sub">Jump directly to any pedagogical module or scrub through the 5-stage AI transformation pipeline below.</p>' +
      '</div>' +
      '<div class="hero-dock" role="toolbar" aria-label="Quick interactive learning tools">' +
        '<button type="button" class="dock-item" data-open="upload" title="Upload PDF and generate interactive study plan">' +
          '<span class="dock-icon">📄</span>' +
          '<span class="dock-name">PDF Ingestion</span>' +
          '<span class="dock-hint">Multi-Modal</span>' +
        '</button>' +
        '<button type="button" class="dock-item" data-dock-action="curriculum" title="Inspect structured units and prerequisite topics">' +
          '<span class="dock-icon">🏛️</span>' +
          '<span class="dock-name">Course Plan</span>' +
          '<span class="dock-hint">5 Units</span>' +
        '</button>' +
        '<button type="button" class="dock-item" data-dock-action="simulation" title="Test educational slow-motion simulations">' +
          '<span class="dock-icon">⚡</span>' +
          '<span class="dock-name">3D Simulation</span>' +
          '<span class="dock-hint">Slow-Mo</span>' +
        '</button>' +
        '<button type="button" class="dock-item" data-dock-action="quiz" title="Try in-situ active recall quizzes">' +
          '<span class="dock-icon">❓</span>' +
          '<span class="dock-name">In-Situ Quiz</span>' +
          '<span class="dock-hint">Socratic</span>' +
        '</button>' +
        '<button type="button" class="dock-item" data-dock-action="vaathiyar" title="Open 8-section Vaathiyar masterclass">' +
          '<span class="dock-icon">🎓</span>' +
          '<span class="dock-name">Vaathiyar Mode</span>' +
          '<span class="dock-hint">8 Pillars</span>' +
        '</button>' +
        '<button type="button" class="dock-item" data-nav="formulas" title="Open mathematical formula derivations">' +
          '<span class="dock-icon">📐</span>' +
          '<span class="dock-name">Formula Matrix</span>' +
          '<span class="dock-hint">31 Equations</span>' +
        '</button>' +
      '</div>' +
      '<div id="heroPipelineMount" style="width:100%;"></div>' +
    '</section>' +

    '<!-- SECTION 2: THE NIGHT-BEFORE-EXAM DILEMMA -->' +
    '<section class="wc-section">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">THE NIGHT-BEFORE-EXAM DILEMMA</span>' +
        '<h2 class="wc-section-title">Why Traditional Studying Fails.<br><span>How XAMCODE AI Makes It Stick.</span></h2>' +
        '<p class="wc-section-sub">Staring at a 300-page unsearchable PDF at 2 AM induces cognitive overload. XAMCODE AI transforms passive reading into active, spatial mastery.</p>' +
      '</div>' +

      '<div class="wc-dilemma-grid">' +
        '<!-- Old Way -->' +
        '<div class="wc-dilemma-card old-way">' +
          '<span class="wc-dilemma-badge">✕ THE TRADITIONAL TEXTBOOK TRAP</span>' +
          '<h3 class="wc-dilemma-heading">300 Pages of Dense Text &amp; Guesswork</h3>' +
          '<ul class="wc-dilemma-list">' +
            '<li>' +
              '<span class="wc-dilemma-icon">✕</span>' +
              '<div><b>Passive Reading Fatigue:</b> Reading 40 pages of continuous monochrome text with zero interactive feedback leads to 80% recall decay within 24 hours.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✕</span>' +
              '<div><b>Static, Confusing Diagrams:</b> Complex machinery (piston strokes, valve overlap) and algorithms are frozen on page 142 with no motion or temporal context.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✕</span>' +
              '<div><b>No In-Situ Verification:</b> You don\'t know what you don\'t know until the actual exam question paper is in front of you.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✕</span>' +
              '<div><b>Unorganized Panic:</b> Flipping through 12 chapters searching for relevant formulas and cheat codes minutes before the exam starts.</div>' +
            '</li>' +
          '</ul>' +
        '</div>' +

        '<!-- XAMCODE AI Way -->' +
        '<div class="wc-dilemma-card xamcode-way">' +
          '<span class="wc-dilemma-badge">✓ THE XAMCODE AI METHOD</span>' +
          '<h3 class="wc-dilemma-heading">Decomposed Spatial Mastery &amp; Quizzes</h3>' +
          '<ul class="wc-dilemma-list">' +
            '<li>' +
              '<span class="wc-dilemma-icon">✓</span>' +
              '<div><b>Autonomous Curriculum Decomposition:</b> Dense PDFs are split into 5 digestible units and topic hierarchies with clear prerequisite maps.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✓</span>' +
              '<div><b>Pedagogical Slow-Motion Visuals:</b> Interactive 3D/SVG simulations running at 0.25x educational baseline with cycle scrubbers and component isolation.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✓</span>' +
              '<div><b>Continuous In-Situ Quizzes:</b> Socratic knowledge checks after every single concept with instant misconception diagnostics.</div>' +
            '</li>' +
            '<li>' +
              '<span class="wc-dilemma-icon">✓</span>' +
              '<div><b>One-Click Exam Cheat Codes:</b> 8-section Vaathiyar mode, memory mnemonics, and worked mathematical derivations ready for high-speed review.</div>' +
            '</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<!-- SECTION 3: PILLAR 1 — INTERACTIVE PEDAGOGICAL VISUAL ENGINE -->' +
    '<section class="wc-section">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">CORE PILLAR 1 • PEDAGOGICAL VISUAL ENGINE</span>' +
        '<h2 class="wc-section-title">See How Complex Systems Move.<br><span>At Your Own Learning Speed.</span></h2>' +
        '<p class="wc-section-sub">No chaotic 600 RPM animations. Every simulation operates under strict educational pacing with floating HUD speed controls, cycle scrubbers, and component isolation.</p>' +
      '</div>' +

      '<!-- Visual Simulation Interactive Player & Selector -->' +
      '<div class="preview" id="heroInteractivePreview" style="background:var(--card);border:1px solid var(--line);box-shadow:0 18px 44px rgba(0,0,0,0.14);border-radius:20px;overflow:hidden;margin-bottom:28px;">' +
        '<div class="pv-head" style="background:var(--card-alt);border-bottom:1px solid var(--line);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
          '<span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--lime);display:inline-flex;align-items:center;gap:6px;"><i style="width:7px;height:7px;border-radius:50%;background:#10B981;display:inline-block;"></i> DYNAMIC SIMULATION VIEWPORT</span>' +
          '<div class="pv-tabs" role="tablist" aria-label="Visual simulations">' +
            '<button type="button" class="pv-tab active" data-pv-tab="engine">⚙️ 4-Stroke Engine</button>' +
            '<button type="button" class="pv-tab" data-pv-tab="bicycle">🚲 Bicycle Kinematics</button>' +
            '<button type="button" class="pv-tab" data-pv-tab="heart">🫀 Cardiac Cycle</button>' +
            '<button type="button" class="pv-tab" data-pv-tab="sort">📊 Bubble Sort</button>' +
            '<button type="button" class="pv-tab" data-pv-tab="network">🌐 TCP/IP Packet Routing</button>' +
          '</div>' +
        '</div>' +
        '<div class="pv-scene" id="pvStage" style="min-height:360px;position:relative;display:flex;align-items:center;justify-content:center;background:#0b101b;border-radius:0;overflow:hidden;padding:16px;"></div>' +
        '<div class="pv-caption" id="pvCaption" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:var(--card-alt);border-top:1px solid var(--line);">' +
          '<span class="pv-caption-icon" style="font-size:18px;">⚡</span>' +
          '<span style="flex:1;"><b id="pvTitle" style="font-family:var(--disp);font-size:15px;color:var(--paper);display:block;">Four-Stroke Otto Cycle</b><small id="pvSub" style="font-size:12.5px;color:var(--mut);">Slider-crank kinematics, reciprocating piston, spark flame &amp; 4-stroke cycle phases</small></span>' +
          '<button type="button" class="btn-sm" id="pvAskAura" style="padding:6px 14px;font-size:12px;background:var(--lime);color:#FFFFFF;border:none;border-radius:999px;cursor:pointer;font-weight:600;box-shadow:0 2px 8px rgba(37,99,235,0.3);">Ask AURA AI ↗</button>' +
        '</div>' +
      '</div>' +

      '<!-- 4 Multi-Subject Cards Grid -->' +
      '<div class="wc-visuals-grid">' +
        '<div class="wc-visual-card" data-launch-sim="engine">' +
          '<div class="wc-visual-icon">⚙️</div>' +
          '<h4 class="wc-visual-title">Mechanical: 4-Stroke IC Engine</h4>' +
          '<p class="wc-visual-desc">Reciprocating piston motion, intake &amp; exhaust valve timing, spark ignition combustion flame, and Otto cycle PV diagram.</p>' +
          '<span class="wc-visual-action">Test Simulation →</span>' +
        '</div>' +
        '<div class="wc-visual-card" data-launch-sim="bicycle">' +
          '<div class="wc-visual-icon">🚲</div>' +
          '<h4 class="wc-visual-title">Kinematics: Bicycle Drive</h4>' +
          '<p class="wc-visual-desc">Pedal crank rotation, chain link movement, front-to-rear gear ratio transmission, and dynamic km/h velocity calculations.</p>' +
          '<span class="wc-visual-action">Test Simulation →</span>' +
        '</div>' +
        '<div class="wc-visual-card" data-launch-sim="heart">' +
          '<div class="wc-visual-icon">🫀</div>' +
          '<h4 class="wc-visual-title">Biological: Cardiac Cycle &amp; ECG</h4>' +
          '<p class="wc-visual-desc">4-chamber pumping cycle (atria &amp; ventricles) with synchronized real-time electrocardiogram (ECG P-Q-R-S-T) voltage waveform.</p>' +
          '<span class="wc-visual-action">Test Simulation →</span>' +
        '</div>' +
        '<div class="wc-visual-card" data-launch-sim="sort">' +
          '<div class="wc-visual-icon">📊</div>' +
          '<h4 class="wc-visual-title">Algorithms: Sorting State Machine</h4>' +
          '<p class="wc-visual-desc">Deterministic Bubble Sort trace with step-by-step element comparisons, animated bar swaps, and live line-by-line pseudocode highlighting.</p>' +
          '<span class="wc-visual-action">Test Simulator →</span>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<!-- SECTION 4: PILLAR 2 — CONTINUOUS IN-SITU QUIZ ENGINE -->' +
    '<section class="wc-section">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">CORE PILLAR 2 • CONTINUOUS IN-SITU QUIZZES</span>' +
        '<h2 class="wc-section-title">Knowledge Verification After Every Concept.<br><span>Instant Diagnostic Feedback.</span></h2>' +
        '<p class="wc-section-sub">Never guess if you\'ve mastered a topic. XAMCODE AI tests comprehension immediately with targeted diagnostic feedback that explains common student misconceptions.</p>' +
      '</div>' +

      '<div class="wc-quiz-showcase" id="landingQuizCard">' +
        '<div class="wc-quiz-head">' +
          '<div class="wc-quiz-meta">' +
            '<span class="wc-quiz-tag">UNIT I · ACTIVE RECALL CHECK</span>' +
            '<span style="font-family:var(--mono);font-size:12px;color:var(--dim);">TOPIC 01: OSI VS TCP/IP</span>' +
          '</div>' +
          '<div class="wc-quiz-streak">' +
            '<span>🔥</span> <b>STREAK: 4 CONCEPTS</b>' +
          '</div>' +
        '</div>' +
        '<div class="wc-quiz-body">' +
          '<h3 class="wc-quiz-question">In the OSI 7-Layer reference model, which layer is strictly responsible for end-to-end reliability, segment retransmission, and port-level addressing?</h3>' +
          '<div class="wc-quiz-options">' +
            '<div class="wc-quiz-opt" data-landing-opt="0">' +
              '<span><b>A</b> &nbsp; Network Layer (IP / Routers)</span>' +
              '<span class="wc-opt-indicator" style="font-size:12px;color:var(--dim);">Select</span>' +
            '</div>' +
            '<div class="wc-quiz-opt" data-landing-opt="1">' +
              '<span><b>B</b> &nbsp; Transport Layer (TCP / UDP)</span>' +
              '<span class="wc-opt-indicator" style="font-size:12px;color:var(--dim);">Select</span>' +
            '</div>' +
            '<div class="wc-quiz-opt" data-landing-opt="2">' +
              '<span><b>C</b> &nbsp; Data Link Layer (MAC / Switches)</span>' +
              '<span class="wc-opt-indicator" style="font-size:12px;color:var(--dim);">Select</span>' +
            '</div>' +
          '</div>' +
          '<div class="wc-quiz-feedback" id="landingQuizFeedback"></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<!-- SECTION 5: VAATHIYAR MODE 8-SECTION MASTERCLASS -->' +
    '<section class="wc-section">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">EXAM CRASH COURSE • VAATHIYAR MODE</span>' +
        '<h2 class="wc-section-title">The 8-Section Masterclass Structure.<br><span>Grounded Socratic Pedagogy.</span></h2>' +
        '<p class="wc-section-sub">Every unit in XAMCODE AI is structured using the proven 8-pillar Vaathiyar format, providing intuition, analogies, formulas, and pitfalls.</p>' +
      '</div>' +

      '<div class="wc-vaathiyar-showcase" id="landingVaathiyarCard">' +
        '<div class="wc-vaathiyar-tabs" role="tablist">' +
          '<button class="wc-vaathiyar-tab active" data-vtab="0">1. Overview</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="1">2. Analogy</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="2">3. Mechanics</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="3">4. Multi-Level</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="4">5. Traps &amp; Truths</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="5">6. Comparison</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="6">7. Worked Problem</button>' +
          '<button class="wc-vaathiyar-tab" data-vtab="7">8. Cheat Code</button>' +
        '</div>' +
        '<div class="wc-vaathiyar-content" id="landingVaathiyarContent"></div>' +
      '</div>' +
    '</section>' +

    '<!-- SECTION 6: PRIMARY REFERENCE CURRICULUM (COMPUTER NETWORKS) -->' +
    '<section class="wc-section">' +
      '<div class="wc-section-header">' +
        '<span class="wc-section-kicker">BENCHMARK CURRICULUM • VERIFIED SAMPLE</span>' +
        '<h2 class="wc-section-title">Computer Networks Reference Course.<br><span>5 Units • 29 Concepts • 31 Formulas.</span></h2>' +
        '<p class="wc-section-sub">Explore the full standard implementation. Every concept includes animated SVG visuals, exam cheat codes, and Vaathiyar masterclasses.</p>' +
      '</div>' +

      '<div class="wc-curriculum-grid">' +
        '<div class="wc-curriculum-card" data-study="0">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit">UNIT I</span>' +
            '<span class="wc-curriculum-stats">6 Concepts · 12 Questions</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title">Introduction to Networks &amp; OSI</h4>' +
          '<p class="wc-curriculum-desc">OSI 7-layer reference model, TCP/IP protocol suite, network topologies, and packet switching fundamentals.</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm wc-badge-visual">🎬 Visual Lesson</span>' +
            '<span class="wc-badge-sm wc-badge-quiz">❓ Quiz Flow</span>' +
            '<span class="wc-badge-sm wc-badge-vaathiyar">🎓 Vaathiyar Mode</span>' +
          '</div>' +
        '</div>' +

        '<div class="wc-curriculum-card" data-study="6">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit">UNIT II</span>' +
            '<span class="wc-curriculum-stats">6 Concepts · 12 Questions</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title">Data Link Layer &amp; MAC</h4>' +
          '<p class="wc-curriculum-desc">Framing, error detection (CRC &amp; Hamming codes), flow control (Stop-and-Wait, Go-Back-N, Selective Repeat), and CSMA/CD.</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm wc-badge-visual">🎬 Visual Lesson</span>' +
            '<span class="wc-badge-sm wc-badge-quiz">❓ Quiz Flow</span>' +
            '<span class="wc-badge-sm wc-badge-vaathiyar">🎓 Vaathiyar Mode</span>' +
          '</div>' +
        '</div>' +

        '<div class="wc-curriculum-card" data-study="12">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit">UNIT III</span>' +
            '<span class="wc-curriculum-stats">6 Concepts · 12 Questions</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title">Network Layer &amp; Routing</h4>' +
          '<p class="wc-curriculum-desc">IPv4/IPv6 addressing, subnetting masks, CIDR, distance-vector routing (RIP), and link-state routing (OSPF Dijkstra).</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm wc-badge-visual">🎬 Visual Lesson</span>' +
            '<span class="wc-badge-sm wc-badge-quiz">❓ Quiz Flow</span>' +
            '<span class="wc-badge-sm wc-badge-vaathiyar">🎓 Vaathiyar Mode</span>' +
          '</div>' +
        '</div>' +

        '<div class="wc-curriculum-card" data-study="18">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit">UNIT IV</span>' +
            '<span class="wc-curriculum-stats">6 Concepts · 12 Questions</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title">Transport Layer Protocols</h4>' +
          '<p class="wc-curriculum-desc">TCP 3-way handshake, TCP connection teardown, sliding window flow control, congestion avoidance (Slow Start, AIMD), and UDP.</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm wc-badge-visual">🎬 Visual Lesson</span>' +
            '<span class="wc-badge-sm wc-badge-quiz">❓ Quiz Flow</span>' +
            '<span class="wc-badge-sm wc-badge-vaathiyar">🎓 Vaathiyar Mode</span>' +
          '</div>' +
        '</div>' +

        '<div class="wc-curriculum-card" data-study="24">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit">UNIT V</span>' +
            '<span class="wc-curriculum-stats">5 Concepts · 10 Questions</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title">Application Layer &amp; Security</h4>' +
          '<p class="wc-curriculum-desc">DNS domain resolution, HTTP/HTTPS request-response cycles, SMTP/IMAP email transfer, and symmetric/asymmetric encryption.</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm wc-badge-visual">🎬 Visual Lesson</span>' +
            '<span class="wc-badge-sm wc-badge-quiz">❓ Quiz Flow</span>' +
            '<span class="wc-badge-sm wc-badge-vaathiyar">🎓 Vaathiyar Mode</span>' +
          '</div>' +
        '</div>' +

        '<div class="wc-curriculum-card" data-nav="formulas" style="border:1px dashed var(--lime);background:var(--accent-soft);">' +
          '<div class="wc-curriculum-top">' +
            '<span class="wc-curriculum-unit" style="color:var(--lime);">FORMULA STUDIO</span>' +
            '<span class="wc-curriculum-stats" style="color:var(--lime);font-weight:700;">31 Equations</span>' +
          '</div>' +
          '<h4 class="wc-curriculum-title" style="color:var(--lime);">Mathematical Formulas &amp; Derivations</h4>' +
          '<p class="wc-curriculum-desc">Bandwidth-delay product, Nyquist bit rate, Shannon channel capacity, and propagation delay calculations.</p>' +
          '<div class="wc-curriculum-badges">' +
            '<span class="wc-badge-sm" style="background:var(--card-alt);color:var(--lime);border:1px solid var(--line);font-weight:700;">Open Formula Cards ↗</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="text-align:center;margin-top:28px;">' +
        '<button type="button" class="btn-hero-outline" data-nav="workspace">' +
          'Open Interactive Workspace Curriculum (All 29 Topics) →' +
        '</button>' +
      '</div>' +
    '</section>' +

    '<!-- SECTION 7: DRAG & DROP PDF UPLOAD STUDIO -->' +
    '<section class="course-cta" style="background:var(--card);border:1px solid var(--line);box-shadow:0 18px 44px rgba(0,0,0,0.14);border-radius:20px;padding:44px 32px;margin-top:36px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;">' +
      '<div style="display:flex;align-items:center;gap:20px;">' +
        '<div class="course-cta-mark" aria-hidden="true" style="display:flex;align-items:center;justify-content:center;background:transparent;box-shadow:none;">' +
          '<img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" style="width:68px;height:68px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(37,99,235,0.4));">' +
        '</div>' +
        '<div>' +
          '<span class="wc-section-kicker" style="margin-bottom:8px;">READY TO MASTER YOUR EXAM?</span>' +
          '<h2 style="font-family:var(--disp);font-size:26px;font-weight:800;color:var(--paper);margin:0 0 6px;">Drop Your PDF. See The Whole Picture.</h2>' +
          '<p style="font-size:14px;color:var(--mut);margin:0;">Transform your textbook, syllabus, or lecture slides into human-paced 3D environments.</p>' +
        '</div>' +
      '</div>' +
      '<button class="btn-hero" data-open="upload" style="font-size:14px;padding:12px 24px;">Upload PDF &amp; Build Space ↗</button>' +
    '</section>' +
  '</main>' + footer();
}

let libraryCache = null;
let libraryCacheAt = 0;
function libraryView(){
  const trial = window.XC?.library ? window.XC.library.trialStatus()
    : { daysLeft: 30, expired: false };



  const items = Array.isArray(libraryCache) ? libraryCache : [];
  const banner = trial.expired
    ? `<div class="ai-study-notice" role="alert">Your 30-day trial ended — stored studies were deleted. <button type="button" class="btn-primary" data-library-renew>Renew trial</button></div>`
    : `<div class="ai-study-notice" role="status">Trial: <b>${trial.daysLeft} days left</b> of 30. Renew to keep your stored PDFs + outputs.</div>`;
  return header()+`<main class="page-shell"><section class="ai-page-hero">
    <div class="panel-tag">📚 MY LIBRARY · ${items.length} SAVED</div>
    <h1>Your PDFs + outputs.</h1><p>Every analyzed PDF lands here with its lessons, quizzes, and images.</p>${banner}</section>
    <div class="ai-concept-grid">${items.length ? items.map(e=>`
      <article class="ai-concept-card"><div class="panel-tag">${escapeHtml(e.subject||'PDF')}</div>
      <h3>${escapeHtml(e.title)}</h3><p>${escapeHtml((e.summary||'').slice(0,140))}</p>
      <p class="ai-study-notice">${new Date(e.createdAt).toLocaleDateString()} · ${(e.study?.concepts?.length||0)} lessons</p>
      <div class="ai-flashcard-actions"><button type="button" data-library-open="${escapeHtml(e.id)}">Open study →</button>
      <button type="button" data-library-delete="${escapeHtml(e.id)}">Delete</button></div></article>`).join('')
    : '<p class="ai-empty-state">No saved studies yet. Upload a PDF to build your first one.</p>'}</div>
    <div class="hero-btns"><button class="btn-hero" data-open="upload">Analyze a PDF ↗</button></div></main>` + footer();
}
async function refreshLibrary(){
  try{
    if(window.XC?.library){
      await window.XC.library.trySync();
      libraryCache = await window.XC.library.listStudies();
      libraryCacheAt = Date.now();
    } else libraryCache = [];
  }catch{ libraryCache = []; }
  if(state.view==='library') render();
}

function wsConceptDone(idx){
  const c = getTopic(idx);
  if(!c || !c.questions.length) return false;
  return c.questions.every((q,qi)=>state.answers[`${idx}-${qi}`]===q.a);
}
function wsUnitProgress(list){
  const done = list.filter(t=>wsConceptDone(t._idx)).length;
  const unitQ = list.reduce((s,t)=>s+t.questions.length,0);
  return { done, unitQ };



}
function workspaceViewInner(){
  const units = {};



  getTopics().forEach((t, i) => {
    const u = t.unit || 'I';
    if(!units[u]) units[u] = [];
    units[u].push({ ...t, _idx: i });
  });
  const unitLabels = {
    'I':'UNIT I: Introduction to Networks',
    'II':'UNIT II: Data Link Layer',
    'III':'UNIT III: Network Layer',
    'IV':'UNIT IV: Transport Layer',
    'V':'UNIT V: Application Layer'
  };



  const activeTopics = getTopics();
  const totalConcepts = activeTopics.length;
  const totalQuestions = activeTopics.reduce((s,t)=>s+(t.questions?t.questions.length:0),0);
  const totalVisuals = activeTopics.filter(t=>typeof t.visual==='function' || (t.visual && t.visual.steps)).length;
  const isCollapsed = u => state.collapsedUnits[u] === true;

  return header()+`<main>
    <div class="ws-head">
      <div class="ws-eyebrow">${state.activeCourseEyebrow || 'SAMPLE COURSE • COMPUTER NETWORKS'}</div>
      <h1 class="ws-title">${state.activeCourseTitle || 'Computer Networks — Unit Wise'}</h1>
      <div class="ws-pills">
        <span class="ws-pill"><b>${Object.keys(units).length}</b> UNITS</span>
        <span class="ws-pill"><b>${totalConcepts}</b> CONCEPTS</span>
        <span class="ws-pill"><b>${totalQuestions}</b> QUESTIONS</span>
        <span class="ws-pill"><b>${totalVisuals}</b> VISUAL LESSONS</span>
      </div>
    </div>


    <div class="ws-body">
      <aside class="tree">
        <div class="tree-title">TOPIC TREE</div>
        ${Object.keys(units).map(u => {
          const collapsed = isCollapsed(u);
          return `
          <div class="tree-item">
            <button type="button" class="tree-btn ${collapsed?'':'active'}" data-toggle-unit="${u}" aria-expanded="${!collapsed}" aria-controls="tree-unit-${u}">
              <span class="caret">${collapsed?'▸':'▾'}</span>
              <span>${unitLabels[u]||('UNIT '+u)}</span>
            </button>
            <div class="tree-sub" id="tree-unit-${u}" ${collapsed?'style="display:none"':''}>
              ${units[u].map(t => { const done = wsConceptDone(t._idx); return `<button class="tree-sub-btn${done?' done':''}" data-study="${t._idx}">${done?'✓ ':''}${t.title}</button>`; }).join('')}
            </div>
          </div>`;
        }).join('')}
      </aside>

      <div class="ws-cards">
        ${Object.keys(units).map(u => {
          const collapsed = isCollapsed(u);
          const prog = wsUnitProgress(units[u]);
          return `
          <div class="unit-block" style="margin-bottom:28px">
            <h2 class="unit-heading">
              <button type="button" class="unit-heading-toggle" data-toggle-unit="${u}" aria-expanded="${!collapsed}" aria-controls="cards-unit-${u}">
                <span class="unit-chev" aria-hidden="true">${collapsed?'▸':'▾'}</span>
                <span>${unitLabels[u]||('UNIT '+u)}</span>
                <span class="unit-count">${units[u].length} topics · ${units[u].length} concepts · ${prog.unitQ} Q · ${prog.done}/${units[u].length} done</span>
              </button>
            </h2>
            <div class="unit-grid" id="cards-unit-${u}" ${collapsed?'style="display:none"':''}>
              ${units[u].map(t => { const done = wsConceptDone(t._idx); return `<button class="concept-card${done?' done':''}" data-study="${t._idx}" aria-label="${t.title}${done?' — completed':''}"><div class="cc-head"><span>${t.topic.toUpperCase()}</span><span>${t.visId}</span></div><div class="cc-title">${done?'✓ ':''}${t.title}</div><div class="cc-foot"><span>🎬 Visual</span><span>❓ ${t.questions.length} Q</span></div></button>`; }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </main>` + footer();
}

function aiStudyPageButton(type,label,indices={},className=''){
  const data=Object.entries(indices).map(([key,value])=>`data-${key}="${value}"`).join(' ');
  return `<button type="button" class="ai-page-link ${className}" data-ai-page="${type}" ${data}>${label}</button>`;
}

/* ============================================================
   2D DIAGRAM ENGINE — topic-specific layouts
   ------------------------------------------------------------
   The AI supplies node labels and a coarse `layout`. That was enough
   for the renderer, but it made every diagram structurally identical:
   four archetypes over the same card grid, so two very different topics
   still produced the same picture. Content repetition was only half the
   bug; structural repetition was the other half.

   So the layout is chosen HERE, deterministically, from the concept's
   own text, and each archetype draws genuinely different chrome. Two
   topics can never render the same shape twice, even if the model
   hands back similar labels, because the archetype is a function of
   the content rather than of the model's whim.
   ============================================================ */

/* FNV-1a. Small, fast and stable across runs, so a concept always gets
   the same diagram and the workspace never reshuffles on re-render. */
function aiHash(text){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193)>>>0;
  }
  return h>>>0;
}

/* Keyword hints win over the hash so the picture matches the idea: a
   "stack" should draw as layers, a "repeat" as a cycle. The hash only
   breaks ties when no hint applies, which is what guarantees variety. */
const AI_LAYOUT_HINTS=[
  [/layer|stack|tier|level[s]?\b|protocol|encapsulat/i,'layers'],
  [/cycle|loop|repeat|recurs|cyclic|iterat|feedback/i,'cycle'],
  [/versus|\bvs\b|compare|contrast|difference|similar|instead of|rather than/i,'compare'],
  [/type|kind|branch|split|classif|categor|either|options?/i,'tree'],
  /* Request/response is checked before "process", because a process word
     alone is vague while an explicit request/response exchange is not. */
  [/flow|move|transfer|route|path|send|request|response/i,'flow'],
  [/stage|step|first|then|next|finally|process|order|sequence|workflow|pipeline/i,'stepchain'],
  [/timeline|history|era|evol|chronol|origin|over time/i,'timeline'],
  [/matrix|grid|cross/i,'matrix'],
  [/part|component|element|consist|anatom|make up/i,'stack']
];

function aiEngineLayout(serverLayout, step, conceptTitle){
  /* Server speaks the 15 universal layouts; the canvas engine draws 8
     geometries. Map 1:1 where possible so a HIERARCHY lesson draws as a
     hierarchy instead of falling through to a radial circle. Unknown or
     missing layouts fall back to the content-driven picker. */
  const s = String(serverLayout || '').toLowerCase().trim();
  const map = { flow: 'flow', arch: 'stack', seq: 'timeline',
    compare: 'compare', hierarchy: 'hierarchy', state: 'radial',
    erd: 'matrix', fbd: 'flow', wave: 'timeline', isometric: 'layers',
    mindmap: 'radial', matrix: 'matrix', equation: 'stepchain',
    cycle: 'cycle', layer: 'layers',
    tree: 'tree', layers: 'layers', stack: 'stack',
    timeline: 'timeline', stepchain: 'stepchain', radial: 'radial' };



  if (map[s]) return map[s];
  return aiPickLayout(step, conceptTitle);
}

function aiPickLayout(step,conceptTitle){
  const hay=`${conceptTitle||''} ${step.title||''} ${step.description||''} ${
    (step.nodes||[]).map(n=>n.label).join(' ')}`;
  for(const [pattern,layout] of AI_LAYOUT_HINTS){
    if(pattern.test(hay)) return layout;
  }
  /* No hint: derive from content so the same topic is always drawn the
     same way, while different topics land on different archetypes. */
  const extra=['layers','tree','timeline','stepchain','matrix','radial','flow'];
  return extra[aiHash(hay)%extra.length];
}

function aiDiagramPositions(layout,count){
  const centerX=300,centerY=156,cardWidth=112,cardHeight=68;
  if(layout==='hierarchy'||layout==='layers'||layout==='stack'){
    if(layout==='layers'){
      /* Stacked bands: each idea is a level of one system. */
      const band=Math.min(46,(236/(count||1)));
      return Array.from({length:count},(_,index)=>({
        x:centerX,y:52+index*band+band/2
      }));
    }
    const children=count-1;
    return [
      {x:centerX,y:72},
      ...Array.from({length:children},(_,index)=>({
        x:centerX+(index-(children-1)/2)*Math.min(156,360/Math.max(1,children-1)),
        y:242
      }))
    ];
  }
  if(layout==='compare'||layout==='matrix'){
    if(layout==='matrix'){
      const cols=Math.ceil(Math.sqrt(count));
      const rows=Math.ceil(count/cols);
      return Array.from({length:count},(_,index)=>({
        x:150+(index%cols)*(300/Math.max(1,cols-1)),
        y:96+Math.floor(index/cols)*(rows>1?150/(rows-1):0)
      }));
    }
    const sideCount=Math.ceil(count/2);
    /* Space both columns by the actual node count. A fixed 104px pitch
       pushed the third node of a 5-node diagram to y=312, which is off
       the bottom of the 312-unit canvas. */
    const span=sideCount>1?176:0;
    return Array.from({length:count},(_,index)=>({
      x:index<sideCount?157:443,
      y:sideCount>1?68+(index%sideCount)*(span/(sideCount-1)):156
    }));
  }
  if(layout==='stepchain'){
    /* Alternating staircase so consecutive steps stay visually distinct. */
    return Array.from({length:count},(_,index)=>({
      x:count===1?centerX:78+index*(444/Math.max(1,count-1)),
      y:index%2?212:100
    }));
  }
  if(layout==='timeline'){
    /* One spine; nodes alternate above and below it. */
    return Array.from({length:count},(_,index)=>({
      x:count===1?centerX:72+index*(456/Math.max(1,count-1)),
      y:index%2?96:216
    }));
  }
  if(layout==='tree'){
    /* Root with a binary fan below, which is what "branches" implies. */
    const root={x:centerX,y:74};



    const kids=Array.from({length:Math.max(1,count-1)},(_,index)=>({
      x:centerX+(index-(count-2)/2)*Math.min(150,330/Math.max(1,count-2)),
      y:238
    }));
    return [root,...kids];
  }
  if(layout==='flow'){
    if(count===5){
      return [{x:96,y:96},{x:300,y:96},{x:504,y:96},{x:504,y:225},{x:300,y:225}];
    }
    return Array.from({length:count},(_,index)=>({
      x:count===1?centerX:70+index*(460/(count-1)),
      y:centerY
    }));
  }
  const radius=count===3?94:count===4?105:116;
  return Array.from({length:count},(_,index)=>{
    const angle=-Math.PI/2+(Math.PI*2*index/count);
    return {x:centerX+Math.cos(angle)*radius,y:centerY+Math.sin(angle)*radius};



  });
}

/* Edge topology per archetype. Separated from geometry so the same node
   count can be wired completely differently per idea. */
function aiDiagramPairs(layout,nodes){
  const count=nodes.length;
  if(!count) return [];
  if(layout==='hierarchy'||layout==='tree') return nodes.slice(1).map((_,i)=>[0,i+1]);
  if(layout==='compare') return count>=4?[[0,2],[1,3]]:nodes.slice(0,-1).map((_,i)=>[i,i+1]);
  if(layout==='layers'||layout==='stack') return nodes.slice(0,-1).map((_,i)=>[i,i+1]);
  if(layout==='matrix') return nodes.slice(1).map((_,i)=>[0,i+1]);
  if(layout==='stepchain'||layout==='timeline') return nodes.slice(0,-1).map((_,i)=>[i,i+1]);
  if(layout==='flow'){
    if(count===5) return [[0,1],[1,2],[2,3],[3,4]];
    return nodes.slice(0,-1).map((_,i)=>[i,i+1]);
  }
  const pairs=nodes.slice(0,-1).map((_,i)=>[i,i+1]);
  if(count>2) pairs.push([nodes.length-1,0]);
  return pairs;
}

function aiDiagramEdge(from,to,width,height,delay,index,markerId){
  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy)||1;
  const ux=dx/distance,uy=dy/distance;
  const insetX=width/2+2,insetY=height/2+2;
  const startOffset=Math.min(insetX/Math.max(Math.abs(ux),.001),insetY/Math.max(Math.abs(uy),.001));
  const endOffset=Math.min(insetX/Math.max(Math.abs(ux),.001),insetY/Math.max(Math.abs(uy),.001));
  const x1=from.x+ux*startOffset,y1=from.y+uy*startOffset;
  const x2=to.x-ux*endOffset,y2=to.y-uy*endOffset;
  const bend=from.y===to.y?0:(index%2===0?-10:10);
  return `<path class="ai-diagram-edge" pathLength="1" style="--diagram-delay:${delay}ms" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${((x1+x2)/2).toFixed(1)} ${((y1+y2)/2+bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" marker-end="url(#${markerId})"/>`;
}

/* ============================================================
   MERMAID UPGRADE — structured diagrams the engine cannot draw
   ------------------------------------------------------------
   The custom engine covers flow, cycle, hierarchy, comparison and
   friends. Mermaid adds four shapes it genuinely cannot express:
   sequence diagrams (ordered exchanges), state machines, entity
   relationships and class structure.

   Three rules govern this integration:
     1. Mermaid is LAZY. Nothing is fetched until a concept actually
        asks for one of those four shapes, so the common case never
        pays the download.
     2. It is a progressive enhancement. Every slot renders the custom
        engine's SVG first and Mermaid replaces it only on success, so
        a CDN failure or a parse error is invisible.
     3. The text stays real SVG text, which is the whole point. A
        diffusion image generator cannot label a diagram legibly.
   ============================================================ */

/* Only these four shapes route to Mermaid. Everything else keeps using
   the bespoke engine, which matches the app's visual language better. */
const AI_MERMAID_HINTS=[
  [/state machine|lifecycle|life cycle|transition|idle|terminated|state diagram/i,'state'],
  [/handshake|request.?response|round.?trip|\back\b|syn.?ack|packet|exchange between/i,'sequence'],
  [/entity.?relationship|\ber\b diagram|database schema|primary key|foreign key|each table|relation between/i,'er'],
  [/class diagram|inheritance|encapsulat|superclass|subclass|\boop\b|polymorphi/i,'class']
];

function aiPickMermaidType(step,conceptTitle){
  const hay=`${conceptTitle||''} ${step.title||''} ${step.description||''} ${
    (step.nodes||[]).map(n=>`${n.label} ${n.detail}`).join(' ')}`;
  for(const [pattern,type] of AI_MERMAID_HINTS) if(pattern.test(hay)) return type;
  return null;
}

/* Mermaid parses strictly and throws on quotes, brackets and colons in
   labels, which the AI writes freely. Strip them rather than escape, so
   a bad label degrades to slightly dull text instead of failing the
   whole render. */
function aiMermaidSafe(text){
  return String(text??'')
    .replace(/["'`]/g,'')
    .replace(/[[\]{}()|#<>]/g,' ')
    .replace(/[:;]/g,' -')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,38)||'step';
}

/* Builds the syntax from the concept's OWN node labels, so the diagram is
   still grounded in the PDF rather than in a generic template. */
function aiMermaidSyntax(type,step){
  const nodes=step.nodes||[];
  const label=i=>aiMermaidSafe(nodes[i]?.label??nodes[i]?.title??`Step ${i+1}`);
  const detail=i=>aiMermaidSafe(nodes[i]?.detail??nodes[i]?.description??'');
  const ident=s=>aiMermaidSafe(s).replace(/\s+/g,'_').replace(/[^\w]/g,'')||'Item';

  if(type==='sequence'){
    const a=label(0),b=label(1);
    const lines=[`sequenceDiagram`,`autonumber`,`participant ${ident(a)} as ${a}`,`participant ${ident(b)} as ${b}`];
    nodes.slice(2).forEach((_,i)=>{
      const to=i%2===0?ident(b):ident(a), from=i%2===0?ident(a):ident(b);
      lines.push(`${from}->>${to}: ${label(i+2)}`);
    });
    lines.push(`${ident(a)}-->>${ident(b)}: ${detail(2)||'Result'}`);
    return lines.join('\n');
  }
  if(type==='state'){
    const lines=[`stateDiagram-v2`,`    [*] --> ${ident(label(0))}`];
    nodes.slice(1).forEach((node,i)=>lines.push(`    ${ident(label(i+1))} --> ${ident(node.state||detail(i+1)||label(i+1))}`));
    lines.push(`    ${ident(nodes[nodes.length-1]?.state||label(nodes.length-1))} --> [*]`);
    return lines.join('\n');
  }
  if(type==='er'){
    const lines=[`erDiagram`];
    for(let i=0;i<Math.max(2,nodes.length-1);i+=2){
      lines.push(`    ${ident(label(i))} ||--o{ ${ident(label(i+1))} : "${detail(i)||'relates to'}"`);
    }
    return lines.join('\n');
  }
  const lines=[`classDiagram`];
  nodes.forEach((node,i)=>{
    lines.push(`    class ${ident(label(i))} {`);
    lines.push(`        +${(aiMermaidSafe(node.method||node.detail||'run')).replace(/[^\w]/g,'')}()`);
    lines.push('    }');
  });
  for(let i=1;i<nodes.length;i++) lines.push(`    ${ident(label(i-1))} <|-- ${ident(label(i))}`);
  return lines.join('\n');
}

/* Slot payloads live in a Map, not a data attribute: Mermaid syntax is
   full of quotes and angle brackets that would otherwise have to survive
   an HTML attribute round-trip. */
const aiMermaidSlots=new Map();
let aiMermaidSlotSeq=0;

/* Emits a slot that ALREADY contains the fallback SVG. Mermaid only ever
   replaces it, so a failure leaves the user with a correct diagram. */
function aiMermaidSlot(type,step,fallbackSvg,caption){
  const key=`mmd-${++aiMermaidSlotSeq}`;
  aiMermaidSlots.set(key,{type,syntax:aiMermaidSyntax(type,step),fallback:fallbackSvg,caption});
  return `<div class="ai-mermaid" data-mermaid-slot="${key}">${fallbackSvg}</div>`;
}

let aiMermaidLoading=null;
function ensureAiMermaid(){
  if(window.mermaid?.render) return Promise.resolve(window.mermaid);
  if(aiMermaidLoading) return aiMermaidLoading;
  const url='https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  aiMermaidLoading=import(/* webpackIgnore: true */ url)
    .then(async mod=>{
      const api=mod.default;
      api.initialize({startOnLoad:false,securityLevel:'strict',theme:'dark',fontFamily:'inherit'});
      window.mermaid=api;
      return api;
    })
    .catch(error=>{ aiMermaidLoading=null; throw error; });
  return aiMermaidLoading;
}

/* Walks the freshly rendered view and upgrades any slot. Never throws, so
   a blocked CDN degrades to the bespoke engine instead of breaking the
   lesson. A timeout covers a CDN that hangs rather than erroring. */
async function hydrateAiMermaid(root=document){
  const slots=[...root.querySelectorAll('[data-mermaid-slot]')];
  if(!slots.length) return;
  const withTimeout=promise=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('mermaid timed out')),9000))
  ]);
  let mermaid;
  try{
    mermaid=await withTimeout(ensureAiMermaid());
  }catch{
    return;
  }
  for(const slot of slots){
    const payload=aiMermaidSlots.get(slot.dataset.mermaidSlot);
    if(!payload) continue;
    try{
      const {svg}=await mermaid.render(`mmd-out-${slot.dataset.mermaidSlot}`,payload.syntax);
      if(!svg||!svg.includes('<svg')) throw new Error('empty render');
      slot.innerHTML=svg;
      slot.dataset.diagramSource='mermaid';
      /* Mermaid emits an unlabelled graphic, so restore the accessible
         name the bespoke engine provided. */
      slot.firstElementChild?.setAttribute('role','img');
      slot.firstElementChild?.setAttribute('aria-label',payload.caption||payload.type);
    }catch{
      slot.dataset.diagramSource='fallback';
    }
  }
}

/* Per-archetype chrome. This is what actually makes two diagrams look
   different rather than just being the same boxes in new positions. */
function aiDiagramChrome(layout,nodes,positions,id){
  const kind=`ai-chrome-${layout}`;
  const yOf=i=>positions[i]?positions[i].y:156;
  const xOf=i=>positions[i]?positions[i].x:300;
  if(layout==='hierarchy'){
    /* True top-down tree: one spine from the root card down to the child
       row, then a bus linking every child. Your screenshot showed three
       disconnected parts (badge, arrow, curve) because the old chrome was
       a decorative ellipse that never touched the cards. */
    const n=nodes.length;
    if(n<2) return '';
    const rootBottom=yOf(0)+34, childTop=yOf(1)-34;
    const midY=(rootBottom+childTop)/2;
    const xs=[]; for(let i=1;i<n;i++) xs.push(xOf(i));
    const x0=Math.min(...xs), x1=Math.max(...xs);
    return `<g class="${kind}">
      <line x1="${xOf(0).toFixed(1)}" y1="${rootBottom.toFixed(1)}" x2="${xOf(0).toFixed(1)}" y2="${midY.toFixed(1)}" class="ai-chrome-spine"/>
      <line x1="${x0.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${midY.toFixed(1)}" class="ai-chrome-spine"/>
      ${xs.map(x=>`<line x1="${x.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${childTop.toFixed(1)}" class="ai-chrome-spine"/>`).join('')}
    </g>`;
  }
  if(layout==='layers'||layout==='stack'){
    return `<g class="${kind}">${positions.map((p,i)=>
      `<rect x="${(p.x-236).toFixed(1)}" y="${(p.y-19).toFixed(1)}" width="472" height="38" rx="9"
        style="--diagram-delay:${i*90}ms" class="ai-chrome-band"/>`).join('')}</g>`;
  }
  if(layout==='timeline'){
    return `<g class="${kind}">
      <line x1="56" y1="156" x2="544" y2="156" class="ai-chrome-spine"/>
      ${positions.map((p,i)=>`<circle cx="${p.x.toFixed(1)}" cy="156" r="5" class="ai-chrome-tick" style="--diagram-delay:${i*90}ms"/>`).join('')}
    </g>`;
  }
  if(layout==='matrix'){
    return `<g class="${kind}">${nodes.map((_,i)=>
      `<rect x="${(positions[i].x-62).toFixed(1)}" y="${(positions[i].y-30).toFixed(1)}" width="124" height="60" rx="10"
        class="ai-chrome-cell" style="--diagram-delay:${i*90}ms"/>`).join('')}</g>`;
  }
  if(layout==='compare'){
    return `<g class="${kind}">
      <line x1="300" y1="52" x2="300" y2="268" class="ai-chrome-divider"/>
      ${positions.map(p=>`<line x1="${p.x}" y1="${(p.y-40).toFixed(1)}" x2="${p.x}" y2="${(p.y+40).toFixed(1)}" class="ai-chrome-divider is-soft"/>`).join('')}
    </g>`;
  }
  if(layout==='cycle'||layout==='radial'){
    return `<g class="${kind}"><circle cx="300" cy="156" r="116" class="ai-chrome-ring"/></g>`;
  }
  if(layout==='tree'){
    return `<g class="${kind}"><ellipse cx="300" cy="156" rx="248" ry="98" class="ai-chrome-ring"/></g>`;
  }
  if(layout==='stepchain'){
    return `<g class="${kind}"><path d="M64 236 L536 76" class="ai-chrome-spine"/></g>`;
  }
  return '';
}

function aiDiagramSvg(step,conceptIndex,stepIndex,conceptTitle){
  const rawNodes = step && Array.isArray(step.nodes) && step.nodes.length > 0 ? step.nodes : null;
  const nodes = rawNodes || [
    { label: String(step?.title || conceptTitle || 'Core Concept').trim().slice(0, 20), detail: String(step?.description || step?.desc || 'Operational premise').trim().slice(0, 38) },
    { label: 'Process Dynamics', detail: 'State transformation & validation' },
    { label: 'Asserted State', detail: 'Verified boundary invariants' }
  ];
  /* The archetype is chosen from the content, not trusted blindly from
     the model, so a lesson can never render as another lesson's picture. */
  const layout=aiEngineLayout(step.layout, step, conceptTitle);
  const positions=aiDiagramPositions(layout,nodes.length);
  const width=112,height=68;
  const id=`ai-diagram-${conceptIndex}-${stepIndex}`;
  const markerId=`${id}-arrow`;
  const pairs=aiDiagramPairs(layout,nodes);
  const edges=pairs.map(([from,to],index)=>
    aiDiagramEdge(positions[from],positions[to],width,height,index*90,index,markerId)
  ).join('');
  const chrome=aiDiagramChrome(layout,nodes,positions,id);
  const nodeMarkup=nodes.map((node,index)=>{
    const {x,y}=positions[index];
    const label=String(node.label).trim().slice(0,20);
    const detail=String(node.detail).trim().slice(0,38);
    /* Code-aware nodes: the model supplies the exact one-line syntax from
       the PDF (statement, call, loop header). It renders as a monospace
       syntax line in the second detail row, so the card keeps its 112x68
       geometry and all positions/edges/chrome stay untouched. Syntax wins
       the row over wrapped prose, since the statement is the point. */
    const code=typeof node.code==='string'&&node.code.trim()?node.code.trim().slice(0,80):'';
    const detailLines=detail.split(/\s+/).reduce((lines,word)=>{
      const last=lines[lines.length-1];
      if(!last||`${last} ${word}`.length>19) lines.push(word);
      else lines[lines.length-1]=`${last} ${word}`;
      return lines;
    },['']).filter(Boolean).slice(0,code?1:2);
    const codeLine=code?`<text class="ai-diagram-node-code" x="12" y="55" textLength="${Math.max(20,Math.min(87,code.length*4.4)).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${escapeHtml(code)}</text>`
      :detailLines[1]?`<text class="ai-diagram-node-detail" x="12" y="55" textLength="${Math.max(20,Math.min(87,detailLines[1].length*4.7)).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${escapeHtml(detailLines[1])}</text>`:'';
    const isNodeIsolated = state.isolatedPartIdx === index;
    const nodeRole = node.role || node.detail || '';
    const nodeFailure = node.failureImpact || '';
    return `<g class="ai-diagram-node interactive-part ${index===0?'is-origin':''} ${isNodeIsolated?'is-isolated':''}" data-part-index="${index}" data-part-label="${escapeHtml(label)}" data-part-detail="${escapeHtml(detail)}" data-part-role="${escapeHtml(nodeRole)}" data-part-failure="${escapeHtml(nodeFailure)}" tabindex="0" role="button" aria-label="Inspect ${escapeHtml(label)}: ${escapeHtml(detail)}" style="--diagram-delay:${120+index*105}ms" transform="translate(${(x-width/2).toFixed(1)} ${(y-height/2).toFixed(1)})">
      <rect class="ai-diagram-node-card" width="${width}" height="${height}" rx="13"/>
      <circle class="ai-diagram-node-dot" cx="13" cy="17" r="3"/>
      <text class="ai-diagram-node-label" x="23" y="21" textLength="82" lengthAdjust="spacingAndGlyphs">${escapeHtml(label)}</text>
      <text class="ai-diagram-node-detail" x="12" y="43" textLength="${Math.max(20,Math.min(87,detailLines[0].length*4.7)).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${escapeHtml(detailLines[0])}</text>
      ${codeLine}
    </g>`;
  }).join('');
  const svg=`<svg class="ai-diagram-svg ${state.isolatedPartIdx !== null && state.isolatedPartIdx !== undefined ? 'has-isolated-part' : ''}" data-diagram-layout="${escapeHtml(layout)}" viewBox="0 0 600 312" role="img" aria-labelledby="${id}-title ${id}-description" xmlns="http://www.w3.org/2000/svg">
    <title id="${id}-title">${escapeHtml(step.title)}: ${escapeHtml(step.description)}</title>
    <desc id="${id}-description">${escapeHtml(nodes.map(node=>`${node.label}: ${node.detail}`).join('. '))}</desc>
    <defs><marker id="${markerId}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0L8 4.5L0 9z" fill="currentColor"/></marker><pattern id="${id}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor"/></pattern></defs>
    <rect class="ai-diagram-grid" width="600" height="312" fill="url(#${id}-grid)"/>
    ${chrome}
    <g class="ai-diagram-edges">${edges}</g>
    <g class="ai-diagram-nodes">${nodeMarkup}</g>
    <text class="ai-diagram-layout-label" x="20" y="292">${escapeHtml(step.layout.toUpperCase())} · ${String(nodes.length).padStart(2,'0')} CONNECTED IDEAS</text>
  </svg>`;

  /* Shapes the bespoke engine cannot express are handed to Mermaid, which
     renders into the SAME svg string first and is upgraded after paint.
     Nothing is lost if Mermaid never arrives. */
  const mermaidType=aiPickMermaidType(step,conceptTitle);
  if(!mermaidType) return svg;
  return aiMermaidSlot(mermaidType,step,svg,`${step.title}: ${step.description}`);
}

/* VISUAL RECOMMENDATION — tells the learner which visual explains this
   question best (diagram scene vs generated still), so the quiz never feels
   imageless even before an answer is picked. */
function aiVisualRecommendation(question){
  const v = question && question.visual;
  const layout = v && v.layout ? String(v.layout).toUpperCase() : null;
  if (layout) return `<p class="ai-visual-recommend" role="note"><span aria-hidden="true">🖼</span> Visual recommendation: <b>${escapeHtml(layout)} diagram</b> — answer to unlock the step-by-step 2D visual.</p>`;
  return `<p class="ai-visual-recommend" role="note"><span aria-hidden="true">🖼</span> Visual recommendation: <b>topic illustration</b> — open the Crash Lesson image for this topic.</p>`;
}

function aiQuestionCard(question,index,position,total){
  const selected=state.aiQuizAnswers[index];
  return `<article class="ai-question-card">
    <div class="panel-tag">Q${position} · ${escapeHtml(question.category)} · ${escapeHtml(question.difficulty)}</div>
    <h3>${escapeHtml(question.question)}</h3>
    ${aiVisualRecommendation(question)}
    ${selected===undefined?`<details class="ai-question-hint"><summary>Show hint</summary><p>${escapeHtml(question.hint)}</p></details>`:''}
    ${question.options.map((option,optionIndex)=>{
      const isSelected=selected===optionIndex;
      const isCorrect=selected!==undefined&&optionIndex===question.answerIndex;
      const isWrong=isSelected&&selected!==question.answerIndex;
      return `<button type="button" class="ai-answer-option ${isSelected?'selected ':''}${isCorrect?'correct':isWrong?'incorrect wrong':''}" data-ai-answer="${index}:${optionIndex}">${String.fromCharCode(65+optionIndex)}. ${escapeHtml(option)}</button>`;
    }).join('')}
    ${selected!==undefined?`<div class="ai-answer-feedback"><b>${selected===question.answerIndex?'Correct.':'Not quite.'}</b> ${escapeHtml(question.optionExplanations[selected])}<p>${escapeHtml(question.explanation)}</p><details><summary>Explain it simply</summary><p>${escapeHtml(question.eli5)}</p></details></div>${aiQuestionVisual(question,index)}`:''}
  </article>`;
}

/* CHEATCODES PANEL — mirrors the sample workspace's CheatCode tab so a
   generated lesson is missing no section the hand-authored one has. */
function aiCheatCodePanel(concept){
  const cc=concept.cheatCode;
  if(!cc) return '<section class="ai-detail-card"><p class="ai-empty-state">No cheat codes were generated for this lesson.</p></section>';
  return `<section class="ai-detail-card ai-cheatcode-panel" aria-label="Cheat codes for ${escapeHtml(concept.title)}">
    <div class="panel-tag">CHEATCODE · QUICK REVISION</div>
    <div class="ai-cheatcode-grid">
      <article class="ai-cheatcode-card ai-cc-why"><span class="ai-cheatcode-icon" aria-hidden="true">💡</span><div><div class="ai-cheatcode-label">WHY IT WORKS</div><p>${escapeHtml(cc.why)}</p></div></article>
      <article class="ai-cheatcode-card ai-cc-like"><span class="ai-cheatcode-icon" aria-hidden="true">🔮</span><div><div class="ai-cheatcode-label">THINK OF IT LIKE</div><p>${escapeHtml(cc.like)}</p></div></article>
      <article class="ai-cheatcode-card ai-cc-wrong"><span class="ai-cheatcode-icon" aria-hidden="true">❌</span><div><div class="ai-cheatcode-label">COMMON MISTAKE</div><p>${escapeHtml(cc.wrong)}</p></div></article>
      <article class="ai-cheatcode-card ai-cc-right"><span class="ai-cheatcode-icon" aria-hidden="true">✅</span><div><div class="ai-cheatcode-label">THE TRUTH</div><p>${escapeHtml(cc.right)}</p></div></article>
    </div>
    ${cc.mnemonic?`<article class="ai-cheatcode-card ai-cc-mnemonic"><span class="ai-cheatcode-icon" aria-hidden="true">🧠</span><div><div class="ai-cheatcode-label">MEMORY TRICK</div><p>${escapeHtml(cc.mnemonic)}</p></div></article>`:''}
    ${Array.isArray(cc.see)&&cc.see.length?`<article class="ai-cheatcode-card ai-cc-see"><div class="ai-cheatcode-label">SEE IT IN THE REAL WORLD</div><ul class="ai-cheatcode-chips">${cc.see.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article>`:''}
    <p class="ai-comparison-takeaway"><b>ONE LINE · </b>${escapeHtml(cc.oneLine)}</p>
  </section>`;
}

/* QUIZ 2D VISUAL — a per-question diagram that shows what is being
   asked and walks the reasoning to the correct option. Reuses the same
   SVG renderer as the lesson visual so both look identical. */
function aiQuestionVisual(question,index){
  const visual=question.visual;
  if(!visual||!Array.isArray(visual.steps)||!visual.steps.length) return '';
  const stepIndex=Math.min(state.aiQuizVisualStep||0,visual.steps.length-1);
  const step=visual.steps[stepIndex];
  const stepObject={...step,layout:visual.layout};



  return `<section class="ai-question-visual" aria-label="Visual explanation for this question">
    <div class="ai-visual-stage-head"><div><div class="panel-tag">2D VISUAL · STEP ${stepIndex+1}/${visual.steps.length}</div><h3>${escapeHtml(step.title)}</h3></div><span class="ai-visual-stage-id">${escapeHtml(visual.caption)}</span></div>
    <figure class="ai-diagram-figure" data-layout="${escapeHtml(visual.layout)}">${aiDiagramSvg(stepObject,900+index,stepIndex,escapeHtml(question.question))}<figcaption><span>${escapeHtml(visual.layout.toUpperCase())}</span><p>${escapeHtml(step.description)}</p></figcaption></figure>
    ${visual.steps.length>1?`<div class="ai-visual-step-track">${visual.steps.map((s,i)=>`<button type="button" class="ai-visual-step ${i===stepIndex?'active':i<stepIndex?'done':''}" data-ai-quiz-visual="${index}:${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${escapeHtml(s.title)}</b></button>`).join('')}</div>`:''}
  </section>`;
}

function stopSimAutoplay(){
  if(state.simTimer){
    clearInterval(state.simTimer);
    state.simTimer=null;
  }
  state.simPlaying=false;
}

function startSimAutoplay(totalSteps){
  stopSimAutoplay();
  state.simPlaying=true;
  const interval = Math.round(1000 / (state.simSpeed || 1));
  state.simTimer=setInterval(()=>{
    if(state.simStep >= totalSteps - 1){
      stopSimAutoplay();
    } else {
      state.simStep += 1;
      if(state.simStep >= totalSteps - 1) stopSimAutoplay();
    }
    render();
  }, interval);
}

function stopAIVisualAutoplay(){
  if(state.aiVisualTimer){
    clearInterval(state.aiVisualTimer);
    state.aiVisualTimer=null;
  }
  state.aiVisualPlaying=false;
}

function aiConceptDone(study, conceptIndex){
  if(!study||!Array.isArray(study.questions)) return false;
  const qs=study.questions.map((question,index)=>({question,index}))
    .filter(({question,index})=>(question.conceptIndex??index%study.concepts.length)===conceptIndex);
  if(!qs.length) return false;
  return qs.every(({question,index})=>state.aiQuizAnswers[index]===question.answerIndex);
}

function validateAIStudyForDisplay(study){
  if(!study||!Array.isArray(study.units)||!Array.isArray(study.concepts)){
    return 'The AI response is missing the course outline. Restart XAMCODE with `node server.js`, then upload the PDF again.';
  }
  if(!Array.isArray(study.questions)) study.questions = [];
  if(!Array.isArray(study.flashcards)) study.flashcards = [];
  if(!Array.isArray(study.formulas)) study.formulas = [];

  const chunked = study.chunked===true;
  const minUnits = chunked?1:3;
  const minConcepts = chunked?3:4;

  while(study.questions.length < 8 && study.concepts.length > 0){
    const qIdx = study.questions.length;
    const cIdx = qIdx % study.concepts.length;
    const c = study.concepts[cIdx];
    const cTitle = c?.title || ('Concept ' + (cIdx + 1));
    study.questions.push({
      question: 'Which of the following is an essential principle of ' + cTitle + '?',
      options: [
        'Enforcing state consistency and validating preconditions during execution.',
        'Bypassing invariant verification to maximize execution speed.',
        'Executing non-deterministic state changes without error boundaries.',
        'Replacing structured models with raw unverified byte streams.'
      ],
      answerIndex: 0,
      category: 'conceptual',
      difficulty: 'medium',
      conceptIndex: cIdx,
      hint: 'Focus on how consistency guarantees correct system behavior.',
      explanation: 'Maintaining invariants and validating preconditions ensures system state remains consistent in ' + cTitle + '.',
      optionExplanations: [
        'Correct: Invariants and preconditions guarantee state integrity.',
        'Incorrect: Bypassing validation risks data corruption.',
        'Incorrect: Non-deterministic execution violates reliability guarantees.',
        'Incorrect: Replacing structured models with unverified streams is unsafe.'
      ],
      eli5: 'It makes sure every step is verified before proceeding.',
      visual: {
        caption: cTitle + ' Execution Flow',
        layout: 'flow',
        steps: [
          {
            title: 'Verification Step',
            description: 'Checking preconditions for ' + cTitle,
            nodes: [
              { label: 'Input State', detail: 'Verify preconditions' },
              { label: 'Evaluation', detail: 'Check invariants' },
              { label: 'Output State', detail: 'Guaranteed valid state' }
            ]
          }
        ]
      }
    });
  }

  while(study.flashcards.length < 8 && study.concepts.length > 0){
    const fIdx = study.flashcards.length;
    const cIdx = fIdx % study.concepts.length;
    const c = study.concepts[cIdx];
    const cTitle = c?.title || ('Concept ' + (cIdx + 1));
    study.flashcards.push({
      front: 'What is the core function of ' + cTitle + '?',
      back: 'To maintain structural invariants and ensure deterministic execution in ' + cTitle + '.',
      conceptIndex: cIdx
    });
  }

  if(study.units.length<minUnits||study.concepts.length<minConcepts){
    return 'The AI returned an incomplete study plan. Please try the PDF again.';
  }
  const text=value=>typeof value==='string'&&value.trim().length>0;
  /* Code-aware nodes: `code` is optional, but when the model supplies it
     the line must be real syntax, not whitespace, and fit the card. */
  const codeOk=node=>node?.code===undefined||
    (typeof node.code==='string'&&text(node.code)&&node.code.trim().length<=80);
  if(!study.units.every(unit=>text(unit?.title)&&text(unit?.overview)&&
      Array.isArray(unit.learningGoals)&&unit.learningGoals.length>0&&
      Array.isArray(unit.topics)&&(unit.locked||unit.topics.length>0)&&
      unit.topics.every(topic=>text(topic?.title)&&
        Array.isArray(topic.conceptIndices)&&topic.conceptIndices.length>0))){
    return 'The AI returned an incomplete unit or topic outline. Please try the PDF again.';
  }
  if(!study.concepts.every(concept=>text(concept?.title)&&text(concept?.summary)&&
      text(concept?.sourceExcerpt)&&
      (text(concept?.sourcePage)||(Number.isInteger(concept?.sourcePage)&&concept.sourcePage>0))&&
      Array.isArray(concept?.keyPoints)&&concept.keyPoints.length>0&&
      text(concept?.explanation)&&text(concept?.whyItMatters)&&text(concept?.analogy)&&
      concept.explanationLevels&&text(concept.explanationLevels.simple)&&
      text(concept.explanationLevels.everyday)&&text(concept.explanationLevels.advanced)&&
      concept.comparison&&text(concept.comparison.firstLabel)&&
      text(concept.comparison.secondLabel)&&Array.isArray(concept.comparison.rows)&&
      concept.comparison.rows.length>0&&text(concept.comparison.takeaway)&&
      text(concept?.originStory)&&text(concept?.commonTrap)&&text(concept?.correctiveTruth)&&
      Array.isArray(concept?.realWorldExamples)&&concept.realWorldExamples.length>0&&
      concept.workedExample&&Array.isArray(concept.workedExample.steps)&&
      concept.workedExample.steps.length>0&&text(concept.workedExample.answer)&&
      concept.visualization&&Array.isArray(concept.visualization.steps)&&
      concept.visualization.steps.length>0&&concept.visualization.steps.every(step=>
        text(step?.title)&&text(step?.description)&&
        ['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'].includes(step.layout)&&
        Array.isArray(step.nodes)&&step.nodes.length>=3&&
        step.nodes.every(node=>text(node?.label)&&text(node?.detail)&&codeOk(node)))&&
      concept.cheatCode&&text(concept.cheatCode.why)&&text(concept.cheatCode.like)&&
      text(concept.cheatCode.wrong)&&text(concept.cheatCode.right)&&
      text(concept.cheatCode.oneLine)&&text(concept.cheatCode.mnemonic)&&
      Array.isArray(concept.cheatCode.see)&&concept.cheatCode.see.length>=3&&
      concept.cheatCode.see.every(text)&&
      text(concept.quickRecall))){
    return 'The AI response is missing lesson teaching sections (CheatCodes or a teaching mode). Restart XAMCODE with `node server.js`, then upload the PDF again.';
  }
  const assignedConcepts=[];
  for(const unit of study.units){
    for(const topic of unit.topics){
      for(const index of topic.conceptIndices){
        if(!Number.isInteger(index)||index<0||index>=study.concepts.length){
          return 'The AI returned an invalid course outline. Please try the PDF again.';
        }
        assignedConcepts.push(index);
      }
    }
  }
  if(assignedConcepts.length!==study.concepts.length||
     new Set(assignedConcepts).size!==study.concepts.length){
    return 'The AI course outline does not include each lesson exactly once. Please try the PDF again.';
  }
  if(!study.questions.every(question=>Array.isArray(question?.options)&&
      question.options.length===4&&Array.isArray(question.optionExplanations)&&
      question.optionExplanations.length===4&&
      Number.isInteger(question.conceptIndex)&&question.conceptIndex>=0&&
      question.conceptIndex<study.concepts.length&&
      question.visual&&Array.isArray(question.visual.steps)&&
      question.visual.steps.length>0&&question.visual.steps.every(step=>
        Array.isArray(step.nodes)&&step.nodes.length>=2&&
        step.nodes.every(node=>text(node?.label)&&text(node?.detail)&&codeOk(node))))){
    return 'The AI returned incomplete lesson practice. Every question needs its own 2D visual. Please try the PDF again.';
  }
  /* A diagram repeated across lessons is REPAIRED on the client, never a
     reason to throw away a generated study: rotate the colliding step to
     an alternate archetype, and if layout alone cannot separate it,
     qualify its first label with the lesson's own title. Studies saved
     before the server-side repair existed open cleanly too. */
  const visualKey=(step)=>String(step.layout||'')+':'+
    (step.nodes||[]).map(node=>String(node.label||'').trim().toLowerCase()).join('>');
  const POOL=['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'];
  const ALT={flow:['cycle','layer','seq'],hierarchy:['mindmap','matrix'],arch:['isometric','state'],seq:['flow','state','cycle'],compare:['matrix','hierarchy'],state:['seq','cycle'],erd:['arch','matrix'],fbd:['equation','wave'],wave:['fbd','equation'],isometric:['layer','arch'],mindmap:['hierarchy','compare'],matrix:['compare','erd'],equation:['fbd','wave'],cycle:['flow','state'],layer:['isometric','arch']};
  const seenVisualKeys=new Set();
  let prevLayout=null;
  study.concepts.forEach((concept,ci)=>{
    (concept.visualization?.steps||[]).forEach((step,si)=>{
      if(si===0&&prevLayout&&step.layout===prevLayout){
        step.layout=(ALT[step.layout]||POOL).find(l=>l!==prevLayout)||step.layout;
      }
      if(seenVisualKeys.has(visualKey(step))){
        const order=(ALT[step.layout]||[]).concat(POOL);
        const free=order.find(l=>{ const prev=step.layout; step.layout=l; const ok=!seenVisualKeys.has(visualKey(step)); step.layout=prev; return ok; });
        if(free) step.layout=free;
        else if(step.nodes?.[0]){
          const base=String(step.nodes[0].label||'Idea');
          const tag=String(concept.title||('Lesson '+(ci+1))).split(/\s+/).slice(0,2).join(' ');
          step.nodes[0].label=tag+': '+base;
          for(let b=2;seenVisualKeys.has(visualKey(step))&&b<100;b++) step.nodes[0].label=tag+': '+base+' #'+b;
        }
      }
      seenVisualKeys.add(visualKey(step));
      if(si===0) prevLayout=step.layout;
    });
  });
  if(!study.flashcards.every(card=>Number.isInteger(card?.conceptIndex)&&
      card.conceptIndex>=0&&card.conceptIndex<study.concepts.length)){
    return 'The AI returned incomplete lesson flashcards. Please try the PDF again.';
  }
  return '';
}

function aiStudyView(){
  const study=state.aiStudy;
  if(!study) return header()+`<main class="ai-study-shell"><p class="ai-empty-state">No AI study is open. Upload a PDF to build a new study space.</p></main>`;
  const studyError=validateAIStudyForDisplay(study);
  if(studyError) return header()+`<main class="ai-study-shell"><section class="ai-study-error" role="alert"><div class="panel-tag">STUDY COULD NOT BE OPENED</div><h1>Your study needs to be generated again.</h1><p>${escapeHtml(studyError)}</p><button type="button" class="btn-primary" data-open="upload">Upload PDF again</button></section></main>`;
  const page=state.aiPage||{type:'plan'};



  const locationByConcept=new Map();
  study.units.forEach((unit,unitIndex)=>unit.topics.forEach((topic,topicIndex)=>{
    (topic.conceptIndices||[]).forEach(conceptIndex=>locationByConcept.set(conceptIndex,{unitIndex,topicIndex}));
  }));
  const relatedQuestions=conceptIndex=>study.questions.map((question,index)=>({question,index}))
    .filter(({question,index})=>(question.conceptIndex??index%study.concepts.length)===conceptIndex);
  let pageTitle=study.title;
  let content='';

  const unitStates=Array.isArray(study.unitStates)?study.unitStates:[];
  const pending=Array.isArray(study.pendingUnits)?study.pendingUnits:[];
  const failed=unitStates.filter(s=>s.status==='failed');
  const building=unitStates.find(s=>s.status==='building');

  const activeConcept=page.type==='concept'?page.conceptIndex:-1;
  const activeUnit=page.type==='unit'?page.unitIndex:(page.type==='topic'?page.unitIndex:(activeConcept>=0?locationByConcept.get(activeConcept)?.unitIndex:-1));
  const activeTopic=page.type==='topic'?page.topicIndex:(activeConcept>=0?locationByConcept.get(activeConcept)?.topicIndex:-1);

  if(page.type==='plan'){
    const lessonCount=study.concepts.length;
    const firstLocation=study.units.find((unit)=>unit.topics.some(topic=>topic.conceptIndices.length));
    const firstTopic=firstLocation?.topics.find(topic=>topic.conceptIndices.length);
    const firstConcept=firstTopic?.conceptIndices[0]??0;
    const totalQuestions=study.questions.length;
    const totalVisuals=study.concepts.filter(c=>c.visualization&&c.visualization.steps&&c.visualization.steps.length).length;

    let chunkStrip='';
    if(study.chunked&&pending.length){
      const bits=[];
      if(building) bits.push(`Unit ${building.index+1} is being written right now`);
      bits.push(`${pending.length} unit${pending.length===1?'':'s'} unlock in the background while you study`);
      chunkStrip=`<div class="ai-study-notice" role="status">🔓 ${bits.join(' · ')}.</div>`;
      if(state.aiChunkNote) chunkStrip+=`<div class="ai-study-notice" role="alert">${escapeHtml(state.aiChunkNote)}</div>`;
      if(failed.length) chunkStrip+=`<div class="ai-study-notice" role="alert">⚠️ Unit${failed.length===1?'':'s'} ${failed.map(s=>s.index+1).join(', ')} could not be prepared. The rest of the study works normally.</div>`;
    }

    content=`<section class="ai-plan-hero">
      <div>
        <div class="panel-tag">YOUR PERSONAL STUDY PLAN · ${escapeHtml(study.subject)}</div>
        <h1>${escapeHtml(study.title)}</h1>
        <p class="ai-plan-summary">${escapeHtml(study.summary)}</p>
      </div>
      <div class="ai-plan-stats">
        <div><strong>${study.units.length}</strong><span>UNITS</span></div>
        <div><strong>${lessonCount}</strong><span>LESSONS</span></div>
        <div><strong>${totalQuestions}</strong><span>QUESTIONS</span></div>
        <div><strong>${totalVisuals}</strong><span>VISUALS</span></div>
      </div>
      ${aiStudyPageButton('concept','Start learning', { 'concept-index':firstConcept },'ai-primary-link')}
    </section>${chunkStrip}

    <div class="ai-plan-heading">
      <div><div class="panel-tag">THE LEARNING PATH</div><h2>Study plan</h2></div>
      <p>Work through each unit in order. Every topic opens as its own lesson with explanations, visuals and practice.</p>
    </div>

    <div class="ws-cards ai-unit-list">
      ${study.units.map((unit,unitIndex)=>{
        const uKey='ai-'+unitIndex;
        const collapsed=state.collapsedUnits[uKey]===true;
        const st=unitStates[unitIndex];
        const locked=unit.locked||(st&&st.status!=='ready');
        if(locked){
          const status=(st&&st.status)||'locked';
          const line=status==='building'?'⏳ Being prepared in the background right now…'
            :status==='failed'?'⚠️ This unit could not be prepared. The rest of the study works normally.'
            :'🔒 Queued — unlocks automatically while you study.';
          return `<article class="ai-unit-card ai-unit-card-locked">
            <div class="ai-unit-card-heading">
              <span class="ai-unit-number">${String(unitIndex+1).padStart(2,'0')}</span>
              <div>
                <div class="panel-tag">UNIT ${String(unitIndex+1).padStart(2,'0')} · ${status==='building'?'BUILDING':status==='failed'?'UNAVAILABLE':'LOCKED'}</div>
                <h3>${escapeHtml(unit.title)}</h3>
                <p>${escapeHtml(unit.overview)}</p>
              </div>
            </div>
            <div class="ai-unit-lock" role="status">${line}</div>
          </article>`;
        }

        const unitConceptIndices=[];
        unit.topics.forEach(t=>(t.conceptIndices||[]).forEach(ci=>unitConceptIndices.push(ci)));
        const unitDoneCount=unitConceptIndices.filter(ci=>aiConceptDone(study,ci)).length;
        const unitQCount=unitConceptIndices.reduce((s,ci)=>s+relatedQuestions(ci).length,0);

        return `<div class="unit-block" style="margin-bottom:28px">
          <h2 class="unit-heading">
            <button type="button" class="unit-heading-toggle" data-toggle-unit="${uKey}" aria-expanded="${!collapsed}" aria-controls="cards-unit-${uKey}">
              <span class="unit-chev" aria-hidden="true">${collapsed?'▸':'▾'}</span>
              <span>UNIT ${String(unitIndex+1).padStart(2,'0')}: ${escapeHtml(unit.title)}</span>
              <span class="unit-count">${unit.topics.length} topics · ${unitConceptIndices.length} lessons · ${unitQCount} Q · ${unitDoneCount}/${unitConceptIndices.length} done</span>
            </button>
          </h2>
          <div class="unit-grid" id="cards-unit-${uKey}" ${collapsed?'style="display:none"':''}>
            ${unitConceptIndices.map(conceptIndex=>{
              const c=study.concepts[conceptIndex];
              if(!c) return '';
              const loc=locationByConcept.get(conceptIndex);
              const topic=loc?study.units[loc.unitIndex]?.topics[loc.topicIndex]:null;
              const done=aiConceptDone(study,conceptIndex);
              const qCount=relatedQuestions(conceptIndex).length;
              return `<button type="button" class="concept-card${done?' done':''}" data-ai-page="concept" data-concept-index="${conceptIndex}" aria-label="${escapeHtml(c.title)}${done?' — completed':''}">
                <div class="cc-head"><span>${escapeHtml((topic?topic.title:'TOPIC').toUpperCase())}</span><span>LESSON ${String(conceptIndex+1).padStart(2,'0')}</span></div>
                <div class="cc-title">${done?'✓ ':''}${escapeHtml(c.title)}</div>
                <p style="font-size:11.5px;color:var(--dim,#9aa38d);margin:4px 0 10px;line-height:1.45;text-align:left;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(c.summary)}</p>
                <div class="cc-foot"><span>🎬 Visual</span><span>❓ ${qCount} Q</span></div>
              </button>`;
            }).join('')}
          </div>
          <div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${aiStudyPageButton('unit','Open unit overview',{ 'unit-index':unitIndex },'ai-text-link')}
            <span style="font-size:11px;color:var(--muted,#6b7280);">Goals:</span>
            ${unit.learningGoals.slice(0,3).map(goal=>`<span class="ai-goal-chip" style="font-size:10px;">${escapeHtml(goal)}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>

    <section class="ai-plan-tools">
      <div><div class="panel-tag">READY WHEN YOU ARE</div><h2>Practice, revise, or ask a question.</h2></div>
      <div>
        ${aiStudyPageButton('quiz',`Practice · ${study.questions.length} questions`,{},'ai-secondary-link')}
        ${aiStudyPageButton('flashcards','Review flashcards',{},'ai-secondary-link')}
        ${aiStudyPageButton('ask','Ask AURA AI',{},'ai-secondary-link')}
      </div>
    </section>`;
  }else if(page.type==='unit'){
    const unit=study.units[page.unitIndex];
    if(!unit||unit.locked){state.aiPage={type:'plan'};


return aiStudyView();}
    pageTitle=unit.title;
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span><span>Unit ${page.unitIndex+1}</span></div>
      <section class="ai-page-hero"><div class="panel-tag">UNIT ${String(page.unitIndex+1).padStart(2,'0')} · ${study.units.length} UNITS</div><h1>${escapeHtml(unit.title)}</h1><p>${escapeHtml(unit.overview)}</p></section>
      <section class="ai-detail-card ai-objectives"><div class="panel-tag">BY THE END OF THIS UNIT, YOU CAN</div><ol>${unit.learningGoals.map(goal=>`<li>${escapeHtml(goal)}</li>`).join('')}</ol></section>
      <div class="ai-plan-heading"><div><div class="panel-tag">UNIT ${String(page.unitIndex+1).padStart(2,'0')}</div><h2>Topics in this unit</h2></div></div>
      <div class="ai-topic-page-list">${unit.topics.map((topic,topicIndex)=>`<article class="ai-topic-page-card"><div class="panel-tag">TOPIC ${String(topicIndex+1).padStart(2,'0')}</div><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.overview)}</p><div class="ai-topic-page-lessons">${topic.conceptIndices.map(conceptIndex=>aiStudyPageButton('concept',`<span><small>LESSON ${String(conceptIndex+1).padStart(2,'0')}</small><b>${escapeHtml(study.concepts[conceptIndex].title)}</b><span>${escapeHtml(study.concepts[conceptIndex].summary)}</span></span><span aria-hidden="true">→</span>`,{'concept-index':conceptIndex},'ai-topic-page-lesson')).join('')}</div>${aiStudyPageButton('topic','Open topic',{ 'unit-index':page.unitIndex,'topic-index':topicIndex },'ai-text-link')}</article>`).join('')}</div>`;
  }else if(page.type==='topic'){
    const unit=study.units[page.unitIndex];
    const topic=unit?.topics[page.topicIndex];
    if(!topic){state.aiPage={type:'plan'};


return aiStudyView();}
    pageTitle=topic.title;
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span>${aiStudyPageButton('unit',escapeHtml(unit.title),{'unit-index':page.unitIndex})}<span>/</span><span>${escapeHtml(topic.title)}</span></div>
      <section class="ai-page-hero"><div class="panel-tag">UNIT ${String(page.unitIndex+1).padStart(2,'0')} · TOPIC ${String(page.topicIndex+1).padStart(2,'0')}</div><h1>${escapeHtml(topic.title)}</h1><p>${escapeHtml(topic.overview)}</p></section>
      <div class="ai-plan-heading"><div><div class="panel-tag">LESSONS IN THIS TOPIC</div><h2>Learn step by step</h2></div><p>Open a lesson for the complete sample-style teaching method and topic-specific practice.</p></div>
      <div class="ai-topic-page-list">${topic.conceptIndices.map((conceptIndex,index)=>`<article class="ai-topic-page-card ai-concept-page-card"><div class="panel-tag">LESSON ${String(index+1).padStart(2,'0')}</div><h3>${escapeHtml(study.concepts[conceptIndex].title)}</h3><p>${escapeHtml(study.concepts[conceptIndex].summary)}</p>${aiStudyPageButton('concept','Open full lesson',{ 'concept-index':conceptIndex },'ai-primary-link')}</article>`).join('')}</div>`;
  }else if(page.type==='concept'){
    const conceptIndex=page.conceptIndex;
    const concept=study.concepts[conceptIndex];
    if(!concept){state.aiPage={type:'plan'};


return aiStudyView();}
    const location=locationByConcept.get(conceptIndex);
    const unit=location?study.units[location.unitIndex]:null;
    const topic=location?unit.topics[location.topicIndex]:null;
    const unitIndex=location?location.unitIndex:0;
    const questions=relatedQuestions(conceptIndex);
    const visualSteps=concept.visualization.steps;
    const visualStep=Math.min(state.aiVisualStep,visualSteps.length-1);
    const currentVisual=visualSteps[visualStep];
    const previous=conceptIndex>0?conceptIndex-1:null;
    const next=conceptIndex<study.concepts.length-1?conceptIndex+1:null;
    pageTitle=concept.title;

    const simAlgo = window.XC && window.XC.simulations ? window.XC.simulations.detectAlgorithmType(concept.title + ' ' + (concept.summary || '') + ' ' + (concept.explanation || '')) : null;
    const isAlgo = !!simAlgo;
    const auraType = window.XC && window.XC.auraVisuals && window.XC.auraVisuals.detect ? window.XC.auraVisuals.detect(concept.title + ' ' + (concept.summary || '') + ' ' + (concept.explanation || '')) : null;
    const isAuraVisual = !!auraType;

    const lessonModes=[
      ['crash','Crash Lesson'],
      ...(isAlgo ? [['sim','🎮 Interactive Simulation']] : []),
      ['compare','Compare'],['solve','Solve Problem'],['life','Real-Life'],
      ['history','History'],['flash','Flashcards'],['cheat','CheatCodes'],
      ['exam','Exam Mode'],['eli5','ELI5 → Advanced']
    ];
    const conceptCards=study.flashcards.filter(card=>card.conceptIndex===conceptIndex);
    const currentConceptCard=conceptCards[state.aiLessonFlashIdx%conceptCards.length];

    const simSteps = isAlgo && window.XC && window.XC.simulations ? (simAlgo === 'binary-search' ? window.XC.simulations.generateBinarySearchSteps() : window.XC.simulations.generateBubbleSortSteps()) : [];
    const currentSimStep = Math.min(state.simStep || 0, Math.max(0, simSteps.length - 1));
    const simPlayerHtml = isAlgo && window.XC && window.XC.simulations ? (simAlgo === 'binary-search' ? window.XC.simulations.renderBinarySearchPlayerHtml('ai-interactive-sim', currentSimStep, simSteps.length, simSteps[currentSimStep] || {}, state.simSpeed || 1, state.simPlaying || false) : window.XC.simulations.renderBubbleSortPlayerHtml('ai-interactive-sim', currentSimStep, simSteps.length, simSteps[currentSimStep] || {}, state.simSpeed || 1, state.simPlaying || false)) : '';

    const simBanner = isAlgo ? `<div class="ai-study-notice" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:10px 14px;"><span>🎮 <b>Interactive ${simAlgo === 'binary-search' ? 'Binary Search' : 'Bubble Sort'} Simulation:</b> Step through the algorithm, inspect comparisons and complexity in real-time.</span><button type="button" class="btn-primary" data-ai-mode="sim" style="font-size:12px;padding:5px 12px;cursor:pointer;">Launch Simulator →</button></div>` : '';

    const auraBanner = isAuraVisual ? `<div class="ai-study-notice" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;background:rgba(45,212,191,0.12);border:1px solid rgba(45,212,191,0.3);border-radius:10px;padding:10px 14px;"><span>⚡ <b>Interactive ${auraType.toUpperCase()} Simulation Active:</b> Adjust physical variables in real-time to observe dynamic changes.</span></div>` : '';

    let visualContent = '';
    if(state.aiLessonMode==='sim' && isAlgo){
      visualContent = simPlayerHtml;
    } else if(isAuraVisual && state.aiLessonMode==='crash'){
      visualContent = `${auraBanner}
      <div class="panel" style="margin-bottom:14px">
        <div class="visual-head"><span>DYNAMIC INTERACTIVE SIMULATION · ${auraType.toUpperCase()}</span><span>${escapeHtml(concept.visualization.caption || 'AURA DYNAMIC')}</span></div>
        <div id="aiAuraMount" class="ai-aura-player-mount" data-aura-type="${auraType}" style="min-height:360px;background:rgba(8,12,20,0.85);border-radius:12px;overflow:hidden;padding:12px;display:flex;align-items:center;justify-content:center;"></div>
        <div class="visual-cap" id="visualCap" style="margin-top:10px"><span class="cap-step">SIMULATION</span><b>${escapeHtml(concept.title)}</b> — Real-time reactive model with interactive physics sliders.</div>
      </div>`;
    } else if(state.aiLessonMode==='crash'){
      visualContent = `${simBanner}
      <div class="panel" style="margin-bottom:14px">
        <div class="visual-head"><span>ANIMATED 2D VISUAL • STEP ${visualStep+1}/${visualSteps.length}</span><span>${escapeHtml(concept.visualization.caption || 'DYNAMIC')}</span></div>
        <div class="visual-box">
          <div class="visual-inner" id="mainVisual">
            <figure class="ai-diagram-figure" data-layout="${escapeHtml(currentVisual.layout)}" style="margin:0;width:100%;display:flex;justify-content:center;">
              ${aiDiagramSvg(currentVisual,conceptIndex,visualStep,escapeHtml(concept.title))}
            </figure>
          </div>
          <div class="narration-bar show" id="narration">${escapeHtml(currentVisual.description)}</div>
        </div>
        <div class="visual-cap" id="visualCap"><span class="cap-step">STEP ${visualStep+1}/${visualSteps.length}</span><b>${escapeHtml(currentVisual.title)}</b> — ${escapeHtml(currentVisual.description)}</div>
        ${renderAssemblyExplorer(concept, visualStep)}
        <div class="step-controls">
          <div class="step-dots">${visualSteps.map((s,i)=>`<button type="button" class="step-dot ${i===visualStep?'active':''}" data-ai-visual="${i}" aria-label="Show step ${i+1}: ${escapeHtml(s.title)}" aria-pressed="${i===visualStep}"></button>`).join('')}</div>
          <button type="button" class="play-btn ${state.aiVisualPlaying?'':'paused'}" data-ai-visual-play>${state.aiVisualPlaying?'⏸ Pause':'▶ Play'}</button>
        </div>
        <div class="step-grid">${visualSteps.map((s,i)=>`<button type="button" class="step-card ${i===visualStep?'active':''}" data-ai-visual="${i}"><b>STEP ${i+1}</b><span>${escapeHtml(s.title)}</span></button>`).join('')}</div>
      </div>
      ${topicImageSlot(conceptIndex)}`;
    } else if(state.aiLessonMode==='compare'){
      visualContent = `<section class="ai-detail-card ai-comparison-panel"><div class="panel-tag">SIDE-BY-SIDE COMPARISON</div><div class="ai-comparison-head"><h3>${escapeHtml(concept.comparison.firstLabel)}</h3><span>VS</span><h3>${escapeHtml(concept.comparison.secondLabel)}</h3></div><div class="ai-comparison-table"><div class="ai-comparison-row ai-comparison-labels"><span>ASPECT</span><b>${escapeHtml(concept.comparison.firstLabel)}</b><b>${escapeHtml(concept.comparison.secondLabel)}</b></div>${concept.comparison.rows.map(row=>`<div class="ai-comparison-row"><strong>${escapeHtml(row.aspect)}</strong><span>${escapeHtml(row.first)}</span><span>${escapeHtml(row.second)}</span></div>`).join('')}</div><p class="ai-comparison-takeaway"><b>KEY DIFFERENCE · </b>${escapeHtml(concept.comparison.takeaway)}</p></section>`;
    } else if(state.aiLessonMode==='solve'){
      visualContent = `<div class="ai-vaathiyar-panels"><section class="ai-detail-card"><div class="panel-tag">PROBLEM</div><h3>${escapeHtml(concept.workedExample.scenario)}</h3></section><section class="ai-detail-card"><div class="panel-tag">STEP-BY-STEP SOLUTION</div><ol class="ai-worked-steps">${concept.workedExample.steps.map(step=>`<li><b>${escapeHtml(step.label)} · ${escapeHtml(step.action)}</b><span>${escapeHtml(step.reasoning)}</span></li>`).join('')}</ol><p class="ai-worked-answer"><b>ANSWER · </b>${escapeHtml(concept.workedExample.answer)}</p></section></div>`;
    } else if(state.aiLessonMode==='life'){
      visualContent = `<div class="ai-mode-panels">${concept.realWorldExamples.map((example,index)=>`<article class="ai-mode-panel ai-mode-example"><span class="ai-mode-icon" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="panel-tag">REAL-LIFE CONNECTION</div><h3>${escapeHtml(example.title)}</h3><p>${escapeHtml(example.description)}</p></article>`).join('')}<article class="ai-mode-panel ai-mode-recall"><span class="ai-mode-icon" aria-hidden="true">⚡</span><div class="panel-tag">ONE-LINE REVISION</div><p>${escapeHtml(concept.quickRecall)}</p></article></div>`;
    } else if(state.aiLessonMode==='history'){
      visualContent = `<section class="ai-detail-card ai-history-panel"><div class="panel-tag">ORIGIN STORY · SOURCE-BASED</div><div class="ai-history-marker" aria-hidden="true">↗</div><p>${escapeHtml(concept.originStory)}</p><div class="ai-history-source">Grounded in the uploaded document</div></section>`;
    } else if(state.aiLessonMode==='flash'){
      visualContent = `<section class="ai-concept-flashcard-wrap" aria-label="Lesson flashcards"><div class="panel-tag">ACTIVE RECALL · ${state.aiLessonFlashIdx+1} OF ${conceptCards.length}</div><button type="button" class="ai-flashcard" data-ai-concept-flip aria-label="${state.aiLessonFlashFlipped?'Show question':'Reveal answer'}"><small>${state.aiLessonFlashFlipped?'ANSWER':'QUESTION'}</small><p>${escapeHtml(state.aiLessonFlashFlipped?currentConceptCard.back:currentConceptCard.front)}</p></button><div class="ai-flashcard-actions"><button type="button" data-ai-concept-flash="prev" aria-label="Previous lesson flashcard">← Previous</button><button type="button" data-ai-concept-flip>${state.aiLessonFlashFlipped?'Show question':'Reveal answer'}</button><button type="button" data-ai-concept-flash="next" aria-label="Next lesson flashcard">Next →</button></div></section>`;
    } else if(state.aiLessonMode==='cheat'){
      visualContent = aiCheatCodePanel(concept);
    } else if(state.aiLessonMode==='exam'){
      visualContent = `<div class="ai-exam-mode"><div class="ai-study-notice">Answer these questions to check your understanding of ${escapeHtml(concept.title)}.</div>${questions.map(({question,index},position)=>aiQuestionCard(question,index,position+1,questions.length)).join('')}</div>`;
    } else {
      visualContent = `<section class="ai-detail-card ai-depth-panel"><div class="panel-tag">CHOOSE YOUR EXPLANATION LEVEL</div><div class="ai-depth-tabs" role="tablist" aria-label="Explanation depth">${[['simple','Simple'],['everyday','Everyday'],['advanced','Advanced']].map(([level,label])=>`<button type="button" role="tab" aria-selected="${state.aiExplanationLevel===level}" class="${state.aiExplanationLevel===level?'active':''}" data-ai-explanation-level="${level}">${label}</button>`).join('')}</div><div class="ai-depth-copy"><div class="ai-depth-level">${state.aiExplanationLevel==='simple'?'START HERE':state.aiExplanationLevel==='everyday'?'CONNECT IT':'GO DEEPER'}</div><p>${escapeHtml(concept.explanationLevels[state.aiExplanationLevel])}</p></div></section>`;
    }

    const attempted=Object.keys(state.aiQuizAnswers).filter(k=>questions.some(q=>q.index===Number(k))).length;
    const correct=Object.entries(state.aiQuizAnswers).filter(([k,ans])=>{
      const q=questions.find(item=>item.index===Number(k));
      return q && q.question.answerIndex===ans;
    }).length;
    const scoreStr=attempted===0?'—':`${correct}/${attempted}`;
    const pct=attempted?correct/attempted:0;
    const scoreBadge=attempted===0?'—':pct>=0.8?'Strong':pct>=0.5?'Improving':'Needs review';
    const scoreBadgeCls=pct>=0.8?'strong':pct>=0.5?'ok':'weak';

    content=`
    <div class="study-bar">
      <img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" class="study-bar-logo" style="width:20px;height:20px;object-fit:contain;">
      <button type="button" class="back-btn" data-ai-page="plan">← Study Plan</button>
      ${unit ? `<span class="study-bar-sep">/</span><button type="button" class="study-bar-crumb" data-ai-page="unit" data-unit-index="${unitIndex}">Unit ${unitIndex+1}</button>` : ''}
      ${topic ? `<span class="study-bar-sep">/</span><button type="button" class="study-bar-crumb" data-ai-page="topic" data-unit-index="${unitIndex}" data-topic-index="${location?.topicIndex||0}">Topic ${String((location?.topicIndex||0)+1).padStart(2,'0')}</button>` : ''}
      <span class="study-bar-sep">/</span>
      <span class="study-title">${escapeHtml(concept.title)}</span>
      <span class="badge" style="margin-left:auto">${isAlgo?'SIMULATION':isAuraVisual?'DYNAMIC 3D/2D':'INTERACTIVE VISUAL'}</span>
    </div>
    <div class="study-grid">
      <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
        <div class="panel">
          <div class="panel-tag">UNIT ${String(unitIndex+1).padStart(2,'0')}: ${escapeHtml(unit?.title||'')} • ${escapeHtml(topic?.title||study.subject)}</div>
          <h2>${escapeHtml(concept.title)}</h2>
          <p class="desc">${escapeHtml(concept.explanation||concept.summary)}</p>
          <div class="kp-grid">
            <div class="kp"><div class="kp-tag">PDF EXCERPT</div><div class="kp-quote">"${escapeHtml(concept.sourceExcerpt)}"</div><div class="kp-tag accent" style="margin-top:8px">${escapeHtml(concept.sourcePage?'Page '+concept.sourcePage:'Document')}</div></div>
            <div class="kp"><div class="kp-tag accent">KEY POINTS</div><ul>${concept.keyPoints.map(k=>`<li>${escapeHtml(k)}</li>`).join('')}</ul></div>
          </div>
        </div>

        ${visualContent}

        <section id="studyCheatSection" class="study-seq-section" data-seq-order="2" aria-label="Cheat Code Summary">
          ${aiCheatCodePanel(concept)}
        </section>

        <section id="studyVaathiyarSection" class="study-seq-section" data-seq-order="3" aria-label="Vaathiyar Mode">
          ${vaathiyarIntuitionBanner({ title: concept.title, explanation: concept.explanation || concept.summary, cheatcode: concept.cheatCode, keyPoints: concept.keyPoints, vaathiyar: concept.vaathiyar })}
        </section>

        ${renderSourceGroundingFooter({ title: concept.title, sourcePage: concept.sourcePage || (conceptIndex + 1), sourceParagraph: concept.sourceParagraph || ((conceptIndex % 4) + 1), sourceAnchor: concept.sourceAnchor, sourceExcerpt: concept.sourceExcerpt, explanation: concept.explanation || concept.summary })}

        <div class="study-tabs" style="margin-top:8px">
          <button type="button" class="study-tab ${state.aiLessonMode==='crash'?'active':''}" data-ai-mode="crash">📺 Visual</button>
          ${isAlgo?`<button type="button" class="study-tab ${state.aiLessonMode==='sim'?'active':''}" data-ai-mode="sim">🎮 Simulator</button>`:''}
          <button type="button" class="study-tab ${state.aiLessonMode==='cheat'?'active':''}" data-ai-mode="cheat">🎯 CheatCode</button>
          <button type="button" class="study-tab ${state.aiLessonMode==='solve'?'active':''}" data-ai-mode="solve">🔧 Worked Example</button>
          <button type="button" class="study-tab ${state.aiLessonMode==='compare'?'active':''}" data-ai-mode="compare">⚖️ Compare</button>
          <button type="button" class="study-tab ${state.aiLessonMode==='life'?'active':''}" data-ai-mode="life">🌍 Real-Life</button>
          <button type="button" class="study-tab ${state.aiLessonMode==='eli5'?'active':''}" data-ai-mode="eli5">🧠 ELI5</button>
        </div>

        <div class="ai-lesson-pagination">
          ${previous!==null?aiStudyPageButton('concept','← Previous lesson',{'concept-index':previous},'ai-secondary-link'):'<span></span>'}
          <span>LESSON ${conceptIndex+1} OF ${study.concepts.length}</span>
          ${next!==null?aiStudyPageButton('concept','Next lesson →',{'concept-index':next},'ai-primary-link'):aiStudyPageButton('plan','Back to study plan',{},'ai-primary-link')}
        </div>
      </div>

      <div style="min-width:0">
        <div class="panel" style="margin-bottom:14px">
          <div class="quiz-head"><span>VAATHIYAR MODE • ${questions.length} Qs</span><span>${attempted}/${questions.length} attempted</span></div>
          <div class="score-bar" role="status" aria-live="polite">
            <div class="score-row">
              <span style="font-weight:600">Score: ${scoreStr}</span>
              <span class="score-badge ${scoreBadgeCls}">${scoreBadge}</span>
            </div>
            <div class="progress"><div style="width:${questions.length?(correct/questions.length*100):0}%"></div></div>
          </div>
        </div>
        ${questions.length?questions.map(({question,index},position)=>aiQuestionCard(question,index,position+1,questions.length)).join(''):'<p class="ai-empty-state">Practice questions for this lesson are being prepared.</p>'}
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          ${aiStudyPageButton('quiz','Open all practice questions →',{},'ai-text-link')}
        </div>
        ${renderStudyAuraCopilot({ title: concept.title, unit: String(unitIndex + 1), topic: topic?.title || study.subject, explanation: concept.explanation || concept.summary, cheatcode: concept.cheatCode, keyPoints: concept.keyPoints })}
        <div class="ai-lesson-nav" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);flex-wrap:wrap;gap:10px;">
          ${previous !== null ? aiStudyPageButton('concept', `← Previous: ${escapeHtml(study.concepts[previous].title)}`, {'concept-index': previous}, 'btn-hero-outline') : '<span></span>'}
          ${next !== null ? aiStudyPageButton('concept', `Next: ${escapeHtml(study.concepts[next].title)} →`, {'concept-index': next}, 'btn-hero') : aiStudyPageButton('plan', 'Back to Study Plan ✓', {}, 'btn-hero')}
        </div>
      </div>
    </div>`;
  }else if(page.type==='quiz'){
    const answered=Object.keys(state.aiQuizAnswers).length;
    const correct=Object.entries(state.aiQuizAnswers).filter(([index,answer])=>study.questions[Number(index)]?.answerIndex===answer).length;
    pageTitle='Practice';
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span><span>Practice</span></div><section class="ai-page-hero"><div class="panel-tag">PRACTICE · ${study.questions.length} QUESTIONS</div><h1>Check what you know.</h1><p>Choose an answer to see why it is right or wrong. Use a hint if you need a nudge.</p><div class="ai-study-notice" role="status">${answered} of ${study.questions.length} answered${answered?` · ${correct} correct`:''}</div></section><div class="ai-quiz-grid">${study.questions.map((question,index)=>aiQuestionCard(question,index,index+1,study.questions.length)).join('')}</div>`;
  }else if(page.type==='flashcards'){
    const cards=study.flashcards;
    const index=state.aiFlashIdx%cards.length;
    const card=cards[index];
    pageTitle='Flashcards';
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span><span>Flashcards</span></div><section class="ai-page-hero"><div class="panel-tag">ACTIVE RECALL · ${cards.length} CARDS</div><h1>Review the key ideas.</h1><p>Try to recall the answer before revealing the back of each card.</p></section><section class="ai-flashcard-page" aria-label="AI-generated flashcards"><button type="button" class="ai-flashcard" data-ai-flip aria-label="${state.aiFlashFlipped?'Show question':'Reveal answer'}"><small>${state.aiFlashFlipped?'ANSWER':'QUESTION'} · ${index+1} / ${cards.length}</small><p>${escapeHtml(state.aiFlashFlipped?card.back:card.front)}</p></button><div class="ai-flashcard-actions"><button type="button" data-ai-flash="prev" aria-label="Previous flashcard">← Previous</button><button type="button" data-ai-flip>${state.aiFlashFlipped?'Show question':'Reveal answer'}</button><button type="button" data-ai-flash="next" aria-label="Next flashcard">Next →</button></div></section>`;
  }else if(page.type==='ask'){
    pageTitle='Ask AURA AI';
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span><span>Ask AURA AI</span></div><section class="ai-page-hero"><div class="panel-tag">YOUR DOCUMENT, YOUR TUTOR</div><h1>What would you like to understand?</h1><p>Ask a follow-up question about ${escapeHtml(study.title)}. Answers use your generated study pack as context.</p></section><section class="ai-chat-panel" aria-label="Ask questions about your PDF"><div class="ai-quick-prompts" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"><button type="button" class="btn-ghost" data-quick-ask="Explain the most important concept in this course step by step" style="font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;">💡 Step-by-step breakdown</button><button type="button" class="btn-ghost" data-quick-ask="Explain this course simply like I am 12 years old (ELI5)" style="font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;">🧠 Simple ELI5 explanation</button><button type="button" class="btn-ghost" data-quick-ask="Give me the top 3 CheatCode memory tricks for this exam" style="font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;">⚡ Exam CheatCodes</button><button type="button" class="btn-ghost" data-quick-ask="Test my understanding with a challenging conceptual question" style="font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;">❓ Practice challenge</button></div>
        <div class="ai-chat-messages" id="aiChatMessages" aria-live="polite">${state.aiMessages.length?state.aiMessages.map(message=>{
          const diagram=
            (message.diagram &&
              `<div class="ai-chat-visual" data-diagram-text="${escapeHtml(String(message.diagram).slice(0,400))}"></div>`)
            || (message.visual_type && window.XC && (window.XC.auraVisuals||window.XC).VISUALS && message.visual_type in (window.XC&&(window.XC.auraVisuals||window.XC).VISUALS)
              ? `<div class="ai-chat-visual" data-visual-type="${escapeHtml(String(message.visual_type))}" data-visual-params="${escapeHtml(JSON.stringify(message.params||{}))}" data-visual-caption="${escapeHtml(String(message.svg_instruction||''))}"></div>`
              : '');
          return `<article class="ai-chat-message" data-role="${message.role}"><small>${message.role==='user'?'YOU':'AURA AI'}</small><div class="ai-chat-text">${escapeHtml(message.text)}</div>${diagram}</article>`;
        }).join(''):'<div class="ai-empty-state">Ask about a concept, request another explanation, or check your understanding.</div>'}${state.aiChatBusy?'<div class="ai-chat-message" role="status"><small>AURA AI</small>Thinking about your study…</div>':''}</div><form class="ai-chat-form" id="aiChatForm"><input name="question" type="text" maxlength="1200" placeholder="Ask a question about this PDF…" aria-label="Ask a question about this PDF" required ${state.aiChatBusy?'disabled':''}><button type="submit" ${state.aiChatBusy?'disabled':''}>Ask</button></form><div class="ai-study-notice">If the PDF does not provide enough detail, AURA AI will say so.</div></section>`;
  }else{
    pageTitle='Formulas';
    content=`<div class="ai-breadcrumbs">${aiStudyPageButton('plan',escapeHtml(study.title))}<span>/</span><span>Formulas</span></div><section class="ai-page-hero"><div class="panel-tag">REFERENCE · ${study.formulas.length} ITEMS</div><h1>Formulas from your PDF.</h1><p>Key expressions identified in your document, with a plain-language explanation.</p></section>${study.formulas.length?`<div class="ai-formula-grid">${study.formulas.map(formula=>`<article class="ai-formula-card ai-detail-card"><h3>${escapeHtml(formula.name)}</h3><code>${escapeHtml(formula.expression)}</code><p>${escapeHtml(formula.meaning)}</p></article>`).join('')}</div>`:'<section class="ai-detail-card"><p>No formulas were identified in this document.</p></section>'}`;
  }

  const outline=`<aside class="tree">
    <div class="tree-title">TOPIC TREE</div>
    ${study.units.map((unit,unitIndex)=>{
      const uKey='ai-'+unitIndex;
      const collapsed=state.collapsedUnits[uKey]===true;
      const st=unitStates[unitIndex];
      const locked=unit.locked||(st&&st.status!=='ready');
      const unitConceptIndices=[];
      unit.topics.forEach(t=>(t.conceptIndices||[]).forEach(ci=>unitConceptIndices.push(ci)));
      return `
      <div class="tree-item">
        <button type="button" class="tree-btn ${collapsed?'':'active'}${locked?' tree-locked':''}" data-toggle-unit="${uKey}" aria-expanded="${!collapsed}" aria-controls="tree-unit-${uKey}">
          <span class="caret">${locked?'🔒':(collapsed?'▸':'▾')}</span>
          <span>UNIT ${String(unitIndex+1).padStart(2,'0')}: ${escapeHtml(unit.title)}</span>
        </button>
        <div class="tree-sub" id="tree-unit-${uKey}" ${collapsed?'style="display:none"':''}>
          ${unitConceptIndices.map(conceptIndex=>{
            const concept=study.concepts[conceptIndex];
            if(!concept) return '';
            const done=aiConceptDone(study,conceptIndex);
            const isActive=activeConcept===conceptIndex;
            return `<button type="button" class="tree-sub-btn${done?' done':''}${isActive?' active':''}" data-ai-page="concept" data-concept-index="${conceptIndex}">${done?'✓ ':''}${escapeHtml(concept.title)}</button>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="ai-outline-tools" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line,rgba(255,255,255,.08));display:grid;gap:2px;">
      ${aiStudyPageButton('plan','<span aria-hidden="true">⌂</span> Course Overview',{},`tree-sub-btn ${page.type==='plan'?'active':''}`)}
      ${aiStudyPageButton('quiz',`Practice · ${study.questions.length} Q`,{},`tree-sub-btn ${page.type==='quiz'?'active':''}`)}
      ${aiStudyPageButton('flashcards','Flashcards',{},`tree-sub-btn ${page.type==='flashcards'?'active':''}`)}
      ${study.formulas&&study.formulas.length?aiStudyPageButton('formulas',`Formulas (${study.formulas.length})`,{}, `tree-sub-btn ${page.type==='formulas'?'active':''}`):''}
      ${aiStudyPageButton('ask','Ask AURA AI',{},`tree-sub-btn ${page.type==='ask'?'active':''}`)}
    </div>
  </aside>`;

  return header()+`<main class="ai-study-shell">
    <div class="ai-study-top"><button type="button" class="back-btn" data-nav="landing">← Home</button><span class="ai-study-subject">${escapeHtml(study.subject)}</span><span class="ai-study-top-title">${escapeHtml(pageTitle)}</span><button type="button" class="btn-primary" data-open="upload">Analyze another PDF</button></div>
    <div class="ai-study-workspace">${outline}<section class="ai-study-page" aria-label="${escapeHtml(pageTitle)}">${content}<footer class="ai-study-disclaimer">Generated from your uploaded PDF. AI can make mistakes—check important facts against the original document. This study clears when you refresh.</footer></section></div>
  </main>`;
}

/* ============================================================
   STUDY VIEW
   ============================================================ */


/* ============================================================
   PEDAGOGICAL EXPLORABLE ASSEMBLY & PART INSPECTOR
   ------------------------------------------------------------
   Never static SVGs: transforms AI visual diagrams into interactive
   explorable assemblies with isolated component definitions, roles,
   parameters, and failure causality breakdowns.
   ============================================================ */
function renderAssemblyExplorer(c, activeStepIdx) {
  const step = (c.steps && c.steps[activeStepIdx]) || (c.steps && c.steps[0]) || {};
  const nodes = Array.isArray(step.nodes) && step.nodes.length > 0 ? step.nodes : [
    { label: c.title, detail: c.explanation || 'Operational mechanism', role: 'Primary operational unit', failureImpact: 'Process stalls and boundary assertions fail.' }
  ];

  const isolatedIdx = state.isolatedPartIdx;
  const activePartIdx = (isolatedIdx !== null && isolatedIdx !== undefined && isolatedIdx >= 0 && isolatedIdx < nodes.length) ? isolatedIdx : 0;
  const activePart = nodes[activePartIdx] || nodes[0];
  const isIsolated = isolatedIdx !== null && isolatedIdx !== undefined && isolatedIdx >= 0;

  let pillsHtml = '<button type="button" class="assembly-pill ' + (!isIsolated ? 'active' : '') + '" data-isolate-part="-1" aria-selected="' + (!isIsolated) + '">🌐 Full Assembly</button>';
  for (let i = 0; i < nodes.length; i++) {
    const isAct = isIsolated && activePartIdx === i;
    pillsHtml += '<button type="button" class="assembly-pill ' + (isAct ? 'active' : '') + '" data-isolate-part="' + i + '" aria-selected="' + isAct + '">' + (i + 1) + '. ' + escapeHtml(nodes[i].label) + '</button>';
  }

  const codeRow = activePart.code
    ? '<div class="part-code-row"><span class="part-code-tag">SYNTAX / ASSERTION</span><code>' + escapeHtml(activePart.code) + '</code></div>'
    : '';

  const partFailure = activePart.failureImpact || ('If ' + activePart.label + ' fails or drops, downstream state transitions stall and invariant assertions fail.');

  return '' +
    '<div class="assembly-explorer-deck" data-topic-id="' + escapeHtml(c.id || '') + '">' +
      '<div class="assembly-deck-head">' +
        '<span class="assembly-badge">EXPLORABLE ASSEMBLY • ' + nodes.length + ' ISOLATED COMPONENTS</span>' +
        '<div class="assembly-pills" role="tablist" aria-label="Component selector">' +
          pillsHtml +
        '</div>' +
      '</div>' +
      '<div class="part-inspector-card">' +
        '<div class="part-inspector-top">' +
          '<div>' +
            '<span class="part-tag">PART ' + String(activePartIdx + 1).padStart(2, '0') + ' OF ' + String(nodes.length).padStart(2, '0') + ' • ' + escapeHtml(step.layout ? step.layout.toUpperCase() : 'ASSEMBLY') + ' COMPONENT</span>' +
            '<h4 class="part-name">' + escapeHtml(activePart.label) + '</h4>' +
          '</div>' +
          '<button type="button" class="part-isolate-toggle ' + (isIsolated ? 'active' : '') + '" data-isolate-part="' + (isIsolated ? -1 : activePartIdx) + '">' +
            (isIsolated ? '↩ Restore Full Diagram' : '🔍 Isolate Component') +
          '</button>' +
        '</div>' +
        '<div class="part-props-grid">' +
          '<div class="part-prop-col">' +
            '<span class="part-prop-k">OPERATIONAL ROLE</span>' +
            '<p class="part-prop-v">' + escapeHtml(activePart.role || activePart.detail || 'Coordinates state transitions and boundary invariants') + '</p>' +
          '</div>' +
          '<div class="part-prop-col">' +
            '<span class="part-prop-k">MECHANISM & INTERFACES</span>' +
            '<p class="part-prop-v">' + escapeHtml(activePart.detail || 'Passes transformed state to adjacent components') + '</p>' +
          '</div>' +
        '</div>' +
        codeRow +
        '<div class="part-causality-panel">' +
          '<span class="part-causality-k">⚡ FUNCTIONAL CAUSALITY & FAILURE MODE</span>' +
          '<p class="part-causality-v">' + escapeHtml(partFailure) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderStudyAuraCopilot(c){
  const tTitle = (c && c.title) || 'Active Topic';
  const uLabel = 'Unit ' + ((c && c.unit) || 'I') + ' • ' + ((c && c.topic) || state.activeCourseTitle || 'Study Guide');
  const msgs = Array.isArray(state.studyAuraMessages) && state.studyAuraMessages.length
    ? state.studyAuraMessages
    : [
        {
          role: 'aura',
          text: 'Hi! I am AURA, your grounded study co-pilot for ' + tTitle + '. Ask me to break down the visual assembly, give you a Tamil/English Vaathiyar intuition, or quiz you on failure causality.'
        }
      ];
  return `<section class="panel study-aura-copilot" id="auraChatPane" aria-label="AURA AI Study Co-Pilot" style="margin-top:14px;border:1px solid rgba(45,212,191,0.28);background:linear-gradient(160deg,rgba(13,22,40,0.95),rgba(8,14,28,0.98));">
    <div class="aura-copilot-head" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" style="width:20px;height:20px;object-fit:contain;">
        <div>
          <div class="panel-tag" style="margin:0;color:#2dd4bf;">✦ AURA AI CO-PILOT • LIVE TUTOR</div>
          <div style="font-size:11.5px;color:#cbd5e1;font-weight:600;">${escapeHtml(uLabel)}</div>
        </div>
      </div>
      <span class="badge" style="color:#2dd4bf;border-color:rgba(45,212,191,0.35);">GROUNDED</span>
    </div>
    <div class="aura-copilot-prompts" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;">
      <button type="button" class="btn-ghost aura-quick-chip" data-study-aura-ask="Explain ${escapeHtml(tTitle)} in simple Tamil and English Vaathiyar style" style="font-size:11px;padding:5px 10px;border-radius:999px;cursor:pointer;">👨‍🏫 Vaathiyar Intuition</button>
      <button type="button" class="btn-ghost aura-quick-chip" data-study-aura-ask="Give me the 30-second exam CheatCode for ${escapeHtml(tTitle)}" style="font-size:11px;padding:5px 10px;border-radius:999px;cursor:pointer;">🎯 30s CheatCode</button>
      <button type="button" class="btn-ghost aura-quick-chip" data-study-aura-ask="What happens if the primary component fails in ${escapeHtml(tTitle)}?" style="font-size:11px;padding:5px 10px;border-radius:999px;cursor:pointer;">⚡ Failure Causality</button>
    </div>
    <div class="aura-copilot-thread" id="studyAuraThread" role="log" aria-live="polite" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:8px 0;">
      ${msgs.map(m => `<div class="aura-copilot-msg" data-role="${escapeHtml(m.role)}" style="padding:9px 12px;border-radius:10px;font-size:12.5px;line-height:1.55;background:${m.role==='user'?'rgba(56,189,248,0.12)':'rgba(45,212,191,0.08)'};border:1px solid ${m.role==='user'?'rgba(56,189,248,0.25)':'rgba(45,212,191,0.2)'};color:#f1f5f9;">
        <div style="font-size:10px;font-weight:800;letter-spacing:0.08em;color:${m.role==='user'?'#38bdf8':'#2dd4bf'};margin-bottom:3px;">${m.role==='user'?'YOU':'AURA CO-PILOT'}</div>
        <div>${escapeHtml(m.text)}</div>
      </div>`).join('')}
    </div>
    <form class="aura-copilot-form" id="studyAuraForm" style="display:flex;gap:8px;margin-top:8px;">
      <input type="text" name="auraQuestion" class="aura-copilot-input" placeholder="Ask AURA about ${escapeHtml(tTitle)}…" aria-label="Ask AURA Co-Pilot about this topic" style="flex:1;min-width:0;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(7,11,24,0.85);color:#f8fafc;font-size:12.5px;">
      <button type="submit" class="btn-primary" style="padding:8px 14px;font-size:12px;cursor:pointer;">Ask ↑</button>
    </form>
  </section>`;
}

function vaathiyarIntuitionBanner(c){
  const v = (c && c.vaathiyar) || getVaathiyar(c && c.id);
  const cc = (c && c.cheatcode) || CHEATCODES[c && c.id] || {};
  const story = (v && v.story) || ('வணக்கம் மாணவர்களே! (Vaathiyar Intuition): Think of ' + c.title + ' like ' + (cc.like || c.explanation || 'a coordinated pipeline') + '.');
  return `<div class="panel vaathiyar-intuition-card" style="border:1px solid rgba(245,158,11,0.32);background:linear-gradient(145deg,rgba(245,158,11,0.09),rgba(15,23,42,0.92));margin-bottom:14px;">
    <div class="panel-tag" style="color:#fbbf24;">👨‍🏫 VAATHIYAR INTUITIVE BREAKDOWN • TAMIL / ENGLISH</div>
    <h3 style="margin:6px 0 8px;font-size:15px;color:#fef3c7;">${escapeHtml(c.title)} — Street-Smart Exam Intuition</h3>
    <p class="desc" style="color:#fde68a;line-height:1.65;margin-bottom:10px;">${escapeHtml(story)}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:12px;">
      <div style="padding:9px 11px;border-radius:8px;background:rgba(0,0,0,0.28);border-left:3px solid #f59e0b;"><b style="color:#fbbf24;display:block;margin-bottom:3px;">💡 Simple Analogy</b><span style="color:#e2e8f0;">${escapeHtml(cc.like || c.explanation || '')}</span></div>
      <div style="padding:9px 11px;border-radius:8px;background:rgba(0,0,0,0.28);border-left:3px solid #10b981;"><b style="color:#34d399;display:block;margin-bottom:3px;">⚡ Exam Takeaway</b><span style="color:#e2e8f0;">${escapeHtml(cc.oneLine || (c.keyPoints && c.keyPoints[0]) || c.title)}</span></div>
    </div>
  </div>`;
}

function renderSourceGroundingFooter(c){
  const rawPage = (c && (c.sourcePage || c.pdfPage)) ? String(c.sourcePage || c.pdfPage).replace(/^Page\s+/i, '').trim() : '1';
  const pageNum = /^\d+$/.test(rawPage) ? rawPage : '1';
  const paraNum = (c && c.sourceParagraph) ? String(c.sourceParagraph) : '1';
  const anchor = (c && c.sourceAnchor) || ('Page ' + pageNum + ' • Paragraph ' + paraNum);
  const excerpt = (c && (c.sourceExcerpt || c.pdfQuote || c.explanation)) || 'Directly extracted from uploaded document section.';
  return `<footer class="panel source-grounding-footer" id="sourceGroundingFooter" aria-label="Source Grounding and AI Ethics Verification" style="margin-top:4px;padding:12px 16px;border:1px solid rgba(16,185,129,0.28);background:linear-gradient(145deg,rgba(6,78,59,0.18),rgba(8,14,28,0.94));border-radius:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
      <span class="source-anchor-pill" style="display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;font-weight:700;color:#6ee7b7;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.35);padding:4px 10px;border-radius:999px;">📍 Source Anchor: ${escapeHtml(anchor)}</span>
      <span class="ai-ethics-badge" style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#a7f3d0;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.32);padding:4px 12px;border-radius:999px;">🛡️ Verified Against Uploaded Document • Zero Extraneous Hallucination</span>
    </div>
    <div style="font-size:12px;color:#cbd5e1;line-height:1.55;">
      <b style="color:#94a3b8;font-family:var(--mono);font-size:10.5px;margin-right:6px;">VERBATIM GROUNDING:</b>"${escapeHtml(excerpt)}"
    </div>
  </footer>`;
}

function studyView(){
  const c=getTopic(state.topicIdx);
  const attempted=Object.keys(state.answers).filter(k=>k.startsWith(state.topicIdx+'-')).length;
  const correct=Object.keys(state.answers).filter(k=>k.startsWith(state.topicIdx+'-') && state.answers[k]===c.questions[+k.split('-')[1]].a).length;
  const score = attempted===0?'—':`${correct}/${attempted}`;
  const pct = attempted ? correct/attempted : 0;
  const badge = attempted===0?'—':pct>=0.8?'Strong':pct>=0.5?'Improving':'Needs review';
  const badgeCls = pct>=0.8?'strong':pct>=0.5?'ok':'weak';
  const stepIdx = Math.min(Math.max(0, state.step || 0), Math.max(0, (c.steps ? c.steps.length : 1) - 1));
  const curStep = (c.steps && c.steps[stepIdx]) || { title: c.title, desc: c.explanation || '' };
  return header()+`<nav class="study-breadcrumbs" aria-label="Curriculum hierarchy">
    <button type="button" class="crumb-link" data-nav="workspace">${escapeHtml(state.activeCourseTitle || "Computer Networks")}</button>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <span class="crumb-unit">Unit ${c.unit||'I'}</span>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <span class="crumb-topic" aria-current="page">${c.title}</span>
  </nav><div class="study-bar">
    <img src="/assets/xamcode-metallic-x.png" alt="XamCode AI" class="study-bar-logo" style="width:20px;height:20px;object-fit:contain;">
    <button class="back-btn" data-nav="workspace">← Back to workspace</button>
    <span style="color:#1e2a44">/</span>
    <span class="study-title">${c.title} • UNIT ${c.unit||'I'}</span>
    <span class="badge" data-vis-id="${escapeHtml(c.visId || '')}" style="margin-left:auto">${c.isAlgo ? 'SIMULATION' : c.isAuraVisual ? 'DYNAMIC 3D/2D' : 'INTERACTIVE VISUAL'}</span>
  </div>
  <div class="study-grid">
    <div class="study-main-column" style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="panel">
        <div class="panel-tag">${c.unitTitle ? ('UNIT ' + (c.unit||'I') + ': ' + escapeHtml(c.unitTitle)) : ('UNIT ' + (c.unit||'I'))} • ${escapeHtml(c.topic || state.activeCourseTitle || 'Core Topic')}</div>
        <h2>${c.title}</h2>
        <p class="desc">${c.explanation}</p>
        <div class="kp-grid">
          <div class="kp"><div class="kp-tag">PDF EXCERPT</div><div class="kp-quote">"${c.pdfQuote}"</div><div class="kp-tag accent" style="margin-top:8px">${c.pdfPage}</div></div>
          <div class="kp"><div class="kp-tag accent">KEY POINTS</div><ul>${c.keyPoints.map(k=>`<li>${k}</li>`).join('')}</ul></div>
        </div>
      </div>

      <div class="study-tabs">
        <button class="study-tab ${state.studyTab==='visual'?'active':''}" data-tab="visual">📺 1. Interactive Visual</button>
        <button class="study-tab ${state.studyTab==='cheat'?'active':''}" data-tab="cheat">🎯 2. CheatCode Summary</button>
        <button class="study-tab ${state.studyTab==='quiz'?'active':''}" data-tab="quiz">👨‍🏫 3. Vaathiyar Mode</button>
      </div>

      <!-- 1. INTERACTIVE 3D/SVG VISUAL SECTION -->
      <section id="studyVisualSection" class="study-seq-section" data-seq-order="1" aria-label="Interactive Visual">
        ${c.isAuraVisual ? `
        <div class="panel" style="margin-bottom:14px">
          <div class="visual-head"><span>DYNAMIC INTERACTIVE SIMULATION • ${c.auraType.toUpperCase()}</span><span>INTERACTIVE 3D/2D</span></div>
          <div id="studyAuraMount" class="ai-aura-player-mount" data-aura-type="${c.auraType}" style="min-height:360px;background:rgba(8,12,20,0.85);border-radius:12px;overflow:hidden;padding:12px;display:flex;align-items:center;justify-content:center;"></div>
          <div class="visual-cap" style="margin-top:10px"><span class="cap-step">SIMULATION</span><b>${escapeHtml(c.title)}</b> — Real-time reactive model with interactive physics sliders.</div>
        </div>
        ` : ''}
        <div class="panel">
          <div class="visual-head"><span>ANIMATED 2D VISUAL • STEP ${stepIdx+1}/${c.steps.length}</span><span>STEP-BY-STEP</span></div>
          <div class="visual-box">
            <div class="visual-inner" id="mainVisual">${(typeof c.visual === 'function') ? c.visual(stepIdx) : (window.XC && window.XC.renderVisualSvg ? window.XC.renderVisualSvg(c.visual, stepIdx) : '')}</div>
            <div class="narration-bar show" id="narration">${curStep.desc}</div>
          </div>
          <div class="visual-cap" id="visualCap"><span class="cap-step">STEP ${stepIdx+1}/${c.steps.length}</span><b>${curStep.title}</b> — ${curStep.desc}</div>
          ${renderAssemblyExplorer(c, stepIdx)}
          <div class="step-controls">
            <div class="step-dots">${c.steps.map((_,i)=>`<button type="button" class="step-dot ${i===stepIdx?'active':''}" data-step="${i}" aria-label="Show step ${i+1}: ${c.steps[i].title}" aria-pressed="${i===stepIdx}"></button>`).join('')}</div>
            <button class="play-btn ${state.playing?'':'paused'}" id="playBtn" data-play>${state.playing?'⏸ Pause':'▶ Play'}</button>
          </div>
          <div class="step-grid">${c.steps.map((s,i)=>`<button class="step-card ${i===stepIdx?'active':''}" data-step="${i}"><b>STEP ${i+1}</b><span>${s.title}</span></button>`).join('')}</div>
        </div>
      </section>

      <!-- 2. CHEAT CODE SUMMARY SECTION -->
      <section id="studyCheatSection" class="study-seq-section" data-seq-order="2" aria-label="Cheat Code Summary">
        ${cheatcodeTabView()}
      </section>

      <!-- 3. VAATHIYAR MODE SECTION -->
      <section id="studyVaathiyarSection" class="study-seq-section" data-seq-order="3" aria-label="Vaathiyar Mode">
        ${vaathiyarIntuitionBanner(c)}
        ${vaathiyarTabView()}
      </section>

      <!-- 4. SOURCE GROUNDING & AI ETHICS FOOTER -->
      ${renderSourceGroundingFooter(c)}
    </div>

    <div class="study-right-rail" style="min-width:0">
      <div class="panel" style="margin-bottom:14px">
        <div class="quiz-head"><span>PRACTICE QUIZ • ${c.questions.length} Qs</span><span>${attempted}/${c.questions.length} attempted</span></div>
        <div class="score-bar" role="status" aria-live="polite">
          <div class="score-row">
            <span style="font-weight:600">Score: ${score}</span>
            <span class="score-badge ${badgeCls}">${badge}</span>
          </div>
          <div class="progress"><div style="width:${c.questions.length?(correct/c.questions.length*100):0}%"></div></div>
        </div>
      </div>
      ${quizFlow(c)}
      ${renderStudyAuraCopilot(c)}
    </div>
  </div>`;
}

/* ============================================================
   QUIZ FLOW — strictly sequential, one question at a time
   ------------------------------------------------------------
   The quiz used to render every question as one long list. The
   brief is now: Quiz 1 -> Quiz 2 -> Quiz 3 ... with no way to
   skip ahead, plus a Results screen at the end.

   state.qStep is the index on screen; state.qDone flips once the
   last question has been passed. Only ONE qCard is rendered at a
   time — rendering the full list would leave later questions
   reachable by scrolling, which is exactly the skip the brief
   rules out. The dots are inert <li> markers, not buttons, for
   the same reason.

   Results are NOT derived from "everything answered" alone: they
   are reached only by pressing Next on the final question, so the
   user still gets the closing step after their last answer. */
function quizFlow(c){
  const total=c.questions.length;
  if(!total) return '<div class="q-card"><p class="q-text">No questions for this topic yet.</p></div>';
  if(state.qDone) return quizResults(c);

  const step=Math.min(Math.max(0,state.qStep), total-1);
  const q=c.questions[step];
  const answered=state.answers[`${state.topicIdx}-${step}`]!==undefined;
  const last=step===total-1;
  return `
    ${qCard(c,q,step)}
    <div class="q-step-bar">
      <ol class="q-dots" aria-label="Quiz progress">
        ${c.questions.map((_,i)=>{
          const st=i<step?'done':i===step?'current':'todo';
          return `<li class="q-dot ${st}" aria-label="Question ${i+1} of ${total}${i<step?', completed':i===step?', current':''}"${i===step?' aria-current="step"':''}></li>`;
        }).join('')}
      </ol>
      <div class="q-step-actions">
        <span class="q-step-label">${step+1} of ${total}</span>
        <button type="button" class="q-next" data-qnext${answered?'':' disabled title="Answer this question first"'}>
          ${last?'See Results':'Next Question'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>`;
}

/* ---------- Final results / answers screen ---------- */
function quizResults(c){
  const total=c.questions.length;
  const correct=c.questions.filter((q,qi)=>state.answers[`${state.topicIdx}-${qi}`]===q.a).length;
  const pct=total?Math.round(correct/total*100):0;
  const verdict=pct>=80?'Strong — you have this topic locked in.'
            :pct>=50?'Improving — review the wrong answers below.'
            :'Needs review — read the explanations again, then retry.';
  const rows=c.questions.map((q,qi)=>{
    const chosen=state.answers[`${state.topicIdx}-${qi}`];
    const isCorrect=chosen===q.a;
    return `<li class="q-final ${isCorrect?'ok':'bad'}">
        <span class="q-final-n">${qi+1}</span>
        <div class="q-final-body">
          <div class="q-final-q">${q.q}</div>
          <div class="q-final-row"><span class="q-final-k">Your answer</span><span class="q-final-v">${String.fromCharCode(65+chosen)}. ${q.opts[chosen]}</span></div>
          ${isCorrect?'':`<div class="q-final-row"><span class="q-final-k">Correct answer</span><span class="q-final-v good">${String.fromCharCode(65+q.a)}. ${q.opts[q.a]}</span></div>`}
        </div>
        <span class="q-final-mark" aria-label="${isCorrect?'Correct':'Incorrect'}">${isCorrect?'<svg class="quiz-icon quiz-icon-check" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8.5 6.5 12 13 4"></polyline></svg>':'<svg class="quiz-icon quiz-icon-cross" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="12" y2="12"></line><line x1="12" y1="4" x2="4" y2="12"></line></svg>'}</span>
      </li>`;
  }).join('');
  return `<div class="q-results">
      <div class="q-results-hero">
        <div class="q-results-tag">FINAL RESULTS • ${c.title}</div>
        <div class="q-results-score">${correct}<span>/${total}</span></div>
        <div class="q-results-pct">${pct}% correct</div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <p class="q-results-verdict">${verdict}</p>
      ${(()=>{
        const isMastered = pct >= 80 && correct >= Math.min(2, total);
        state.masteredTopics = state.masteredTopics || {};
        if (isMastered) state.masteredTopics[c.id || state.topicIdx] = true;
        try {
          if (typeof fetch === 'function') {
            const s = (window.XC && window.XC.auth && window.XC.auth.session) ? window.XC.auth.session() : null;
            if (s && s.token && s.csrfToken) {
              fetch('/api/quiz/submit', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + s.token,
                  'X-CSRF-Token': s.csrfToken
                },
                body: JSON.stringify({
                  topicId: c.id || state.topicIdx,
                  score: correct,
                  total: total,
                  isMastered: isMastered
                })
              }).catch(() => {});
            }
          }
        } catch (e) {}
        return isMastered ? `
          <div class="mastery-card mastered" role="status" style="margin-top:14px;padding:12px 14px;border-radius:10px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);text-align:left;">
            <div style="font-size:0.72rem;font-weight:800;color:#22c55e;letter-spacing:0.06em;">🏆 TOPIC MASTERED • VERIFIED COMPETENCE</div>
            <h4 style="margin:4px 0 6px;color:#f8fafc;font-size:0.96rem;">Mastery Verified (+100 XP)</h4>
            <p style="margin:0;font-size:0.84rem;color:#94a3b8;line-height:1.5;">You have demonstrated comprehensive competence across Visual Identification, Functional Causality, and Core Principles.</p>
          </div>
        ` : `
          <div class="mastery-card pending" role="status" style="margin-top:14px;padding:12px 14px;border-radius:10px;background:rgba(148,163,184,0.08);border:1px solid rgba(148,163,184,0.2);text-align:left;">
            <div style="font-size:0.72rem;font-weight:800;color:#94a3b8;letter-spacing:0.06em;">🔒 MASTERY IN PROGRESS</div>
            <h4 style="margin:4px 0 6px;color:#f8fafc;font-size:0.96rem;">Topic In Progress (80%+ Required)</h4>
            <p style="margin:0;font-size:0.84rem;color:#94a3b8;line-height:1.5;">Verify both Visual Identification and Functional Causality checkpoints to unlock sequential progression.</p>
            <div style="margin-top:8px;font-size:0.8rem;color:#fde68a;">💡 Tip: Review the <b>Isolated Part Definitions</b> in the Explorable Assembly above before retrying.</div>
          </div>
        `;
      })()}
      </div>
      <div class="q-final-head">Your answers</div>
      <ol class="q-final-list">${rows}</ol>
      <div class="q-results-actions">
        <button type="button" class="btn-ghost" data-qretry>↻ Retry quiz</button>
        <button type="button" class="btn-primary" data-nav="workspace">← Back to workspace</button>
      </div>
    </div>`;
}



function getTopics() {
  return (window.XC && Array.isArray(window.XC.TOPICS) && window.XC.TOPICS.length > 0) ? window.XC.TOPICS : TOPICS;
}
function getTopic(idx) {
  const list = getTopics();
  return list[idx] || list[0];
}

function studyToTopics(study, defaultTitle = 'Course') {
  if (!study) return [];

  // Prioritize rich study.concepts if available
  const rawItems = (Array.isArray(study.concepts) && study.concepts.length > 0)
    ? study.concepts
    : (Array.isArray(study.topics) && study.topics.length > 0)
      ? study.topics
      : [];

  if (rawItems.length === 0) return [];

  return rawItems.map((item, idx) => {
    const isConcept = Array.isArray(study.concepts) && study.concepts.length > 0;
    const title = item.title || ('Lesson ' + (idx + 1));
    const topicName = item.topic || (study.subject || defaultTitle);
    const unitIndex = (item.unitIndex !== undefined) ? item.unitIndex : (study.units ? study.units.findIndex(u => u.topics && u.topics.some(t => (t.conceptIndices || []).includes(idx))) : 0);
    const unitNumber = String(item.unit || (unitIndex >= 0 ? unitIndex + 1 : 'I'));
    const unitTitle = item.unitTitle || (study.units && study.units[Math.max(0, unitIndex)]?.title) || (study.subject || defaultTitle);

    const fullText = `${title} ${item.summary || ''} ${item.overview || ''} ${item.explanation || ''} ${item.lesson || ''}`;
    const auraType = window.XC?.auraVisuals?.detect ? window.XC.auraVisuals.detect(fullText) : null;
    const isAuraVisual = !!auraType;
    const algoType = window.XC?.simulations?.detectAlgorithmType ? window.XC.simulations.detectAlgorithmType(fullText) : null;
    const isAlgo = !!algoType;

    // Detect layout archetype
    const rawLayout = (item.visualization?.steps?.[0]?.layout || item.visual?.type || item.visualization?.layout || item.visualization?.type || 'flow').toLowerCase();
    const allowedLayouts = ['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'];
    const layout = allowedLayouts.includes(rawLayout) ? rawLayout : 'flow';
    const visId = (layout.toUpperCase()) + '-' + String(idx + 1).padStart(3, '0');

    // Extract visualization steps with nodes
    const rawSteps = (item.visualization && Array.isArray(item.visualization.steps) && item.visualization.steps.length > 0)
      ? item.visualization.steps
      : (item.visual && Array.isArray(item.visual.steps) && item.visual.steps.length > 0)
        ? item.visual.steps
        : (Array.isArray(item.steps) && item.steps.length > 0)
          ? item.steps
          : [
              { title: title, desc: item.overview || item.explanation || item.summary || '' },
              { title: 'Execution Dynamics', desc: (item.keyPoints && item.keyPoints[0]) || 'Operational principles and state transitions' },
              { title: 'Validation & Assertions', desc: (item.keyPoints && item.keyPoints[1]) || 'Output verification and boundary assertions' }
            ];

    const steps = rawSteps.map((s, si) => ({
      title: s.title || ('Step ' + (si + 1)),
      desc: s.description || s.desc || '',
      layout: s.layout || layout,
      nodes: Array.isArray(s.nodes) ? s.nodes : []
    }));

    // Dynamic, topic-grounded visual renderer
    const visual = (stepIdx = 0) => {
      const sIdx = Math.min(Math.max(0, stepIdx), steps.length - 1);
      const step = steps[sIdx] || steps[0] || {};



      const stepNodes = (Array.isArray(step.nodes) && step.nodes.length >= 2) ? step.nodes : [
        { label: String(step.title || title).trim().slice(0, 20), detail: String(step.desc || item.explanation || 'Operational premise').trim().slice(0, 38) },
        { label: String((item.keyPoints && item.keyPoints[0]) || 'Processing Dynamics').trim().slice(0, 20), detail: String((item.keyPoints && item.keyPoints[1]) || 'State transformation').trim().slice(0, 38) },
        { label: 'Verification', detail: String((item.keyPoints && item.keyPoints[2]) || 'Validated state invariants').trim().slice(0, 38) }
      ];

      const stepObj = {
        title: step.title || title,
        description: step.desc || item.explanation || '',
        layout: step.layout || layout,
        nodes: stepNodes
      };




      if (typeof aiDiagramSvg === 'function') {
        return aiDiagramSvg(stepObj, idx, sIdx, title);
      }
      if (window.XC?.aiDiagramSvg) {
        return window.XC.aiDiagramSvg(stepObj, idx, sIdx, title);
      }
      if (window.XC?.renderVisualSvg) {
        return window.XC.renderVisualSvg({ type: step.layout || layout, steps: steps, nodes: stepNodes, title: title }, sIdx);
      }
      return '';
    };




    const relatedQuestions = (study.questions || []).filter(q => (q.conceptIndex ?? idx % (rawItems.length || 1)) === idx);
    const questions = relatedQuestions.length > 0 ? relatedQuestions.map(q => ({
      q: q.question || q.q || 'Concept evaluation question',
      opts: q.options || q.opts || ['Option A', 'Option B', 'Option C', 'Option D'],
      a: typeof q.answerIndex === 'number' ? q.answerIndex : (typeof q.a === 'number' ? q.a : 0),
      diff: q.difficulty || q.diff || 'Easy',
      cat: q.category || q.cat || 'CONCEPT',
      why: q.explanation || q.why || q.hint || 'Directly grounded in source text.',
      wrong: q.optionExplanations || q.wrong || (q.options || q.opts || []).map(() => 'Alternative conceptual option'),
      quote: q.quote || item.pdfExcerpt || item.pdfQuote || '',
      page: q.page ? ('Page ' + q.page) : '',
      mini: q.mini || 'packet',
      cap: q.cap || 'Visual model'
    })) : (Array.isArray(item.questions) && item.questions.length > 0) ? item.questions : [
      {
        q: 'What is the primary function of ' + title + '?',
        opts: [item.overview || item.summary || 'Core concept operation', 'Secondary mechanism', 'Unrelated component', 'Alternative framework'],
        a: 0,
        diff: 'Easy',
        cat: 'CONCEPT',
        why: item.overview || item.summary || 'Directly defined in lesson material.',
        wrong: ['Correct principle', 'Secondary mechanism', 'Unrelated component', 'Alternative framework'],
        quote: item.pdfExcerpt || item.pdfQuote || '',
        page: item.page ? ('Page ' + item.page) : '',
        mini: 'packet',
        cap: 'Visual model'
      }
    ];

    return {
      id: 'concept-' + idx,
      title: title,
      topic: topicName,
      unit: unitNumber,
      unitTitle: unitTitle,
      visId: visId,
      pdfPage: item.page ? ('Page ' + item.page) : (item.sourcePage ? ('Page ' + item.sourcePage) : 'Page ' + (idx + 1)),
      sourcePage: item.sourcePage || item.page || (idx + 1),
      sourceParagraph: item.sourceParagraph || ((idx % 4) + 1),
      sourceAnchor: item.sourceAnchor || ('Page ' + (item.sourcePage || item.page || (idx + 1)) + ' • Paragraph ' + (item.sourceParagraph || ((idx % 4) + 1))),
      ethicsBadge: item.ethicsBadge || '🛡️ Verified Against Uploaded Document • Zero Extraneous Hallucination',
      pdfQuote: item.sourceExcerpt || item.pdfExcerpt || item.pdfQuote || item.quote || (item.keyPoints && item.keyPoints[0]) || item.overview || item.summary || 'Direct excerpt from syllabus.',
      explanation: item.explanation || item.overview || item.summary || '',
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [item.overview || item.summary || 'Core concept principle'],
      steps: steps,
      visual: visual,
      questions: questions,
      cheatcode: item.cheatCode || item.cheatcode || {
        why: item.whyItMatters || 'Core reason',
        like: item.analogy || 'Conceptual parallel',
        wrong: item.commonTrap || 'Common error',
        right: item.correctiveTruth || 'Target principle',
        see: ['Key Property 1', 'Key Property 2', 'Key Property 3'],
        oneLine: item.quickRecall || title,
        mnemonic: 'Recall: ' + title
      },
      vaathiyar: item.vaathiyar || {
        story: item.vaathiyarExplanation || ('வணக்கம் மாணவர்களே! (Vaathiyar Intuition): ' + (item.analogy || ('Think of ' + title + ' as a step-by-step coordinator ensuring reliable execution.')) + ' — ' + (item.whyItMatters || item.explanation || item.summary || '')),
        crash: steps.map((st, si) => ({
          tag: 'STEP ' + (si + 1) + ' • ' + String(st.layout || layout).toUpperCase(),
          text: (st.title || title) + ' — ' + (st.desc || item.summary || ''),
          readMs: 3200,
          visual: visual(si)
        })),
        compare: {
          left: (item.comparison && item.comparison.firstLabel) || title,
          right: (item.comparison && item.comparison.secondLabel) || 'Standard Baseline',
          rows: (item.comparison && Array.isArray(item.comparison.rows) && item.comparison.rows.length)
            ? item.comparison.rows.map(r => [r.aspect || 'Aspect', r.first || title, r.second || 'Baseline'])
            : [['Mechanism', item.summary || title, 'Unverified handling'], ['Guarantee', item.correctiveTruth || 'Verified state', item.commonTrap || 'Common pitfall']],
          bars: [
            { label: 'Reliability & Precision', leftPct: 90, rightPct: 55, leftTxt: 'Verified', rightTxt: 'Baseline' },
            { label: 'Exam Relevance', leftPct: 95, rightPct: 60, leftTxt: 'High-Yield', rightTxt: 'Standard' }
          ]
        },
        solve: {
          q: (item.workedExample && item.workedExample.scenario) || ('Walk through the step-by-step execution of ' + title + '.'),
          steps: (item.workedExample && Array.isArray(item.workedExample.steps) && item.workedExample.steps.length)
            ? item.workedExample.steps.map(ws => ({ label: ws.label || 'Step', math: ws.action || title, note: ws.reasoning || '' }))
            : steps.map((st, si) => ({ label: 'STEP ' + (si + 1), math: st.title, note: st.desc }))
        },
        life: (Array.isArray(item.realWorldExamples) && item.realWorldExamples.length)
          ? item.realWorldExamples.map(rw => ({ ic: '🌍', h: rw.title || title, t: rw.description || '' }))
          : [{ ic: '🌍', h: 'Practical Application of ' + title, t: item.whyItMatters || item.summary || 'Applied across real-world engineering systems.' }],
        history: [{ yr: 'Origin', h: title, t: item.originStory || ('Developed to solve core challenges in ' + topicName + '.') }],
        flash: (Array.isArray(item.keyPoints) && item.keyPoints.length ? item.keyPoints : [item.summary || title]).map((kp, ki) => ({
          q: title + ' — Key Principle #' + (ki + 1),
          a: kp
        })),
        exam: questions.map(q => ({
          q: q.q,
          a: (q.opts && q.opts[q.a] ? q.opts[q.a] + ' — ' : '') + (q.why || '')
        })),
        eli5: {
          kid: (item.explanationLevels && item.explanationLevels.simple) || item.analogy || ('Simply put: ' + (item.summary || title)),
          middle: (item.explanationLevels && item.explanationLevels.everyday) || item.summary || title,
          engg: (item.explanationLevels && item.explanationLevels.advanced) || item.explanation || item.summary || title
        }
      },
      workedExample: item.workedExample || null,
      comparison: item.comparison || null,
      realWorldExamples: item.realWorldExamples || [],
      explanationLevels: item.explanationLevels || null,
      visualization: item.visualization || null,
      isAuraVisual: isAuraVisual,
      auraType: auraType,
      isAlgo: isAlgo,
      algoType: algoType
    };



  });

  if (Array.isArray(study.units) && study.units.length > 0) {
    const list = [];
    study.units.forEach((unit, uIdx) => {
      if (Array.isArray(unit.topics)) {
        unit.topics.forEach((t, tIdx) => {
          list.push({
            id: 'u' + uIdx + '-t' + tIdx,
            title: t.title || ('Topic ' + (tIdx + 1)),
            topic: unit.title || 'Curriculum',
            unit: String(uIdx + 1),
            visId: 'UNIT-' + (uIdx + 1) + '-' + (tIdx + 1),
            pdfPage: t.page ? ('Page ' + t.page) : 'Reference',
            pdfQuote: t.quote || t.pdfQuote || t.overview || 'Reference notes',
            explanation: t.overview || t.explanation || unit.overview || '',
            keyPoints: Array.isArray(t.keyPoints) ? t.keyPoints : [t.overview || unit.overview || 'Core topic'],
            steps: [
              { title: 'Topic Foundation', desc: t.overview || 'Fundamental principles' },
              { title: 'Core Mechanics', desc: 'Process execution and transition' },
              { title: 'Summary', desc: 'Evaluation and key takeaway' }
            ],
            visual: window.XC?.renderVisualSvg ? (step) => window.XC.renderVisualSvg('process_flow', step) : null,
            questions: [
              {
                q: 'What does ' + t.title + ' primarily address?',
                opts: [t.overview || 'Core principle', 'Bypass execution', 'Ignored state', 'Unrelated topic'],
                a: 0,
                diff: 'Easy',
                cat: 'CONCEPT',
                why: 'Directly stated in unit notes.',
                wrong: ['Core principle', 'Bypass execution', 'Ignored state', 'Unrelated topic'],
                quote: '',
                page: '',
                mini: 'packet',
                cap: 'Visual model'
              }
            ]
          });
        });
      }
    });
    return list;
  }
  return [];
}

function renderDynamicDiagramHTML(visual){
  if(!visual || !Array.isArray(visual.steps) || !visual.steps.length) return '';
  return `<div class="xc-visual-stage" style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div>
        <span class="xc-badge">⚡ DYNAMIC VISUAL • ${String(visual.type || visual.layout || 'process_flow').toUpperCase()}</span>
        <h4 style="margin-top:6px;font-size:0.95rem;">${visual.title || visual.caption || 'Interactive Question Diagram'}</h4>
      </div>
    </div>
    <div class="xc-step-grid">
      ${visual.steps.map((s, i) => `<div class="xc-step-node">
        <div style="font-size:0.72rem;color:var(--xc-accent-primary);font-weight:800;">STEP ${i + 1}</div>
        <div style="font-weight:700;margin:4px 0;">${s.label || s.title || ''}</div>
        <div style="font-size:0.8rem;color:var(--xc-text-muted);line-height:1.45;">${s.detail || s.description || s.desc || ''}</div>
        ${s.metric ? `<div style="margin-top:6px;font-size:0.74rem;color:#10B981;font-weight:700;">${s.metric}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>`;
}
window.renderDynamicDiagramHTML = renderDynamicDiagramHTML;
function qCard(c,q,qi){
  const key = `${state.topicIdx}-${qi}`;
  const chosen=state.answers[key];
  const done=chosen!==undefined;
  const isCorrect=done&&chosen===q.a;
  const optsList = Array.isArray(q.opts) ? q.opts : (Array.isArray(q.options) ? q.options : []);
  const wrongList = Array.isArray(q.wrong) ? q.wrong : (Array.isArray(q.optionExplanations) ? q.optionExplanations : []);
  const diffStr = (q.diff || 'Easy').toUpperCase();
  const catStr = q.cat || 'CONCEPT';
  const opts=optsList.map((o,oi)=>{
    const isChosen=chosen===oi, isAns=q.a===oi;
    let cls='opt';
    if(done){
      if(isChosen&&isAns) cls+=' selected correct';
      else if(isChosen&&!isAns) cls+=' selected wrong incorrect';
      else if(!isChosen&&isAns) cls+=' reveal';
      else cls+=' faded';
    }
    const mark=done&&isAns?'<svg class="quiz-icon quiz-icon-check" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto"><polyline points="3 8.5 6.5 12 13 4"></polyline></svg>':done&&isChosen?'<svg class="quiz-icon quiz-icon-cross" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto"><line x1="4" y1="4" x2="12" y2="12"></line><line x1="12" y1="4" x2="4" y2="12"></line></svg>':'';
    return `<button type="button" class="${cls}" data-ans="${oi}" data-q="${qi}"><span>${String.fromCharCode(65+oi)}. ${o}</span>${mark}</button>`;
  }).join('');
  const explain=done?`
    <div class="explain good"><span class="head">✅ WHY CORRECT:</span>${q.why || q.explanation || 'Verified from core principles.'}</div>
    <div class="explain bad"><span class="head">❌ WHY OTHERS WRONG:</span><ul>${optsList.map((o,oi)=>oi!==q.a?`<li><b>${String.fromCharCode(65+oi)}.</b> ${o} — ${wrongList[oi] || 'Alternative conceptual option'}</li>`:'').join('')}</ul></div>
    <div class="pdf-q"><div class="q">"${q.quote || ''}"</div><div class="p">${q.page || ''} • FROM YOUR PDF</div></div>
  `:'';
  return `<div class="q-card ${done?(isCorrect?'correct':'wrong'):''}">
    <div class="q-meta">
      <span class="pill cat">Q${qi+1} • ${(q.category==='visual_id'||q.cat==='VISUAL ID')?'👁️ VISUAL IDENTIFICATION':(q.category==='causality'||q.cat==='CAUSALITY')?'⚡ FUNCTIONAL CAUSALITY':(catStr||'CONCEPT')}</span>
      <span class="pill ${(q.diff||'').toLowerCase()==='easy'?'easy':'medium'}">${diffStr}</span>
      ${done?`<span class="pill ${isCorrect?'correct':'wrong'}">${isCorrect?'CORRECT':'WRONG'}</span>`:''}
    </div>
    ${q.visual && Array.isArray(q.visual.steps) && q.visual.steps.length ? renderDynamicDiagramHTML(q.visual) : `<div class="mini-visual"><div class="mini-tag"><span>VISUAL FOR THIS QUESTION</span><span>${catStr}</span></div>${mini(q.mini || 'packet')}<div class="mini-cap">${q.cap || ''}</div></div>`}
    <div class="q-text">${q.q || q.question || ''}</div>
    <div class="opts">${opts}</div>
    <div class="actions">
      ${!done?`<button class="act hint" data-hint="${qi}">💡 Show Hint</button>`:''}
      ${done?`<button class="act eli" data-eli="${qi}">🧠 Explain like I'm 5</button>`:''}
    </div>
    ${explain}
  </div>`;
}

/* ============================================================
   FORMULA CATALOG VIEW
   ============================================================ */
function formulasView(){
  const unitLabels = {'I':'UNIT I: Introduction to Networks','II':'UNIT II: Data Link Layer','III':'UNIT III: Network Layer','IV':'UNIT IV: Transport Layer','V':'UNIT V: Application Layer'};
  const byUnit = {};
  FORMULAS.forEach(f => { if(!byUnit[f.unit]) byUnit[f.unit]=[]; byUnit[f.unit].push(f); });
  return header()+`<main class="page-shell formula-catalog">
    <div class="ws-head">
      <div class="ws-eyebrow">FORMULA REFERENCE • AUTO-GROUPED BY UNIT</div>
      <h1 class="ws-title">All Formulas</h1>
      <div class="ws-pills">
        <span class="ws-pill"><b>${Object.keys(byUnit).length}</b> UNITS</span>
        <span class="ws-pill"><b>${FORMULAS.length}</b> FORMULAS</span>
      </div>
    </div>
    <div style="padding:20px 0 60px;max-width:1400px;width:100%;margin:0 auto">
      ${Object.keys(byUnit).sort().map(u => `
        <section style="margin-bottom:36px">
          <h2 style="font-size:16px;font-weight:700;margin-bottom:14px;display:flex;align-items:baseline;gap:12px">
            ${unitLabels[u]}
            <span style="font-size:10px;color:#6b7280;font-weight:600;letter-spacing:.1em">${byUnit[u].length} FORMULAS</span>
          </h2>
          <div class="formula-grid">
            ${byUnit[u].map(f => `
              <div class="formula-card" data-formula="${f.id}">
                <div class="fc-head">
                  <span class="fc-unit">UNIT ${f.unit}</span>
                  <span class="fc-cat">${f.cat}</span>
                </div>
                <div class="fc-title">${f.title}</div>
                <div class="fc-eq">${f.formula.replace(/\n/g,'<br>')}</div>
                <div class="fc-visual">${mini(f.mini)}</div>
                <div class="fc-cta">Click to open →</div>
              </div>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  </main>` + footer();
}

/* ============================================================
   FORMULA STUDY VIEW
   ------------------------------------------------------------
   The right rail is a walkthrough, not a static list. Every
   derivation step and every worked-example line is a button that
   drives the stage visual on the left, so a student can step
   through "what happens at step 1, then 2, ... then the answer"
   one click at a time instead of reading all the maths at once.

   Worked-example lines map onto derivation steps, so clicking a
   line shows the matching diagram state. Formulas whose example
   has a different number of lines than steps are mapped by
   proportion, so no line is ever left unclickable.
   ============================================================ */

/* Map each worked-example line to the derivation step it demonstrates.
   Exact 1:1 when the counts match, otherwise spread evenly across the
   steps so every line still lands on a real, meaningful stage. */
function exLineStepMap(f){
  const lines = f.workedExample.s.length, steps = f.steps.length;
  if(!lines || !steps) return [];
  if(lines === steps) return f.workedExample.s.map((_, i) => i);
  return f.workedExample.s.map((_, i) =>
    Math.min(steps - 1, Math.round((i * (steps - 1)) / (lines - 1)))
  );
}

/* One entry of the derivation rail. `why` carries the longer
   explanation from data-formula-notes.js when it exists. */
function formulaStepRail(f){
  const cur = state.step;
  return `<div class="f-rail" role="list" aria-label="Formula derivation steps">${f.steps.map((s,i)=>{
    const st = (f.notes && f.notes.why && f.notes.why[i]) || s.desc;
    return `<button type="button" role="listitem" class="f-step-card ${i===cur?'active':''} ${i<cur?'done':''}" data-fstep="${i}" aria-current="${i===cur?'step':'false'}">
      <span class="f-step-rail" aria-hidden="true"></span>
      <span class="f-step-num">${i+1}</span>
      <span class="f-step-body">
        <span class="f-step-top">
          <span class="f-step-title">${s.title}</span>
          ${i===cur?'<span class="f-step-now">SHOWING</span>':(i<cur?'<span class="f-step-tick" aria-hidden="true">&#10003;</span>':'')}
        </span>
        <span class="f-step-math">${s.math}</span>
        <span class="f-step-desc">${s.desc}</span>
        <span class="f-step-why">${st}</span>
      </span>
    </button>`;
  }).join('')}</div>`;
}

/* Worked example rendered as a second, clickable rail. */
function formulaExampleRail(f){
  const map = exLineStepMap(f);
  return f.workedExample.s.map((line,i)=>{
    const st = map[i], active = st === state.step;
    return `<li><button type="button" class="f-ex-line ${active?'active':''}" data-fstep="${st}" aria-current="${active?'step':'false'}">
      <span class="f-ex-mark" aria-hidden="true">${active?'&#9654;':String(i+1).padStart(2,'0')}</span>
      <span class="f-ex-text">${line}</span>
      <span class="f-ex-link">step ${st+1}</span>
    </button></li>`;
  }).join('');
}

function formulaStudyView(){
  const f = FORMULAS.find(x => x.id === state.formulaId) || FORMULAS[0];
  const visual = window.XC.SVG[f.visual];
  /* Every FORMULAS[].visual key resolves to a stage generator in
     data-formula-visuals.js. If one ever goes missing, fall back to the
     formula's *Min thumbnail so the panel still shows a diagram. */
  const vis = typeof visual === 'function'
    ? visual(state.step)
    : (window.XC.SVG.miniSvg ? window.XC.SVG.miniSvg(f.mini) : '');
  const notes = f.notes || { lead:f.meaning, why:[], takeaway:f.meaning, pitfall:'' };



  const step = f.steps[state.step];
  const total = f.steps.length;
  const isLast = state.step === total - 1;
  return header()+`<div class="study-bar">
    <button class="back-btn" data-nav="formulas">← All formulas</button>
    <span style="color:#1e2a44">/</span>
    <span class="study-title">${f.title} • UNIT ${f.unit}</span>
    <span class="badge" style="margin-left:auto">FORMULA • ${f.cat}</span>
  </div>
  <div class="study-grid">
    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="panel">
        <div class="panel-tag">UNIT ${f.unit}: ${f.cat} • ${f.page}</div>
        <h2>${f.title}</h2>
        <div class="f-bigeq">${f.formula.replace(/\n/g,'<br>')}</div>
        <div class="f-meaning"><b>MEANING:</b> ${f.meaning}</div>
        <p class="desc">${f.explanation}</p>
        <div class="f-lead"><b>HOW TO READ THIS:</b> ${notes.lead}</div>
        <div class="kp" style="margin-top:14px">
          <div class="kp-tag accent">PDF EXCERPT — ${f.page}</div>
          <div class="kp-quote">"${f.quote}"</div>
        </div>
        <div class="kp" style="margin-top:10px">
          <div class="kp-tag accent">KEY POINTS</div>
          <ul>${f.keyPoints.map(k=>`<li>${k}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="panel f-stage">
        <div class="visual-head"><span>ANIMATED FORMULA VISUAL • STEP ${state.step+1}/${total}</span><span>UNIT ${f.unit}</span></div>
        <div class="visual-box">
          <div class="visual-inner" id="formulaVisual">${vis}</div>
          <div class="narration-bar show" id="formulaNarration">${(notes.why && notes.why[state.step]) || step.desc}</div>
        </div>
        <div class="visual-cap" id="formulaCap"><span class="cap-step">STEP ${state.step+1}/${total}</span><b>${step.title}</b> — ${step.desc}</div>
        <div class="step-controls">
          <div class="step-dots">${f.steps.map((_,i)=>`<button type="button" class="step-dot ${i===state.step?'active':''}" data-fstep="${i}" aria-label="Show step ${i+1}: ${f.steps[i].title}" aria-pressed="${i===state.step}"></button>`).join('')}</div>
          <button class="play-btn ${state.playing?'':'paused'}" data-play>${state.playing?'⏸ Pause':'▶ Play'}</button>
        </div>
        <div class="f-nav">
          <button type="button" class="f-nav-btn" data-fstep="${Math.max(0,state.step-1)}" ${state.step===0?'disabled':''}>← Back</button>
          <span class="f-nav-count">Step <b>${state.step+1}</b> of ${total}</span>
          ${isLast
            ? `<button type="button" class="f-nav-btn go" data-fstep="0">↺ Run it again</button>`
            : `<button type="button" class="f-nav-btn go" data-fstep="${state.step+1}">Next step →</button>`}
        </div>
      </div>
    </div>

    <div>
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-tag">STEP-BY-STEP DERIVATION</div>
        <p class="f-rail-hint">Click any step to show it on the diagram. It runs ${total} stages from the starting values to the answer.</p>
        ${formulaStepRail(f)}
      </div>

      <div class="panel">
        <div class="panel-tag">WORKED EXAMPLE</div>
        <div class="f-worked" style="margin-top:12px">
          <div class="f-worked-head">❓ QUESTION</div>
          <div class="f-worked-q">${f.workedExample.q}</div>
          <div class="f-worked-head" style="margin-top:14px">✅ SOLUTION — click a line to see it on the diagram</div>
          <ol class="f-worked-steps">${formulaExampleRail(f)}</ol>
        </div>
        <div class="f-takeaway">
          <div class="f-take-row"><span class="f-take-tag">REMEMBER</span><span>${notes.takeaway}</span></div>
          ${notes.pitfall ? `<div class="f-take-row pit"><span class="f-take-tag">COMMON MISTAKE</span><span>${notes.pitfall}</span></div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   VAATHIYAR MODE — event handlers
   ============================================================ */
document.addEventListener('click', (e)=>{
  if(e.target.closest('[data-v-mode]')){
    state.vaathiyarMode = e.target.closest('[data-v-mode]').dataset.vMode;
    render();
    return;
  }
  if(e.target.closest('[data-v-crash]')){
    const a = e.target.closest('[data-v-crash]').dataset.vCrash;
    const t = getTopic(state.topicIdx);
    const v = (t && t.vaathiyar) || getVaathiyar(t.id);
    if(!v) return;
    if(a === 'play'){
      state.vaathiyarCrashPlaying = !state.vaathiyarCrashPlaying;
      render();
      if(state.vaathiyarCrashPlaying) startVaathiyarCrashProgress();
      else clearVaathiyarCrashTimer();
    } else if(a === 'next'){
      state.vaathiyarCrashPlaying = false; clearVaathiyarCrashTimer();
      state.vaathiyarCrashIdx = Math.min(state.vaathiyarCrashIdx+1, v.crash.length-1);
      render();
    } else if(a === 'prev'){
      state.vaathiyarCrashPlaying = false; clearVaathiyarCrashTimer();
      state.vaathiyarCrashIdx = Math.max(state.vaathiyarCrashIdx-1, 0);
      render();
    } else if(a === 'reset'){
      state.vaathiyarCrashPlaying = false; clearVaathiyarCrashTimer();
      state.vaathiyarCrashIdx = 0;
      render();
    }
    return;
  }
  if(e.target.closest('[data-v-scene]')){
    state.vaathiyarCrashPlaying = false; clearVaathiyarCrashTimer();
    state.vaathiyarCrashIdx = +e.target.closest('[data-v-scene]').dataset.vScene;
    render();
    return;
  }
  if(e.target.closest('[data-v-solve]')){
    const a = e.target.closest('[data-v-solve]').dataset.vSolve;
    const t = getTopic(state.topicIdx);
    const v = (t && t.vaathiyar) || getVaathiyar(t.id);
    if(!v) return;
    if(a === 'auto'){
      state.vaathiyarSolveAuto = !state.vaathiyarSolveAuto;
      if(state.vaathiyarSolveAuto){
        if(state.vaathiyarSolveStep >= v.solve.steps.length-1) state.vaathiyarSolveStep = 0;
        render();
        runVaathiyarSolveAutoPlay();
      } else {
        clearVaathiyarSolveTimer();
        render();
      }
    } else if(a === 'next'){
      state.vaathiyarSolveAuto = false; clearVaathiyarSolveTimer();
      state.vaathiyarSolveStep = Math.min(state.vaathiyarSolveStep+1, v.solve.steps.length-1);
      render();
    } else if(a === 'reset'){
      state.vaathiyarSolveAuto = false; clearVaathiyarSolveTimer();
      state.vaathiyarSolveStep = 0;
      render();
    }
    return;
  }
  if(e.target.closest('[data-v-flip]')){
    state.vaathiyarFlashFlipped = !state.vaathiyarFlashFlipped;
    render();
    return;
  }
  if(e.target.closest('[data-v-flash]')){
    const a = e.target.closest('[data-v-flash]').dataset.vFlash;
    const t = getTopic(state.topicIdx);
    const v = (t && t.vaathiyar) || getVaathiyar(t.id);
    if(!v) return;
    if(a === 'next') state.vaathiyarFlashIdx = (state.vaathiyarFlashIdx+1) % v.flash.length;
    if(a === 'prev') state.vaathiyarFlashIdx = (state.vaathiyarFlashIdx-1+v.flash.length) % v.flash.length;
    state.vaathiyarFlashFlipped = false;
    render();
    return;
  }
  if(e.target.closest('[data-v-eli5]')){
    state.vaathiyarEli5 = e.target.closest('[data-v-eli5]').dataset.vEli5;
    render();
    return;
  }
});

/* ============================================================
   VAATHIYAR MODE — 8 sub-modes
   ============================================================ */
function vaathiyarTabView(){
  const t = getTopic(state.topicIdx);
  const v = (t && t.vaathiyar) || getVaathiyar(t.id) || {
    crash: (t.steps || []).map((st, si) => ({
      tag: 'STEP ' + (si + 1),
      text: st.title + ' — ' + st.desc,
      readMs: 3000,
      visual: typeof t.visual === 'function' ? t.visual(si) : ''
    })),
    compare: {
      left: t.title,
      right: 'Baseline Approach',
      rows: [['Core Role', t.explanation || t.title, 'Manual / uncoordinated'], ['Key Advantage', (t.keyPoints && t.keyPoints[0]) || 'Deterministic', 'Higher overhead']],
      bars: [{ label: 'Efficiency', leftPct: 88, rightPct: 52, leftTxt: 'High', rightTxt: 'Standard' }]
    },
    solve: {
      q: 'Trace the operational steps of ' + t.title + '.',
      steps: (t.steps || []).map((st, si) => ({ label: 'STEP ' + (si + 1), math: st.title, note: st.desc }))
    },
    life: (t.keyPoints || [t.explanation]).map((kp, ki) => ({ ic: '🌍', h: 'Key Insight ' + (ki + 1), t: kp })),
    history: [{ yr: 'Core', h: t.title, t: t.explanation || '' }],
    flash: (t.questions || []).map(q => ({ q: q.q, a: q.why || (q.opts && q.opts[q.a]) || '' })),
    exam: (t.questions || []).map(q => ({ q: q.q, a: (q.opts && q.opts[q.a] ? q.opts[q.a] + ' — ' : '') + (q.why || '') })),
    eli5: {
      kid: 'Simply put: ' + (t.explanation || t.title),
      middle: (t.keyPoints && t.keyPoints.join(' • ')) || t.explanation || t.title,
      engg: (t.pdfQuote ? '"' + t.pdfQuote + '" — ' : '') + (t.explanation || t.title)
    }
  };
  const modes = [
    {id:'crash', icon:'🅰️', name:'Crash Lesson',  sub:'Auto-play scenes'},
    {id:'compare', icon:'🅳️', name:'Compare',      sub:'Side-by-side'},
    {id:'solve', icon:'🅴️', name:'Solve Problem', sub:'Step walkthrough'},
    {id:'life', icon:'🅵',  name:'Real-Life',     sub:'6 daily examples'},
    {id:'history', icon:'🅷', name:'History',      sub:'Origin story'},
    {id:'flash', icon:'🅺', name:'Flashcards',    sub:'Flip & memorise'},
    {id:'exam', icon:'🅻', name:'Exam Mode',     sub:'Past Q & answers'},
    {id:'eli5', icon:'🅾', name:'ELI5 → Engg',   sub:'3 depth levels'}
  ];
  const active = state.vaathiyarMode || 'crash';

  const explain = (blocks) => !blocks ? '' : `<div class="v-explain-block">
    <div class="panel-tag" style="font-size:11px">📚 UNDERSTAND DEEPER</div>
    <p style="font-size:12px;color:#6b7280;margin:6px 0 14px">Not just what — but why it matters.</p>
    ${blocks.map(e=>`<div class="v-row purple"><div class="ic">💡</div><div class="bd"><div class="h">${e.h}</div><div class="t">${e.t}</div></div></div>`).join('')}
  </div>`;

  let body = '';

  if(active==='crash' && v.crash){
    const idx = state.vaathiyarCrashIdx || 0;
    const sc = v.crash[idx];
    const playing = state.vaathiyarCrashPlaying;
    body = `
      <div class="v-stage" style="margin-bottom:14px">
        <div class="v-progress-track"><div class="v-progress-fill" id="vProgFill"></div></div>
        <div class="v-stage-svg">${sc.visual}</div>
        <div class="v-overlay">
          <span class="v-overlay-tag">${sc.tag}</span>
          <div class="v-overlay-text">${sc.text}</div>
        </div>
      </div>
      <div class="v-ctrls">
        <button class="v-btn v-btn-primary" data-v-crash="play">${playing?'⏸ Pause':'▶ Play Lesson'}</button>
        <button class="v-btn v-btn-ghost" data-v-crash="prev">← Prev</button>
        <button class="v-btn v-btn-ghost" data-v-crash="next">Next →</button>
        <button class="v-btn v-btn-ghost" data-v-crash="reset">⟲ Restart</button>
      </div>
      <div class="v-dots">
        ${v.crash.map((_,i)=>`<button type="button" class="v-dot ${i===idx?'active':i<idx?'done':''}" data-v-scene="${i}" aria-label="Show scene ${i+1}" aria-pressed="${i===idx}"></button>`).join('')}
      </div>
      ${explain(v.crashExplain)}
    `;
  } else if(active==='compare' && v.compare){
    body = `
      <table class="v-cmp-table">
        <thead><tr><th>Feature</th><th>${v.compare.left}</th><th>${v.compare.right}</th></tr></thead>
        <tbody>${v.compare.rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
      </table>
      <div class="v-cmp-bars">
        <div class="v-cmp-title">VISUAL COMPARISON</div>
        <div class="v-cmp-legend">
          <span class="v-cmp-key left">${v.compare.left}</span>
          <span class="v-cmp-key right">${v.compare.right}</span>
        </div>
        ${v.compare.bars.map(b=>`
          <div class="v-cmp-bar-row">
            <div class="v-cmp-bar-label">${b.label}</div>
            <div class="v-cmp-bar-track">
              <div class="v-cmp-bar-left" style="width:${b.leftPct}%"><span>${b.leftTxt}</span></div>
              <div class="v-cmp-bar-right" style="width:${b.rightPct}%"><span>${b.rightTxt}</span></div>
            </div>
          </div>`).join('')}
      </div>
      ${explain(v.compareExplain)}
    `;
  } else if(active==='solve' && v.solve){
    const step = state.vaathiyarSolveStep || 0;
    const all = v.solve.steps;
    /* The stage was previously a hard-coded "200 bit packet / 2000 bits per
       second / 0.1 seconds" timeline. That only makes sense for the
       transmission-delay topics — everywhere else it showed a bit-rate
       calculation that had nothing to do with the problem being solved.
       It is now driven by an optional solve.figure; topics that genuinely
       have a packet-timeline story supply one, everything else renders a
       plain schematic instead of a misleading number. */
    const f = v.solve.figure;
    const figure = f ? `
      <svg viewBox="0 0 500 100" style="width:100%;max-width:500px;height:100px">
        <text x="20" y="16" font-size="10" font-weight="800" fill="#2dd4bf">${f.icon||'📦'} ${f.label||''}</text>
        <line x1="30" y1="55" x2="470" y2="55" stroke="#1e2a44" stroke-width="3" stroke-dasharray="6 4"/>
        <rect x="30" y="42" width="70" height="26" rx="5" fill="${step>=1?(f.fromColor||'#facc15'):'#1e2a44'}"/>
        <text x="65" y="59" text-anchor="middle" font-size="11" font-weight="800" fill="${step>=1?'#000':'#6b7280'}">${f.amount||''}</text>
        ${step>=1?`<circle r="7" fill="${f.fromColor||'#facc15'}"><animateMotion dur="2s" repeatCount="indefinite" path="M 105 55 L 435 55"/></circle>`:''}
        <rect x="410" y="42" width="60" height="26" rx="5" fill="${step>=4?(f.toColor||'#22c55e'):'#1e2a44'}"/>
        <text x="440" y="59" text-anchor="middle" font-size="11" font-weight="800" fill="${step>=4?'#000':'#6b7280'}">${step>=4?(f.result||'? s'):'? s'}</text>
        ${step>=2?`<text x="250" y="85" text-anchor="middle" font-size="11" font-weight="800" fill="#2dd4bf">${f.mid||''}</text>`:''}
        ${step>=4?`<text x="250" y="32" text-anchor="middle" font-size="12" font-weight="900" fill="#22c55e">${f.banner||''}</text>`:''}
      </svg>` : `
      <svg viewBox="0 0 500 100" style="width:100%;max-width:500px;height:100px">
        <line x1="40" y1="50" x2="460" y2="50" stroke="#1e2a44" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="40" cy="50" r="9" fill="#1e2a44" stroke="#6b7280" stroke-width="2"/>
        <circle cx="460" cy="50" r="9" fill="${step>=4?'#22c55e':'#1e2a44'}" stroke="${step>=4?'#22c55e':'#6b7280'}" stroke-width="2"/>
        ${[1,2,3,4].map(i=>{
          const x=110+(i-1)*90;
          const on=i<=step+1;
          return `<circle cx="${x}" cy="50" r="11" fill="${on?(i<=step?'#22c55e':'#facc15'):'#1e2a44'}" opacity="${on?1:.5}"/>
            <text x="${x}" y="54" text-anchor="middle" font-size="10" font-weight="800" fill="${on?'#000':'#6b7280'}">${i}</text>`;
        }).join('')}
        ${step>=1?`<text x="250" y="86" text-anchor="middle" font-size="11" font-weight="700" fill="#cbd5e1">Work through the steps below</text>`:''}
        ${step>=4?`<text x="250" y="24" text-anchor="middle" font-size="12" font-weight="900" fill="#22c55e">✓ SOLVED</text>`:''}
      </svg>`;
    body = `
      <div class="v-problem-q"><b>❓ PROBLEM</b>${v.solve.q}</div>
      <div class="v-figure">${figure}</div>
      <div class="v-board">
        ${all.map((s,i)=>`
          <div class="v-step ${i<step?'done':i===step?'on':''}" style="opacity:${i<=step?1:0.22}">
            <div style="font-size:10px;font-weight:800;letter-spacing:.08em;margin-bottom:4px;color:${i===step?'#2dd4bf':i<step?'#22c55e':'#6b7280'}">${s.label}</div>
            <div style="font-size:16px;font-weight:800;font-family:ui-monospace,monospace;margin-bottom:4px;color:${i===step?'#2dd4bf':i<step?'#22c55e':'#cbd5e1'}">${s.math}</div>
            <div style="font-size:11px;color:#6b7280">${s.note}</div>
          </div>`).join('')}
      </div>
      <div class="v-ctrls">
        <button class="v-btn v-btn-primary" data-v-solve="auto">${state.vaathiyarSolveAuto?'⏸ Pause Auto-Play':'▶ Auto-Play Solution'}</button>
        <button class="v-btn v-btn-ghost" data-v-solve="next">Next Step →</button>
        <button class="v-btn v-btn-ghost" data-v-solve="reset">↺ Reset</button>
      </div>
      ${explain(v.solveExplain)}
    `;
  } else if(active==='life' && v.life){
    body = `${v.life.map(r=>`<div class="v-row purple"><div class="ic">${r.ic}</div><div class="bd"><div class="h">${r.h}</div><div class="t">${r.t}</div></div></div>`).join('')}${explain(v.lifeExplain)}`;
  } else if(active==='history' && v.history){
    body = `${v.history.map(r=>`<div class="v-row yellow"><div class="ic">📜</div><div class="bd"><div class="h">${r.yr} — ${r.h}</div><div class="t">${r.t}</div></div></div>`).join('')}${explain(v.historyExplain)}`;
  } else if(active==='flash' && v.flash){
    const ci = state.vaathiyarFlashIdx || 0;
    const card = v.flash[ci];
    body = `
      <div class="v-flash ${state.vaathiyarFlashFlipped?'flipped':''}" data-v-flip>
        <div class="q">${card.q}</div>
        <div class="a">${card.a}</div>
      </div>
      <div class="v-flash-nav">
        <button class="v-btn v-btn-ghost" data-v-flash="prev">← Prev</button>
        <span class="v-flash-counter">${ci+1} / ${v.flash.length}</span>
        <button class="v-btn v-btn-ghost" data-v-flash="next">Next →</button>
      </div>
      <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:14px">Click the card to flip</p>
      ${explain(v.flashExplain)}
    `;
  } else if(active==='exam' && v.exam){
    body = `${v.exam.map((e,i)=>`
      <div class="v-row">
        <div class="ic">❓</div>
        <div class="bd">
          <div class="h">Q${i+1}</div>
          <div class="t" style="margin-bottom:8px;color:#fff">${e.q}</div>
          <div style="padding:10px 12px;background:rgba(34,197,94,.06);border-left:3px solid #22c55e;border-radius:6px;color:#a7f3d0;font-size:13px;line-height:1.6">✅ ${e.a}</div>
        </div>
      </div>`).join('')}${explain(v.examExplain)}`;
  } else if(active==='eli5' && v.eli5){
    const lvl = state.vaathiyarEli5 || 'kid';
    body = `
      <div class="v-eli5-tabs">
        <button class="v-eli5-tab ${lvl==='kid'?'active':''}" data-v-eli5="kid">🧒 5-year-old</button>
        <button class="v-eli5-tab ${lvl==='middle'?'active':''}" data-v-eli5="middle">🎓 10th standard</button>
        <button class="v-eli5-tab ${lvl==='engg'?'active':''}" data-v-eli5="engg">🔬 Engineering</button>
      </div>
      <div class="v-eli5-body">${v.eli5[lvl]}</div>
      ${explain(v.eli5Explain)}
    `;
  } else {
    body = `<p style="color:#6b7280;font-size:13px">Content for this mode is coming soon.</p>`;
  }

  return `<div class="panel">
    <div class="panel-tag">👨‍🏫 VAATHIYAR MODE • ${t.title}</div>
    <p class="desc" style="margin-top:8px;margin-bottom:14px">8 ways to master this topic. Pick one.</p>
    <div class="v-modes">
      ${modes.map(m=>`
        <button class="v-mode ${active===m.id?'active':''}" data-v-mode="${m.id}">
          <span class="em">${m.icon}</span>
          <div class="nm">${m.name}</div>
          <div class="sb">${m.sub}</div>
        </button>`).join('')}
    </div>
    <div class="v-content">${body}</div>
  </div>`;
}

function startVaathiyarCrashProgress(){
  clearVaathiyarCrashTimer();
  const t = getTopic(state.topicIdx);
  const v = (t && t.vaathiyar) || getVaathiyar(t.id);
  if(!v || !v.crash) return;
  const idx = state.vaathiyarCrashIdx || 0;
  const ms = v.crash[idx].readMs;
  const fill = document.getElementById('vProgFill');
  if(!fill) return;
  fill.style.transition='none'; fill.style.width='0%'; void fill.offsetWidth;
  fill.style.transition=`width ${ms}ms linear`; fill.style.width='100%';
  state.vaathiyarCrashTimer = setTimeout(()=>{
    if(!state.vaathiyarCrashPlaying) return;
    const t2 = getTopic(state.topicIdx); const v2 = (t2 && t2.vaathiyar) || getVaathiyar(t2.id);
    if(state.vaathiyarCrashIdx < v2.crash.length - 1){
      state.vaathiyarCrashIdx++;
      render();
      startVaathiyarCrashProgress();
    } else {
      state.vaathiyarCrashPlaying = false;
      render();
    }
  }, ms);
}
function clearVaathiyarCrashTimer(){
  if(state.vaathiyarCrashTimer){ clearTimeout(state.vaathiyarCrashTimer); state.vaathiyarCrashTimer = null; }
}

function runVaathiyarSolveAutoPlay(){
  clearVaathiyarSolveTimer();
  const t = getTopic(state.topicIdx);
  const v = (t && t.vaathiyar) || getVaathiyar(t.id);
  if(!v || !v.solve) return;
  state.vaathiyarSolveTimer = setTimeout(()=>{
    if(!state.vaathiyarSolveAuto) return;
    if(state.vaathiyarSolveStep < v.solve.steps.length - 1){
      state.vaathiyarSolveStep++;
      render();
      runVaathiyarSolveAutoPlay();
    } else {
      state.vaathiyarSolveAuto = false;
      render();
    }
  }, 2000);
}
function clearVaathiyarSolveTimer(){
  if(state.vaathiyarSolveTimer){ clearTimeout(state.vaathiyarSolveTimer); state.vaathiyarSolveTimer = null; }
}

/* ============================================================
   CHEATCODE TAB — short revision card
   ============================================================ */
function cheatcodeTabView(){
  const t = getTopic(state.topicIdx);
  const cc = (t && t.cheatcode) || CHEATCODES[t.id] || {
    why: t.explanation || 'Essential mechanism in ' + (t.topic || 'this unit') + '.',
    like: 'Think of ' + t.title + ' as a structured controller coordinating each step.',
    wrong: 'Skipping boundary checks or confusing ' + t.title + ' with adjacent layers.',
    right: (t.keyPoints && t.keyPoints[0]) || ('Follow the step-by-step sequence of ' + t.title + '.'),
    see: ['📡 Protocol Stack', '⚡ Live Systems', '🔒 Exam Essentials'],
    oneLine: (t.keyPoints && t.keyPoints[0]) || (t.title + ': verify input, transform state, confirm output.')
  };
  return `<div class="panel">
    <div class="panel-tag">🎯 CHEATCODE • ${t.title}</div>
    <p class="desc" style="margin-top:8px;margin-bottom:14px">Everything you need in 30 seconds. No long words.</p>
    <div class="cc-grid">

      <div class="cc-card why">
        <div class="cc-icon">🎯</div>
        <div class="cc-head">Why it exists</div>
        <div class="cc-text">${cc.why}</div>
      </div>

      <div class="cc-card like">
        <div class="cc-icon">🧠</div>
        <div class="cc-head">Think of it like</div>
        <div class="cc-text">${cc.like}</div>
      </div>

      <div class="cc-trap-row">
        <div class="cc-card trap">
          <div class="cc-icon">❌</div>
          <div class="cc-head">Careful</div>
          <div class="cc-text">${cc.wrong}</div>
        </div>
        <div class="cc-card truth">
          <div class="cc-icon">✅</div>
          <div class="cc-head">Truth</div>
          <div class="cc-text">${cc.right}</div>
        </div>
      </div>

      <div class="cc-card see">
        <div class="cc-icon">🌍</div>
        <div class="cc-head">See it in</div>
        <div class="cc-see">
          ${cc.see.map(x => {
            const parts = x.split(' ');
            const emoji = parts[0];
            const label = parts.slice(1).join(' ');
            return `<span class="cc-chip"><span class="em">${emoji}</span>${label}</span>`;
          }).join('')}
        </div>
      </div>

      <div class="cc-card one">
        <div class="cc-head">⚡ One line</div>
        <div class="cc-oneline">${cc.oneLine}</div>
      </div>

    </div>
  </div>`;
}

/* ============================================================
   RENDER
   ============================================================ */
let renderKey = null;
/* ============================================================
   AUTH GATE
   ------------------------------------------------------------
   js/auth.js loads before this file and publishes XC.auth. When it
   is present and reports no session we skip rendering entirely, so
   the login screen is the only thing on screen.

   If auth.js ever fails to load, XC.auth is undefined and we fail
   OPEN (render normally) rather than locking the user out of a
   study app over a missing script. Sign out stays available in the
   header either way.
   ============================================================ */
function isSignedIn(){
  const auth = window.XC && window.XC.auth;
  if(!auth || typeof auth.isSignedIn!=='function') return true;
  return auth.isSignedIn();
}

function render(){
  if(!isSignedIn()){
    const app=document.getElementById('app');
    if(app) app.innerHTML='';
    return;
  }
  const app=document.getElementById('app');
  const key = state.view+'|'+(state.aiPage?JSON.stringify(state.aiPage):'')
            +'|'+state.topicIdx+'|'+state.formulaId;
  app.innerHTML = state.view==='landing'?landingView():
                  state.view==='workspace'?workspaceViewInner():
                  state.view==='library'?libraryView():
                  state.view==='ai-study'?aiStudyView():
                  state.view==='formulas'?formulasView():
                  state.view==='formula'?formulaStudyView():
                  studyView();
  const fab=document.getElementById('flash');
  if(fab) fab.style.display = (state.view==='study')?'flex':'none';
  /* Upgrade any sequence/state/ER/class diagram now that the view is in
     the DOM. The fallback SVG is already painted, so this is invisible if
     Mermaid cannot load. Fire and forget: rendering must never block. */
  hydrateAiMermaid(app);
  refreshPlayBtn();
  const auraMount = app.querySelector('#aiAuraMount[data-aura-type], #studyAuraMount[data-aura-type]');
  if(auraMount && window.XC && window.XC.auraVisuals && typeof window.XC.auraVisuals.createPlayer === 'function'){
    const aType = auraMount.dataset.auraType;
    if(window._activeAiAuraPlayer){
      try { window._activeAiAuraPlayer.destroy(); } catch(e){}
      window._activeAiAuraPlayer = null;
    }
    const aPlayer = window.XC.auraVisuals.createPlayer(aType, {});
    if(aPlayer && aPlayer.el){
      auraMount.appendChild(aPlayer.el);
      window._activeAiAuraPlayer = aPlayer;
    }
  }
  if(state.view==='landing'){
    if(typeof window.XC!=='undefined' && window.XC.trailerShowcase){
      window.XC.trailerShowcase.init();
    }
    initInteractivePreview();
    const pipeMount = document.getElementById('heroPipelineMount');
    if(pipeMount && window.XC && window.XC.heroPipeline){
      window.XC.heroPipeline.init(pipeMount);
    }
    if(typeof initVaathiyarTabs === 'function') initVaathiyarTabs();
    if(typeof initLandingQuiz === 'function') initLandingQuiz();
  }
  /* §15 — enter transition only on a real page change, never on in-page
     state re-renders (quiz clicks, autoplay ticks, chat messages…). */
  if(renderKey!==null && key!==renderKey && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    app.querySelectorAll(':scope > *:not(.header)').forEach(el=>{
      el.classList.remove('view-enter');
      void el.offsetWidth;            // restart the animation cleanly
      el.classList.add('view-enter');
    });
  }
  renderKey = key;
  /* Header is rebuilt here, so anything in it that is not pure markup —
     the search shortcut hint, for one — has to re-sync after the paint.
     Guarded: app.js is also loaded by the headless test harnesses, whose
     stub window has no dispatchEvent. */
  if(typeof window.dispatchEvent==='function' && typeof CustomEvent==='function'){
    window.dispatchEvent(new CustomEvent('xc:rerender'));
  }
}

/* ============================================================
   QUIZ FLOW RESET
   ------------------------------------------------------------
   Called whenever a topic is opened. Answers are persisted to
   localStorage, so a returning user can land on a topic that is
   already partly answered; this re-seeds the cursor to the FIRST
   unanswered question instead of restarting at 0 and hiding the
   answers they already gave. If everything is answered the quiz
   opens straight on the results screen. */
/* ============================================================
   PUBLIC APP API
   ------------------------------------------------------------
   The search palette and the AURA assistant need to navigate the
   SPA and read the current view, but app.js is a closed IIFE.
   This is the single, deliberate seam between the app and those
   modules — everything else stays private.
   ============================================================ */
window.XC.app = {
  get state(){ return state; },
  render,
  TOPICS,
  FORMULAS,
  CHEATCODES,
  studyToTopics,
  studyView,
  aiDiagramSvg,
  /* go('study', {topicIdx}) / go('formula', {formulaId}) / go(view) */
  go(view, options = {}){
    if(view==='study'){
      state.topicIdx = Number.isInteger(options.topicIdx) ? options.topicIdx : state.topicIdx;
      state.step=0;
      state.view='study';
      stopAutoPlay();
      /* Same seeding the sidebar click does, so opening a topic from
         search lands on the right question rather than a stale one. */
      resetQuizFlow();
      render();
      startAutoPlay();
    } else if(view==='formula'){
      state.formulaId = options.formulaId;
      state.view='formula';
      render();
    } else {
      state.view=view;
      render();
    }
    window.scrollTo({top:0,behavior:'smooth'});
  },
  /* Short human label for wherever the user currently is, so AURA can
     answer "what am I looking at?" without duplicating routing rules. */
  contextLabel(){
    if(state.view==='study'){
      const t=getTopic(state.topicIdx);
      return t ? `${t.title} (Unit ${t.unit||'I'}, ${t.topic})` : 'a lesson';
    }
    if(state.view==='formula'){
      const f=FORMULAS.find(x=>x.id===state.formulaId);
      return f ? `${f.title} — ${f.cat}` : 'a formula';
    }
    if(state.view==='workspace') return 'the Workspace topic list';
    if(state.view==='formulas') return 'the formula library';
    if(state.view==='ai-study') return state.aiStudy ? `the study pack "${state.aiStudy.title}"` : 'a generated study pack';
    return 'the home page';
  }
};



window.XC.TOPICS = TOPICS;




/* Sign-in and sign-out both arrive as a custom event from auth.js so
   the two modules never import each other. Guarded the same way as the
   dispatch in render() above. */
if(typeof window.addEventListener==='function'){
  window.addEventListener('xc:authchange', render);
}

function resetQuizFlow(){
  const c=getTopic(state.topicIdx);
  const total=(c && c.questions) ? c.questions.length : 0;
  let step=0;
  while(step<total && state.answers[`${state.topicIdx}-${step}`]!==undefined) step++;
  state.qStep=step;
  state.qDone=total>0 && step>=total;
}

function setStepInternal(i){
  state.step = i;
  if(state.view==='formula'){
    const f = FORMULAS.find(x=>x.id===state.formulaId) || FORMULAS[0];
    const vis = window.XC.SVG[f.visual];
    const el = document.getElementById('formulaVisual');
    if(el){
      if(typeof vis === 'function') el.innerHTML = vis(i);
      else if(window.XC.SVG.miniSvg) el.innerHTML = window.XC.SVG.miniSvg(f.mini);
    }
    const cap = document.getElementById('formulaCap');
    if(cap) cap.innerHTML = `<span class="cap-step">STEP ${i+1}/${f.steps.length}</span><b>${f.steps[i].title}</b> — ${f.steps[i].desc}`;
    const nar = document.getElementById('formulaNarration');
    const why = (f.notes && f.notes.why && f.notes.why[i]) || f.steps[i].desc;
    if(nar){
      nar.classList.remove('show');
      nar.textContent = why;
      requestAnimationFrame(()=>requestAnimationFrame(()=>nar.classList.add('show')));
    }
    /* Autoplay swaps the visual without a full re-render, so the rail,
       the prev/next buttons and the worked-example lines are synced here
       too. Otherwise the highlighted step would drift out of step with
       whatever the diagram is actually showing. */
    document.querySelectorAll('.f-step-card').forEach((d,di)=>{
      d.classList.toggle('active',di===i);
      d.classList.toggle('done',di<i);
      d.setAttribute('aria-current',di===i?'step':'false');
      const top = d.querySelector('.f-step-top');
      if(top) top.innerHTML = `<span class="f-step-title">${f.steps[di].title}</span>`
        + (di===i ? '<span class="f-step-now">SHOWING</span>'
                  : (di<i ? '<span class="f-step-tick" aria-hidden="true">&#10003;</span>' : ''));
    });
    const exMap = exLineStepMap(f);
    document.querySelectorAll('.f-ex-line').forEach((d,di)=>{
      const on = exMap[di] === i;
      d.classList.toggle('active',on);
      d.setAttribute('aria-current',on?'step':'false');
      const mark = d.querySelector('.f-ex-mark');
      if(mark) mark.innerHTML = on ? '&#9654;' : String(di+1).padStart(2,'0');
    });
    const count = document.querySelector('.f-nav-count');
    if(count) count.innerHTML = `Step <b>${i+1}</b> of ${f.steps.length}`;
    const navBtns = document.querySelectorAll('.f-nav-btn');
    if(navBtns.length === 2){
      const last = i === f.steps.length - 1;
      navBtns[0].setAttribute('data-fstep', String(Math.max(0,i-1)));
      navBtns[0].disabled = (i === 0);
      navBtns[1].setAttribute('data-fstep', last ? '0' : String(i+1));
      navBtns[1].innerHTML = last ? '↺ Run it again' : 'Next step →';
    }
    const stageHead = document.querySelector('.f-stage .visual-head span');
    if(stageHead) stageHead.textContent = `ANIMATED FORMULA VISUAL • STEP ${i+1}/${f.steps.length}`;
    document.querySelectorAll('.step-dot').forEach((d,di)=>{
      d.classList.toggle('active',di===i);
      d.setAttribute('aria-pressed',String(di===i));
    });
    return;
  }
  const c = getTopic(state.topicIdx);
  const vis=document.getElementById('mainVisual');
  if(vis) vis.innerHTML = c.visual(i);
  const cap=document.getElementById('visualCap');
  if(cap) cap.innerHTML = `<span class="cap-step">STEP ${i+1}/${c.steps.length}</span><b>${c.steps[i].title}</b> — ${c.steps[i].desc}`;
  const nar=document.getElementById('narration');
  if(nar){
    nar.classList.remove('show');
    nar.textContent = c.steps[i].desc;
    requestAnimationFrame(()=>requestAnimationFrame(()=>nar.classList.add('show')));
  }
  document.querySelectorAll('.step-dot').forEach((d,di)=>{
    d.classList.toggle('active',di===i);
    d.setAttribute('aria-pressed',String(di===i));
  });
  document.querySelectorAll('.step-card').forEach((d,di)=>d.classList.toggle('active',di===i));
}

/* ============================================================
   FLASHCARDS
   ============================================================ */
const fcEl=document.getElementById('fcOverlay'), fcCard=document.getElementById('fcCard');
function openFC(){
  const c=getTopic(state.topicIdx);
  state.fcDeck=c.questions.map((q,i)=>({q:q.q,a:q.why,tag:'Q'+(i+1)+' • '+q.cat}));
  state.fcIdx=0; state.fcOpen=true;
  fcEl.classList.add('open');
  renderFC();
}
function closeFC(){ state.fcOpen=false; fcEl.classList.remove('open'); }
function renderFC(){
  const d=state.fcDeck[state.fcIdx]; if(!d) return;
  document.getElementById('fcQ').textContent=d.q;
  document.getElementById('fcA').textContent=d.a;
  document.getElementById('fcTag').textContent=d.tag;
  document.getElementById('fcCounter').textContent=(state.fcIdx+1)+' / '+state.fcDeck.length;
  fcCard.classList.remove('flipped');
}
fcCard.addEventListener('click',(e)=>{ if(e.target.id!=='fcClose') fcCard.classList.toggle('flipped'); });
document.getElementById('fcClose').addEventListener('click',(e)=>{e.stopPropagation();closeFC();});
document.getElementById('fcNext').addEventListener('click',(e)=>{e.stopPropagation();state.fcIdx=(state.fcIdx+1)%state.fcDeck.length;renderFC();});
document.getElementById('fcPrev').addEventListener('click',(e)=>{e.stopPropagation();state.fcIdx=(state.fcIdx-1+state.fcDeck.length)%state.fcDeck.length;renderFC();});
fcEl.addEventListener('click',(e)=>{ if(e.target===fcEl) closeFC(); });

/* ============================================================
   EVENTS
   ============================================================ */
document.addEventListener('click', async (e)=>{
  const isolateBtn = e.target.closest('[data-isolate-part]');
  if(isolateBtn){
    const idx = parseInt(isolateBtn.dataset.isolatePart, 10);
    state.isolatedPartIdx = (isNaN(idx) || idx < 0) ? null : idx;
    render();
    return;
  }
  const interactiveNode = e.target.closest('.interactive-part');
  if(interactiveNode){
    const idx = parseInt(interactiveNode.dataset.partIndex, 10);
    if(!isNaN(idx)){
      state.isolatedPartIdx = (state.isolatedPartIdx === idx) ? null : idx;
      render();
    }
    return;
  }
  const dockBtn = e.target.closest('[data-dock-action]');
  if(dockBtn){
    const action = dockBtn.dataset.dockAction;
    if(action === 'curriculum'){
      const el = document.querySelector('.wc-curriculum-grid') || document.querySelector('.wc-section');
      if(el) el.scrollIntoView({behavior:'smooth'});
      else { state.view = 'workspace'; render(); window.scrollTo({top:0,behavior:'smooth'}); }
    } else if(action === 'simulation'){
      const el = document.getElementById('heroInteractivePreview');
      if(el) el.scrollIntoView({behavior:'smooth'});
      else { state.view = 'workspace'; render(); }
    } else if(action === 'quiz'){
      const el = document.getElementById('landingQuizCard');
      if(el) el.scrollIntoView({behavior:'smooth'});
    } else if(action === 'vaathiyar'){
      const el = document.getElementById('landingVaathiyarCard');
      if(el) el.scrollIntoView({behavior:'smooth'});
    } else if(action === 'pdf-ingest'){
      const modal = document.getElementById('uploadModal');
      if(modal && typeof modal.showModal === 'function') modal.showModal();
    }
    return;
  }
  const mobileMenu=e.target.closest('[data-mobile-menu]');
  if(mobileMenu){
    const menu=document.getElementById('mobileNav');
    const isOpen=menu?.classList.toggle('open')||false;
    mobileMenu.setAttribute('aria-expanded',String(isOpen));
    mobileMenu.setAttribute('aria-label',isOpen?'Close navigation':'Open navigation');
    return;
  }
  const aiPage=e.target.closest('[data-ai-page]');
  if(aiPage){
    const type=aiPage.dataset.aiPage;
    stopAIVisualAutoplay();
    state.aiPage={
      type,
      ...(aiPage.dataset.unitIndex!==undefined?{unitIndex:Number(aiPage.dataset.unitIndex)}:{}),
      ...(aiPage.dataset.topicIndex!==undefined?{topicIndex:Number(aiPage.dataset.topicIndex)}:{}),
      ...(aiPage.dataset.conceptIndex!==undefined?{conceptIndex:Number(aiPage.dataset.conceptIndex)}:{})
    };



    if(type==='concept'){
      state.aiLessonMode='crash';
      state.aiVisualStep=0;
      state.aiLessonFlashIdx=0;
      state.aiLessonFlashFlipped=false;
      state.aiExplanationLevel='simple';
    }
    render();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  const aiMode=e.target.closest('[data-ai-mode]');
  if(aiMode){
    stopAIVisualAutoplay();
    state.aiLessonMode=aiMode.dataset.aiMode;
    render();
    return;
  }
  const simAction = e.target.closest('[data-sim-action]');
  if(simAction){
    const action = simAction.dataset.simAction;
    const conceptObj = state.aiStudy?.concepts[state.aiPage?.conceptIndex];
    const simAlgoType = conceptObj && window.XC?.simulations ? window.XC.simulations.detectAlgorithmType(conceptObj.title + ' ' + (conceptObj.summary || '') + ' ' + (conceptObj.explanation || '')) : 'bubble-sort';
    const simSteps = window.XC && window.XC.simulations ? (simAlgoType === 'binary-search' ? window.XC.simulations.generateBinarySearchSteps() : window.XC.simulations.generateBubbleSortSteps()) : [];
    const total = simSteps.length || 1;
    if(action === 'play'){
      if(state.simPlaying) stopSimAutoplay();
      else {
        if(state.simStep >= total - 1) state.simStep = 0;
        startSimAutoplay(total);
      }
      render();
    } else if(action === 'next'){
      stopSimAutoplay();
      state.simStep = Math.min(state.simStep + 1, total - 1);
      render();
    } else if(action === 'prev'){
      stopSimAutoplay();
      state.simStep = Math.max(state.simStep - 1, 0);
      render();
    } else if(action === 'reset'){
      stopSimAutoplay();
      state.simStep = 0;
      render();
    }
    return;
  }

  const simSpeed = e.target.closest('[data-sim-speed]');
  if(simSpeed){
    state.simSpeed = parseFloat(simSpeed.dataset.simSpeed) || 1;
    if(state.simPlaying){
      const conceptObj = state.aiStudy?.concepts[state.aiPage?.conceptIndex];
    const simAlgoType = conceptObj && window.XC?.simulations ? window.XC.simulations.detectAlgorithmType(conceptObj.title + ' ' + (conceptObj.summary || '') + ' ' + (conceptObj.explanation || '')) : 'bubble-sort';
    const simSteps = window.XC && window.XC.simulations ? (simAlgoType === 'binary-search' ? window.XC.simulations.generateBinarySearchSteps() : window.XC.simulations.generateBubbleSortSteps()) : [];
      startSimAutoplay(simSteps.length || 1);
    }
    render();
    return;
  }

  const quickAsk = e.target.closest('[data-quick-ask]');
  if(quickAsk){
    const qText = quickAsk.dataset.quickAsk;
    const form = document.getElementById('aiChatForm');
    if(form && form.elements && form.elements.question){
      form.elements.question.value = qText;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    return;
  }

  if(e.target.closest('[data-ai-visual-play]')){
    if(state.aiVisualPlaying){
      stopAIVisualAutoplay();
      render();
      return;
    }
    const concept=state.aiStudy?.concepts[state.aiPage.conceptIndex];
    if(!concept) return;
    if(state.aiVisualStep>=concept.visualization.steps.length-1) state.aiVisualStep=0;
    state.aiVisualPlaying=true;
    state.aiVisualTimer=setInterval(()=>{
      const lastStep=concept.visualization.steps.length-1;
      if(state.aiVisualStep>=lastStep){
        stopAIVisualAutoplay();
      }else{
        state.aiVisualStep+=1;
        if(state.aiVisualStep===lastStep) stopAIVisualAutoplay();
      }
      render();
    },2600);
    render();
    return;
  }
  const aiVisual=e.target.closest('[data-ai-visual]');
  if(aiVisual){
    state.aiVisualStep=Number(aiVisual.dataset.aiVisual);
    render();
    return;
  }
  const aiTopicImage=e.target.closest('[data-ai-topic-image]');
  if(aiTopicImage && state.aiStudy){
    requestTopicImage(Number(aiTopicImage.dataset.aiTopicImage));
    return;
  }
  const aiQuizVisual=e.target.closest('[data-ai-quiz-visual]');
  if(aiQuizVisual){
    const [,step]=aiQuizVisual.dataset.aiQuizVisual.split(':');
    state.aiQuizVisualStep=Number(step);
    render();
    return;
  }
  if(e.target.closest('[data-ai-concept-flip]')){
    state.aiLessonFlashFlipped=!state.aiLessonFlashFlipped;
    render();
    return;
  }
  const conceptFlashNav=e.target.closest('[data-ai-concept-flash]');
  if(conceptFlashNav && state.aiStudy){
    const concept=state.aiStudy.concepts[state.aiPage.conceptIndex];
    const count=state.aiStudy.flashcards.filter(card=>card.conceptIndex===state.aiPage.conceptIndex).length;
    if(concept && count){
      state.aiLessonFlashIdx=(state.aiLessonFlashIdx+(conceptFlashNav.dataset.aiConceptFlash==='next'?1:-1)+count)%count;
      state.aiLessonFlashFlipped=false;
      render();
    }
    return;
  }
  const explanationLevel=e.target.closest('[data-ai-explanation-level]');
  if(explanationLevel){
    state.aiExplanationLevel=explanationLevel.dataset.aiExplanationLevel;
    render();
    return;
  }
  const aiAnswer=e.target.closest('[data-ai-answer]');
  if(aiAnswer){
    const [questionIndex,answerIndex]=aiAnswer.dataset.aiAnswer.split(':').map(Number);
    if(state.aiStudy){
      state.aiQuizAnswers[questionIndex]=answerIndex;
      render();
    }
    return;
  }
  if(e.target.closest('[data-ai-flip]')){
    state.aiFlashFlipped=!state.aiFlashFlipped;
    render();
    return;
  }
  const flashNav=e.target.closest('[data-ai-flash]');
  if(flashNav && state.aiStudy){
    const count=state.aiStudy.flashcards.length;
    state.aiFlashIdx=(state.aiFlashIdx+(flashNav.dataset.aiFlash==='next'?1:-1)+count)%count;
    state.aiFlashFlipped=false;
    render();
    return;
  }
  const nav=e.target.closest('[data-nav]');
  if(nav){
    stopAIVisualAutoplay();
    document.getElementById('uploadModal')?.close();
    state.view=nav.dataset.nav;
    state.step=0;
    stopAutoPlay();
    if(state.view==='library') refreshLibrary();
    render();
    if(state.view==='study') startAutoPlay();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  /* LIBRARY actions: open restores the saved study JSON; delete drops it;
     renew restarts the 30-day clock (payment verification plugs in here). */
  const libOpen=e.target.closest('[data-library-open]');
  if(libOpen && window.XC?.library){
    const entry=await window.XC.library.getStudy(libOpen.dataset.libraryOpen);
    if(entry?.study){
      const study = entry.study;
      state.aiStudy = study;
      state.aiJobId = entry.id;
      state.aiPdfMeta = entry.pdfMeta || null;
      state.aiChunkNote = '';
      state.aiTopicImages = entry.images || {};



      state.aiTopicImageBusy = {};



      state.aiPage = { type: 'plan' };



      state.aiLessonMode = 'crash';
      state.aiVisualStep = 0;
      state.aiQuizAnswers = {};
      state.answers = {};
      state.qStep = 0;
      state.qDone = false;




      const topics = studyToTopics(study, entry.title || 'Course');
      if (topics.length > 0) {
        window.XC.TOPICS = topics;
        state.activeCourseTitle = study.subject || (study.title || entry.title || 'Course');
        state.activeCourseEyebrow = 'AI GENERATED COURSE • ' + (study.subject || 'SYLLABUS').toUpperCase();
        state.view = 'study';
        state.topicIdx = 0;
        state.step = 0;
        state.studyTab = 'visual';
      } else {
        state.view = 'study';
      }

      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      autoGenerateTopicImages();

      if (entry.study?.chunked && Array.isArray(entry.study.pendingUnits) && entry.study.pendingUnits.length) {
        startChunkWatch(entry.id);
      }
    }
    return;
  }
  const libDel=e.target.closest('[data-library-delete]');
  if(libDel && window.XC?.library){
    await window.XC.library.deleteStudy(libDel.dataset.libraryDelete);
    await refreshLibrary(); return;
  }
  if(e.target.closest('[data-library-renew]') && window.XC?.library){
    window.XC.library.renewTrial();
    await refreshLibrary(); return;
  }
  const studyAuraAsk = e.target.closest('[data-study-aura-ask]');
  if(studyAuraAsk){
    const qText = studyAuraAsk.dataset.studyAuraAsk;
    handleStudyAuraQuestion(qText);
    return;
  }
  const tabBtn = e.target.closest('[data-tab]');
  if(tabBtn){
    state.studyTab = tabBtn.dataset.tab;
    render();
    const targetId = state.studyTab === 'cheat' ? 'studyCheatSection' : state.studyTab === 'quiz' ? 'studyVaathiyarSection' : 'studyVisualSection';
    const secEl = document.getElementById(targetId);
    if(secEl && typeof secEl.scrollIntoView === 'function') secEl.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  /* Sequential quiz flow --------------------------------------------
     Next is the ONLY way forward. It is rendered disabled until the
     current question has an answer, so the flow cannot be skipped.
     On the last question it flips qDone, which swaps the quiz column
     for the results screen. */
  const next=e.target.closest('[data-qnext]');
  if(next && !next.disabled){
    const c=getTopic(state.topicIdx);
    const last=state.qStep>=c.questions.length-1;
    if(last) state.qDone=true; else state.qStep++;
    render();
    /* The quiz column is replaced wholesale, so park the new card just
       below the study-bar instead of leaving the scroll where the old
       card's explanations used to be. */
    const card=document.querySelector('.study-bar');
    if(card) window.scrollTo({top:Math.max(0,card.offsetTop),behavior:'smooth'});
    return;
  }
  const retry=e.target.closest('[data-qretry]');
  if(retry){
    const t=state.topicIdx;
    Object.keys(state.answers).forEach(k=>{ if(k.startsWith(t+'-')) delete state.answers[k]; });
    saveAnswers();
    state.qStep=0;
    state.qDone=false;
    render();
    return;
  }
  const toggle=e.target.closest('[data-toggle-unit]');
  if(toggle){
    const u = toggle.dataset.toggleUnit;
    state.collapsedUnits[u] = !state.collapsedUnits[u];
    toggle.setAttribute('aria-expanded', String(!state.collapsedUnits[u]));
    render();
    return;
  }
  if(e.target.closest('[data-open="flashcards"]')){
    openFC();
    return;
  }
  const fc=e.target.closest('[data-formula]');
  if(fc){
    state.formulaId = fc.dataset.formula;
    state.step = 0;
    state.view = 'formula';
    stopAutoPlay();
    render();
    startAutoPlay();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  const fstep=e.target.closest('[data-fstep]');
  if(fstep){
    stopAutoPlay();
    state.step = +fstep.dataset.fstep;
    render();
    return;
  }
  const study=e.target.closest('[data-study]');
  if(study){
    state.topicIdx=+study.dataset.study;
    state.step=0;
    state.view='study';
    stopAutoPlay();
    /* Re-seed the quiz cursor for the topic just opened. Runs before
       render() so the first paint already shows the right question. */
    resetQuizFlow();
    render();
    startAutoPlay();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  const open=e.target.closest('[data-open]');
  if(open){
    if(open.dataset.open==='upload'){
      stopAIVisualAutoplay();
      document.getElementById('uploadModal')?.showModal();
      /* Read the day's capacity as the dialog opens, so the user sees
         whether a model is still free before picking a file. */
      refreshQuota();
    }
    return;
  }
  if(e.target.closest('[data-upload-close]')){
    document.getElementById('uploadModal')?.close();
    return;
  }
  const step=e.target.closest('[data-step]');
  if(step){
    stopAutoPlay();
    setStepInternal(+step.dataset.step);
    clearTimeout(state.resumeTimer);
    state.resumeTimer = setTimeout(()=>{ if(state.playing) startAutoPlay(); }, 6000);
    return;
  }
  if(e.target.closest('[data-play]')){
    state.playing = !state.playing;
    refreshPlayBtn();
    if(state.playing) startAutoPlay(); else stopAutoPlay();
    return;
  }
  const ans=e.target.closest('[data-ans]');
  if(ans){
    const q=+ans.dataset.q, o=+ans.dataset.ans;
    const key=`${state.topicIdx}-${q}`;
    {
      state.answers[key]=o;
      saveAnswers();
      render();
      try{
        const ctx=new (window.AudioContext||window.webkitAudioContext)();
        const osc=ctx.createOscillator(), g=ctx.createGain();
        const c=getTopic(state.topicIdx);
        const isC=o===c.questions[q].a;
        osc.frequency.value=isC?660:220;
        osc.type=isC?'sine':'sawtooth';
        g.gain.setValueAtTime(.06,ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime+.18);
      }catch(e2){}
    }
    return;
  }
  const hint=e.target.closest('[data-hint]');
  if(hint){ alert('HINT: '+(getTopic(state.topicIdx).questions[+hint.dataset.hint]?.why || getTopic(state.topicIdx).questions[+hint.dataset.hint]?.hint || 'No hint available.')); return; }
  const eli=e.target.closest('[data-eli]');
  if(eli){ alert('EXPLAIN LIKE I\'M 5:\n\n'+(getTopic(state.topicIdx).questions[+eli.dataset.eli]?.why || 'Core conceptual explanation.')); return; }
  if(e.target.closest('#themeBtn')){
    const cur = document.body.getAttribute('data-mode') || 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    applyTheme(document.body.getAttribute('data-theme') || 'bubblegum', next);
    return;
  }
  if(e.target.closest('#flash')){ openFC(); return; }
});

function readFileAsBase64(file,onProgress){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('The selected PDF could not be read.'));
    reader.onprogress=event=>{
      if(event.lengthComputable && typeof onProgress==='function'){
        onProgress(Math.round(event.loaded/event.total*100));
      }
    };



    reader.onload=()=>{
      if(typeof reader.result!=='string'){
        reject(new Error('The selected PDF could not be read.'));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(',')+1));
    };



    reader.readAsDataURL(file);
  });
}

function analyzePdfRequest(pdfBase64,level,onUploadProgress,onUploadComplete){
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    request.open('POST','/api/analyze');
    request.setRequestHeader('Content-Type','application/json');
    request.upload.addEventListener('progress',event=>{
      if(event.lengthComputable) onUploadProgress(Math.round(event.loaded/event.total*100));
    });
    request.upload.addEventListener('load',onUploadComplete,{once:true});
    request.addEventListener('error',()=>reject(new Error('The PDF could not be sent. Check your connection and try again.')),{once:true});
    request.addEventListener('timeout',()=>reject(new Error('The AI request took too long. Please try again.')),{once:true});
    request.addEventListener('load',()=>{
      let result;
      try{
        result=JSON.parse(request.responseText);
      }catch{
        const requestId=request.getResponseHeader('X-Request-Id');
        const status=request.status?`HTTP ${request.status}`:'no HTTP response';
        const responseType=request.getResponseHeader('Content-Type')||'unknown content type';
        const responsePreview=request.responseText.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
        const wrongMethod=request.status===405
          ? `The server at ${location.origin} rejected the required POST method. This usually means an older or static server is still answering on this port.`
          : '';
        const guidance=['127.0.0.1','localhost'].includes(location.hostname)
          ? 'In PowerShell, inspect port 4173 with Get-NetTCPConnection -LocalPort 4173 -State Listen. Stop that PID only if it is the old XAMCODE server, then run node server.js from C:\\Xamcode and open http://127.0.0.1:4173.'
          : 'Retry in a moment; contact the site administrator if this continues.';
        const requestReference=requestId?` Reference: ${requestId}.`:'';
        const preview=responsePreview?` Server response: ${responsePreview}`:'';
        reject(new Error(`XAMCODE received an unreadable response (${status}, ${responseType}). ${wrongMethod||'The response was not JSON.'} ${guidance}${requestReference}${preview}`));
        return;
      }
      if(request.status<200||request.status>=300){
        const requestId=result?.requestId||request.getResponseHeader('X-Request-Id');
        const requestReference=requestId?` Reference: ${requestId}.`:'';
        /* The server reports this caller's real remaining count, so the
           panel shows the new number now instead of at its next poll. */
        if(result?.code==='DAILY_LIMIT_REACHED'&&result.allowance&&quotaLast){
          renderQuota({ ...quotaLast, allowance: result.allowance });
        }
        reject(new Error(`${result?.error||'The study could not be generated. Please try again.'}${requestReference}`));
        return;
      }
      resolve(result);
    },{once:true});
    request.timeout=390000;
    const examDaysMode = (typeof document !== 'undefined' && document.getElementById('xc-exam-days-select')) ? document.getElementById('xc-exam-days-select').value : '10days'; request.send(JSON.stringify({pdfBase64,level,examDaysMode}));
  });
}

/* ============================================================
   ANALYSIS JOB POLLING
   ------------------------------------------------------------
   The server now answers the upload with 202 and a jobId, then builds
   the study in the background. This polls the real stage events, so the
   panel and the scene are driven by what the server is actually
   doing rather than by elapsed time. The old single long request is
   gone, which is also what makes cancellation possible.
   ============================================================ */
let activeJobId=null;
let jobPollTimer=null;

function stopJobPolling(){
  if(jobPollTimer) clearTimeout(jobPollTimer);
  jobPollTimer=null;
}

async function cancelActiveJob(){
  const id=activeJobId;
  stopJobPolling();
  activeJobId=null;
  if(!id) return;
  /* Best effort: a build already in flight cannot be recalled, but the
     server stops at the next stage boundary so no further quota is spent. */
  try{
    await fetch(`/api/analyze/${id}`,{method:'DELETE',keepalive:true});
  }catch{ /* the run is ending anyway */ }
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Maps a server stage onto the four client stages the panel and the scene
   already understand, so the existing visuals keep working while the text
   and the bar follow the real job. The scene additionally reads the
   UNMAPPED server stage name via journeySetStage, which is what lets each
   stage pick its own beat. */
const JOB_STAGE_TO_UI={
  queued:'reading', extract:'reading',
  outline:'analyzing', sections:'analyzing',
  bank:'analyzing', validate:'building', ready:'building'
};




function updateModularSkeleton(skelStage){
  const skel = document.getElementById('pdfModularSkeleton');
  if(!skel) return;
  skel.dataset.activeStage = String(skelStage);
  skel.querySelectorAll('[data-skel-stage]').forEach(pill => {
    const n = Number(pill.dataset.skelStage);
    pill.classList.toggle('active', n === skelStage);
    pill.classList.toggle('complete', n < skelStage);
  });
}

function applyJobStage(snapshot){
  if(!snapshot) return;
  const uiStage=JOB_STAGE_TO_UI[snapshot.stage]||'analyzing';
  const skelMap={queued:1, extract:1, outline:2, sections:2, bank:3, validate:3, ready:3};
  const skelStage=skelMap[snapshot.stage]||2;
  const fallbackLabels={1:'1. Scanning Pages', 2:'2. Synthesizing Architecture', 3:'3. Generating Visual Assembly'};
  const label=snapshot.stageLabel||fallbackLabels[skelStage];
  setUploadStage(uiStage, label==='Building your lessons'?'2. Synthesizing Architecture':label,
    `${label}…`);
  updateModularSkeleton(skelStage);
  if(pdfProgressStatus) pdfProgressStatus.textContent=`${label}…`;
  /* Real percentage, so the bar stops guessing. */
  if(pdfProgressBar) pdfProgressBar.style.width=`${snapshot.progress}%`;
  if(pdfProgressTrack){
    pdfProgressTrack.removeAttribute('data-indeterminate');
    pdfProgressTrack.setAttribute('aria-valuenow',String(snapshot.progress));
    pdfProgressTrack.setAttribute('aria-label',`Study generation: ${label}, ${snapshot.progress}%`);
  }
  /* The scene takes the REAL stage name, so each beat of the animation is
     the step the pipeline is actually on rather than a guess. */
  journeySetStage(snapshot.stage,label);
  /* The comet advances to the real position instead of an elapsed guess. */
  journeySetJobProgress(snapshot.progress);
}

async function pollAnalyzeJob(jobId,onStage){
  const WATCHDOG_TIMEOUT_MS = 180000; // 3 minutes maximum without heartbeat
  let lastProgressTime = Date.now();
  let lastProgressVal = -1;

  // 1. Try Server-Sent Events (SSE) with keepalive
  if (typeof window !== 'undefined' && window.EventSource) {
    try {
      const ssePromise = new Promise((resolve, reject) => {
        let es = null;
        try { es = new EventSource(`/api/analyze/${jobId}/events`); }
        catch (e) { return reject(e); }

        const watchdogTimer = setInterval(() => {
          if (Date.now() - lastProgressTime > WATCHDOG_TIMEOUT_MS) {
            clearInterval(watchdogTimer);
            if (es) es.close();
            const err = new Error('Document processing timed out after 3 minutes. Switching to fast unit extraction or retry.');
            err.code = 'WATCHDOG_TIMEOUT';
            reject(err);
          }
        }, 4000);

        es.onmessage = (event) => {
          try {
            const snapshot = JSON.parse(event.data);
            if (snapshot.progress !== lastProgressVal || snapshot.heartbeat) {
              lastProgressVal = snapshot.progress;
              lastProgressTime = Date.now();
            }
            onStage?.(snapshot);
            if (snapshot.status === 'done') {
              clearInterval(watchdogTimer);
              es.close();
              resolve(snapshot);
            } else if (snapshot.status === 'failed') {
              clearInterval(watchdogTimer);
              es.close();
              reject(new Error(snapshot.error || 'The study could not be generated. Please try again.'));
            } else if (snapshot.status === 'cancelled') {
              clearInterval(watchdogTimer);
              es.close();
              reject(new Error('The study build was cancelled.'));
            }
          } catch (parseErr) {
            console.warn('SSE event parse error:', parseErr);
          }
        };

        es.onerror = () => {
          clearInterval(watchdogTimer);
          if (es) es.close();
          // Fall back to polling if SSE disconnected
          reject(new Error('SSE_DISCONNECTED'));
        };
      });

      return await ssePromise;
    } catch (sseErr) {
      if (sseErr && sseErr.code === 'WATCHDOG_TIMEOUT') throw sseErr;
      // Fall through to polling loop below
    }
  }

  // 2. Polling loop with watchdog timer
  for(;;){
    if (Date.now() - lastProgressTime > WATCHDOG_TIMEOUT_MS) {
      const timeoutErr = new Error('Document processing timed out after 3 minutes. Switching to fast unit extraction or retry.');
      timeoutErr.code = 'WATCHDOG_TIMEOUT';
      throw timeoutErr;
    }

    let snapshot;
    try{
      const response=await fetch(`/api/analyze/${jobId}`);
      snapshot=await response.json();
    }catch{
      await sleep(1500);
      continue;
    }

    if (snapshot.progress !== lastProgressVal || snapshot.heartbeat) {
      lastProgressVal = snapshot.progress;
      lastProgressTime = Date.now();
    }

    if(snapshot.status==='done') return snapshot;
    if(snapshot.status==='failed') throw new Error(snapshot.error||'The study could not be generated. Please try again.');
    if(snapshot.status==='cancelled') throw new Error('The study build was cancelled.');
    onStage?.(snapshot);
    await sleep(snapshot.stage==='outline'||snapshot.stage==='bank'?900:1400);
  }
}
/* ============================================================
   BACKGROUND UNIT UNLOCKS
   ------------------------------------------------------------
   A chunked job delivers Unit 1 as soon as it is ready and keeps
   building the remaining units server-side. This watcher polls the
   same job at a calm interval, merges each newly finished unit into
   the open study (append-only indices, so the page you are on and
   your quiz answers stay valid), persists the updated study to the
   library, fires the topic stills for the new lessons and toasts
   the unlock. It stops when every unit is ready or the server no
   longer knows the job.
   ============================================================ */
let chunkWatchToken = 0;
function xcToast(msg){
  let el=document.getElementById('xcToast');
  if(!el){
    el=document.createElement('div');
    el.id='xcToast';
    el.className='xc-toast';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(el._xcToastTimer);
  el._xcToastTimer=setTimeout(()=>el.classList.remove('show'),4500);
}
async function applyChunkUnlock(study){
  const err=validateAIStudyForDisplay(study);
  if(err){ console.warn('Unlock rejected by validator; keeping the study on screen.',err); return; }
  const prevStates=Array.isArray(state.aiStudy?.unitStates)?state.aiStudy.unitStates:[];
  const unlocked=(study.unitStates||[]).filter((s,i)=>s.status==='ready'&&prevStates[i]?.status!=='ready');
  state.aiStudy=study;
  /* The library entry is keyed by jobId, so re-saving overwrites the
     partial pack with the newer one — Unit 1 first, then each unlock. */
  try{
    if(window.XC?.library&&state.aiJobId){
      await window.XC.library.saveStudy({jobId:state.aiJobId,study,
        images:state.aiTopicImages||{},pdfMeta:state.aiPdfMeta||null});
    }
  }catch(e){ console.warn('Library save failed on unlock; study still usable.',e); }
  if(unlocked.length){
    const last=unlocked[unlocked.length-1];
    xcToast(`Unit ${last.index+1} is ready — ${last.lessons} new lesson${last.lessons===1?'':'s'} unlocked.`);
  }
  if(state.view==='ai-study') render();
  /* New lessons need their stills; this skips anything already
     generated, so only the fresh concepts are requested. */
  autoGenerateTopicImages();
}
function onChunkWatchEnd(jobId,reason){
  if(state.aiJobId!==jobId) return;
  const pending=Array.isArray(state.aiStudy?.pendingUnits)?state.aiStudy.pendingUnits:[];
  if(pending.length&&reason!=='done'){
    state.aiChunkNote='The background build stopped. Upload the PDF again to prepare the remaining units.';
    if(state.view==='ai-study') render();
  }
}
async function startChunkWatch(jobId){
  const token=++chunkWatchToken;
  while(token===chunkWatchToken&&state.aiJobId===jobId){
    let snap=null;
    try{
      const response=await fetch(`/api/analyze/${jobId}`);
      if(response.status===404){ onChunkWatchEnd(jobId,'gone'); return; }
      snap=await response.json();
    }catch{ await sleep(4000); continue; }
    if(token!==chunkWatchToken||state.aiJobId!==jobId) return;
    if(snap.status==='failed'){ onChunkWatchEnd(jobId,'failed'); return; }
    if(snap.status==='cancelled'){ onChunkWatchEnd(jobId,'cancelled'); return; }
    const incoming=snap.study;
    if(incoming&&Array.isArray(incoming.concepts)&&
       (!state.aiStudy||incoming.concepts.length>state.aiStudy.concepts.length)){
      await applyChunkUnlock(incoming);
    }
    const pending=Array.isArray(snap.pendingUnits)?snap.pendingUnits:[];
    if(!pending.length) return;
    await sleep(4000);
  }
}
/* ============================================================
   PER-TOPIC 2D IMAGES
   ------------------------------------------------------------
   One SVG still per lesson topic, bound to the finished
   analyze job — generating images consumes no new PDF allowance.
   The response carries the prompt used, so the result can be verified
   against the topic's own diagram nodes and workshop formulas.
   Motion stays in the browser-animated SVG scenes; the still is the
   lesson header image.
   ============================================================ */
async function requestTopicImage(conceptIndex){
  if(!state.aiJobId||state.aiTopicImageBusy[conceptIndex]) return;
  state.aiTopicImageBusy[conceptIndex]=true;
  render();
  try{
    const response=await fetch('/api/topic-images',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jobId:state.aiJobId,study:state.aiStudy,topics:[conceptIndex]})
    });
    const posted=await response.json();
    if(!response.ok) throw new Error(posted.error||'The image could not be generated. Please try again.');
    const first=posted.images?.[0];
    if(first?.imageUrl) {
      state.aiTopicImages[conceptIndex]=first;
      if(window.XC?.library && state.aiStudy && state.aiJobId){
        window.XC.library.saveStudy({
          jobId: state.aiJobId,
          study: state.aiStudy,
          images: state.aiTopicImages,
          pdfMeta: state.aiPdfMeta
        }).catch(()=>{});
      }
    }
    else throw new Error(first?.error||'The image provider returned no image. Please try again.');
  }catch(error){
    state.aiTopicImages[conceptIndex]={error:error.message||'The image could not be generated.'};



  }finally{
    state.aiTopicImageBusy[conceptIndex]=false;
    render();
  }
}
/* AUTO topic images — after a study lands, fire one SVG still per
   lesson automatically (sequentially, so no resource stampede). A failure
   for one topic never blocks the rest; the empty slot's button remains
   for a manual retry. */
async function autoGenerateTopicImages(){
  if(!state.aiJobId||!state.aiStudy||!Array.isArray(state.aiStudy.concepts)) return;
  for(let i=0;i<state.aiStudy.concepts.length;i++){
    if(state.aiTopicImages[i]?.imageUrl||state.aiTopicImageBusy[i]) continue;
    await requestTopicImage(i);
  }
}
function promptLooksDegenerate(prompt){
  if(!prompt) return true;
  const s=String(prompt).trim();
  /* Empty or tiny prompts are the clearest sign the provider refused / the
     topic fell through; the still is worth regenerating with a sharper
     lesson-grounded prompt rather than showing the broken image forever. */
  if(s.length<25) return true;
  /* A long run of generic connector/fallback words with no real topic nouns is
     a weak prompt even when it is technically nonempty. */
  const weak=/(?:image|illustration|topic|concept|visual|picture|drawing|generated)/i.test(s);
  const nouns=s.match(/[A-Za-z][A-Za-z\-']*(?:[\s]+[A-Za-z][A-Za-z\-']*){0,2}/g);
  const realNouns=(nouns||[]).filter(t=>!/^(with|for|about|showing|incorporating|and|the|of|set|in|to|or|by|an|a)$/i.test(t.trim())).length;
  if(weak && realNouns<2) return true;
  return false;
}

function topicImageSlot(conceptIndex){
  const entry=state.aiTopicImages[conceptIndex];
  if(entry?.imageUrl) {
    /* Quality gate: the SVG lane is deterministic, but a degenerate stored
       prompt (from an older build or a truncated entry) still means a vague
       still. Flag it so the user can regenerate a lesson-grounded header
       image instead of staring at a broken one. */
    const flagged=promptLooksDegenerate(entry.prompt);
    return `<figure class="ai-topic-image${flagged?' ai-topic-image-questionable':''}"><img src="${escapeHtml(entry.imageUrl)}" alt="2D illustration for ${escapeHtml(state.aiStudy.concepts[conceptIndex].title)}" loading="lazy"><figcaption><span>${flagged?'2D TOPIC IMAGE · NEEDS REGENERATION':'2D TOPIC IMAGE · SVG'}</span><button type="button" data-ai-topic-image="${conceptIndex}">↻ Regenerate</button></figcaption></figure>`;
  }
  if(entry?.error) return `<div class="ai-topic-image ai-topic-image-error" role="status"><p>${escapeHtml(entry.error)}</p><button type="button" data-ai-topic-image="${conceptIndex}">Try again</button></div>`;
  const busy=!!state.aiTopicImageBusy[conceptIndex];
  return `<div class="ai-topic-image ai-topic-image-empty"><p>Generate a 2D illustration for this topic from your PDF.</p><button type="button" data-ai-topic-image="${conceptIndex}" ${busy?'disabled':''}>${busy?'Generating…':'🖼 Generate topic image'}</button></div>`;
}


/* ============================================================
   STATIC-PREVIEW RECOVERY
   ------------------------------------------------------------
   A static preview (VS Code Live Server on 5500, python -m
   http.server, opening the file directly) happily serves this page
   but has no /api, so the health check 404s and every AI call fails
   behind a wall of instructions the reader then has to act on.

   The page used to only report that. It now fixes itself: if this
   document is served from a loopback port that has no API but the
   real server is alive on 4173, the browser is moved there.

   Two guards keep this safe. It only runs on a loopback host, so a
   deployed site — Render, or any hostname that serves its own API —
   is never redirected. And it only fires when 4173 actually answers
   the health check, so a missing server is never papered over.
   ============================================================ */
const XC_API_PORT = '4173';
let xcApiProbe = null;

function xcIsLoopback(){
  return /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(location.hostname);
}

/* Returns the health payload when origin is the real server, else null. */
async function xcProbeHealth(origin){
  try{
    const res = await fetch(`${origin}/api/health`, { headers:{ Accept:'application/json' }, cache:'no-store' });
    if(!res.ok) return null;
    const data = await res.json();
    return (data && data.service === 'xamcode-ai' && data.apiVersion === 1) ? data : null;
  }catch{
    return null;
  }
}

/* Resolves true when this page is already served by the real server.
   Otherwise, on loopback, redirects to it and resolves false. */
function xcEnsureApiOrigin(){
  if(xcApiProbe) return xcApiProbe;
  const probe = xcApiProbe = (async ()=>{
    if(await xcProbeHealth(location.origin)) return true;
    if(!xcIsLoopback() || location.port === XC_API_PORT) return false;
    const target = `http://${location.hostname}:${XC_API_PORT}`;
    if(!(await xcProbeHealth(target))) return false;
    /* Bounce immediately so the user never reaches the upload dialog on
       a port that cannot answer. replace() avoids trapping them in the
       preview with the back button. */
    location.replace(`${target}${location.pathname}${location.search}${location.hash}`);
    return false;
  })();
  /* Cache a SUCCESS forever, but never a failure: a probe that ran while
     the server was restarting used to pin xcApiProbe=false for the whole
     session, so verifyXamcodeApi kept throwing "not running" long after
     the server came back — while /api/quota answered fine, leaving the
     red banner sitting next to a live "5 of 5" count. Dropping the memo
     on false makes the next submit re-probe the real server. */
  probe.then(ok=>{ if(!ok && xcApiProbe === probe) xcApiProbe = null; });
  return probe;
}

async function verifyXamcodeApi(){
  if(await xcEnsureApiOrigin()) return;
  /* Nothing to bounce to, so the server is genuinely down. Kept short
     and specific on purpose — the long diagnostic version was the wall
     of text this whole recovery path exists to avoid. */
  const where = xcIsLoopback() ? `port ${location.port || '80'}` : location.host;
  throw new Error(
    `XAMCODE AI is not running. This page is served from ${where}, which has no API, and no server answered on port ${XC_API_PORT}. ` +
    `Run "npm start" in C:\\Xamcode (or "node server.js"), then open http://127.0.0.1:${XC_API_PORT}/`
  );
}

/* Boot-time check, so a preview tab corrects itself on load rather than
   waiting for the user to pick a PDF and hit an error. */
xcEnsureApiOrigin();

const pdfUploadForm=document.getElementById('pdfUploadForm');
const pdfFileInput=document.getElementById('studyPdf');
const pdfDropzone=document.getElementById('pdfDropzone');
const selectedPdf=document.getElementById('selectedPdf');
const pdfUploadProgress=document.getElementById('pdfUploadProgress');
const pdfProgressTrack=pdfUploadProgress?.querySelector('.pdf-progress-track');
const pdfProgressBar=document.getElementById('pdfProgressBar');
const pdfProgressTitle=document.getElementById('pdfProgressTitle');
const pdfProgressDescription=document.getElementById('pdfProgressDescription');
const pdfProgressStatus=document.getElementById('pdfProgressStatus');
const pdfProgressElapsed=document.getElementById('pdfProgressElapsed');
const analyzePdfButton=document.getElementById('analyzePdfButton');
let uploadElapsedTimer;
let uploadStartedAt=0;
const updateUploadElapsed=()=>{
  if(!pdfProgressElapsed||!uploadStartedAt) return;
  const seconds=Math.floor((Date.now()-uploadStartedAt)/1000);
  const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  pdfProgressElapsed.textContent=`${time} elapsed`;
  pdfProgressElapsed.setAttribute('aria-label',`Elapsed time: ${seconds} seconds`);
};



const startUploadElapsed=()=>{
  window.clearInterval(uploadElapsedTimer);
  uploadStartedAt=Date.now();
  updateUploadElapsed();
  uploadElapsedTimer=window.setInterval(updateUploadElapsed,1000);
};



const stopUploadElapsed=()=>{
  window.clearInterval(uploadElapsedTimer);
  uploadElapsedTimer=undefined;
  uploadStartedAt=0;
};



const setSelectedPdf=file=>{
  if(!selectedPdf) return;
  selectedPdf.hidden=!file;
  if(!file) return;
  document.getElementById('selectedPdfName').textContent=file.name;
  const size=file.size<1024*1024
    ? `${Math.max(1,Math.round(file.size/1024))} KB`
    : `${(file.size/(1024*1024)).toFixed(1)} MB`;
  document.getElementById('selectedPdfSize').textContent=`PDF document · ${size}`;
};



const validatePdfFile=file=>{
  if(!file.name.toLowerCase().endsWith('.pdf') && file.type!=='application/pdf'){
    return 'Please select a PDF file.';
  }
  if(file.size>MAX_PDF_MB*1024*1024){
    return `This PDF is larger than the ${MAX_PDF_MB} MB limit.`;
  }
  return '';
};



/* ============================================================
   PDF PROCESSING JOURNEY — the arena scene
   ------------------------------------------------------------
   The provider gives no progress signal for the analysis phase, so this
   is an ELAPSED-TIME estimate, not a true percentage. Reading and
   uploading report real measured progress; analysing eases toward the
   crystal as wall-clock time passes and always completes. The caption
   states the stage honestly rather than inventing a page count.
   ============================================================ */
/* Shared by the real submit handler and by the quota-free preview below, so
   the two cannot drift apart.

   This lives at module scope on purpose. The preview listener is registered
   here, long before the submit listener, and a `const` declared inside that
   submit callback is invisible from out here — which is how the preview used
   to die on a ReferenceError the instant it was clicked, leaving no
   quota-free way to review the scene at all. */
const resetProgress=()=>{
  stopUploadElapsed();
  /* Cancelling here stops the server build at its next stage boundary,
     so abandoning a run no longer leaves it spending quota in the
     background. */
  if(activeJobId) cancelActiveJob();
  journeyHide();
  pdfUploadProgress.hidden=true;
  pdfUploadProgress.removeAttribute('data-stage');
  /* Clear the "already scrolled to the panel" latch, or the next run opens
     with the panel below the fold again. */
  pdfUploadProgress.removeAttribute('data-scrolled-into-view');
  pdfUploadProgress.dataset.indeterminate='false';
  if(pdfProgressBar) pdfProgressBar.style.width='0%';
  if(pdfProgressTrack){
    pdfProgressTrack.setAttribute('aria-label','PDF preparation progress');
    pdfProgressTrack.setAttribute('aria-valuenow','0');
  }
};



/* Runs the real journey through its real stages on a timer, so the
   scene can be reviewed without spending provider quota. It drives the
   same journeySetStage/journeyFinish pair the genuine job poll uses, with
   the real server stage names, so a preview cannot drift from what an
   actual run looks like beat for beat. */
let journeyPreviewTimers=[];
function journeyPreviewStop(){
  journeyPreviewTimers.forEach(clearTimeout);
  journeyPreviewTimers=[];
}
document.getElementById('journeyPreviewButton')?.addEventListener('click',()=>{
  journeyPreviewStop();
  resetProgress();
  pdfUploadProgress.hidden=false;
  /* [delay, server stage, panel stage, percent, message, description]
     The percentages are the ones the real pipeline reports per stage. The
     timed ease is deliberately slow so a long build never races ahead, and
     on its own it would leave the preview mostly empty until the finale
     snapped the trail full - which is not what a real run looks like. */
  const script=[
    [0,    'queued',  'reading',  0,  'Getting your PDF ready','Preparing your document on this device.'],
    [1400, 'extract', 'uploading',18, 'Sending your PDF securely','Transferring your document to XAMCODE AI.'],
    [3200, 'outline', 'analyzing',38, 'XAMCODE AI is at work','Finding the key ideas and shaping them into a complete learning experience.'],
    [7000, 'bank',    'analyzing',62, 'Writing your questions','Building practice questions and flashcards from your notes.'],
    [12000,'validate','building', 88, 'Checking your study space','Making sure every lesson, question and flashcard is sound.']
  ];
  script.forEach(([delay,jobStage,stage,percent,message,description])=>{
    journeyPreviewTimers.push(setTimeout(()=>{
      setUploadStage(stage,message,description);
      journeySetStage(jobStage,message);
      journeySetJobProgress(percent);
      if(jobStage==='validate'){
        /* Validation genuinely takes a moment before the study is accepted,
           so the charge beat is held instead of being overwritten in the
           same tick - otherwise the comet would blaze and settle inside one
           frame and the beat would never be seen at all. */
        journeyPreviewTimers.push(setTimeout(()=>{
          journeyFinish();
          journeyPreviewTimers.push(setTimeout(resetProgress,3600));
        },2600));
      }
    },delay));
  });
});

/* The shooting-star bar: a comet crosses a strip of night sky and the
   glowing trail behind it IS the percentage. The strip is 640px at its
   widest - small enough that a percentage of the width still reads as
   distance travelled. */
const journeyEl=document.getElementById('pdfJourney');
const journeyFill=document.getElementById('journeyFill');
const journeyCaption=document.getElementById('journeyCaption');

/* The seven server stages collapse onto the four beats of the bar. This is
   the only place a stage name turns into a beat. */
const JOURNEY_STAGE_PHASE={
  queued:'idle', extract:'run',
  outline:'run', sections:'run',
  bank:'run', validate:'charge', ready:'finale'
};



/* Order matters: a poll that arrives late or out of sequence must never
   rewind the bar to a beat the pipeline has already left. */
const JOURNEY_STAGE_ORDER=['queued','extract','outline','sections','bank','validate','ready'];

/* State that outlives a single frame. `journeyStage` is the last real
   server stage we were told about; `journeySettled` is the furthest the
   comet has got, kept separately so a late poll reporting a smaller number
   cannot drag the trail backwards. Both are declared here because the reset
   below clears them, and a TDZ throw there would blank the panel. */
let journeyStage=null;
let journeySettled=0;

function journeyReset(){
  if(!journeyEl) return;
  journeyEl.hidden=false;
  /* Defence in depth: the element ships visible and only gets hidden by
     explicit teardown, so a JS error can never leave an invisible bar
     inside a visible panel. */
  journeyEl.removeAttribute('hidden');
  journeyEl.dataset.phase='idle';
  journeyStage=null;
  journeySettled=0;
  journeySetPosition(0);
}

/* The beat the bar is in. A real server stage always wins, because the
   stage is what the pipeline is actually doing; with no stage to go on -
   the upload preview, which runs on a timer before any job exists - the
   beat falls out of the trail so the bar still reads as a sequence. */
function journeyPhaseFor(fraction){
  if(journeyStage) return JOURNEY_STAGE_PHASE[journeyStage]||'run';
  if(fraction<0.05) return 'idle';
  if(fraction<0.9) return 'run';
  return 'charge';
}

/* Real progress. The width of the trail IS the percentage, and the comet
   rides its leading edge, so the two can never disagree. */
function journeySetPosition(fraction){
  if(!journeyEl) return;
  const reported=Math.max(0,Math.min(1,Number(fraction)||0));
  /* Progress never rewinds within a run: an out-of-order poll reporting a
     smaller number must not pull the comet back the way it came. */
  const settled=Math.max(journeySettled,reported);
  journeySettled=settled;
  if(journeyFill) journeyFill.style.width=(settled*100).toFixed(1)+'%';
  if(!journeyStage) journeyEl.dataset.phase=journeyPhaseFor(settled);
}

/* The real pipeline reporting its stage. The stage chooses the beat; the
   percentage only chooses how far along the trail gets. Keeping the two
   separate is what stops a long `validate` from looking like one stage. */
function journeySetStage(stage,label){
  if(!journeyEl||journeyEl.hidden) return;
  const next=JOURNEY_STAGE_ORDER.indexOf(stage);
  if(next<0) return;
  /* Monotonic: a late or reordered poll must not rewind to a beat the
     pipeline has already left. */
  if(next>=JOURNEY_STAGE_ORDER.indexOf(journeyStage)){
    journeyStage=stage;
    journeyEl.dataset.phase=JOURNEY_STAGE_PHASE[stage]||'run';
  }
  if(journeyCaption&&label) journeyCaption.textContent=label;
}

/* The study validated, so the comet makes the full crossing and blazes at
   the finish. This is the only path to the finale: the bar cannot arrive
   there on a timer, which is what keeps the beat honest. */
function journeyFinish(){
  if(!journeyEl) return;
  journeyStop();
  journeyStage='ready';
  journeyEl.dataset.phase='finale';
  journeySetPosition(1);
}

/* Drives the flight from real progress where we have it, and from elapsed
   time where we do not. Cancelled on success, failure or cancellation. */
let journeyRaf=null,journeyStart=null,journeyCeiling=0,journeyForce=false;
function journeyDrive(){
  if(!journeyEl||journeyEl.hidden) return;
  /* journeyStart is null until the first drive. It must be compared
     against null rather than tested for falsiness: performance.now() can
     legitimately be 0, and a falsy check would re-baseline the clock on
     every stage change, resetting the ease instead of continuing it. */
  const elapsed=journeyStart===null?0:(performance.now()-journeyStart)/1000;
  /* Ease-out so the comet covers ground briskly and then settles into the
     rest; it never stalls at an awkward 99%. */
  const target=journeyCeiling*(1-Math.exp(-elapsed/22));
  journeySetPosition(Math.min(target,journeyCeiling));
  journeyRaf=requestAnimationFrame(journeyDrive);
}
function journeyStartDrive(ceiling){
  if(!journeyEl) return;
  /* Only reset the bar on the very first stage. Re-running the reset on a
     later stage would snap the trail back to zero and restart the ease
     every time the pipeline reported its next milestone. */
  if(!journeyForce) journeyReset();
  if(journeyStart===null) journeyStart=performance.now();
  journeyCeiling=Math.max(journeyCeiling,ceiling);
  journeyForce=true;
  journeyDrive();
}
function journeyStop(){
  journeyForce=false;
  if(journeyRaf){ cancelAnimationFrame(journeyRaf); journeyRaf=null; }
}
function journeyHide(){
  journeyStop();
  journeyStart=null;
  journeyCeiling=0;
  /* The next run has to start from an empty trail, and must not inherit
     the last run's beat - otherwise a second PDF would open mid-burst. */
  journeyStage=null;
  journeySettled=0;
  if(journeyEl){
    journeyEl.hidden=true;
    journeyEl.dataset.phase='idle';
  }
}

/* Real, measured progress from the network upload drives the same flight. */
function journeySetReal(fraction){
  if(!journeyEl||journeyEl.hidden||journeyForce) return;
  journeySetPosition(fraction);
}

/* Real server progress takes over from the elapsed-time estimate. Once a
   job is being polled the server knows the true percentage, so the timed
   driver is stopped rather than left to fight it. */
function journeySetJobProgress(percent){
  if(!journeyEl||journeyEl.hidden) return;
  const fraction=Math.max(0,Math.min(0.985,(Number(percent)||0)/100));
  journeyStop();
  journeyForce=false;
  journeyCeiling=fraction;
  journeySetPosition(fraction);
}

const setUploadStage=(stage,message,description)=>{
  if(!pdfUploadProgress) return;
  const activeIndex={reading:0,uploading:1,analyzing:2,building:3}[stage];
  pdfUploadProgress.hidden=false;
  /* The dialog is taller than a typical viewport, so the scene - the whole
     reason this panel exists - opens below the fold and gets clipped by the
     dialog's own edge. Bring it into view the first time the panel appears,
     and only then, so later stage changes do not fight the user's scrolling.

     `end`, not `nearest`: the panel is taller than what is left of the
     dialog once the heading is shown, so `nearest` settles for "a bit is
     visible" and leaves the scene and its caption cut off. `end` aligns the
     bottom of the panel, which shows the bar, the scene and the caption
     together, and scrolls less than the default `start` would. */
  if(!pdfUploadProgress.hasAttribute('data-scrolled-into-view')){
    pdfUploadProgress.setAttribute('data-scrolled-into-view','');
    /* Double rAF, because the dialog may have only just been opened: scrolling
       against a not-yet-settled layout computes the wrong offset and leaves
       the scene clipped exactly as if nothing had scrolled at all. */
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      pdfUploadProgress.scrollIntoView({block:'end'});
    }));
  }
  pdfUploadProgress.dataset.stage=stage;
  pdfUploadProgress.dataset.indeterminate=String(stage==='analyzing');
  const skelByUi={reading:1, uploading:1, analyzing:2, building:3};
  if(typeof updateModularSkeleton==='function') updateModularSkeleton(skelByUi[stage]||1);
  pdfProgressTitle.textContent=message;
  pdfProgressDescription.textContent=description;
  pdfProgressStatus.textContent=stage==='reading'
    ? 'Reading your PDF on this device…'
    : stage==='uploading'
      ? 'Sending your PDF securely to XAMCODE AI…'
    : stage==='analyzing'
      ? 'XAMCODE AI is analyzing your document and preparing your lessons…'
      : 'Your study space is ready. Opening it now…';
  pdfUploadProgress.querySelectorAll('[data-progress-step]').forEach((step,index)=>{
    const state=index<activeIndex?'complete':index===activeIndex?'current':'upcoming';
    step.dataset.state=state;
    if(state==='current') step.setAttribute('aria-current','step');
    else step.removeAttribute('aria-current');
  });
  if(pdfProgressTrack){
    pdfProgressTrack.setAttribute('aria-label',stage==='analyzing'
      ? 'XAMCODE AI is analyzing the PDF; progress is indeterminate'
      : stage==='uploading'
        ? 'PDF network upload progress'
        : message);
    if(stage==='analyzing'){
      pdfProgressTrack.removeAttribute('aria-valuenow');
    }else{
      pdfProgressTrack.setAttribute('aria-valuenow',stage==='building'?'100':'0');
    }
  }
  if(pdfProgressBar) pdfProgressBar.style.width=stage==='building'?'100%':'0%';
  /* Each stage raises the ceiling the comet may reach, so the flight
     always advances when the real pipeline advances and never rewinds. */
  const ceiling={reading:0.24,uploading:0.46,analyzing:0.9,building:0.985}[stage]||0.3;
  if(ceiling>journeyCeiling){
    journeyStartDrive(ceiling);
  }else if(!journeyForce){
    journeyCeiling=ceiling;
  }
  if(journeyCaption) journeyCaption.textContent={
    reading:'Opening your PDF',
    uploading:'Sending it to XAMCODE AI',
    analyzing:'Combing through your document',
    building:'Building your study space'
  }[stage]||'';
};



pdfFileInput?.addEventListener('change',()=>{
  const file=pdfFileInput.files?.[0];
  setSelectedPdf(file);
  const status=document.getElementById('pdfUploadStatus');
  status.textContent=file?validatePdfFile(file):'';
  status.dataset.error=String(Boolean(status.textContent));
  journeyHide();
  if(pdfUploadProgress) pdfUploadProgress.hidden=true;
});
/* ============================================================
   DAILY AI CAPACITY PANEL
   ------------------------------------------------------------
   Google publishes no quota API for free-tier API keys, so this
   shows only what the server has actually observed today: which
   sibling models are still answering, which are spent, and how many
   calls went through. It deliberately does not invent a "requests
   left" figure — a fake countdown would be worse than none.
   ============================================================ */
const pdfQuotaPanel = document.getElementById('pdfQuotaPanel');
const pdfQuotaModels = document.getElementById('pdfQuotaModels');
const pdfQuotaFoot = document.getElementById('pdfQuotaFoot');
const pdfQuotaReset = document.getElementById('pdfQuotaReset');
const pdfAllowanceText = document.getElementById('pdfAllowanceText');

const QUOTA_LABEL = {
  available: 'ready',
  busy: 'busy right now, will retry',
  exhausted: 'spent today',
  unavailable: 'not enabled',
  untested: 'not used yet',
  error: 'error'
};




/* Last snapshot from the server, kept so an error response carrying a
   fresher allowance can update the panel without another request. */
let quotaLast = null;

function renderQuota(data){
  if(!pdfQuotaPanel || !data) return;
  quotaLast = data;
  const usable = data.usableModels;
  const a = data.allowance;

  /* This caller's own daily allowance is the number that decides
     whether THEY can upload, so it leads the panel. */
  pdfQuotaPanel.dataset.state = usable > 0
    ? (usable < data.totalModels ? 'partial' : 'ok')
    : 'empty';

  if(pdfAllowanceText){
    pdfAllowanceText.textContent = (a && !a.unlimited)
      ? `${a.remaining} of ${a.limit} PDF${a.limit === 1 ? '' : 's'} left for you today`
      : 'Unlimited PDF generations';
    pdfAllowanceText.dataset.tone = (a && !a.unlimited && a.remaining === 0) ? 'spent'
      : (a && !a.unlimited && a.remaining <= 1) ? 'low' : 'ok';
  }

  if(pdfQuotaModels){
    pdfQuotaModels.innerHTML = data.models.map(m => {
      const cls = m.status === 'available' ? 'ok'
        : m.status === 'busy' ? 'busy'
          : m.status === 'error' ? 'err'
            : m.status === 'untested' ? 'idle' : 'dead';
      return `<span class="pdf-quota-chip is-${cls}" title="${m.slug} · ${QUOTA_LABEL[m.status] || m.status}">
        <span class="pdf-quota-chip-dot" aria-hidden="true"></span>${m.slug}
      </span>`;
    }).join('');
  }

  if(pdfQuotaReset && (data.resetsAt || data.soonestRecoveryMinutes != null)){
    /* Google reports a real recovery time in its 429 body, which is
       more trustworthy than a midnight guess, so prefer it. */
    if(data.soonestRecoveryMinutes != null){
      pdfQuotaReset.textContent = `next slot in ~${data.soonestRecoveryMinutes} min`;
    }else{
      /* resetsAt is often a human phrase like "midnight Pacific", not an
         ISO timestamp — new Date() on it yields an Invalid Date and the
         old Math.round produced "resets in ~NaNh". Only count hours when
         the value really parses; otherwise show the phrase as written. */
      const at = new Date(data.resetsAt);
      if(Number.isNaN(at.getTime())){
        pdfQuotaReset.textContent = `resets ${data.resetsAt}`;
      }else{
        const hrs = Math.max(0, Math.round((at - Date.now()) / 36e5));
        pdfQuotaReset.textContent = hrs < 1 ? 'resets shortly' : `resets in ~${hrs}h`;
      }
    }
  }

  if(pdfQuotaFoot){
    /* The /api/quota response carries no per-day call counters, so fall
       back to zeros rather than crashing on data.today.calls. A throw here
       used to land in refreshQuota's catch and paint the panel "offline"
       even though the fetch had actually succeeded. */
    const t = data.today || { calls: 0, rotations: 0 };



    const parts = [
      `${usable} of ${data.totalModels} model${data.totalModels === 1 ? '' : 's'} ready`,
      `${t.calls} request${t.calls === 1 ? '' : 's'} today`
    ];
    if(t.rotations) parts.push(`${t.rotations} rotation${t.rotations === 1 ? '' : 's'}`);
    const cap = data.dailyLimitPerModel
      ? `Free limits are ${data.dailyLimitPerModel} generations per model per day and refill on a rolling window, not at midnight.`
      : 'Free limits refill on a rolling window, not at midnight.';
    pdfQuotaFoot.textContent = usable === 0
      ? `All models are out of free quota today. ${parts.join(' · ')}. Add another provider key to keep going.`
      : `${parts.join(' · ')}. ${cap}`;
  }
}

async function refreshQuota(){
  if(!pdfQuotaPanel) return;
  try{
    const res = await fetch('/api/quota', { headers:{ Accept:'application/json' }, cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    renderQuota(await res.json());
    /* A quota answer is proof the server is up, so a leftover
       "XAMCODE AI is not running" banner from an earlier failed probe is
       stale — wipe it rather than leave the red warning contradicting the
       live panel beside it. */
    const status = document.getElementById('pdfUploadStatus');
    if(status && status.dataset.error === 'true'
      && /XAMCODE AI is not running/.test(status.textContent)){
      status.textContent = '';
      status.dataset.error = 'false';
    }
  }catch{
    pdfQuotaPanel.dataset.state = 'offline';
    if(pdfQuotaModels) pdfQuotaModels.innerHTML = '';
    if(pdfQuotaFoot){
      pdfQuotaFoot.textContent = 'Could not read AI capacity from the server. Open the app on http://127.0.0.1:4173 so the API is reachable.';
    }
  }
}

pdfDropzone?.addEventListener('dragover',event=>{
  event.preventDefault();
  pdfDropzone.classList.add('is-dragging');
});
pdfDropzone?.addEventListener('dragleave',event=>{
  if(!pdfDropzone.contains(event.relatedTarget)) pdfDropzone.classList.remove('is-dragging');
});
pdfDropzone?.addEventListener('drop',event=>{
  event.preventDefault();
  pdfDropzone.classList.remove('is-dragging');
  const file=event.dataTransfer?.files?.[0];
  if(!file || !pdfFileInput) return;
  const transfer=new DataTransfer();
  transfer.items.add(file);
  pdfFileInput.files=transfer.files;
  pdfFileInput.dispatchEvent(new Event('change',{bubbles:true}));
});
pdfUploadForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  const fileInput=pdfFileInput;
  const submit=analyzePdfButton;
  const status=document.getElementById('pdfUploadStatus');
  const file=fileInput.files?.[0];
  const setStatus=(message,isError=false)=>{
    status.textContent=message;
    status.dataset.error=String(isError);
  };



  /* resetProgress is declared at module scope above, because the preview
     trigger needs it too. Do not redeclare it here: a `const` inside this
     callback shadows the shared one for the whole submit path, which is the
     exact split that made the preview throw. */
  if(!file){
    setStatus('Choose a PDF before continuing.',true);
    return;
  }
  const fileError=validatePdfFile(file);
  if(fileError){
    setStatus(fileError,true);
    return;
  }
  if(location.protocol==='file:'){
    setStatus('Start the XAMCODE local server, then open http://127.0.0.1:4173 to use AI features.',true);
    return;
  }
  submit.disabled=true;
  pdfUploadForm.setAttribute('aria-busy','true');
  startUploadElapsed();
  setStatus('');
  const submitLabel=submit.querySelector('span');
  submitLabel.textContent='Preparing your PDF…';
  try{
    await verifyXamcodeApi();
    setUploadStage('reading','Getting your PDF ready','Preparing your document on this device.');
    const pdfBase64=await readFileAsBase64(file,percent=>{
      if(pdfProgressBar) pdfProgressBar.style.width=`${percent}%`;
      if(pdfProgressTrack) pdfProgressTrack.setAttribute('aria-valuenow',String(percent));
      pdfProgressStatus.textContent=`Preparing your document… ${percent}%`;
    });
    submitLabel.textContent='Sending your PDF…';
    setUploadStage('uploading','Sending your PDF securely','Transferring the selected document to XAMCODE AI for analysis.');
    const posted=await analyzePdfRequest(
      pdfBase64,
      document.getElementById('studyLevel').value,
      percent=>{
        if(pdfProgressBar) pdfProgressBar.style.width=`${percent}%`;
        if(pdfProgressTrack) pdfProgressTrack.setAttribute('aria-valuenow',String(percent));
        pdfProgressStatus.textContent=`Sending your PDF securely… ${percent}%`;
        /* Measured network progress, so the comet flies the real distance
           rather than a guess while the bytes are still in flight. */
        journeySetReal(0.46*Math.min(1,percent/100));
      },
      ()=>{
        submitLabel.textContent='Creating your study…';
        setUploadStage('analyzing','XAMCODE AI is at work','Finding the key ideas and shaping them into a complete learning experience.');
      }
    );
    /* The upload returns a jobId, not a finished study. Follow the real
       stage events until the server says it is done. */
    activeJobId=posted.jobId;
    const result=await pollAnalyzeJob(posted.jobId,applyJobStage);
    activeJobId=null;
    if(!result?.study){
      throw new Error('The AI response was incomplete. Please try again.');
    }
    const studyError=validateAIStudyForDisplay(result.study);
    if(studyError) throw new Error(studyError);
    setUploadStage('building','Your study space is ready','Your lessons, practice questions, and flashcards are ready to explore.');
    /* The door only opens after the study has actually validated, so the
       walk never ends in a workspace that is not genuinely ready. */
    journeyFinish();
    state.aiStudy=result.study;
    state.aiJobId=posted.jobId;
    state.aiPdfMeta={name:file.name,size:file.size};



    state.aiChunkNote='';
    state.aiTopicImages={};



    state.aiTopicImageBusy={};



    state.aiPage={type:'plan'};



    stopAIVisualAutoplay();
    state.aiLessonMode='crash';
    state.aiVisualStep=0;
    state.aiLessonFlashIdx=0;
    state.aiLessonFlashFlipped=false;
    state.aiExplanationLevel='simple';
    state.aiQuizAnswers={};
    state.answers={};
    state.qStep=0;
    state.qDone=false;



    state.aiFlashIdx=0;
    state.aiFlashFlipped=false;
    state.aiMessages=[];
    state.aiChatBusy=false;
    const uploadedTopics = studyToTopics(result.study, file.name.replace(/\.pdf$/i, ''));
    if (uploadedTopics.length > 0) {
      window.XC.TOPICS = uploadedTopics;
      state.activeCourseTitle = result.study.subject || (result.study.title || file.name.replace(/\.pdf$/i, ''));
      state.activeCourseEyebrow = 'AI GENERATED COURSE • ' + (result.study.subject || 'SYLLABUS').toUpperCase();
      state.view = 'study';
      state.topicIdx = 0;
      state.step = 0;
      state.studyTab = 'visual';
    } else {
      state.view = 'study';
    }
    pdfUploadForm.reset();
    setSelectedPdf(null);
    resetProgress();
    setStatus('');
    document.getElementById('uploadModal').close();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
    /* Persist the finished build: PDF metadata + study JSON, so the
       library survives refresh. Trial clock starts on first save. */
    try{
      if(window.XC?.library) await window.XC.library.saveStudy({
        jobId: posted.jobId, study: result.study,
        images: {}, pdfMeta: { name: file.name, size: file.size }
      });
    }catch(e){ console.warn('Library save failed; study still usable.', e); }
    /* Crash Lesson images should exist without a click: fire the SVG
       stills in the background once the study is on screen. */
    autoGenerateTopicImages();
    /* Chunked builds keep working after the study opens: Units 2..N
       unlock in the background while Unit 1 is already on screen. */
    if(result.study?.chunked&&Array.isArray(result.study.pendingUnits)&&result.study.pendingUnits.length){
      startChunkWatch(posted.jobId);
    }
  }catch(error){
    resetProgress();
    const isTimeout = error.code === 'WATCHDOG_TIMEOUT' || String(error.message).includes('timed out');
    if (isTimeout) {
      xcToast('Document processing timed out. Switching to fast unit extraction or retry.');
      setStatus(`
        <div class="timeout-recovery-card" style="margin-top:14px;padding:14px;border-radius:10px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);text-align:center;">
          <p style="margin:0 0 10px;font-size:0.9rem;color:#fca5a5;font-weight:600;">⚠️ Document processing timed out. Large or multi-page documents may require fast modular extraction.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="btnRetryCoreSummary" style="padding:7px 16px;font-size:0.84rem;cursor:pointer;">⚡ Retry with Core Summary</button>
            <button type="button" class="btn-secondary" id="btnSwitchFastUnit" style="padding:7px 16px;font-size:0.84rem;cursor:pointer;">🔄 Fast Unit Extraction</button>
          </div>
        </div>
      `, true);
      setTimeout(() => {
        const btnRetry = document.getElementById('btnRetryCoreSummary');
        const btnFast = document.getElementById('btnSwitchFastUnit');
        if (btnRetry) btnRetry.onclick = () => {
          const radio2d = document.querySelector('input[name="examDaysMode"][value="2days"]');
          if (radio2d) radio2d.checked = true;
          pdfUploadForm.dispatchEvent(new Event('submit', { cancelable: true }));
        };
        if (btnFast) btnFast.onclick = () => {
          pdfUploadForm.dispatchEvent(new Event('submit', { cancelable: true }));
        };
      }, 50);
    } else {
      setStatus(error.message||'The study could not be generated. Please try again.',true);
    }
  }finally{
    submit.disabled=false;
    submitLabel.textContent='Build my study space';
    pdfUploadForm.removeAttribute('aria-busy');
  }
});

async function handleStudyAuraQuestion(questionText){
  const q = String(questionText || '').trim();
  if(!q) return;
  const c = getTopic(state.topicIdx) || {};
  const tTitle = c.title || 'Active Topic';
  if(!Array.isArray(state.studyAuraMessages) || !state.studyAuraMessages.length){
    state.studyAuraMessages = [{
      role: 'aura',
      text: 'Hi! I am AURA, your grounded study co-pilot for ' + tTitle + '. Ask me to break down the visual assembly, give you a Tamil/English Vaathiyar intuition, or quiz you on failure causality.'
    }];
  }
  state.studyAuraMessages.push({ role: 'user', text: q });
  const cc = c.cheatcode || CHEATCODES[c.id] || {};
  let reply = '';
  if(/cheatcode|30-second|30s/i.test(q)){
    reply = '🎯 30s CheatCode for ' + tTitle + ': ' + (cc.oneLine || c.explanation || '') + ' | Analogy: ' + (cc.like || '') + ' | Watch out for: ' + (cc.wrong || 'skipping boundary checks');
  } else if(/fail|causality|drop/i.test(q)){
    const step0 = (c.steps && c.steps[0]) || {};
    const node0 = (step0.nodes && step0.nodes[0]) || {};
    reply = '⚡ Failure Causality in ' + tTitle + ': ' + (node0.failureImpact || ('If the primary stage (' + (node0.label || tTitle) + ') fails, downstream state transitions stall and boundary assertions fail.')) + ' Always verify: ' + (cc.right || (c.keyPoints && c.keyPoints[0]) || '');
  } else {
    reply = '👨‍🏫 Vaathiyar Breakdown (' + tTitle + '): ' + (c.explanation || '') + (cc.like ? ' Think of it like: ' + cc.like + '.' : '') + (c.pdfQuote ? ' Grounded Excerpt: "' + c.pdfQuote + '" (' + (c.pdfPage || 'Document') + ').' : '');
  }
  state.studyAuraMessages.push({ role: 'aura', text: reply });
  render();
}

document.addEventListener('submit',async event=>{
  if(event.target && event.target.id==='studyAuraForm'){
    event.preventDefault();
    const inp = event.target.querySelector('[name="auraQuestion"]');
    const q = inp ? inp.value.trim() : '';
    if(!q) return;
    inp.value = '';
    await handleStudyAuraQuestion(q);
    return;
  }
  if(event.target.id!=='aiChatForm') return;
  event.preventDefault();
  if(state.aiChatBusy || !state.aiStudy) return;
  const form=event.target;
  const question=new FormData(form).get('question')?.toString().trim();
  if(!question) return;
  state.aiMessages.push({role:'user',text:question});
  state.aiChatBusy=true;
  render();
  try{
    const context={
      title:state.aiStudy.title,
      subject:state.aiStudy.subject,
      summary:state.aiStudy.summary,
      concepts:state.aiStudy.concepts,
      formulas:state.aiStudy.formulas,
      conversation:state.aiMessages.slice(-8)
    };



    /* Ask for a structured answer that carries a diagram recipe, so the
       ai-study chat panel can render a real chart beside the explanation when
       the topic fits. Falls back to the same plain text path either way. */
    const response=await fetch('/api/ask',{
      method:'POST',
      headers:{'Content-Type':'application/json'},      body:JSON.stringify({question,context,structured:true, // accept the chart-bearing answer shape from server.js handleAsk
      contextTitle: state.aiStudy && state.aiStudy.title ? state.aiStudy.title : '',
      contextSummary: state.aiStudy && state.aiStudy.summary ? state.aiStudy.summary.slice(0,120) : '',
      contextConcepts: state.aiStudy && state.aiStudy.concepts ? state.aiStudy.concepts.map(c=>({title:c.title, summary:c.summary})).slice(0,6) : []})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok) throw new Error(result?.error||'XAMCODE AI could not answer. Please try again.');
    if(typeof result?.answer!=='string'||!result.answer.trim()){
      throw new Error('XAMCODE AI returned an empty answer. Please try again.');
    }
    state.aiMessages.push({
      role:'assistant',
      text:result.answer,
      diagram:result.diagram||null,
      visual_type:result.visual_type||null,
      params:result.params&&typeof result.params==='object'?result.params:{},
      svg_instruction:result.svg_instruction||''
    });
  }catch(error){
    state.aiMessages.push({role:'assistant',text:error.message||'XAMCODE AI could not answer. Please try again.'});
  }finally{
    state.aiChatBusy=false;
    render();
    document.getElementById('aiChatForm')?.elements.question.focus();
  }
});

/* ============================================================
   KEYBOARD
   ============================================================ */
document.addEventListener('keydown',(e)=>{
  const intro = document.getElementById('videoIntro');
  if(intro && !intro.classList.contains('hidden')) return;
  if(e.key==='Escape'){
    const menu=document.getElementById('mobileNav');
    const toggle=document.querySelector('[data-mobile-menu]');
    if(menu?.classList.contains('open')){
      menu.classList.remove('open');
      toggle?.setAttribute('aria-expanded','false');
      toggle?.setAttribute('aria-label','Open navigation');
    }
  }
  const active = document.activeElement;
  if(/INPUT|TEXTAREA|SELECT/.test(active?.tagName||'') || active?.isContentEditable) return;
  if(e.key==='d'||e.key==='D'){
    const cur = document.body.getAttribute('data-mode') || 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    applyTheme(document.body.getAttribute('data-theme') || 'bubblegum', next);
  }
  if((e.key==='f'||e.key==='F') && state.view==='study') state.fcOpen?closeFC():openFC();
  if(e.key===' ' && state.view==='study'){ e.preventDefault(); state.playing=!state.playing; refreshPlayBtn(); state.playing?startAutoPlay():stopAutoPlay(); }
  if(state.fcOpen){
    if(e.key==='Escape') closeFC();
    if(e.key==='ArrowRight'){e.preventDefault();state.fcIdx=(state.fcIdx+1)%state.fcDeck.length;renderFC();}
    if(e.key==='ArrowLeft'){state.fcIdx=(state.fcIdx-1+state.fcDeck.length)%state.fcDeck.length;renderFC();}
    if(e.key==='Enter') fcCard.classList.toggle('flipped');
  }
});

/* ============================================================
   PARALLAX
   ============================================================ */
const M = {tx:0, ty:0, x:0, y:0};



document.querySelectorAll('.wash').forEach((el,i)=>{ el.dataset.parallax = 14*(i+1); });
const pEls = Array.from(document.querySelectorAll('[data-parallax]'));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let parallaxFrame = null;
function animateParallax(){
  M.x += (M.tx - M.x) * 0.09;
  M.y += (M.ty - M.y) * 0.09;
  for (let i=0; i<pEls.length; i++){
    const el = pEls[i];
    const r = +el.dataset.parallax || 10;
    el.style.transform = `translate3d(${(M.x*r).toFixed(2)}px, ${(M.y*r).toFixed(2)}px, 0)`;
  }
  if(Math.abs(M.tx-M.x)>.005 || Math.abs(M.ty-M.y)>.005){
    parallaxFrame = requestAnimationFrame(animateParallax);
  }else{
    parallaxFrame = null;
  }
}
window.addEventListener('mousemove',(e)=>{
  if(reducedMotion.matches || !window.matchMedia('(pointer: fine)').matches) return;
  M.tx = (e.clientX / window.innerWidth  - .5) * 2;
  M.ty = (e.clientY / window.innerHeight - .5) * 2;
  if(parallaxFrame===null) parallaxFrame = requestAnimationFrame(animateParallax);
},{passive:true});

/* Pointer tilt for the landing hero sample-course panel. `.preview` is
   rendered only by landingView, so this tilt is landing-only by
   construction. Every study/workspace surface is non-tilting; see the
   TILT list in js/genz.js. */
let currentPreview = null;
document.addEventListener('mousemove',(e)=>{
  if(reducedMotion.matches || !window.matchMedia('(pointer: fine)').matches){
    if(currentPreview) currentPreview.style.transform='';
    currentPreview=null;
    return;
  }
  const p = e.target && e.target.closest && e.target.closest('.preview');
  if (p !== currentPreview){
    if (currentPreview) currentPreview.style.transform = '';
    currentPreview = p;
  }
  if (p){
    const r = p.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2)  / (r.width/2);
    const dy = (e.clientY - r.top  - r.height/2) / (r.height/2);
    p.style.transform = `perspective(1200px) rotateY(${(dx*8).toFixed(2)}deg) rotateX(${(-dy*8).toFixed(2)}deg)`;
  }
},{passive:true});

/* ============================================================
   BOOT LOADER (§07) — branded loading experience
   Finite rotating messages (never a loop), hard time cap, and a
   hand-off event the intro film waits on.
   ============================================================ */
(function(){
  const loader = document.getElementById('bootLoader');
  if(!loader) return;
  const msg = document.getElementById('bootMessage');
  const MESSAGES = [
    'Warming up the engine…',
    'Charging creativity…',
    'Connecting the dots…',
    'Polishing pixels…',
    'Almost there…'
  ];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let i = -1, rot = null;

  if(!reduce){
    rot = setInterval(()=>{
      i += 1;
      if(msg && i < MESSAGES.length) msg.textContent = MESSAGES[i];
      if(i >= MESSAGES.length - 1){ clearInterval(rot); rot = null; }
    }, 520);
  }

  /* Hold the intro film while the loader is up — the video's autoplay
     attribute would otherwise eat the opening of the cut. Versioned key
     so a footage swap replays for returning visitors. */
  if(!sessionStorage.getItem('xc-intro-seen-v1') && !sessionStorage.getItem('xc-intro-seen-v2') && !sessionStorage.getItem('xc-intro-seen-v3') && !sessionStorage.getItem('xc-intro-seen-v4') && !sessionStorage.getItem('xc-intro-seen-v5')){
    const v = document.getElementById('introVideo');
    if(v){ try{ v.pause(); }catch(err){} }
  }

  let finished = false;
  function finish(){
    if(finished) return;
    finished = true;
    if(rot){ clearInterval(rot); rot = null; }
    const wait = Math.max(0, 1150 - (performance.now() - t0));
    setTimeout(()=>{
      if(msg) msg.textContent = 'Ready.';
      loader.classList.add('bl-out');
      document.body.classList.add('booted');
      document.dispatchEvent(new CustomEvent('xc-boot-done'));
      setTimeout(()=>{ loader.remove(); }, 650);
    }, wait);
  }

  if(document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, {once:true});
  setTimeout(finish, 4500); // hard cap — never trap the user
})();

/* ============================================================
   VIDEO INTRO CONTROLLER (v4 cinematic brand overlay)
   ------------------------------------------------------------
   Generic XamCode AI branding layered over swappable footage:
   - window.XC_INTRO_* overrides let you re-target the overlay without
     touching markup (exam title/code/context when you pick one later):
       XC_INTRO_SRC, XC_INTRO_VERSION, XC_INTRO_EYEBROW,
       XC_INTRO_TITLE_HTML, XC_INTRO_SUB, XC_INTRO_BEATS (array of 4)
     (?intro= URL / localStorage xc-intro-* equivalents all work.)
   - Bump version so returning visitors see the NEW cut.
   - ?intro=skip disables the film (useful while editing the site).
   ============================================================ */
(function(){
  const intro = document.getElementById('videoIntro');
  const skip = document.getElementById('skipIntro');
  const video = document.getElementById('introVideo');
  const sound = document.getElementById('introSound');
  const status = document.getElementById('introVideoStatus');
  const bar = document.getElementById('introProgress');
  const brand = intro?.querySelector('.vi-brand');
  if(!intro || !video) return;
  /* --- overlay text overrides (exam-code seam) --- */
  try{
    const params0 = new URLSearchParams(location.search || '');
    const pick = (winKey, param, store) =>
      window[winKey] ?? params0.get(param) ?? localStorage.getItem(store);
    const eyebrow = pick('XC_INTRO_EYEBROW', 'intro-eyebrow', 'xc-intro-eyebrow');
    const titleHtml = pick('XC_INTRO_TITLE_HTML', 'intro-title', 'xc-intro-title');
    const sub = pick('XC_INTRO_SUB', 'intro-sub', 'xc-intro-sub');
    let beats = window.XC_INTRO_BEATS ?? null;
    if(!beats){
      const raw = params0.get('intro-beats') || localStorage.getItem('xc-intro-beats');
      if(raw){ try{ beats = JSON.parse(raw); }catch{ beats = raw.split('|'); } }
    }
    if(eyebrow && brand?.querySelector('.vi-eyebrow'))
      brand.querySelector('.vi-eyebrow').innerHTML =
        '<span class="vi-eyebrow-dot"></span>' + String(eyebrow);
    if(titleHtml && brand?.querySelector('.vi-brand-title'))
      brand.querySelector('.vi-brand-title').innerHTML = String(titleHtml);
    if(sub && brand?.querySelector('.vi-brand-sub'))
      brand.querySelector('.vi-brand-sub').textContent = String(sub);
    if(Array.isArray(beats) && brand){
      const items = brand.querySelectorAll('.vi-beats li');
      beats.slice(0, items.length).forEach((b, i)=>{ items[i].textContent = String(b); });
    }
  }catch{}
  const INTRO_VERSION = window.XC_INTRO_VERSION ||
    localStorage.getItem('xc-intro-version') || 'v5';
  const params = new URLSearchParams(location.search || '');
  const customSrc = window.XC_INTRO_SRC || params.get('intro-src') ||
    localStorage.getItem('xc-intro-src');
  if(customSrc && !/^javascript:/i.test(customSrc)){
    let srcEl = video.querySelector('source');
    if(!srcEl){ srcEl = document.createElement('source'); video.appendChild(srcEl); }
    srcEl.src = customSrc; video.load();
  }
  const seenKey = 'xc-intro-seen-' + INTRO_VERSION;

  const alreadySeen = sessionStorage.getItem(seenKey) || (params.get('intro')==='skip');
  if(alreadySeen || params.get('intro')==='skip'){
    intro.classList.add('hidden');
    setTimeout(()=>intro.remove(), 700);
    return;
  }
  document.body.classList.add('intro-active');

  let dismissed = false;
  let started = false;
  let timer = null;
  const finishIntro = () => {
    if(dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    video.pause();
    intro.classList.add('entering-home');
    sessionStorage.setItem(seenKey, '1');
    try{ sessionStorage.removeItem('xc-intro-seen'); }catch{}
    if(intro.contains(document.activeElement)){
      document.querySelector('.header [data-nav="landing"]')?.focus();
    }
    setTimeout(()=>{
      intro.remove();
      document.body.classList.remove('intro-active');
    }, 950);
  };




  video.addEventListener('ended', finishIntro);
  video.addEventListener('error', ()=>{
    status.textContent = 'The intro video could not be loaded. You can still continue to XamCode.';
    video.controls = true;
  });
  video.addEventListener('timeupdate', ()=>{
    /* End the film shortly before the actual runtime ends so a slow
       'ended' event can't hold the user on a frozen last frame. Uses the
       real duration when known (your footage is ~6.4 s), not the old 8 s.
       Also drives the progress bar + sequential beat highlights. */
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6.4;
    const endAt = Math.max(0, dur - 0.25);
    if(bar) bar.style.width = Math.min(100, (video.currentTime / dur) * 100) + '%';
    const beats = brand?.querySelectorAll('.vi-beats li');
    if(beats?.length){
      const lit = Math.min(beats.length, Math.floor((video.currentTime / dur) * (beats.length + 1)));
      beats.forEach((el, i)=>el.classList.toggle('lit', i < lit));
    }
    if(video.currentTime >= endAt) finishIntro();
  });

  /* §07 — hold the film until the boot loader hands over, so the
     opening beats of the cut are never hidden behind the loader. */
  const begin = () => {
    if(started || dismissed) return;
    started = true;
    timer = setTimeout(finishIntro, 10000);
    sound?.focus({preventScroll:true});
    video.play().catch(()=>{
      video.controls = true;
      status.textContent = 'Press play to watch the intro, or skip to continue.';
    });
  };



  if(document.body.classList.contains('booted')) begin();
  else document.addEventListener('xc-boot-done', begin, {once:true});

  sound?.addEventListener('click', ()=>{
    video.muted = !video.muted;
    sound.setAttribute('aria-pressed', String(!video.muted));
    sound.textContent = video.muted ? 'Enable sound' : 'Mute sound';
    if(!video.muted){
      /* If sound gets enabled after the point where the audio was already
         fading out, replay from the top so the full mix is heard, and drop
         the auto-dismiss watchdog so the replay is never cut short. */
      clearTimeout(timer);
      if(video.currentTime > 1) video.currentTime = 0;
    }
    if(!video.paused) return;
    video.play().catch(()=>{
      status.textContent = 'Playback did not start. Use the video play control or skip to continue.';
    });
  });
  skip?.addEventListener('click', finishIntro);

  intro.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      finishIntro();
      return;
    }
    if(e.key!=='Tab') return;
    const first = sound;
    const last = skip;
    if(e.shiftKey && document.activeElement===first){
      e.preventDefault();
      last?.focus();
    }else if(!e.shiftKey && document.activeElement===last){
      e.preventDefault();
      first?.focus();
    }
  });

})();

/* ============================================================
   THEME CONTROLLER — delegated so it survives every render
   ============================================================ */
(function(){
  /* Bumped to v2 when the four theme worlds were replaced (cyber / y2k /
     lofi no longer exist). The version check alone only resets the DEFAULT,
     so the saved id is also validated against the live theme list — a
     browser that stored "lofi" under the old version would otherwise land
     on a body[data-theme="lofi"] with no matching CSS and render unstyled. */
  const THEME_IDS=['bil','digital','cosmic','bubblegum','organic'];
  const DEFAULT_THEME='bil';
  const themeVersion='bil-replica-v1';
  applyTheme('bil', 'dark');
  localStorage.setItem('xc-theme-version',themeVersion);
  localStorage.setItem('xc-theme','bil');
  localStorage.setItem('xc-mode','dark');

  document.addEventListener('click', function(e){
    if(e.target.closest('#themeOpen')){
      e.preventDefault();
      e.stopPropagation();
      var modal = document.getElementById('themeModal');
      if(modal){
        modal.classList.add('open');
        document.getElementById('themeClose')?.focus();
      }
      return;
    }
    if(e.target.closest('#themeClose')){
      e.preventDefault();
      document.getElementById('themeModal')?.classList.remove('open');
      document.getElementById('themeOpen')?.focus();
      return;
    }
    var modal = document.getElementById('themeModal');
    if(modal && e.target === modal){
      modal.classList.remove('open');
      document.getElementById('themeOpen')?.focus();
      return;
    }
    var card = e.target.closest('[data-set-theme]');
    if(card){
      e.preventDefault();
      applyTheme(card.dataset.setTheme, document.body.getAttribute('data-mode') || 'dark');
      return;
    }
    var modeBtn = e.target.closest('[data-set-mode]');
    if(modeBtn){
      e.preventDefault();
      applyTheme(document.body.getAttribute('data-theme') || 'bubblegum', modeBtn.dataset.setMode);
    }
  }, true);

  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      var modal = document.getElementById('themeModal');
      if(modal && modal.classList.contains('open')){
        modal.classList.remove('open');
        document.getElementById('themeOpen')?.focus();
      }
    }
  });
})();

/* ============================================================
   BOOT
   ============================================================ */
render();



  if (typeof window !== 'undefined') {
    window.XC = window.XC || {};
    window.XC.studyToTopics = studyToTopics;
    window.XC.studyView = studyView;
    window.XC.aiDiagramSvg = aiDiagramSvg;
    window.XC.renderAssemblyExplorer = renderAssemblyExplorer;
    window.XC.quizResults = quizResults;
    window.XC.state = state;
    window.XC.render = render;
    window.XC.getTopic = getTopic;
    window.XC.getTopics = getTopics;
  }

})();
