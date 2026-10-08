/* ============================================================
   TEST — VAATHIYAR CONTENT INTEGRITY
   ============================================================
   Guards the hand-authored quiz content. Every topic must carry
   all 16 sub-modes with usable content, and every VAATHIYAR key
   must correspond to a real topic id (no orphan entries that
   silently never render).

   Run: node test-vaathiyar-content.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

/* Same load order as the browser: base Vaathiyar map, then unit files,
   then visuals. data-vaathiyar-unitN.js merges into the map created by
   data-vaathiyar.js, so the order is load-bearing, not cosmetic. */
function dataRank(file) {
  if (file === 'data-vaathiyar.js') return 20;
  const unit = /^data-vaathiyar-unit(\d+)\.js$/.exec(file);
  if (unit) return 21 + Number(unit[1]);
  if (file === 'data-visuals.js') return 90;
  return 10;
}

const sandbox = { window: null, console: { log() {}, warn() {}, error() {} } };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const dataFiles = fs.readdirSync(path.join(ROOT, 'js'))
  .filter(f => f.startsWith('data-') && f.endsWith('.js'))
  .sort((a, b) => dataRank(a) - dataRank(b) || a.localeCompare(b));
for (const f of dataFiles) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: f });
}

const XC = sandbox.XC || {};
const TOPICS = XC.TOPICS || [];
const VAATHIYAR = XC.VAATHIYAR || {};

const REQUIRED = ['crash', 'crashExplain', 'compare', 'compareExplain', 'solve',
  'solveExplain', 'life', 'lifeExplain', 'history', 'historyExplain',
  'flash', 'flashExplain', 'exam', 'examExplain', 'eli5', 'eli5Explain'];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); } };
const nonEmpty = v => Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v);

console.log(`Checking ${Object.keys(VAATHIYAR).length} Vaathiyar topics against ${TOPICS.length} topics\n`);

for (const [id, t] of Object.entries(VAATHIYAR)) {
  const missing = REQUIRED.filter(k => t[k] === undefined);
  if (missing.length) { fail++; console.log(`  FAIL: ${id} is missing ${missing.join(', ')}`); continue; }

  for (const k of REQUIRED) {
    if (!nonEmpty(t[k])) { fail++; console.log(`  FAIL: ${id}.${k} is empty`); }
    else pass++;
  }

  /* Every crash slide must render: tag + prose + an inline visual + a
     positive read time, or the slide shows a blank panel. */
  t.crash.forEach((c, i) => {
    const good = c && typeof c.tag === 'string' && c.tag.length &&
      typeof c.text === 'string' && c.text.length > 10 &&
      typeof c.visual === 'string' && c.visual.length > 20 &&
      Number.isFinite(c.readMs) && c.readMs >= 1000;
    ok(good, `${id}.crash[${i}] is not renderable`);
  });

  /* Unbalanced divs in a hand-written visual breaks the whole panel. */
  t.crash.forEach((c, i) => {
    if (typeof c.visual !== 'string') return;
    const opens = (c.visual.match(/<div/g) || []).length;
    const closes = (c.visual.match(/<\/div>/g) || []).length;
    ok(opens === closes, `${id}.crash[${i}] has unbalanced divs (${opens} open, ${closes} close)`);
  });

  ok(Array.isArray(t.compare.rows) && t.compare.rows.length >= 3 &&
    t.compare.rows.every(r => Array.isArray(r) && r.length === 3),
    `${id}.compare.rows must be >=3 rows of exactly 3 cells`);

  ok(Array.isArray(t.compare.bars) && t.compare.bars.length >= 3 &&
    t.compare.bars.every(b => Number.isFinite(b.leftPct) && Number.isFinite(b.rightPct) &&
      b.leftPct >= 0 && b.leftPct <= 100 && b.rightPct >= 0 && b.rightPct <= 100),
    `${id}.compare.bars must have >=3 bars with pcts in 0..100`);

  ok(typeof t.solve.q === 'string' && t.solve.q.length > 10 &&
    Array.isArray(t.solve.steps) && t.solve.steps.length >= 3 &&
    t.solve.steps.every(s => s.label && s.math),
    `${id}.solve needs a question and >=3 steps with label+math`);

  ok(typeof t.eli5.kid === 'string' && t.eli5.kid.length > 20 &&
    typeof t.eli5.middle === 'string' && t.eli5.middle.length > 20 &&
    typeof t.eli5.engg === 'string' && t.eli5.engg.length > 20,
    `${id}.eli5 needs kid, middle and engg, each substantial`);

  /* Quiz-facing arrays have their own required shapes. */
  ok(t.flash.every(f => f.q && f.a), `${id}.flash entries need q and a`);
  ok(t.exam.every(e => e.q && e.a), `${id}.exam entries need q and a`);
  ok(t.history.every(h => h.yr && h.h && h.t), `${id}.history entries need yr, h and t`);
  ok(t.life.every(l => l.ic && l.h && l.t), `${id}.life entries need ic, h and t`);
}

