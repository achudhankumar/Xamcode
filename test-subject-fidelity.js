'use strict';
/* ============================================================
   TEST — SUBJECT FIDELITY (guard functions + live pipeline wiring)
   ------------------------------------------------------------
   Covers the acceptance criteria for the subject-fidelity guard:
     1. a Computer Networks concept PASSES a network fingerprint
     2. Environmental Science / Java concepts FAIL that fingerprint
     3. each subject passes its OWN fingerprint (no subject is privileged)
     4. terminology variants (plural/stemmed forms) are not falsely rejected
     5. a weak/empty fingerprint never blanket-rejects
     6. BOTH pipeline paths (single-shot + chunked) capture the fingerprint
        and call the gate before validation, with subject-aware retries
     7. multi-subject documents keep every covered subject's concepts
     8. extractPdfTextLite really pulls text out of PDF streams
     9. thresholds carry no hard-coded subject dictionary
   Run: node test-subject-fidelity.js
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const zlib = require('node:zlib');
const src = fs.readFileSync(__dirname + '/server.js', 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => {
  if (c) { pass++; console.log('  ok   ' + m); }
  else { fail++; console.log('  FAIL ' + m); }
};

/* ---------- slice the guard block + prompt helpers out of server.js ---------- */
const guardStart = src.indexOf('function buildLiteralSubjectFingerprint(');
const promptStart = src.indexOf('function outlinePromptWithFingerprint(', guardStart);
const phIdx = src.indexOf('PROMPT HELPERS', guardStart);
const guardEnd = phIdx < 0 ? -1 : src.lastIndexOf('/*', phIdx);
if (guardStart < 0 || promptStart < 0 || guardEnd <= guardStart)
  throw new Error('guard block boundaries not located');
const guardSlice = src.slice(guardStart, guardEnd);
const promptSlice = src.slice(promptStart);

const sb = {
  module: { exports: {} }, exports: {}, require, console, zlib,
  /* enforceOutlineSubjectFidelity throws through mkErr; the sandbox needs a
     stand-in so the enforcement tests can run without the rest of server.js. */
  mkErr: (status, message, extra) => Object.assign(new Error(message), { status }, extra || {})
};
vm.createContext(sb);
vm.runInContext(
  guardSlice + '\n' + promptSlice + '\nmodule.exports = {\n' +
  '  buildLiteralSubjectFingerprint, conceptTextTokens,\n' +
  '  conceptMatchesLiteralFingerprint, normalizeOutlineFingerprint,\n' +
  '  enforceOutlineSubjectFidelity,\n' +
  '  outlinePromptWithFingerprint, compactOutlinePromptWithFingerprint\n' +
  '};\n', sb, { filename: 'guard-slice.js' });
const G = sb.module.exports;

/* ---------- extractPdfTextLite (separate slice: helper -> createAnalyzeJob) ---------- */
const exStart = src.indexOf('function extractPdfTextLite(');
const exEnd = src.indexOf('function createAnalyzeJob(');
if (exStart < 0 || exEnd <= exStart) throw new Error('extractPdfTextLite boundaries not located');
const sb2 = { require, console, zlib, Buffer, module: { exports: {} } };
vm.createContext(sb2);
vm.runInContext(src.slice(exStart, exEnd) + '\nmodule.exports = { extractPdfTextLite };\n',
  sb2, { filename: 'extract-slice.js' });
const EX = sb2.module.exports;

/* ================= document fixtures ================= */
const networkText = [
  'Computer networks use TCP, a connection-oriented transport protocol that provides reliable delivery using a three-way handshake SYN SYN-ACK ACK.',
  'IP networks route packets between hosts using distance-vector and link-state routing; Dijkstra selects shortest paths in link-state routing.',
  'The subnet mask determines the network portion of an IPv4 address; CIDR notation expresses the prefix length. ARP maps an IP address to a MAC address on a local network segment.',
  'DNS resolves human-readable domain names to IP addresses through a hierarchy of resolvers, authoritative servers and cached records.'
].join(' ');
const ecologyText = [
  'Ecosystems transfer energy along trophic levels: producers capture sunlight, consumers eat biomass and decomposers recycle nutrients.',
  'Population growth follows logistic curves constrained by carrying capacity; predator-prey interactions oscillate seasonally.',
  'Biodiversity measures species richness and evenness across habitats; keystone species exert influence beyond their abundance.'
].join(' ');
const javaText = [
  'Java exception handling distinguishes checked exceptions from unchecked RuntimeException subclasses; the throw statement raises an exception object.',
  'The finally block runs whether or not an exception propagates; try-with-resources closes AutoCloseable sources automatically.',
  'Custom exception classes extend Exception or RuntimeException; stack traces record call frames for debugging.'
].join(' ');

