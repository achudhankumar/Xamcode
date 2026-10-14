'use strict';
/* Proves the AURA chat can generate images from text, end to end:
   1. the aura-visuals browser bundle renders flowchart/sequence/prose
   2. js/aura-diagram.js lazy-loads it and exposes XC.auraDiagram.render
   3. server.js requires a "diagram" recipe in the AURA prompt + sanitizes it
   4. XamCode.html / js/aura.js / css/aura.css wire the pieces together   */
const fs = require('fs'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---------- 1. the browser bundle ---------- */
const BUNDLE = 'c:/Xamcode/aura-visuals/browser/aura-diagram.js';
ok(fs.existsSync(BUNDLE), 'browser bundle is built (aura-visuals/browser/aura-diagram.js)');

let bodyMode = 'dark';
const sandbox = { console, setTimeout, clearTimeout, queueMicrotask, TextEncoder, TextDecoder };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.document = {
  createElement: (t) => ({ tagName: String(t).toUpperCase(), src: '', async: false, onload: null, onerror: null }),
  head: { appendChild(){} },
  body: { getAttribute: (k) => k === 'data-mode' ? bodyMode : null },
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
};
vm.createContext(sandbox);
if (fs.existsSync(BUNDLE)) {
  vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'aura-diagram.js' });
}
ok(typeof (sandbox.AuraDiagram && sandbox.AuraDiagram.renderDiagram) === 'function',
  'bundle exposes window.AuraDiagram.renderDiagram');

/* ---------- 2. the lazy loader the chat calls ---------- */
vm.runInContext(fs.readFileSync('c:/Xamcode/js/aura-diagram.js', 'utf8'), sandbox, { filename: 'aura-diagram.js' });
const AD = sandbox.window.XC && sandbox.window.XC.auraDiagram;
ok(AD && typeof AD.render === 'function', 'js/aura-diagram.js exposes XC.auraDiagram.render');
ok(AD && typeof AD.ensureLoaded === 'function', 'XC.auraDiagram.ensureLoaded exists for preloading');
ok(AD && AD.currentTheme() === 'dark', 'theme follows body[data-mode]=dark');
bodyMode = 'light';
ok(AD && AD.currentTheme() === 'light', 'theme follows body[data-mode]=light');
bodyMode = 'dark';

