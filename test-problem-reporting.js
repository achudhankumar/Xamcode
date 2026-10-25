'use strict';

const { ProblemReporter, VALID_REASONS, VALID_TARGETS } = require('./lib/problem-reporter');

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
console.log('TEST: PHASE A4 — REPORT A PROBLEM BUTTON & QUALITY LOOP');
console.log('============================================================\n');

const reporter = new ProblemReporter();

// 1. Validation Constraints
console.log('--- Testing Report Validation & Target Coverage ---');
try {
  reporter.submitReport({ targetType: 'invalid_type', targetId: 't1', reason: 'wrong_fact' });
  assert(false, 'Should reject invalid target type');
} catch (err) {
  assert(err.message.includes('Invalid report targetType'), 'Enforces valid report target types');
}

try {
  reporter.submitReport({ targetType: 'topic', targetId: 't1', reason: 'invalid_reason' });
  assert(false, 'Should reject invalid reason');
} catch (err) {
  assert(err.message.includes('Invalid report reason'), 'Enforces whitelisted report reasons');
}

// 2. Report Creation with Prompt Version & Model
console.log('\n--- Testing Report Creation & Row Attribution ---');
const r1 = reporter.submitReport({
  targetType: 'topic',
  targetId: 'cn-hamming',
  reason: 'wrong_fact',
  note: 'Formula mentions parity bits inverted',
  promptVersion: 'v2.1',
  modelUsed: 'gemini-flash-lite-latest',
  userId: 'user_456'
});

assert(r1.id.startsWith('rep_'), 'Generates unique report ID');
assert(r1.promptVersion === 'v2.1', 'Row records exact prompt version (v2.1)');
assert(r1.modelUsed === 'gemini-flash-lite-latest', 'Row records exact model used');

const r2 = reporter.submitReport({
  targetType: 'visual',
  targetId: 'cn-sliding-window',
  reason: 'visual_broken',
  note: 'Frame 2 animation overlaps title',
  promptVersion: 'v2.1',
  modelUsed: 'gemini-flash-lite-latest'
});

const r3 = reporter.submitReport({
  targetType: 'quiz_question',
  targetId: 'q-42',
  reason: 'confusing',
  note: 'Options B and C look identical',
  promptVersion: 'v1.9',
  modelUsed: 'gemini-flash-lite-latest'
});

// 3. Admin Filtering by Reason
console.log('\n--- Testing Admin Filters by Reason ---');
const wrongFactReports = reporter.getReportsByReason('wrong_fact');
assert(wrongFactReports.length === 1 && wrongFactReports[0].targetId === 'cn-hamming', 'Admin filters reports specifically by "wrong_fact"');

const visualBrokenReports = reporter.getReportsByReason('visual_broken');
assert(visualBrokenReports.length === 1 && visualBrokenReports[0].targetId === 'cn-sliding-window', 'Admin filters reports specifically by "visual_broken"');

// 4. Admin Grouping by Prompt Version
console.log('\n--- Testing Grouping by Prompt Version ---');
const grouped = reporter.getReportsGroupedByPromptVersion();
assert(grouped['v2.1'].length === 2, 'Groups 2 reports under prompt version v2.1');
assert(grouped['v1.9'].length === 1, 'Groups 1 report under prompt version v1.9');

// 5. Export to Phase 11 Evaluation Set
console.log('\n--- Testing Export to Phase 11 Eval Set ---');
const exportData = reporter.exportReportedTopicsToEvalSet();
assert(exportData.count === 2, 'Exports exactly 2 unique reported topic IDs to eval set');
assert(exportData.evalTopicIds.includes('cn-hamming') && exportData.evalTopicIds.includes('cn-sliding-window'), 'Eval set receives flagged topics for test harness tuning');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
