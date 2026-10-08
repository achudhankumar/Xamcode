'use strict';
/* Throwaway verification for code-aware diagram nodes. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
const start = src.indexOf('function escapeHtml(');
const end = src.indexOf('function aiQuestionCard(');
let slice = src.slice(start, end);
slice = slice.replace(/const aiMermaidSlots=new Map\(\);/g, 'var aiMermaidSlots={get(){},set(){}};');
slice = slice.replace(/let aiMermaidSlotSeq=0;/g, 'var aiMermaidSlotSeq=0;');
const sb = { module: { exports: {} }, console };
vm.createContext(sb);
try {
  vm.runInContext(slice + '\nmodule.exports={aiDiagramSvg};', sb);
} catch (e) {
  console.log('EXTRACT_FAIL: ' + e.message);
  process.exit(1);
}
const { aiDiagramSvg } = sb.module.exports;
let fail = 0;
const ok = (c, m) => { if (c) console.log('  ok   ' + m); else { fail++; console.log('  FAIL ' + m); } };

const withCode = {
  title: 'Loop run', description: 'runs 3 times', layout: 'flow',
  nodes: [
    { label: 'Init', detail: 'sets counter', code: 'x = 0' },
    { label: 'Loop', detail: 'repeats body', code: 'for i in range(3):' },
    { label: 'Print', detail: 'shows value', code: 'print(x)' }
  ]
};
const svg = aiDiagramSvg(withCode, 0, 0, 'Loops');
ok(svg.includes('ai-diagram-node-code'), 'code class is emitted');
ok(svg.includes('for i in range(3):'), 'syntax text is present');
ok(svg.includes('repeats body'), 'short effect prose stays on row 1 alongside syntax');

const plain = {
  title: 'T', description: 'd', layout: 'flow',
  nodes: [{ label: 'A', detail: 'short' }, { label: 'B', detail: 'short' }, { label: 'C', detail: 'short' }]
};
ok(!aiDiagramSvg(plain, 1, 0, 'Plain').includes('ai-diagram-node-code'), 'plain nodes have no code line');

const evil = {
  title: 'T', description: 'd', layout: 'flow',
  nodes: [{ label: 'A', detail: 'd', code: '<b>x</b>' }, { label: 'B', detail: 'd' }, { label: 'C', detail: 'd' }]
};
const svg3 = aiDiagramSvg(evil, 2, 0, 'Evil');
ok(!svg3.includes('<b>'), 'code is HTML-escaped');
ok((svg3.match(/width="112"/g) || []).length === 3, 'card geometry intact (3x 112-wide cards)');

const long = {
  title: 'T', description: 'd', layout: 'flow',
  nodes: [{ label: 'A', detail: 'd', code: 'y'.repeat(200) }, { label: 'B', detail: 'd' }, { label: 'C', detail: 'd' }]
};
ok(!aiDiagramSvg(long, 3, 0, 'Long').includes('y'.repeat(81)), 'long code truncated at 80');

console.log(fail === 0 ? '*** CODE RENDER PASS ***' : '*** CODE RENDER FAIL ***');
process.exit(fail === 0 ? 0 : 1);
