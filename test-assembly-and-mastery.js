'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== TEST: WEB-GROUNDED VISUAL ENRICHMENT & ADAPTIVE MASTERY ENGINE ===\n');

// 1. Test server-side enrichment and low-data fallback
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// Create sandbox to test server functions
const serverSandbox = {
  console,
  setTimeout,
  clearTimeout,
  text: str => typeof str === 'string' && str.trim().length > 0,
  pickLayout: () => 'flow',
  visualFingerprint: v => (v && v.caption) || 'vis-default',
  ALLOWED15: new Set(['flow','arch','seq','compare','hierarchy','state','erd','fbd','wave','isometric','mindmap','matrix','equation','cycle','layer'])
};
vm.createContext(serverSandbox);

// Extract enrichConceptVisual, normalizeConcept, normalizeBank
const sFuncs = `
${serverCode.slice(serverCode.indexOf('function enrichConceptVisual('), serverCode.indexOf('function normalizeBank('))}
${serverCode.slice(serverCode.indexOf('function normalizeBank('), serverCode.indexOf('function validateStudyOutline('))}
`;
vm.runInContext(sFuncs, serverSandbox);

console.log('--- 1. Testing Low-Data / Text-Only Enrichment ---');

// Test 1A: Network topic with completely missing visualization
const netConcept = {
  title: 'TCP Flow & Congestion Control',
  topic: 'Computer Networks',
  summary: 'Sliding window, Tahoe, and Reno congestion window mechanics.',
  explanation: 'TCP guarantees reliable transmission through additive increase and multiplicative decrease.',
  keyPoints: ['Three-way handshake', 'Sliding window buffer', 'Fast retransmit']
};
serverSandbox.normalizeConcept(netConcept, 0, [netConcept]);

assert(netConcept.visualization && netConcept.visualization.steps.length >= 2, 'Must generate multi-step visualization');
assert(netConcept.isolatedPartDefinitions && netConcept.isolatedPartDefinitions.length >= 3, 'Must generate isolatedPartDefinitions');
assert(netConcept.visualization.steps[0].nodes.some(n => /ingress|protocol|switching|queue|buffer/i.test(n.label)), 'Must contain domain-grounded network components');
assert(netConcept.visualization.steps[0].nodes[0].failureImpact, 'Each node must have failureImpact causality defined');
console.log('✓ Network low-data concept enriched with authentic assembly:', netConcept.isolatedPartDefinitions.map(p => p.name).join(' → '));

// Test 1B: Biology concept with sparse text-only outline
const bioConcept = {
  title: 'Synaptic Signal Transduction',
  topic: 'Neurobiology',
  summary: 'Neurotransmitter release, receptor binding, and postsynaptic action potential.'
};
serverSandbox.normalizeConcept(bioConcept, 0, [bioConcept]);
assert(bioConcept.visualization.steps[0].nodes.some(n => /receptor|transduction|catalytic|effector/i.test(n.label)), 'Biology concepts must enrich with biochemical cascade components');
console.log('✓ Biology low-data concept enriched with biochemical assembly:', bioConcept.isolatedPartDefinitions.map(p => p.name).join(' → '));

// Test 1C: Operating System concept
const osConcept = {
  title: 'Virtual Memory & Page Translation',
  topic: 'Operating Systems',
  summary: 'TLB miss handling and page table walk.'
};
serverSandbox.normalizeConcept(osConcept, 0, [osConcept]);
assert(osConcept.visualization.steps[0].nodes.some(n => /dispatcher|mmu|kernel|pipeline|i\/o/i.test(n.label)), 'OS concepts must enrich with kernel/MMU components');
console.log('✓ OS low-data concept enriched with kernel/MMU assembly:', osConcept.isolatedPartDefinitions.map(p => p.name).join(' → '));

console.log('\n--- 2. Testing Adaptive Mastery Quiz Generation ---');
const testBank = { questions: [], flashcards: [], formulas: [] };
const concepts = [netConcept, bioConcept];
serverSandbox.normalizeBank(testBank, concepts.length, concepts);

const visualIdQuestions = testBank.questions.filter(q => q.category === 'visual_id' || q.cat === 'VISUAL ID');
const causalityQuestions = testBank.questions.filter(q => q.category === 'causality' || q.cat === 'CAUSALITY');

assert(visualIdQuestions.length >= 2, 'Every concept must have a Visual Identification question');
assert(causalityQuestions.length >= 2, 'Every concept must have a Functional Causality question');
assert(visualIdQuestions.every(q => q.options && q.options.length === 4), 'Visual ID questions must have 4 options');
assert(causalityQuestions.every(q => /fails|disconnect|break|impact|consequence/i.test(q.question)), 'Causality questions must test component failure consequences');

console.log('✓ Adaptive Mastery battery generated:');
console.log('  • Visual Identification Questions:', visualIdQuestions.length);
console.log('    Sample:', visualIdQuestions[0].question);
console.log('  • Functional Causality Questions:', causalityQuestions.length);
console.log('    Sample:', causalityQuestions[0].question);

