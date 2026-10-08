/* ============================================================
   TEST - PDF TOPIC IMAGES (2D, MiniMax, no video)
   ------------------------------------------------------------
   1. craftTopicImagePrompt is a pure function: prompts carry the
      topic title + the topic's OWN diagram node labels + workshop
      formulas, never another topic's labels, and stay within the
      1500-char MiniMax prompt cap.
   2. handleTopicImages binds images to a finished analyze job (the
      5-PDF/day allowance on POST /api/analyze stays the only gate),
      isolates per-topic failures, and video routes answer 410.
   No network, no API keys: MiniMax fetch is stubbed.

   Run: node test-topic-images.js
   ============================================================ */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

/* ---- slice 1: the pure prompt builder (no sockets, no fetch) ---- */
const start = src.indexOf('function craftTopicImagePrompt(');
if (start < 0) throw new Error('craftTopicImagePrompt not found in server.js');
const endProbe = src.indexOf('async function handleTopicImages(', start);
if (endProbe < 0) throw new Error('handleTopicImages anchor not found in server.js');
const slice = src.slice(0, src.indexOf('function minimaxKey(')) + '\n' + src.slice(start, endProbe);
const sb = { module: { exports: {} }, exports: {}, require, console, __dirname,
  process: { env: {}, hasOwnProperty: Object.hasOwn } };
vm.createContext(sb);
vm.runInContext(slice + '\nmodule.exports={craftTopicImagePrompt};', sb);
const { craftTopicImagePrompt } = sb.module.exports;

const N = (l, d) => ({ label: l, detail: d });
const mkConcept = (title, nodesA, nodesB) => ({
  title, summary: title + ' summary with enough words to shape a prompt',
  analogy: title + ' is like a tidy shelf',
  workedExample: { scenario: 'A classroom demo of ' + title },
  visualization: { caption: 'cap', steps: [
    { title: 's1', description: 'd', layout: 'flow', nodes: nodesA },
    { title: 's2', description: 'd', layout: 'cycle', nodes: nodesB }
  ] }
});
const study = {
  subject: 'Computer Networks',
  formulas: [
    { name: 'Transmission time', expression: 'L/R', conceptIndex: 0 },
    { name: 'Propagation delay', expression: 'd/s', conceptIndex: 1 }
  ],
  concepts: [
    mkConcept('Packet Switching', [N('Packet', 'x'), N('Router', 'x'), N('Queue', 'x')], [N('Store', 'x'), N('Forward', 'x'), N('Route', 'x')]),
    mkConcept('Circuit Switching', [N('Circuit', 'x'), N('Dial', 'x'), N('Reserve', 'x')], [N('Setup', 'x'), N('Hold', 'x'), N('Teardown', 'x')])
  ]
};

console.log('\nthe prompt names the topic and its own diagram nodes');
const p0 = craftTopicImagePrompt(study, study.concepts[0], 0);
ok(p0.includes('Packet Switching'), 'topic title is in the prompt');
ok(p0.includes('Router'), 'own node labels ground the image');
ok(!p0.includes('Teardown'), 'the other topic labels never leak in');
ok(p0.indexOf('Flat 2D') === 0, 'the style prefix pins 2D vector output');

console.log('\nthe prompt carries workshop formulas for the topic');
ok(p0.includes('L/R'), 'concept-scoped formula (L/R) is referenced');
const p1 = craftTopicImagePrompt(study, study.concepts[1], 1);
ok(p1.includes('d/s') && !p1.includes('L/R'), 'each topic gets its own formula');

