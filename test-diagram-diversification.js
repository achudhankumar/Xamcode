/* ============================================================
   TEST - DIAGRAM DIVERSIFICATION (no more "reused the same diagram")
   ============================================================
   Reproduces the failure seen on large curriculum PDFs: several lessons
   from the same domain collapse onto identical layout + node labels, and
   the adaptive-mastery questions share one visual object by reference.
   Before the fix the server/browser validators rejected the whole study.
   Now the visuals must be auto-repaired and the study must pass.
   Run: node test-diagram-diversification.js
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---- server slice: schema .. pickLayout (normalizers + validators + diversifier) ---- */
const start = src.indexOf('const studySchema');
const pickEnd = src.indexOf('\n}', src.indexOf("return 'arch'; // default"));
if (start < 0 || pickEnd < 0) throw new Error('could not locate the server validator block');
const sbox = { module: { exports: {} }, exports: {}, require, console: { log() {}, warn() {}, error: console.error } };
vm.createContext(sbox);
vm.runInContext(src.slice(start, pickEnd + 3) +
  '\nmodule.exports={normalizeConcept,normalizeBank,validateConcepts,validateStudyBank,diversifyStudyVisuals,visualFingerprint};', sbox);
const S = sbox.module.exports;

/* ---- browser validator ---- */
const aStart = appSrc.indexOf('function validateAIStudyForDisplay(study){');
const aEnd = appSrc.indexOf('\nfunction aiStudyView()');
const abox = { module: { exports: {} }, exports: {}, console };
vm.createContext(abox);
vm.runInContext(appSrc.slice(aStart, aEnd) + '\nmodule.exports={validateAIStudyForDisplay};', abox);
const C = abox.module.exports;

const clientKey = s => String(s.layout || '') + ':' + (s.nodes || []).map(n => String(n.label || '').trim().toLowerCase()).join('>');

console.log('\n1. same-domain lessons that used to collide');
/* Six networking lessons with sparse visuals: enrichConceptVisual gives
   every one of them the same four domain parts and the same layout. */
const titles = ['TCP Congestion Control', 'IP Packet Routing', 'DNS Resolution Path',
  'ARP Address Mapping', 'HTTP Request Lifecycle', 'Subnet Mask Planning'];
const concepts = titles.map(t => ({ title: t, topic: 'Computer Networks', summary: t + ' in a packet network.' }));
concepts.forEach((c, i) => S.normalizeConcept(c, i, concepts));

const keys = concepts.flatMap(c => c.visualization.steps.map(clientKey));
ok(new Set(keys).size === keys.length, `every concept step has a unique layout+labels key (${new Set(keys).size}/${keys.length})`);
const firstLayouts = concepts.map(c => c.visualization.steps[0].layout);
ok(firstLayouts.every((l, i) => i === 0 || l !== firstLayouts[i - 1]), 'no two consecutive lessons share an archetype: ' + firstLayouts.join(' → '));
ok(S.validateConcepts(concepts) === true, 'server validateConcepts accepts the repaired lessons');

console.log('\n2. mastery questions no longer share one visual object');
const bank = { questions: [], flashcards: [], formulas: [] };
S.normalizeBank(bank, concepts.length, concepts);
const objs = bank.questions.map(q => q.visual).filter(Boolean);
ok(new Set(objs).size === objs.length, 'each question owns its own visual object');
ok(!bank.questions.some(q => concepts.some(c => c.visualization === q.visual)), 'no question visual aliases a concept visual');
ok(S.validateStudyBank(bank, concepts.length) === true, 'server validateStudyBank accepts the bank');
const qfps = bank.questions.map(q => S.visualFingerprint(q.visual));
ok(new Set(qfps).size === qfps.length, `question visual fingerprints are unique (${new Set(qfps).size}/${qfps.length})`);

console.log('\n3. browser repairs a stale saved study instead of rejecting it');
const stale = JSON.parse(JSON.stringify(concepts));
/* Force a hard collision the way an old cached study would carry it. */
stale[1].visualization = JSON.parse(JSON.stringify(stale[0].visualization));
stale[2].visualization = JSON.parse(JSON.stringify(stale[0].visualization));
const study = {
  title: 'Networks', subject: 'Computer Networks', summary: 's', chunked: true,
  units: [{ title: 'U1', overview: 'o', learningGoals: ['g'], topics: [{ title: 'T', conceptIndices: stale.map((_, i) => i) }] }],
  concepts: stale, questions: bank.questions, flashcards: bank.flashcards, formulas: []
};
const err = C.validateAIStudyForDisplay(study);
ok(!/reused the same diagram/i.test(err), 'browser no longer raises "reused the same diagram"');
ok(err === '', 'browser validator accepts the study (got: "' + err + '")');
const k2 = study.concepts.flatMap(c => c.visualization.steps.map(clientKey));
ok(new Set(k2).size === k2.length, 'browser left every lesson with a unique diagram');

console.log('\n4. the diversifier is idempotent and never empties a diagram');
const before = JSON.stringify(concepts.map(c => c.visualization));
S.diversifyStudyVisuals(concepts, null);
ok(JSON.stringify(concepts.map(c => c.visualization)) === before, 'a second pass changes nothing');
ok(concepts.every(c => c.visualization.steps.every(s => s.nodes.length >= 3 && s.nodes.every(n => n.label && n.detail))), 'every step keeps >=3 labelled nodes');

console.log('\n5. error string is gone from both validators');
ok(!/reused the same diagram/.test(appSrc), 'js/app.js no longer contains the rejection message');
ok(!/reused the same diagram/.test(src), 'server.js never contained / no longer contains it');

console.log('\n' + (fail === 0 ? '*** PASS ***' : '*** FAIL ***') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);

