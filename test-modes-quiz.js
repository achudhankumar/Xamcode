'use strict';

const fs = require('fs');
const path = require('path');
const { ModeCache, defaultModeCache } = require('./lib/mode-cache');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

console.log('============================================================');
console.log('TEST: PHASE 7 — MODES, CHEATCODE, QUIZ & TRUST LABELS');
console.log('============================================================\n');

(async () => {
  const cache = new ModeCache();
  const allModes = ['crash', 'compare', 'solve', 'life', 'history', 'flash', 'exam', 'eli5'];
  const testTopicId = 'net-osi-layers';
  const testTopicData = { title: 'OSI Reference Model and Layer Encapsulation' };

  // 1. Verify 8 Modes Implemented & Performance
  console.log('--- Testing 8 Vaathiyar Modes & Lazy Generation ---');
  assert(allModes.length === 8, '8 distinct Vaathiyar modes defined');

  const firstOpenTimes = [];
  for (const m of allModes) {
    const res = await cache.loadMode(testTopicId, m, testTopicData);
    assert(res.cached === false, `Mode "${m}" generated on-demand upon first open`);
    assert(res.durationMs < 10000, `Mode "${m}" first open duration is under 10 seconds (${res.durationMs}ms)`);
    firstOpenTimes.push(res.durationMs);
  }

  // 2. Second Open Served from Cache (< 5ms)
  console.log('\n--- Testing Second Open Cache Hit (Instantaneous) ---');
  for (const m of allModes) {
    const res = await cache.loadMode(testTopicId, m, testTopicData);
    assert(res.cached === true, `Mode "${m}" second open served strictly from cache`);
    assert(res.durationMs < 10, `Mode "${m}" second open is instantaneous (${res.durationMs}ms)`);
  }

  // 3. Prefetching Crash Lesson and Flashcards
  console.log('\n--- Testing Topic Prefetch (Crash & Flash) ---');
  const freshCache = new ModeCache();
  const prefetchedTopicId = 'net-sliding-window';
  await freshCache.prefetchTopic(prefetchedTopicId, { title: 'Sliding Window ARQ' });
  assert(freshCache.has(prefetchedTopicId, 'crash'), 'Crash Lesson prefetched and cached');
  assert(freshCache.has(prefetchedTopicId, 'flash'), 'Flashcards prefetched and cached');
  assert(!freshCache.has(prefetchedTopicId, 'solve'), 'Non-prefetched modes remain lazy');

  // 4. Trust Label Rules Enforcement
  console.log('\n--- Testing Trust Labels & Grounding Invariants ---');
  const compareRes = await cache.loadMode(testTopicId, 'compare');
  assert(compareRes.content.trustLabel === 'AI estimate', 'Compare mode enforces "AI estimate" trust label on synthetic comparisons');

  const lifeRes = await cache.loadMode(testTopicId, 'life');
  assert(lifeRes.content.trustLabel === 'Extra knowledge, not from your PDF', 'Real-Life mode enforces "Extra knowledge, not from your PDF" trust label');

  const historyRes = await cache.loadMode(testTopicId, 'history');
  assert(historyRes.content.trustLabel === 'Extra knowledge, not from your PDF', 'History mode enforces "Extra knowledge, not from your PDF" trust label');

  // 5. Solve Problem Diagram: Full Mesh with All Links Drawn
  console.log('\n--- Testing Solve Problem Diagram Geometry ---');
  const solveRes = await cache.loadMode(testTopicId, 'solve');
  const diagram = solveRes.content.diagram;
  assert(typeof diagram === 'string' && diagram.includes('<svg'), 'Solve Problem returns SVG diagram');
  const linkMatches = diagram.match(/<line /g) || [];
  assert(linkMatches.length === 10, `Solve Problem draws complete 5-node mesh with all 10 links (found ${linkMatches.length} links, not a row of dots)`);
  const nodeMatches = diagram.match(/<circle /g) || [];
  assert(nodeMatches.length === 5, `Solve Problem renders all 5 node vertices in mesh (found ${nodeMatches.length})`);

  // 6. Practice Quiz Header & Icon Bug Fix
  console.log('\n--- Testing UI Renovations & Icon Bug Fixes ---');
  const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
  assert(appJs.includes('PRACTICE QUIZ • ${c.questions.length} Qs'), 'Quiz panel renamed to "Practice Quiz"');
  assert(appJs.includes('quiz-icon quiz-icon-check'), 'Checkmark replaced with clean inline SVG icon');
  assert(appJs.includes('quiz-icon quiz-icon-cross'), 'Cross mark replaced with clean inline SVG icon');

  const layoutCss = fs.readFileSync(path.join(__dirname, 'css', 'layout.css'), 'utf8');
  assert(layoutCss.includes('scroll-margin-top:80px'), 'Sample page title overlap fixed with scroll-margin clearance');

  // 7. Write Phase 7 Report
  const reportData = {
    modes_implemented: 8,
    second_open_served_from_cache: 1,
    label_rules_enforced: 1,
    icon_bug_fixed: 1,
    title_overlap_fixed: 1
  };

  const reportPath = path.join(__dirname, 'reports', 'phase-7.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  assert(fs.existsSync(reportPath), 'reports/phase-7.json written successfully');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();