/* An entry keyed on a topic id that no longer exists would never render. */
const topicIds = TOPICS.map(t => t.id);
for (const id of Object.keys(VAATHIYAR)) {
  ok(topicIds.includes(id), `VAATHIYAR key "${id}" does not match any topic id`);
}

const covered = topicIds.filter(id => VAATHIYAR[id]);
console.log(`  coverage: ${covered.length}/${topicIds.length} topics have Vaathiyar content`);
const missingTopics = topicIds.filter(id => !VAATHIYAR[id]);
if (missingTopics.length) console.log(`  still missing: ${missingTopics.join(', ')}`);

/* ============================================================
   TILT SCOPE — pointer tilt must stay on the landing page only
   ============================================================
   genz.js drives tilt from one selector list. Study content (the
   Workspace grid, formula/cheatcode cards, Vaathiyar rows and the
   whole PDF-generated study space) must never re-enter that list:
   tilt displaces layouts and makes small answer options a moving
   target. The landing `.card` grid and the landing hero `.preview`
   are the only intentional tilt surfaces.
   ============================================================ */
{
  const genzSrc = fs.readFileSync(path.join(ROOT, 'js', 'genz.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const cssSrc = ['genz.css', 'theme-studio.css']
    .map(f => fs.readFileSync(path.join(ROOT, 'css', f), 'utf8')).join('\n');

  const tiltMatch = /var TILT\s*=\s*([\s\S]*?);/.exec(genzSrc);
  ok(!!tiltMatch, 'genz.js must declare a TILT selector list');
  const TILT = tiltMatch ? tiltMatch[1] : '';

  /* Every tilt surface is a reading/clicking target, so none of these
     class families may appear anywhere in the tilt list. */
  const FORBIDDEN = [
    'concept-card', 'formula-card', 'cc-card', 'q-card', 'step-card',
    'mini-visual', 'v-row', 'v-stage', 'v-flash', 'ws-pill', 'ts-card',
    'theme-card', 'ai-unit-card', 'ai-topic-page-card', 'ai-visual-stage-card',
    'ai-detail-card', 'ai-formula-card', 'ai-question-card', 'ai-mode-panel'
  ];
  for (const sel of FORBIDDEN) {
    ok(!TILT.includes(sel), `tilt list must not include .${sel}`);
  }
  ok(TILT.includes('.card'), 'tilt list must keep the landing .card grid');

  /* The 3D scaffolding must be landing-scoped too, or a stray .gz-tilt
     class on a study card would still displace it. */
  ok(!/^\s*\.gz-tilt\s*\{/m.test(cssSrc), '.gz-tilt must always be qualified, never a bare selector');
  ok(/\.card\.gz-tilt\s*\{/.test(cssSrc), '.gz-tilt must be scoped to .card');

  /* Only the landing hero panel may set a pointer transform directly. */
  const previewTilt = /closest\('\.preview'\)/.test(appSrc);
  ok(previewTilt, 'landing .preview keeps its pointer tilt');
  const directTilt = appSrc.match(/style\.transform\s*=\s*`perspective/g) || [];
  ok(directTilt.length === 1, `only the landing .preview may tilt in app.js (found ${directTilt.length})`);

  /* No tilt may be reintroduced for the Theme Studio gallery. */
  ok(!/\.ts-card\.gz-tilt/.test(cssSrc), '.ts-card must not have a gz-tilt rule');
}

/* ============================================================
   GENERATED STUDY SECTIONS — all 8 sample sections must exist
   ============================================================
   The sample workspace is the reference. A generated pack is
   incomplete unless every concept carries its own CheatCode, every
   concept has its own distinct diagram, and every question carries
   its own 2D visual. This reads server.js as text so the check
   tracks the real validator rather than a copy of it.
   ============================================================ */
{
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  /* CheatCodes are a first-class section, not an optional extra. */
  ok(/cheatCode:\s*\{/.test(serverSrc), 'schema must declare a cheatCode object');
  ok(/required:\s*\['why',\s*'like',\s*'wrong',\s*'right',\s*'see',\s*'oneLine',\s*'mnemonic'\]/
    .test(serverSrc), 'cheatCode must require why/like/wrong/right/see/oneLine/mnemonic');
  ok(/text\(concept\.cheatCode\.why\)/.test(serverSrc),
    'validation must require the cheatCode why field');

  /* Every question needs its own visual; a question without one is broken. */
  ok(/visual:\s*\{/.test(serverSrc), 'schema must declare a per-question visual');
  ok(/question\.visual\.steps/.test(serverSrc), 'validation must inspect question visuals');
  ok(/'eli5',\s*'visual'\]/.test(serverSrc), 'visual must be required on every question');

  /* The reuse bug: one generic diagram repeated across topics. */
  ok(/conceptVisualSignatures/.test(serverSrc), 'validation must fingerprint concept visuals');
  ok(/questionVisualSignatures/.test(serverSrc), 'validation must fingerprint question visuals');
  ok(/distinctLabels\s*\/\s*allConceptLabels\.length\s*<\s*0\.6/.test(serverSrc),
    'validation must reject pooled/repeated node labels');

  /* Quiz coverage: more questions, spread across every concept. The rule
     moved into validateStudyBank when generation was split into stages. */
  ok(/bank\.questions\.length\s*<\s*conceptCount\s*\*\s*2/.test(serverSrc),
    'every concept needs at least 2 questions');
  ok(/function validateStudyBank\(bank, conceptCount\)/.test(serverSrc),
    'stage 2 must validate the bank against the stage 1 concept count');
  ok(/function validateStudyOutline\(pack\)/.test(serverSrc),
    'stage 1 must have its own outline validator');

  /* The client renders all of this, so its validator must match. */
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  ok(/function aiCheatCodePanel/.test(appSrc), 'client must render the CheatCode panel');
  ok(/function aiQuestionVisual/.test(appSrc), 'client must render the per-question 2D visual');
  ok(/aiQuestionVisual\(question,index\)/.test(appSrc), 'question card must embed its visual');
  ok(/\['cheat','CheatCodes'\]/.test(appSrc), 'CheatCodes must be a lesson tab');
  ok(/reused the same diagram across lessons/.test(appSrc),
    'client must reject a reused diagram too');
}

/* ============================================================
   UPLOAD LIMIT — one number, and a JSON cap that cannot drift
   ============================================================
   The browser base64-encodes the PDF, inflating it by 4/3. If the JSON
   body cap is lower than that, readJson rejects a legal PDF with a
   vague "Request is too large." before the specific PDF check runs.
   So the two limits must stay derived from the same value.
   ============================================================ */
{
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'XamCode.html'), 'utf8');

  const mb = /const MAX_PDF_MB\s*=\s*[^;]*?\|\|\s*(\d+)\)/.exec(serverSrc);
  ok(!!mb, 'server must define MAX_PDF_MB with a default');
  const limitMb = mb ? Number(mb[1]) : 0;
  ok(limitMb === 20, `the PDF limit must be 20 MB (found ${limitMb})`);

  ok(/MAX_PDF_BYTES\s*=\s*MAX_PDF_MB\s*\*/.test(serverSrc),
    'MAX_PDF_BYTES must derive from MAX_PDF_MB');
  ok(/MAX_JSON_BYTES\s*=\s*Math\.ceil\(MAX_PDF_BYTES\s*\*\s*4\s*\/\s*3\)/.test(serverSrc),
    'MAX_JSON_BYTES must be derived from the base64-inflated size, not hardcoded');
  ok(!/MAX_JSON_BYTES\s*=\s*\d/.test(serverSrc),
    'MAX_JSON_BYTES must never be a hardcoded number');

  /* A 20 MB PDF must survive the JSON gate: 20MB * 4/3 ~= 26.7MB < cap. */
  const encoded = mb => Math.ceil(mb * 1024 * 1024 * 4 / 3);
  const jsonBytes = /MAX_JSON_BYTES\s*=\s*Math\.ceil\(MAX_PDF_BYTES\s*\*\s*4\s*\/\s*3\)\s*\+\s*(\d+)\s*\*\s*1024\s*\*\s*1024/
    .exec(serverSrc);
  ok(!!jsonBytes, 'MAX_JSON_BYTES must add a documented slack allowance');
  const slackMb = jsonBytes ? Number(jsonBytes[1]) : 0;
  const capMb = encoded(limitMb) / 1048576 + slackMb;
  ok(capMb > encoded(limitMb) / 1048576,
    `JSON cap (${capMb.toFixed(1)} MB) must exceed a base64-encoded ${limitMb} MB PDF`);

  /* Regression: an upload just over the limit must still clear the JSON
     gate so the user gets "PDFs must be N MB or smaller." rather than the
     vague "Request is too large." from readJson. */
  ok(capMb >= encoded(limitMb + 1) / 1048576,
    `JSON cap (${capMb.toFixed(1)} MB) must admit an oversized ${limitMb + 1} MB PDF so the specific size error is reachable`);
  ok(/PDFs must be \$\{MAX_PDF_MB\} MB or smaller/.test(serverSrc),
    'the PDF size error must name the configured limit');
  ok(/readJson\(request, MAX_JSON_BYTES,\s*[`'"]/.test(serverSrc),
    'the analyze route must pass a specific too-large message to readJson');

  /* Client and UI must agree with the server. */
  const clientMb = /const MAX_PDF_MB\s*=\s*(\d+)/.exec(appSrc);
  ok(!!clientMb && Number(clientMb[1]) === limitMb,
    'client MAX_PDF_MB must match the server default');
  ok(/file\.size\s*>\s*MAX_PDF_MB\s*\*\s*1024\s*\*\s*1024/.test(appSrc),
    'client size check must use MAX_PDF_MB, not a literal');
  ok(!/14\s*\*\s*1024\s*\*\s*1024/.test(appSrc), 'no hardcoded 14 MB check may remain');
  ok(/PDF · UP TO 20 MB/.test(html), 'dropzone label must show 20 MB');
  ok(/up to 20 megabytes/.test(html), 'accessible hint must say 20 megabytes');
  ok(/Maximum size: 20 MB/.test(html), 'privacy note must say 20 MB');
}

console.log(`\n${fail === 0 ? '*** PASS ***' : '*** FAIL ***'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