console.log('\n--- 3. Testing Client Explorable Assembly & Mastery UI ---');
// Sandbox browser environment
const dummyEl = () => ({
  addEventListener: () => {},
  setAttribute: () => {},
  getAttribute: () => '',
  appendChild: () => {},
  querySelector: () => dummyEl(),
  querySelectorAll: () => [],
  remove: () => {},
  classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
  style: {},
  dataset: {}
});
const clientSandbox = {
  window: {},
  document: {
    createElement: () => dummyEl(),
    createElementNS: () => dummyEl(),
    head: dummyEl(),
    body: dummyEl(),
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => dummyEl(),
    getElementById: () => dummyEl()
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: cb => setTimeout(cb, 10),
  cancelAnimationFrame: id => clearTimeout(id),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  performance: { now: () => Date.now() },
  URLSearchParams: URLSearchParams,
  URL: URL,
  location: { search: '', pathname: '/' }
};
clientSandbox.window = clientSandbox;
clientSandbox.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };
clientSandbox.document.dispatchEvent = () => {};
clientSandbox.addEventListener = () => {};
clientSandbox.removeEventListener = () => {};
vm.createContext(clientSandbox);

// Load required scripts in client sandbox
const auraVisualsCode = fs.readFileSync(path.join(__dirname, 'js', 'aura-visuals.js'), 'utf8');
const simCode = fs.readFileSync(path.join(__dirname, 'js', 'interactive-simulations.js'), 'utf8');
const vtCode = fs.readFileSync(path.join(__dirname, 'js', 'visual-templates.js'), 'utf8');
const dataTopicsCode = fs.readFileSync(path.join(__dirname, 'js', 'data-topics.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

vm.runInContext(auraVisualsCode, clientSandbox);
vm.runInContext(simCode, clientSandbox);
vm.runInContext(vtCode, clientSandbox);
vm.runInContext(dataTopicsCode, clientSandbox);
vm.runInContext(appCode, clientSandbox);

// Test renderAssemblyExplorer
const XC = clientSandbox.window.XC;
const assemblyHtml = XC.renderAssemblyExplorer(netConcept, 0);
assert(assemblyHtml.includes('assembly-explorer-deck'), 'Must render assembly-explorer-deck container');
assert(assemblyHtml.includes('EXPLORABLE ASSEMBLY'), 'Must render assembly badge');
assert(assemblyHtml.includes('data-isolate-part="-1"'), 'Must render full assembly restore pill');
assert(assemblyHtml.includes('data-isolate-part="0"'), 'Must render component 1 pill');
assert(assemblyHtml.includes('OPERATIONAL ROLE'), 'Must render operational role section');
assert(assemblyHtml.includes('FUNCTIONAL CAUSALITY &amp; FAILURE MODE') || assemblyHtml.includes('FUNCTIONAL CAUSALITY & FAILURE MODE'), 'Must render failure causality callout');
console.log('✓ Explorable Assembly Deck correctly rendered with isolated part inspector');

// Test aiDiagramSvg interactive attributes
const diagramSvg = XC.aiDiagramSvg(netConcept.visualization.steps[0], 0, 0, netConcept.title);
assert(diagramSvg.includes('interactive-part'), 'SVG nodes must have interactive-part class');
assert(diagramSvg.includes('data-part-index="0"'), 'SVG nodes must carry part index data attributes');
assert(diagramSvg.includes('role="button"'), 'SVG nodes must be keyboard/accessible buttons');
console.log('✓ SVG Diagram nodes transformed into interactive explorable parts');

// Test isolation state in SVG
XC.state.isolatedPartIdx = 0;
const isolatedSvg = XC.aiDiagramSvg(netConcept.visualization.steps[0], 0, 0, netConcept.title);
assert(isolatedSvg.includes('has-isolated-part'), 'SVG wrapper must have has-isolated-part when isolated');
assert(isolatedSvg.includes('is-isolated'), 'Isolated node must have is-isolated class');
console.log('✓ Component isolation mode verified with visual emphasis and dimming');

// Test Mastery Card rendering in quizResults
const fullMarksTopic = {
  id: 'test-topic-mastery',
  title: 'Network Routing Mastery',
  questions: [
    { q: 'Q1', a: 0, opts: ['A','B'] },
    { q: 'Q2', a: 0, opts: ['A','B'] }
  ]
};
XC.state.topicIdx = 0;
XC.state.answers = { '0-0': 0, '0-1': 0 };
XC.state.qStep = 1;
XC.state.qDone = true;
const resultsHtml = XC.quizResults(fullMarksTopic);
assert(resultsHtml.includes('TOPIC MASTERED • VERIFIED COMPETENCE'), 'Full score must trigger TOPIC MASTERED card');
assert(XC.state.masteredTopics['test-topic-mastery'], 'Must mark topic as mastered in state');
console.log('✓ Topic Mastery Verified card successfully rendered upon 100% score');

// Test Pending Mastery Card on score < 80%
XC.state.answers = { '0-0': 1, '0-1': 1 };
const pendingResultsHtml = XC.quizResults(fullMarksTopic);
assert(pendingResultsHtml.includes('MASTERY IN PROGRESS'), 'Score < 80% must display MASTERY IN PROGRESS card');
assert(pendingResultsHtml.includes('Isolated Part Definitions'), 'Pending card must recommend reviewing isolated part definitions');
console.log('✓ Mastery In Progress guidance card successfully rendered upon score < 80%');

console.log('\n*** ALL WEB-GROUNDED ENRICHMENT & ADAPTIVE MASTERY TESTS PASSED (100%) ***');
process.exit(0);