const networkFp = G.buildLiteralSubjectFingerprint(networkText, []);
const ecologyFp = G.buildLiteralSubjectFingerprint(ecologyText, []);
const javaFp = G.buildLiteralSubjectFingerprint(javaText, []);

function mkConcept(o){
  return {
    title: o.title, summary: o.summary, explanation: o.explanation,
    sourceExcerpt: o.excerpt, sourcePage: 1,
    keyPoints: o.keyPoints || [],
    whyItMatters: 'It matters for the exam.', analogy: 'Like a road map.',
    explanationLevels: { simple: 's', everyday: 'e', advanced: 'a' },
    commonTrap: 'c', correctiveTruth: 'ct',
    comparison: { firstLabel: 'A', secondLabel: 'B', takeaway: 't',
      rows: [{ aspect: 'x', first: '1', second: '2' },
        { aspect: 'y', first: '3', second: '4' },
        { aspect: 'z', first: '5', second: '6' }] },
    originStory: 'o',
    realWorldExamples: [{ title: 'ex', description: 'd' }],
    workedExample: { scenario: 'w', answer: 'a',
      steps: [{ label: 'l', action: 'act', reasoning: 'r' },
        { label: 'l2', action: 'act2', reasoning: 'r2' }] },
    quickRecall: 'q',
    cheatCode: { why: '1', like: '2', wrong: '3', right: '4', oneLine: '5',
      mnemonic: '6', see: ['a', 'b', 'c'] },
    visualization: { caption: 'cap', steps: [{ title: o.visTitle, description: o.visDesc,
      layout: 'flow', nodes: o.nodes.map(n => ({ label: n, detail: n + ' detail' })) }] }
  };
}

const cnConcept = mkConcept({
  title: 'The TCP Three-Way Handshake',
  summary: 'TCP opens a connection with a SYN, SYN-ACK, ACK handshake before any data flows.',
  explanation: 'The client sends SYN, the server answers SYN-ACK, the client confirms with ACK; only then is the connection state established.',
  excerpt: 'TCP uses a three-way handshake to open a reliable connection.',
  keyPoints: ['SYN starts the connection', 'SYN-ACK acknowledges and counters', 'ACK completes the handshake'],
  visTitle: 'Handshake flow', visDesc: 'SYN to SYN-ACK to ACK across the network',
  nodes: ['Client SYN', 'Server SYN-ACK', 'Client ACK', 'routing table']
});
const envSciConcept = mkConcept({
  title: 'Trophic Levels and Energy Flow',
  summary: 'Energy moves from producers to consumers to decomposers along trophic levels.',
  explanation: 'Each trophic level passes roughly ten percent of its energy upward through the ecosystem.',
  excerpt: 'Producers capture sunlight and consumers eat biomass.',
  keyPoints: ['producers form the first trophic level', 'consumers eat biomass', 'decomposers recycle nutrients'],
  visTitle: 'Energy pyramid', visDesc: 'trophic levels stacked by biomass',
  nodes: ['producers', 'primary consumers', 'decomposers', 'carrying capacity']
});
const javaConcept = mkConcept({
  title: 'Java Exception Hierarchy',
  summary: 'Checked exceptions and RuntimeException subclasses form the Java exception hierarchy.',
  explanation: 'The throw statement raises an exception object that propagates until a catch block handles it or the stack unwinds.',
  excerpt: 'Checked exceptions must be declared; RuntimeException subclasses are optional.',
  keyPoints: ['throw raises an exception object', 'finally always runs', 'stack traces record call frames'],
  visTitle: 'Hierarchy of exceptions', visDesc: 'exception hierarchy branches',
  nodes: ['Throwable', 'Exception', 'RuntimeException', 'try-with-resources']
});
const variantConcept = mkConcept({
  title: 'Packet Handshakes on the Network',
  summary: 'Handshakes between hosts put entries into the routing table of each network device.',
  explanation: 'During the handshake the packets traverse subnet segments while ARP resolves every MAC address.',
  excerpt: 'The handshakes populate routing tables across the subnet.',
  keyPoints: ['handshakes synchronize both hosts', 'packets carry sequence numbers', 'subnet routers forward packets'],
  visTitle: 'Handshakes and packets', visDesc: 'handshakes exchange packets via the subnet',
  nodes: ['handshakes', 'packets', 'subnet router', 'MAC address']
});
const genericConcept = mkConcept({
  title: 'Systems and Data',
  summary: 'A system processes data for the user.',
  explanation: 'Data enters the system and the user sees the result.',
  excerpt: 'The system stores data.',
  keyPoints: ['systems process data', 'users see results'],
  visTitle: 'Generic system', visDesc: 'data through a system',
  nodes: ['Input', 'System', 'Output', 'user']
});