console.log('\nthe prompt respects the MiniMax cap and rejects junk');
ok(p0.length <= 1500, 'prompt is within the 1500 cap');
let threw = null;
try { craftTopicImagePrompt(study, { title: '   ' }, 0); } catch (e) { threw = e; }
ok(threw && threw.status === 400, 'a blank topic title is a clean 400');
/* ---- slice 2: handler + routes, MiniMax fetch stubbed ---- */
let fetchImpl = (...a) => global.fetch(...a);
function loadServer(env) {
  const cut = src.indexOf('const server = http.createServer');
  if (cut < 0) throw new Error('server bootstrap not found');
  const box = {
    console: { log() {}, warn() {}, error() {} },
    process: { env: Object.assign({}, env), hasOwnProperty: Object.hasOwn },
    require, __dirname, __filename,
    Buffer, URL, fetch: (...a) => fetchImpl(...a),
    setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, TextEncoder, Intl
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(
    src.slice(0, cut) +
    '\nglobalThis.__t={handleTopicImages,generateImage,jobs,createAnalyzeJob};',
    box, { filename: 'server.js' }
  );
  return box.__t;
}
const seedJob = T => {
  const job = T.createAnalyzeJob(Buffer.from('%PDF-1.4 fake'), 'standard', 'req-1');
  job.status = 'done'; job.stage = 'ready';
  job.study = JSON.parse(JSON.stringify(study));
  return job;
};
const mkRes = () => {
  const r = { _out: {}, setHeader() {}, writeHead(s) { r._out.status = s; }, end(b) { r._out.body = String(b); } };
  return r;
};
const mkReq = obj => {
  const payload = Buffer.from(JSON.stringify(obj));
  return { headers: {}, socket: { remoteAddress: '127.0.0.1' },
    on(e, f) { if (e === 'data') f(payload); if (e === 'end') f(); } };
};
(async () => {
  console.log('\nhandleTopicImages serves one image per requested topic');
  const T = loadServer({ MINIMAX_API_KEY: 'mm-test' });
  const job = seedJob(T);
  const seen = [];
  fetchImpl = async (url) => {
    seen.push(String(url));
    const n = seen.length;
    return { ok: true, status: 200,
      json: async () => ({ data: { image_urls: ['https://img.test/' + n + '.png'] } }) };
  };
  const r1 = mkRes();
  await T.handleTopicImages(mkReq({ jobId: job.id }), r1, 't1');
  const b1 = JSON.parse(r1._out.body);
  ok(r1._out.status === 200, 'a finished job answers 200');
  ok(b1.count === 2 && b1.images.length === 2, 'both topics get an image by default');
  ok(b1.images[0].imageUrl === 'https://img.test/1.png', 'MiniMax URLs flow through per topic');
  ok(b1.images[0].prompt.includes('Packet Switching'), 'the used prompt rides along for verification');
  ok(seen.every(u => u.includes('image_generation')), 'only image_generation is called, never video');
  console.log('\nper-topic failures are isolated, unknown jobs are clean 404s');
  fetchImpl = async () => ({ ok: false, status: 502,
    json: async () => ({ base_resp: { status_msg: 'no image' } }) });
  const r2 = mkRes();
  await T.handleTopicImages(mkReq({ jobId: job.id, topics: [0, 1] }), r2, 't2');
  const b2 = JSON.parse(r2._out.body);
  ok(r2._out.status === 200 && b2.images.every(i => i.error), 'a provider outage marks each topic, batch survives');
  const r3 = mkRes();
  await T.handleTopicImages(mkReq({ jobId: '00000000-0000-0000-0000-000000000000' }), r3, 't3');
  ok(r3._out.status === 404, 'an unknown job is a 404');
  const running = T.createAnalyzeJob(Buffer.from('%PDF-1.4 fake'), 'standard', 'req-2');
  const r4 = mkRes();
  await T.handleTopicImages(mkReq({ jobId: running.id }), r4, 't4');
  ok(r4._out.status === 409, 'an unfinished job is a 409, not a silent empty set');
  console.log('\nvideo routes are disabled (images only)');
  ok(src.includes("return sendJson(res, 410, { error: 'Video generation is disabled."), 'video routes answer 410 VIDEO_DISABLED');
  ok(!/return handleVideoStart\(/.test(src), 'no route dispatches to the video handler anymore');
  console.log('\n' + (fail === 0 ? '*** TOPIC IMAGES PASS (' + pass + ') ***' : '*** TOPIC IMAGES FAIL: ' + fail + ' ***'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });

