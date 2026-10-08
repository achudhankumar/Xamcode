/* Runs the REAL server validateStudyOutline and the REAL client
   validateAIStudyForDisplay against dbg-outline.json, reporting the exact
   failing rule for each. Extracts both functions from source like the tests do. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const sStart = serverSrc.indexOf('function text(v){');
const sEnd = serverSrc.indexOf('function validateStudyPack(pack) {');
const sSlice = serverSrc.slice(sStart, sEnd) + '\nmodule.exports={validateStudyOutline,text,normalizeOutline,normalizeBank};';
const sb = { module: { exports: {} }, exports: {}, console };
vm.createContext(sb);
vm.runInContext(sSlice, sb);
const { validateStudyOutline, normalizeOutline } = sb.module.exports;

const appSrc = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
const aStart = appSrc.indexOf('function validateAIStudyForDisplay(study){');
const aEnd = appSrc.indexOf('\nfunction aiStudyView()');
const aSlice = appSrc.slice(aStart, aEnd) + '\nmodule.exports={validateAIStudyForDisplay};';
const ab = { module: { exports: {} }, exports: {}, console, Array, Object, String, Number, Boolean, JSON, Set, Math };
vm.createContext(ab);
vm.runInContext(aSlice, ab);
const { validateAIStudyForDisplay } = ab.module.exports;

const outline = JSON.parse(fs.readFileSync(path.join(__dirname, 'dbg-outline.json'), 'utf8'));

/* A full bank is required for the client check; reuse shapes from the outline
   so we test the concept/unit rules that just failed. */
const bank = {
  formulas: [],
  questions: Array.from({ length: 10 }, (_, i) => ({
    question: 'q' + i, options: ['a','b','c','d'], answerIndex: 0, conceptIndex: i % outline.concepts.length,
    category: 'c', difficulty: 'easy', hint: 'h', explanation: 'e', optionExplanations: ['a','b','c','d'], eli5: 'x',
    visual: { caption: 'cap', layout: 'flow', steps: [{ title: 't', description: 'd', nodes: [{ label: 'L', detail: 'D' }, { label: 'L2', detail: 'D2' }, { label: 'L3', detail: 'D3' }] }, { title: 't2', description: 'd2', nodes: [{ label: 'M', detail: 'D' }, { label: 'M2', detail: 'D2' }, { label: 'M3', detail: 'D3' }] }] }
  })),
  flashcards: Array.from({ length: 10 }, (_, i) => ({ front: 'f', back: 'b', conceptIndex: i % outline.concepts.length }))
};
const study = Object.assign({}, outline, bank);

console.log('--- server validateStudyOutline (raw model output) ---');
console.log(validateStudyOutline(outline) ? 'PASSES' : 'FAILS before normalizeOutline');

/* Mirror the real pipeline: normalize, then validate. */
normalizeOutline(outline);
console.log('--- server validateStudyOutline (after normalizeOutline, as the pipeline runs it) ---');
console.log(validateStudyOutline(outline) ? 'PASSES' : 'FAILS (repair was not enough; stage would retry)');

console.log('--- client validateAIStudyForDisplay ---');
console.log(JSON.stringify(validateAIStudyForDisplay(study)) || '(passes)');

/* Probe individual client rules by relaxation to locate each failure. */
const t = v => typeof v === 'string' && v.trim().length > 0;
const c0 = study.concepts[0];
console.log('probe sourcePage is string?', t(c0.sourcePage), '| raw:', JSON.stringify(c0.sourcePage));
const layouts = new Set();
for (const c of study.concepts) for (const s of (c.visualization?.steps || [])) layouts.add(s.layout);
console.log('concept step layouts present:', [...layouts].join(','));
console.log('allowed by client line 940:', ['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'].join(','));
for (const c of study.concepts){
  for (const s of (c.visualization?.steps || [])){
    if (!['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'].includes(s.layout)) { console.log('client-rejected layout:', s.layout, 'in concept', c.title); break; }
  }
}