/* ================= 1. per-concept gate ================= */
console.log('\nper-concept fingerprint gate');
ok(G.conceptMatchesLiteralFingerprint(cnConcept, networkFp) === true,
  'valid Computer Networks concept PASSES the network fingerprint');
ok(G.conceptMatchesLiteralFingerprint(envSciConcept, networkFp) === false,
  'Environmental Science concept FAILS the network fingerprint');
ok(G.conceptMatchesLiteralFingerprint(javaConcept, networkFp) === false,
  'Java exception-hierarchy concept FAILS the network fingerprint');
ok(G.conceptMatchesLiteralFingerprint(envSciConcept, ecologyFp) === true,
  'ecology concept passes its OWN fingerprint (no subject is privileged)');
ok(G.conceptMatchesLiteralFingerprint(javaConcept, javaFp) === true,
  'Java concept passes its OWN fingerprint (no subject is privileged)');
ok(G.conceptMatchesLiteralFingerprint(cnConcept, javaFp) === false,
  'network concept FAILS the Java fingerprint (direction is symmetric)');

/* ================= 2. terminology variants ================= */
console.log('\nterminology variants are not falsely rejected');
ok(G.conceptMatchesLiteralFingerprint(variantConcept, networkFp) === true,
  'plural/stemmed variants (handshakes/packets/subnet) still match');
const routeVariant = mkConcept({
  title: 'Distance Vector Routing Updates',
  summary: 'Routers exchange routing updates describing distances to every network destination.',
  explanation: 'Distance-vector routing propagates each router full table to its neighbours periodically.',
  excerpt: 'Routing updates flood the network.',
  keyPoints: ['routing updates carry distances', 'the routing table lists destinations'],
  visTitle: 'Routing updates', visDesc: 'routing updates between routers',
  nodes: ['routing updates', 'routing table', 'distance vector', 'network destination']
});
ok(G.conceptMatchesLiteralFingerprint(routeVariant, networkFp) === true,
  'repeated genuine overlap (routing x4) passes without a single exact match');
ok(G.conceptMatchesLiteralFingerprint(genericConcept, networkFp) === false,
  'generic short nouns alone (systems/data/user) cannot pass a wrong subject');

/* ================= 3. weak fingerprints never blanket-reject ================= */
console.log('\ndegraded paths');
ok(G.conceptMatchesLiteralFingerprint(cnConcept, '') === true,
  'empty literal fingerprint degrades to pass (no evidence)');
ok(G.conceptMatchesLiteralFingerprint(envSciConcept, '   ') === true,
  'whitespace-only fingerprint degrades to pass, never blanket-rejects');
const emptyConcept = mkConcept({
  title: '  ', summary: '  ', explanation: '   ', excerpt: '  ',
  keyPoints: ['  '], nodes: ['  '], visTitle: '  ', visDesc: '  '
});
ok(G.conceptMatchesLiteralFingerprint(emptyConcept, networkFp) === false,
  'concept with no recoverable tokens FAILS a substantive fingerprint');

/* ================= 4. multi-subject documents ================= */
console.log('\nmulti-subject documents');
const mixedFp = G.buildLiteralSubjectFingerprint(networkText + ' ' + ecologyText, []);
ok(G.conceptMatchesLiteralFingerprint(cnConcept, mixedFp) === true,
  'a multi-subject document keeps its networking concepts');
