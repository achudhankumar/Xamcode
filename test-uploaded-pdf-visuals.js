const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== TEST: DYNAMIC PDF VISUAL GENERATION PIPELINE ===');

// Prepare browser-like sandbox
  const dummyEl = () => ({
    addEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => '',
    appendChild: () => {},
    querySelector: () => dummyEl(),
    querySelectorAll: () => [],
    remove: () => {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    style: {},
    dataset: {}
  });
  const sandbox = {
    window: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    location: { search: '', pathname: '/' },
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
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  requestAnimationFrame: (cb) => setTimeout(cb, 50),
  cancelAnimationFrame: (id) => clearTimeout(id),
  Map: Map,
  Set: Set,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Math: Math,
  JSON: JSON
};

sandbox.window = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.scrollTo = () => {};
sandbox.performance = { now: () => Date.now() };
sandbox.sessionStorage = { getItem: () => 'true', setItem: () => {}, removeItem: () => {} };
sandbox.URLSearchParams = URLSearchParams;
sandbox.URL = URL;
sandbox.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };
sandbox.document.dispatchEvent = () => {};
vm.createContext(sandbox);

// 1. Load js/aura-visuals.js
const auraVisualsCode = fs.readFileSync(path.join(__dirname, 'js', 'aura-visuals.js'), 'utf8');
vm.runInContext(auraVisualsCode, sandbox);
assert(sandbox.window.XC && sandbox.window.XC.auraVisuals, 'window.XC.auraVisuals must exist');
console.log('✓ auraVisuals loaded in sandbox');

// 2. Load js/interactive-simulations.js
const simCode = fs.readFileSync(path.join(__dirname, 'js', 'interactive-simulations.js'), 'utf8');
vm.runInContext(simCode, sandbox);
console.log('✓ interactive-simulations loaded in sandbox');

// 3. Load js/visual-templates.js
const vtCode = fs.readFileSync(path.join(__dirname, 'js', 'visual-templates.js'), 'utf8');
vm.runInContext(vtCode, sandbox);
console.log('✓ visual-templates loaded in sandbox');

// 3.5 Load js/data-topics.js
const dataTopicsCode = fs.readFileSync(path.join(__dirname, 'js', 'data-topics.js'), 'utf8');
vm.runInContext(dataTopicsCode, sandbox);

// 4. Load js/app.js functions
const appCode = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
vm.runInContext(appCode, sandbox);
console.log('✓ app.js loaded in sandbox');

// Test Case 1: Biology PDF (Photosynthesis & Cellular Respiration)
const mockBiologyStudy = {
  title: 'AP Biology: Cellular Energetics',
  subject: 'Cellular Energetics',
  summary: 'Light reactions, Calvin cycle, and mitochondrial electron transport.',
  units: [
    {
      title: 'Photosynthetic Light Capture',
      topics: [{ title: 'Light Reactions', conceptIndices: [0] }]
    },
    {
      title: 'Mitochondrial ATP Synthesis',
      topics: [{ title: 'Chemiosmosis', conceptIndices: [1] }]
    }
  ],
  concepts: [
    {
      title: 'Photosystem II & Thylakoid Membrane',
      summary: 'Photolysis of water generates proton gradient across the thylakoid lumen.',
      explanation: 'Photons excite P680 chlorophyll electrons, splitting H2O into O2, protons, and high-energy electrons.',
      keyPoints: [
        'Photolysis: 2H2O -> 4H+ + 4e- + O2',
        'Plastoquinone transports electrons to Cytochrome b6f',
        'ATP synthase utilizes the delta-pH proton motive force'
      ],
      visualization: {
        caption: 'Thylakoid Electron Transport Architecture',
        layout: 'flow',
        steps: [
          {
            title: 'Photon Absorption & P680 Excitation',
            description: 'Antenna pigments focus energy into reaction center P680.',
            layout: 'flow',
            nodes: [
              { label: 'P680 Complex', detail: 'Primary photon absorption chlorophyll', code: 'E = h * nu' },
              { label: 'Water Splitting', detail: 'H2O photolysis releases O2 byproduct' },
              { label: 'Plastoquinone (PQ)', detail: 'Mobile hydrophobic electron shuttle' }
            ]
          },
          {
            title: 'Proton Gradient Accumulation',
            description: 'Protons accumulate in the lumen creating electrochemical potential.',
            layout: 'layers',
            nodes: [
              { label: 'Stroma Matrix', detail: 'Low H+ concentration pH 8.0' },
              { label: 'Thylakoid Lipid', detail: 'Impermeable lipid bilayer membrane' },
              { label: 'Lumen Space', detail: 'High H+ concentration pH 5.5' }
            ]
          }
        ]
      }
    },
    {
      title: 'Mitochondrial Chemiosmotic Coupling',
      summary: 'NADH and FADH2 drive Complexes I-IV to produce matrix ATP.',
      explanation: 'Electron transport chain complexes pump protons into the intermembrane space.',
      keyPoints: [
        'Complex I (NADH dehydrogenase) transfers electrons to Ubiquinone',
        'Proton gradient powers FoF1 rotary ATP synthase',
        'Molecular oxygen acts as the terminal electron acceptor'
      ],
      visualization: {
        caption: 'Mitochondrial Cristae Architecture',
        layout: 'hierarchy',
        steps: [
          {
            title: 'Electron Carrier Oxidation',
            description: 'NADH delivers high potential electrons to Complex I.',
            layout: 'hierarchy',
            nodes: [
              { label: 'Complex I / III', detail: 'Multi-subunit proton pumping complexes', code: 'NADH -> NAD+ + H+ + 2e-' },
              { label: 'Cytochrome c', detail: 'Water-soluble peripheral electron carrier' },
              { label: 'Complex IV', detail: 'Reduces O2 to metabolic water' }
            ]
          }
        ]
      }
    }
  ],
  questions: [
    {
      conceptIndex: 0,
      question: 'What is the immediate source of electrons to replace those excited in P680?',
      options: ['Photolysis of water molecules', 'Carbon dioxide fixation', 'NADPH oxidation', 'ATP hydrolysis'],
      answerIndex: 0,
      explanation: 'Photolysis of H2O supplies replacement electrons to P680+.'
    }
  ]
};