async function main(){
  /* ---------- rendering: every kind of recipe becomes a picture ---------- */
  console.log('\ntext → diagram rendering');
  const flow = await AD.render('flow: Receive request, Session valid?, Serve page/Send 401, End');
  ok(flow.kind === 'flowchart', 'flow: recipe → flowchart (' + flow.kind + ')');
  ok(/data-kind="flowchart"/.test(flow.svg) && flow.svg.includes('<svg'), 'flowchart SVG has <svg> + data-kind');
  ok(flow.svg.includes('Session'), 'decision step label appears in the SVG');
  ok(flow.width > 0 && flow.height > 0, 'intrinsic size ' + flow.width + '×' + flow.height);

  const seq = await AD.render('seq: Client, Server | Client->Server: SYN | Server->Client: SYN-ACK | Client->Server: ACK');
  ok(seq.kind === 'sequence', 'seq: recipe → sequence diagram (' + seq.kind + ')');
  ok(seq.svg.includes('data-kind="sequence"') && seq.svg.includes('SYN-ACK'), 'sequence SVG carries the actors and messages');

  const chain = await AD.render('Client sends request -> Server checks session -> Server returns page');
  ok(chain.kind === 'flowchart' && chain.svg.includes('Server') && chain.svg.includes('session'),
    'arrow chain → flowchart with the steps as nodes');

  const free = await AD.render('The TCP handshake works in three steps: the client sends SYN. The server replies SYN-ACK. The client sends ACK.');
  ok(free.kind === 'flowchart' && free.nodes >= 3,
    'prose fallback still lays out ' + free.nodes + ' nodes — every question gets an image');

  const dark = await AD.render('flow: A, B, C');
  const light = await AD.render('flow: A, B, C', { theme: 'light' });
  ok(dark.svg !== light.svg, 'light theme renders differently from dark');
  bodyMode = 'light';
  const auto = await AD.render('flow: A, B, C');
  bodyMode = 'dark';
  ok(auto.svg === light.svg, 'render() without opts picks the page theme automatically');

  /* ---------- 3. the server contract ---------- */
  console.log('\nserver.js requires + sanitizes the diagram recipe');
  const src = fs.readFileSync('c:/Xamcode/server.js', 'utf8');
  const p0 = src.indexOf('const AURA_JSON_PROMPT');
  const p1 = src.indexOf('async function handleAsk');
  ok(p0 >= 0 && p1 > p0, 'AURA_JSON_PROMPT + normalizeAura region located');
  const sb2 = { module: { exports: {} }, console, extractJson(){ throw new Error('not used for object inputs'); } };
  vm.createContext(sb2);
  vm.runInContext(src.slice(p0, p1) + '\nmodule.exports = { AURA_JSON_PROMPT, normalizeAura };\n', sb2, { filename: 'server-slice.js' });
  const S = sb2.module.exports;
  ok(/"diagram"/.test(S.AURA_JSON_PROMPT) && /REQUIRED/.test(S.AURA_JSON_PROMPT), 'prompt requires a "diagram" recipe');
  ok(/->/.test(S.AURA_JSON_PROMPT) && /seq:/.test(S.AURA_JSON_PROMPT) && /flow:/.test(S.AURA_JSON_PROMPT),
    'prompt documents the arrow, flow: and seq: formats');
  ok(/ONE short paragraph/.test(S.AURA_JSON_PROMPT), 'prompt asks for a SHORT explanation (2-4 sentences)');

  const n1 = S.normalizeAura({ explanation: 'E', diagram: 'A -> B -> C' });
  ok(n1.diagram === 'A -> B -> C', 'diagram recipe passes through untouched');
  const n2 = S.normalizeAura({ explanation: 'E', diagram: '<b>x</b> -> y' });
  ok(n2.diagram === '', 'a diagram containing HTML is dropped');
  const n3 = S.normalizeAura({ explanation: 'E', diagram: 'x'.repeat(900) });
  ok(n3.diagram.length <= 600, 'diagram is capped at 600 chars (' + n3.diagram.length + ')');
  const n4 = S.normalizeAura({ explanation: 'E' });
  ok(n4.diagram === '', 'missing diagram → empty string, never undefined');
  ok(typeof n4.explanation === 'string' && n4.visual_type === null, 'the old fields still normalize as before');
  ok(/diagram: norm\.diagram/.test(src), '/api/aura response carries diagram to the client');

  /* ---------- 4. app wiring ---------- */
  console.log('\napp wiring');
  const html = fs.readFileSync('c:/Xamcode/XamCode.html', 'utf8');
  const iLoader = html.indexOf('js/aura-diagram.js');
  const iAura = html.indexOf('js/aura.js');
  ok(iLoader > 0 && iAura > iLoader, 'XamCode.html loads js/aura-diagram.js before js/aura.js');
  const chat = fs.readFileSync('c:/Xamcode/js/aura.js', 'utf8');
  ok(/data\.diagram/.test(chat), 'aura.js reads data.diagram from the response');
  ok(/diagramText/.test(chat) && /mountDiagram/.test(chat), 'aura.js stores the recipe and mounts the SVG');
  ok(/else auraMsg\.diagramText = answerText/.test(chat), 'answer text itself is the last-resort recipe');
  const css = fs.readFileSync('c:/Xamcode/css/aura.css', 'utf8');
  ok(/aura-diagram-busy/.test(css) && /\.aura-visual>svg/.test(css), 'aura.css styles the generated diagram slot');

  console.log('\n*** ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ***  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