ok(G.conceptMatchesLiteralFingerprint(envSciConcept, mixedFp) === true,
  'a multi-subject document keeps its ecology concepts too');

/* ================= 5. enforceOutlineSubjectFidelity ================= */
console.log('\nenforceOutlineSubjectFidelity (the pipeline gate)');
let threw = null;
try{
  G.enforceOutlineSubjectFidelity({ concepts: [envSciConcept, javaConcept] },
    { literalFingerprint: networkFp });
}catch(e){ threw = e; }
ok(threw && threw.code === 'SUBJECT_MISMATCH',
  'off-subject pack throws SUBJECT_MISMATCH');
ok(threw && /does not match/i.test(threw.message),
  'the error carries the clear "does not match" message');
let passed = true;
try{
  G.enforceOutlineSubjectFidelity({ concepts: [cnConcept, variantConcept] },
    { literalFingerprint: networkFp });
}catch(e){ passed = false; }
ok(passed, 'on-subject pack passes the gate untouched');
const packA = { concepts: [cnConcept] };
G.enforceOutlineSubjectFidelity(packA, { literalFingerprint: networkFp });
ok(packA.subjectFingerprint === networkFp.toLowerCase(),
  'the gate normalizes pack.subjectFingerprint from the literal fingerprint');
let weakOk = true;
try{
  G.enforceOutlineSubjectFidelity({ concepts: [envSciConcept] }, { literalFingerprint: '' });
}catch(e){ weakOk = false; }
ok(weakOk, 'missing fingerprint degrades to no-op (never a blanket rejection)');
const packB = { concepts: [cnConcept], subjectFingerprint: 'fluffy generic model words' };
G.normalizeOutlineFingerprint(packB, networkFp);
ok(packB.subjectFingerprint === networkFp.toLowerCase(),
  'literal fingerprint backfills over a weak model fingerprint');
const packC = { concepts: [cnConcept] };
G.normalizeOutlineFingerprint(packC, '');
ok(typeof packC.subjectFingerprint === 'string',
  'with no literal fp the model/backfill path still yields a string');

/* ================= 6. pipeline wiring (source assertions) ================= */
console.log('\npipeline wiring');
const analyzeBody = src.slice(src.indexOf('async function runAnalyzeJob('),
  src.indexOf('/* ---------- unit-chunked analysis'));
ok(/job\.literalFingerprint = buildLiteralSubjectFingerprint\(extractPdfTextLite\(job\.pdf\), \[\]\)/.test(analyzeBody),
  'runAnalyzeJob captures the literal fingerprint from the PDF text');
ok((analyzeBody.match(/enforceOutlineSubjectFidelity\(/g) || []).length === 2,
  'runAnalyzeJob enforces the gate on BOTH the first attempt and the retry');
ok(/outlinePromptWithFingerprint\(job\)/.test(analyzeBody),
  'runAnalyzeJob builds its outline prompt with the fingerprint helper');
ok(/SUBJECT_MISMATCH/.test(analyzeBody) && /DIFFERENT subject/.test(analyzeBody),
  'runAnalyzeJob retry is subject-failure aware');
const chunkedBody = src.slice(src.indexOf('async function runChunkedJob('),
  src.indexOf('/* ---------- HTTP helpers'));
ok(/job\.literalFingerprint = buildLiteralSubjectFingerprint\(extractPdfTextLite\(job\.pdf\), \[\]\)/.test(chunkedBody),
  'runChunkedJob captures ONE fingerprint per job for every unit');
const unitBody = src.slice(src.indexOf('async function buildUnit('),
  src.indexOf('async function buildRemainingUnits('));
ok((unitBody.match(/enforceOutlineSubjectFidelity\(/g) || []).length === 2,
  'buildUnit enforces the gate per unit, on first attempt and retry');
ok(/compactOutlinePromptWithFingerprint\(job, k\)/.test(unitBody),
  'buildUnit uses the unit-scoped fingerprint prompt helper');
ok(/SUBJECT_MISMATCH/.test(unitBody) && /DIFFERENT subject/.test(unitBody),
  'buildUnit retry is subject-failure aware');

/* ================= 7. extractPdfTextLite ================= */
console.log('\nextractPdfTextLite');
const uncompressed = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj << /Length 96 >> stream\n' +
  'BT /F1 12 Tf 72 720 Td (Computer networks use TCP handshake routing subnet) Tj ET\n' +
  'endstream\nendobj\n%%EOF\n', 'latin1');
const exText = EX.extractPdfTextLite(uncompressed);
ok(/handshake/.test(exText) && /subnet/.test(exText),
  'text pulled from an uncompressed content stream');
const rawDeflate = zlib.deflateSync(Buffer.from('(Link-state routing uses Dijkstra over the subnet) Tj', 'latin1'));
const compressedPdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj << /Length ' + rawDeflate.length + ' >> stream\n', 'latin1'),
  rawDeflate,
  Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1')
]);
ok(/Dijkstra/.test(EX.extractPdfTextLite(compressedPdf)),
  'text pulled from a Flate-compressed content stream');