const studyToTopics = sandbox.window.XC.studyToTopics;
const studyView = sandbox.window.XC.studyView;

const topics = studyToTopics(mockBiologyStudy, 'AP Biology');
assert.strictEqual(topics.length, 2, 'Should produce 2 topics');

// Verify Topic 0 (Photosynthesis)
const t0 = topics[0];
console.log('\n--- Evaluating Topic 0 (Biology - Photosynthesis) ---');
console.log('Title:', t0.title);
console.log('visId:', t0.visId);
console.log('isAuraVisual:', t0.isAuraVisual, 'auraType:', t0.auraType);

assert.notStrictEqual(t0.visId, 'NET-001', 'visId must NOT be hardcoded NET-001');
assert(t0.visId.startsWith('FLOW-'), 'visId should reflect layout (FLOW-001)');
assert.strictEqual(t0.isAuraVisual, true, 'Topic 0 matches Photosynthesis dynamic simulation');
assert.strictEqual(t0.auraType, 'photosynthesis', 'auraType should be photosynthesis');
assert.strictEqual(typeof t0.visual, 'function', 'c.visual must be a callable function');

// Render Step 0
const svgStep0 = t0.visual(0);
assert(typeof svgStep0 === 'string' && svgStep0.includes('<svg'), 'Visual must return valid SVG markup');
assert(svgStep0.includes('P680 Complex'), 'SVG must include the PDF concept node: P680 Complex');
assert(svgStep0.includes('Water Splitting'), 'SVG must include the PDF concept node: Water Splitting');
assert(svgStep0.includes('E = h * nu'), 'SVG must include the code chip from PDF: E = h * nu');
assert(!svgStep0.includes('Host A') && !svgStep0.includes('Host B'), 'Must NOT replicate Computer Networks sample Host A/B');
console.log('✓ Topic 0 Step 0 correctly renders P680, photolysis nodes, and exact code formula');

// Render Step 1
const svgStep1 = t0.visual(1);
assert(svgStep1.includes('Stroma Matrix') || svgStep1.includes('Lumen Space'), 'Step 1 must dynamically render Step 1 nodes');
console.log('✓ Topic 0 Step 1 dynamically updates to render Stroma Matrix and Lumen Space');

// Verify Topic 1 (Mitochondria)
const t1 = topics[1];
console.log('\n--- Evaluating Topic 1 (Biology - Chemiosmosis) ---');
console.log('Title:', t1.title);
console.log('visId:', t1.visId);
assert(t1.visId.startsWith('HIERARCHY-'), 'visId should reflect hierarchy layout');
const svgT1 = t1.visual(0);
assert(svgT1.includes('Complex I / III'), 'SVG must render Mitochondrial Complex I/III');
assert(svgT1.includes('NADH -&gt; NAD+') || svgT1.includes('NADH -> NAD+'), 'SVG must render NADH equation');
assert(!svgT1.includes('Host A'), 'Must NOT replicate Computer Networks sample');
console.log('✓ Topic 1 correctly renders Mitochondrial Complex I / III with hierarchy layout');

// Verify studyView markup produces dynamic labels, not hardcoded Network strings
const state = sandbox.window.XC.app.state;
state.view = 'study';
state.topicIdx = 0;
state.step = 0;
state.activeCourseTitle = 'AP Biology';
state.answers = {};
state.studyTab = 'visual';
state.playing = false;
sandbox.window.XC.TOPICS = topics;

const studyHtml = sandbox.window.XC.studyView();
assert(!studyHtml.includes('UNIT II: Data Link Layer'), 'Must NOT contain hardcoded "UNIT II: Data Link Layer"');
assert(!studyHtml.includes('UNIT I: Introduction to Networks'), 'Must NOT contain hardcoded "UNIT I: Introduction to Networks"');
assert(studyHtml.includes('AP Biology') || studyHtml.includes('Photosynthetic Light Capture'), 'Must contain actual course or unit title');
assert(studyHtml.includes('studyAuraMount'), 'Must include interactive simulation mount for Photosynthesis');
console.log('✓ studyView renders authentic course breadcrumb, dynamic badge, and interactive simulation mount');

console.log('\n*** ALL DYNAMIC PDF VISUAL GENERATION TESTS PASSED ***\n');
process.exit(0);
