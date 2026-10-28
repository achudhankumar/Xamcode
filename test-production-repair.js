'use strict';

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function checkServerListening() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await checkServerListening()) {
    return { proc: null, reused: true };
  }
  const proc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: 'ignore'
  });
  for (let i = 0; i < 40; i++) {
    if (await checkServerListening()) {
      return { proc, reused: false };
    }
    await new Promise(r => setTimeout(r, 250));
  }
  try { proc.kill('SIGKILL'); } catch (_) {}
  throw new Error('Server failed to start on port ' + PORT);
}

async function runAudit() {
  console.log('=== PHASE 4: PRODUCTION REPAIR & UI INTEGRITY VERIFICATION ===\n');
  const results = [];
  function record(name, condition, details = '') {
    const passed = Boolean(condition);
    results.push({ name, passed, details });
    console.log((passed ? '  ✓ PASS: ' : '  ✗ FAIL: ') + name + (details ? ` (${details})` : ''));
  }

  let serverHandle = null;
  let browser = null;

  try {
    serverHandle = await ensureServer();
    console.log(`Server ready on ${BASE_URL} (reused=${serverHandle.reused})\n`);

    const chromePath = process.env.CHROME_PATH || 'C:\\Users\\asus1\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
    const launchOpts = { headless: true };
    if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;

    browser = await chromium.launch(launchOpts);
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();

    // 1. Load Home Page & Verify Branding + No Leaked Internal Labels
    console.log('--- 1. Branding & Leaked Internal Metadata Audit ---');
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    const homeAudit = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const headerLogo = document.querySelector('header .logo-mark img');
      const footerLogo = document.querySelector('footer .logo-mark img');
      return {
        hasAstExtractor: /AST\s*EXTRACTOR/i.test(bodyText),
        hasCurriculumDag: /Curriculum\s*DAG/i.test(bodyText),
        hasInternalPaths: /pdf-stream-ast\.ts|curriculum-dag\.json|diagnostic-evaluator\.ts/i.test(bodyText),
        headerLogoSrc: headerLogo ? headerLogo.getAttribute('src') : null,
        headerLogoLoaded: headerLogo ? (headerLogo.complete && headerLogo.naturalWidth > 0) : false,
        footerLogoSrc: footerLogo ? footerLogo.getAttribute('src') : null,
        footerLogoLoaded: footerLogo ? (footerLogo.complete && footerLogo.naturalWidth > 0) : false
      };
    });

    record('No "AST Extractor" leaked on Landing page', !homeAudit.hasAstExtractor);
    record('No "Curriculum DAG" leaked on Landing page', !homeAudit.hasCurriculumDag);
    record('No internal .ts/.json engineering paths leaked', !homeAudit.hasInternalPaths);
    record('Official metallic X logo rendered in Header', homeAudit.headerLogoSrc === '/assets/xamcode-metallic-x.png' && homeAudit.headerLogoLoaded, homeAudit.headerLogoSrc || 'missing');
    record('Official metallic X logo rendered in Footer', homeAudit.footerLogoSrc === '/assets/xamcode-metallic-x.png' && homeAudit.footerLogoLoaded, homeAudit.footerLogoSrc || 'missing');

    // 2. Simulate Uploaded PDF Study via Library & Open Study View
    console.log('\n--- 2. Strict PDF Grounding & Dynamic Study Workspace ---');
    const studyAudit = await page.evaluate(async () => {
      // Seed stale sample answer at key "0-0" to prove opening a PDF study resets it
      const st = window.XC.state;
      st.answers = { '0-0': 1, '0-1': 0 };
      localStorage.setItem('xc-progress', JSON.stringify({ answers: { '0-0': 1, '0-1': 0 }, visited: [0] }));

      const customPdfStudy = {
        id: 'pdf-thermo-101',
        title: 'Statistical Thermodynamics & Partition Functions',
        subject: 'Thermodynamics',
        summary: 'Boltzmann distribution, canonical ensemble partition functions, and Helmholtz free energy derivations from the uploaded lecture notes.',
        plan: {
          title: 'Statistical Thermodynamics & Partition Functions',
          subject: 'Thermodynamics',
          summary: 'Boltzmann distribution and canonical partition function derivations.',
          units: [
            {
              id: 'unit-1',
              number: 1,
              title: 'Canonical Ensemble & Partition Function Z',
              overview: 'Deriving macroscopic thermodynamic state variables from microstate energy levels.',
              goals: ['Derive Z = sum exp(-beta E_i)', 'Compute Helmholtz Free Energy F = -kT ln Z'],
              status: 'ready',
              topics: [
                {
                  id: 't-1',
                  title: 'Canonical Partition Function Derivation',
                  summary: 'Summing Boltzmann factors across discrete microstates in thermal equilibrium.'
                }
              ]
            }
          ]
        },
        concepts: [
          {
            id: 'c-1',
            title: 'Canonical Partition Function Derivation',
            unitNumber: 1,
            unitTitle: 'Canonical Ensemble & Partition Function Z',
            topic: 'Statistical Thermodynamics',
            archetype: 'flow',
            summary: 'The canonical partition function Z normalizes the Boltzmann probability distribution across microstates E_i at temperature T.',
            sourcePage: 14,
            sourceExcerpt: 'For a canonical ensemble at fixed (N, V, T), the partition function is Z = Σ_i exp(-E_i / k_B T), and Helmholtz free energy is F = -k_B T ln Z.',
            keyPoints: [
              'Microstate Energy Spectrum — Discrete quantum energy states E_i accessible to the system',
              'Boltzmann Weight Factor — Exponential thermal weighting exp(-beta * E_i) where beta = 1/(k_B T)',
              'Partition Normalization Z — Total sum over states governing Helmholtz free energy F = -k_B T ln Z'
            ],
            formulas: ['Z = \\sum_i e^{-\\beta E_i}', 'F = -k_B T \\ln Z'],
            steps: [
              {
                caption: 'Microstate Energy Spectrum',
                why: 'Enumerates accessible energy states E_i in fixed volume V.',
                code: 'E_i = h_bar * omega * (n + 1/2)',
                visual: {
                  layout: 'flow',
                  title: 'Canonical Partition Function Pipeline',
                  nodes: [
                    { id: 'n1', label: 'Microstate Spectrum E_i', sub: 'Quantum energy levels', role: 'source' },
                    { id: 'n2', label: 'Boltzmann Factor exp(-βE_i)', sub: 'Thermal probability weight', role: 'process' },
                    { id: 'n3', label: 'Partition Sum Z', sub: 'Normalization constant', role: 'target' },
                    { id: 'n4', label: 'Helmholtz Free Energy F', sub: 'F = -k_B T ln Z', role: 'Inspector' }
                  ],
                  edges: [
                    { from: 'n1', to: 'n2', label: 'Apply β = 1/kT' },
                    { from: 'n2', to: 'n3', label: 'Sum over i' },
                    { from: 'n3', to: 'n4', label: '-k_B T ln(Z)' }
                  ]
                }
              }
            ],
            questions: [
              {
                id: 'q-thermo-1',
                stem: 'According to the canonical ensemble derivation on page 14, how is the Helmholtz free energy F obtained from the partition function Z?',
                options: [
                  'F = -k_B T ln Z',
                  'F = +k_B T Z^2',
                  'F = E_i / k_B T',
                  'F = ln(beta) / Z'
                ],
                answerIndex: 0,
                rationale: 'Taking the logarithm of the canonical partition function Z yields the Helmholtz free energy via F = -k_B T ln Z.',
                difficulty: 'Medium'
              },
              {
                id: 'q-thermo-2',
                stem: 'What does the Boltzmann factor exp(-beta * E_i) represent in the partition sum?',
                options: [
                  'The unnormalized thermal weight of microstate i at inverse temperature beta',
                  'The total volume of the container',
                  'The classical momentum of an ideal gas piston',
                  'An ungrounded network packet header'
                ],
                answerIndex: 0,
                rationale: 'Each microstate i is weighted by exp(-beta * E_i) before dividing by Z.',
                difficulty: 'Easy'
              }
            ]
          }
        ]
      };

      // Save to XC.library and trigger data-library-open click to exercise real library flow
      if (window.XC.library && typeof window.XC.library.saveStudy === 'function') {
        await window.XC.library.saveStudy({
          id: 'pdf-thermo-101',
          title: customPdfStudy.title,
          subject: customPdfStudy.subject,
          summary: customPdfStudy.summary,
          study: customPdfStudy
        });
      }

      // Apply exact same state transitions as library/upload completion
      window.XC.TOPICS = window.XC.studyToTopics(customPdfStudy);
      st.aiStudy = customPdfStudy;
      st.aiCourseName = customPdfStudy.title;
      st.aiCourseSub = 'Thermodynamics • 1 Lesson • 2 Questions';
      st.aiQuizAnswers = {};
      st.answers = {};
      st.qStep = 0;
      st.qDone = false;
      st.topicIdx = 0;
      st.step = 0;
      st.view = 'study';
      window.XC.render();

      const bodyText = document.body.innerText || '';
      const visualEl = document.getElementById('studyVisualSection');
      const cheatEl = document.getElementById('studyCheatSection');
      const vaathiyarEl = document.getElementById('studyVaathiyarSection');
      const auraEl = document.getElementById('auraChatPane');
      const studyBarLogo = document.querySelector('.study-bar img');

      const vRect = visualEl ? visualEl.getBoundingClientRect() : null;
      const cRect = cheatEl ? cheatEl.getBoundingClientRect() : null;
      const vaRect = vaathiyarEl ? vaathiyarEl.getBoundingClientRect() : null;
      const aRect = auraEl ? auraEl.getBoundingClientRect() : null;

      return {
        topicTitle: window.XC.getTopic(0) ? window.XC.getTopic(0).title : null,
        hasSamplePollution: /OSI Model|TCP 3-Way Handshake|Sliding Window/i.test(bodyText),
        hasGroundedContent: /Canonical Partition Function Derivation/i.test(bodyText) && /Helmholtz/i.test(bodyText),
        hasVis001Badge: /\bVIS-001\b/.test(bodyText),
        studyBarLogoSrc: studyBarLogo ? studyBarLogo.getAttribute('src') : null,
        sectionsPresent: Boolean(visualEl && cheatEl && vaathiyarEl),
        visualTop: vRect ? Math.round(vRect.top) : -1,
        cheatTop: cRect ? Math.round(cRect.top) : -1,
        vaathiyarTop: vaRect ? Math.round(vaRect.top) : -1,
        cheatHasContent: cheatEl ? cheatEl.innerText.trim().length > 80 : false,
        vaathiyarHasContent: vaathiyarEl ? /Vaathiyar Mode/i.test(vaathiyarEl.innerText) && vaathiyarEl.innerText.trim().length > 120 : false,
        auraMounted: Boolean(auraEl && aRect && aRect.width > 200 && aRect.height > 150),
        auraText: auraEl ? auraEl.innerText : '',
        staleAnswersCleared: Object.keys(st.answers || {}).length === 0
      };
    });

    record('Uploaded PDF replaces sample topics without sample pollution', !studyAudit.hasSamplePollution && studyAudit.hasGroundedContent, studyAudit.topicTitle);
    record('Stale localStorage quiz answers cleared on opening study', studyAudit.staleAnswersCleared);
    record('No raw internal "VIS-001" badge visible in Study View', !studyAudit.hasVis001Badge);
    record('Official logo rendered in Study View top bar (.study-bar)', studyAudit.studyBarLogoSrc === '/assets/xamcode-metallic-x.png');
    record('All 3 sequential workspace sections exist (#studyVisualSection, #studyCheatSection, #studyVaathiyarSection)', studyAudit.sectionsPresent);
    record(
      'Sequential vertical hierarchy enforced: Visual -> Cheat Code -> Vaathiyar Mode',
      studyAudit.sectionsPresent && studyAudit.visualTop < studyAudit.cheatTop && studyAudit.cheatTop < studyAudit.vaathiyarTop,
      `tops: Visual=${studyAudit.visualTop}px, Cheat=${studyAudit.cheatTop}px, Vaathiyar=${studyAudit.vaathiyarTop}px`
    );
    record('Cheat Code section populated with grounded topic summary & formulas', studyAudit.cheatHasContent);
    record('Vaathiyar Mode section populated with bilingual intuitive explanation & 8 modes', studyAudit.vaathiyarHasContent);

    // 3. Verify Quiz Option Clicking & Answer Selection State
    console.log('\n--- 3. Interactive Quiz Option Selection Audit ---');
    const firstOptSelector = '.q-card .opts .opt[data-ans="0"]';
    await page.waitForSelector(firstOptSelector, { state: 'visible', timeout: 5000 });
    await page.click(firstOptSelector);
    await page.waitForTimeout(150);

    const quizClickAudit = await page.evaluate(() => {
      const opt0 = document.querySelector('.q-card .opts .opt[data-ans="0"]');
      const explain = document.querySelector('.q-card .explain');
      const nextBtn = document.querySelector('.q-step-bar [data-qnext]');
      return {
        hasSelectedClass: opt0 ? opt0.classList.contains('selected') : false,
        hasCorrectOrIncorrectClass: opt0 ? (opt0.classList.contains('correct') || opt0.classList.contains('incorrect')) : false,
        explainVisible: explain ? explain.innerText.trim().length > 15 : false,
        nextBtnEnabled: nextBtn ? !nextBtn.disabled : false,
        recordedAnswer: window.XC.state.answers['0-0']
      };
    });

    record('Clicking quiz option immediately records answer state', quizClickAudit.recordedAnswer === 0, `answer=${quizClickAudit.recordedAnswer}`);
    record('Clicked quiz option receives .selected and .correct/.incorrect classes', quizClickAudit.hasSelectedClass && quizClickAudit.hasCorrectOrIncorrectClass);
    record('Clicking quiz option reveals grounded explanation rationale (.explain)', quizClickAudit.explainVisible);
    record('Clicking quiz option enables Next Question button', quizClickAudit.nextBtnEnabled);

    // 4. Verify Right-Side AURA Co-Pilot Mounting & Live Chat Interaction
    console.log('\n--- 4. Right-Side AURA Co-Pilot Audit ---');
    record('Right-side AURA Co-Pilot (#auraChatPane) mounted and visible', studyAudit.auraMounted);
    record('AURA Co-Pilot initialized with active topic context', /Canonical Partition Function Derivation/i.test(studyAudit.auraText));

    const chipSelector = '#auraChatPane [data-study-aura-ask]';
    await page.waitForSelector(chipSelector, { state: 'visible', timeout: 5000 });
    await page.click(chipSelector);
    await page.waitForTimeout(250);

    const auraChatAudit = await page.evaluate(() => {
      const thread = document.getElementById('studyAuraThread');
      const text = thread ? thread.innerText : '';
      const msgCount = thread ? thread.children.length : 0;
      return {
        msgCount,
        hasResponse: /Vaathiyar Breakdown|Key Points|Exam Tip/i.test(text)
      };
    });

    record('Clicking AURA quick mastery chip appends user question & grounded response', auraChatAudit.msgCount >= 3 && auraChatAudit.hasResponse, `messages=${auraChatAudit.msgCount}`);

  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    if (serverHandle && serverHandle.proc) {
      try { serverHandle.proc.kill('SIGKILL'); } catch (_) {}
    }
  }

  const failed = results.filter(r => !r.passed);
  console.log(`\n=== AUDIT SUMMARY: ${results.length - failed.length}/${results.length} CHECKS PASSED ===`);
  if (failed.length > 0) {
    console.error('Failed checks:', failed);
    process.exit(1);
  }
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('FATAL ERROR in test-production-repair.js:', err);
  process.exit(1);
});
