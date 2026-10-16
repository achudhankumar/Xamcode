'use strict';
/* ============================================================
   RENDER TESTS for the /build dashboard (build.html inline script).
   ----------------------------------------------------------------
   Loads the REAL inline <script> from build.html and runs it against:
     * a faithful DOM stub where getElementById() returns **null** for any
       id not present in the HTML — exactly like a real browser — so a
       missing-element dereference reproduces as a crash, and
     * a stubbed fetch() returning canned /api/bip/summary + chat payloads.

   Proves the fix for the "Could not load build status — is the server
   running?" bug: refreshAll() must render valid responses, keep unknown
   states honest, survive missing optional fields, and show an honest
   (non-blaming) message when the request itself fails.
   Run: node test-bip-render.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

const html = fs.readFileSync(path.join(__dirname, 'build.html'), 'utf8');

/* Every element id actually present in the page. */
const ids = new Set();
const idRe = /id=["']([^"']+)["']/g;
let m;
while ((m = idRe.exec(html))) ids.add(m[1]);

/* The real inline script under test. */
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch){ console.error('FAIL: no inline <script> found in build.html'); process.exit(1); }
const script = scriptMatch[1];

function makeEl(tag){
  return {
    tagName: String(tag || 'div'), textContent: '', className: '', style: {},
    children: [], hidden: false, value: '', checked: false, disabled: false,
    type: '', name: '', maxLength: 0, placeholder: '', autocomplete: '', required: false,
    scrollTop: 0, scrollHeight: 0,
    classList: { add(){}, remove(){}, contains(){ return false; } },
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){}, click(){}
  };
}

/* Run the real script once. Returns { els, missingIds } where els maps
   id -> element for elements that exist. `dropIds` lets a test simulate
   elements that are absent from the DOM (browser would return null). */
function renderOnce(fetchImpl, opts){
  opts = opts || {};
  const drop = new Set(opts.dropIds || []);
  const els = new Map();
  const documentStub = {
    getElementById(id){
      if (!ids.has(id) || drop.has(id)) return null;   // real browser: null
      if (!els.has(id)) els.set(id, makeEl('div'));
      return els.get(id);
    },
    createElement(tag){ return makeEl(tag); }
  };
  function ESStub(){ this.onmessage = null; this.onerror = null; this.close = function(){}; }
  const fn = new Function('document', 'fetch', 'EventSource', script);
  fn(documentStub, fetchImpl, ESStub);
  return new Promise(resolve => setTimeout(() => resolve(els), 60));
}

/* fetch stub: route by path, canned ok/error payloads. */
function makeFetch(summary, summaryError){
  return function(path){
    let res;
    if (path.indexOf('/api/bip/summary') === 0){
      res = summaryError
        ? { ok: false, status: summaryError.status, body: summaryError.body }
        : { ok: true, status: 200, body: summary };
    } else if (path.indexOf('/api/bip/chat') === 0){
      res = { ok: true, status: 200, body: { messages: [], total: 0 } };
    } else {
      res = { ok: true, status: 200, body: {} };
    }
    return Promise.resolve({
      ok: res.ok, status: res.status,
      json: function(){ return Promise.resolve(res.body); }
    });
  };
}

function baseSummary(overrides){
  const now = new Date().toISOString();
  const base = {
    progress: { percent: 56, verifiedWeight: 56, totalWeight: 100, phase: 'Building',
      currentMilestone: null, counts: { total: 10, verified: 5, inProgress: 2, needsReview: 0, planned: 3 } },
    milestones: [
      { id: 'ms1', key: 'core-setup', title: 'Core application setup', weight: 8, status: 'verified', criteria: 'Server boots.', verifiedAt: now },
      { id: 'ms2', key: 'auth', title: 'Authentication', weight: 8, status: 'in_progress', criteria: 'Server sessions.', verifiedAt: null }
    ],
    roadmap: [ { id: 'rm1', title: 'Public roadmap', status: 'in_progress', summary: 'Official plan.' } ],
    status: {
      build: { state: 'unknown', at: null, ref: null },
      tests: { state: 'unknown', at: null, ref: null },
      deploy: { state: 'unknown', at: null, ref: null },
      integration: { webhooks: false, ciIngest: false, live: false, storage: 'json', durable: false }
    },
    integration: { webhooks: false, ciIngest: false, live: false, storage: 'json', durable: false },
    recentActivity: [],
    ideas: [],
    launch: { hasConfirmedDate: false, confirmed: null, estimated: null, note: '',
      readinessPercent: 56, readiness: 'Building', countdownMs: null, estimatedCountdownMs: null },
    counts: { waitlist: 0, ideas: 0, chatMessages: 0, openReports: 0 },
    requestId: 'test'
  };
  return Object.assign(base, overrides || {});
}

function txt(els, id){ const e = els.get(id); return e ? String(e.textContent) : '(absent)'; }
const BANNER = 'Could not load build status';