let garbageOk = true;
try{ EX.extractPdfTextLite(Buffer.from('not a pdf at all')); }
catch(e){ garbageOk = false; }
ok(garbageOk, 'garbage input degrades gracefully (never throws)');
if (fs.existsSync(__dirname + '/sample-networks.pdf')){
  const real = EX.extractPdfTextLite(fs.readFileSync(__dirname + '/sample-networks.pdf'));
  ok(real.length > 0 && /(network|subnet|routing|tcp)/i.test(real),
    'sample-networks.pdf yields networking vocabulary (' + real.trim().slice(0, 60) + '...)');
}else{
  ok(true, 'sample-networks.pdf absent — real-PDF probe skipped');
}

/* ================= 8. threshold audit ================= */
console.log('\nthreshold audit: no hard-coded subject dictionary');
/* Comments may USE other subjects as examples; only live code is audited. */
const noComments = guardSlice
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
ok(!/trophic|photosynthesis|exception hierarchy/i.test(noComments),
  'the guard code contains no other-subject special cases');
ok(!/Computer Networks/i.test(noComments),
  'the guard code hard-codes no subject name');
const stopBlock = /const stop = new Set\(\[([\s\S]*?)\]\);/.exec(guardSlice);
ok(!!stopBlock && !/\b(tcp|routing|subnet|dijkstra)\b/i.test(stopBlock[1]),
  'the stop list holds only generic English words, no networking terms');
ok(!!stopBlock && !/\b(trophic|biomass|ecosystem)\b/i.test(stopBlock[1]),
  'the stop list holds only generic English words, no ecology terms');

/* ================= 9. live pipeline, stubbed model (both paths) =================
   Boots the real server.js internals with fetch stubbed: the model answers
   with a fluent ENVIRONMENTAL SCIENCE pack for the Computer Networks PDF,
   twice. Both the single-shot and the chunked path must reject it with the
   subject message — proving the gate actually fires inside the pipeline. */
console.log('\nlive pipeline: off-subject model output is rejected (both paths)');
const os = require('node:os');
const path = require('node:path');
const cut = src.indexOf('const server = http.createServer');
if (cut < 0) throw new Error('server bootstrap not located');
let poolFetch = () => { throw new Error('poolFetch not set'); };
const pool = {
  module: { exports: {} }, exports: {}, require, __dirname, __filename: path.join(__dirname, 'server.js'),
  process: { env: { GEMINI_API_KEY: 'k-fidelity', GEMINI_MODEL: 'm-one', GEMINI_MODELS: 'm-one',
      PORT: '4299', XAMCODE_QUOTA_FILE: path.join(os.tmpdir(), 'xc-fidelity-' + process.pid + '.json'),
      PDF_GENERATIONS_PER_DAY: '9' },
    hasOwnProperty: Object.hasOwn },
  Buffer, URL, fetch: (...a) => poolFetch(...a),
  setTimeout, clearTimeout, setInterval, clearInterval,
  AbortController, TextEncoder, Intl, console: { log(){}, warn(){}, error(){} }
};
pool.globalThis = pool;
vm.createContext(pool);
vm.runInContext(src.slice(0, cut) + '\n' + guardSlice + '\n' + promptSlice +
  '\nglobalThis.__p = { createAnalyzeJob, runAnalyzeJob, runChunkedJob };', pool,
  { filename: 'server-pipeline.js' });
const P = pool.__p;

const offConcepts = [0, 1, 2, 3].map(i => ({
  title: 'Trophic Level ' + i + ' Energy Flow',
  summary: 'Energy moves between trophic levels in the ecosystem.',
  explanation: 'Producers, consumers and decomposers pass biomass energy along the trophic levels.',
  sourceExcerpt: 'Producers capture sunlight in the ecosystem.', sourcePage: 1,
  keyPoints: ['trophic levels move energy', 'biomass flows upward', 'decomposers recycle nutrients'],
  whyItMatters: 'It matters for ecology.', analogy: 'A food web.',
  explanationLevels: { simple: 's', everyday: 'e', advanced: 'a' },
  commonTrap: 'c', correctiveTruth: 'ct',
  comparison: { firstLabel: 'A', secondLabel: 'B', takeaway: 't',
    rows: [{ aspect: 'x', first: '1', second: '2' }, { aspect: 'y', first: '3', second: '4' },
      { aspect: 'z', first: '5', second: '6' }] },
  originStory: 'o', realWorldExamples: [{ title: 'ex', description: 'd' }],
  workedExample: { scenario: 'w', answer: 'a',
    steps: [{ label: 'l', action: 'a', reasoning: 'r' }, { label: 'l2', action: 'a2', reasoning: 'r2' }] },
  quickRecall: 'q',
  cheatCode: { why: '1', like: '2', wrong: '3', right: '4', oneLine: '5',
    mnemonic: 'eco' + i, see: ['a', 'b', 'c'] },
  visualization: { caption: 'cap', steps: [{ title: 's' + i, description: 'd', layout: 'flow',
    nodes: [{ label: 'trophic ' + i, detail: 'ecology' }, { label: 'biomass', detail: 'energy' },
      { label: 'ecosystem', detail: 'habitat' }] }] }
}));
const offOutline = { title: 'Ecosystems', subject: 'Environmental Science',
  summary: 'Trophic levels inside ecosystems.',
  units: [0, 1, 2].map(i => ({ title: 'Unit ' + i, overview: 'o', learningGoals: ['g1', 'g2'],
    topics: [{ title: 'Topic ' + i, overview: 'o', conceptIndices: [i] }] })),
  concepts: offConcepts };
const offUnit = { topics: [{ title: 'Topic 0', overview: 'o', conceptIndices: [0, 1, 2] }],
  concepts: offConcepts.slice(0, 3) };
const gemReply = obj => ({ ok: true, status: 200,
  headers: { get: () => null, has: () => false },
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
let stubCalls = 0;
poolFetch = async (url, init) => {
  stubCalls++;
  let text = '';
  try{ text = String((JSON.parse(init.body).contents[0].parts || []).map(p => p.text || '').join(' ')); }catch{}
  if (/course plan ONLY/.test(text)) return gemReply({ title: 'Ecosystems', subject: 'Environmental Science',
    summary: 's', units: [0, 1, 2].map(i => ({ title: 'Unit ' + i, overview: 'o', learningGoals: ['g1', 'g2'],
      topics: [{ title: 'Topic ' + i, overview: 'o' }] })) });
  if (/ONLY the learning content/.test(text)) return gemReply(offUnit);
  return gemReply(offOutline);
};
const pdfBuf = fs.readFileSync(path.join(__dirname, 'sample-networks.pdf'));

(async () => {
  const jobA = P.createAnalyzeJob(pdfBuf, 'standard', 'fid-1');
  await P.runAnalyzeJob(jobA);
  ok(jobA.status === 'failed' && /does not match/i.test(jobA.error || ''),
    'single-shot path rejects the off-subject answer (' + jobA.error + ')');
  ok(stubCalls >= 2, 'single-shot path retried once before failing (' + stubCalls + ' model calls)');

  stubCalls = 0;
  const jobB = P.createAnalyzeJob(pdfBuf, 'standard', 'fid-2');
  await P.runChunkedJob(jobB);
  ok(jobB.status === 'failed' && /does not match/i.test(jobB.error || ''),
    'chunked path rejects the off-subject unit (' + jobB.error + ')');

  console.log('\n' + (fail === 0
    ? '*** SUBJECT FIDELITY PASS (' + pass + ') ***'
    : '*** SUBJECT FIDELITY FAIL: ' + fail + ' failed, ' + pass + ' passed ***'));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