(async () => {
  /* ---- 1. Valid response, all statuses unknown ---- */
  console.log('--- valid response: honest unknown states ---');
  let els = await renderOnce(makeFetch(baseSummary()));
  ok(txt(els, 'phaseLabel').indexOf(BANNER) < 0, 'no error banner on a valid response');
  ok(txt(els, 'phaseLabel').indexOf('Building') >= 0, 'phase label shows the phase (got "' + txt(els, 'phaseLabel') + '")');
  ok(txt(els, 'stBuild') === 'unknown', 'build shows honest "unknown" (got "' + txt(els, 'stBuild') + '")');
  ok(txt(els, 'stTests') === 'unknown', 'tests shows honest "unknown" when no event');
  ok(txt(els, 'stDeploy') === 'unknown', 'deploy shows honest "unknown" when no event');
  ok(txt(els, 'statIdeas') === '0', 'ideas stat card renders 0 (got "' + txt(els, 'statIdeas') + '")');
  ok(txt(els, 'statWait') === '0', 'waitlist stat card renders 0 (got "' + txt(els, 'statWait') + '")');
  ok(txt(els, 'waitCount') === '0', 'waitCount renders 0 (got "' + txt(els, 'waitCount') + '")');

  /* ---- 2. Production-like: tests passed, build+deploy unknown, live feed ---- */
  console.log('--- production-like: tests passed beside unknown build/deploy ---');
  const now = new Date().toISOString();
  const prod = baseSummary({
    status: {
      build: { state: 'unknown', at: null, ref: null },
      tests: { state: 'passed', at: now, ref: 'c564b5a968e946280a70e8080dfa3bbaa9467f13' },
      deploy: { state: 'unknown', at: null, ref: null },
      integration: { webhooks: true, ciIngest: true, live: true, storage: 'supabase', durable: true }
    },
    integration: { webhooks: true, ciIngest: true, live: true, storage: 'supabase', durable: true },
    recentActivity: [ { id: 'ev_1', type: 'tests_passed', summary: 'CI tests passed on main @ c564b5a (run 1)', detail: '', ref: 'c564b5a968e946280a70e8080dfa3bbaa9467f13', status: 'passed', source: 'ci', at: now } ]
  });
  els = await renderOnce(makeFetch(prod));
  ok(txt(els, 'phaseLabel').indexOf(BANNER) < 0, 'no banner when tests are passed');
  ok(txt(els, 'stTests') === 'passed', 'tests renders "passed" (got "' + txt(els, 'stTests') + '")');
  ok(txt(els, 'stBuild') === 'unknown', 'build stays honest "unknown" beside passed tests');
  ok(txt(els, 'stDeploy') === 'unknown', 'deploy stays honest "unknown" beside passed tests');
  ok(txt(els, 'liveBadge').indexOf('live') >= 0, 'live badge reflects live integration (got "' + txt(els, 'liveBadge') + '")');

  /* ---- 3. Request actually fails (e.g. durable storage 503) ---- */
  console.log('--- failed request: honest, non-blaming error ---');
  els = await renderOnce(makeFetch(null, { status: 503, body: { error: 'Durable Build-in-Public storage is unavailable. Nothing was read or stored.', code: 'DURABLE_STORAGE_UNAVAILABLE' } }));
  const pl = txt(els, 'phaseLabel');
  ok(pl.indexOf('Build status unavailable') >= 0, 'failed request shows a useful error (got "' + pl + '")');
  ok(pl.indexOf('is the server running') < 0, 'error does NOT blame the server');
  ok(pl.indexOf('Durable Build-in-Public storage is unavailable') >= 0, 'error surfaces the real (non-sensitive) reason');
  ok(txt(els, 'stBuild') === '(absent)' || txt(els, 'stBuild') === '–', 'build card not falsely populated on failure (got "' + txt(els, 'stBuild') + '")');

  /* ---- 4. Missing optional fields do not crash the render ---- */
  console.log('--- missing optional fields ---');
  const sparse = { status: { build: { state: 'passed' }, tests: { state: 'passed' }, deploy: { state: 'unknown' } }, progress: baseSummary().progress, milestones: [] };
  delete sparse.counts; delete sparse.launch; delete sparse.recentActivity; delete sparse.ideas; delete sparse.roadmap; delete sparse.integration;
  els = await renderOnce(makeFetch(sparse));
  ok(txt(els, 'phaseLabel').indexOf(BANNER) < 0, 'sparse response renders without a banner');
  ok(txt(els, 'stTests') === 'passed', 'tests still renders from sparse response');
  ok(txt(els, 'stDeploy') === 'unknown', 'deploy honest unknown in sparse response');

  /* ---- 5. Even if optional stat elements are ABSENT (old DOM), status still renders ---- */
  console.log('--- resilience: stat elements absent from the DOM ---');
  els = await renderOnce(makeFetch(prod), { dropIds: ['statIdeas', 'statWait', 'waitCount'] });
  ok(txt(els, 'phaseLabel').indexOf(BANNER) < 0, 'absent stat elements do NOT crash or show a banner');
  ok(txt(els, 'stTests') === 'passed', 'status board still renders when stat cards are absent');

  console.log('\nRENDER: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('RENDER ERROR: ' + (e && e.stack || e)); process.exit(1); });

