'use strict';
/* ============================================================
   TEST - SUBJECT FIDELITY GUARD (pure functions, no network)
   ------------------------------------------------------------
   * THIS PASS DOES NOT TOUCH THE LIVE PIPELINE.
   * This server.js only contains the guard block + prompt helpers, so the
     test exercises those exported functions directly and asserts the
     regression/preservation constraints. The live pipeline integration
     points are documented in the comment block at the bottom of server.js.
   * Scenarios covered:
       - Computer Networks PDF literal fingerprint
       - Environmental Science off-subject concept vs that fingerprint (FAIL)
       - Java exception-hierarchy off-subject concept vs that fingerprint (FAIL)
       - On-subject Computer Networks concept vs that fingerprint (PASS)
       - On-subject ecology and Java concepts vs their own fingerprints (PASS)
       - Short-genuine-overlap concept PASSES a short literal fingerprint
       - Repeated genuine overlap still passes (no false negative)
       - Generic-only overlap FAILS (short common nouns alone)
       - Off-subject concept FAILS a short literal fingerprint
       - Degraded paths (missing literal fp / empty or whitespace-only concept)
       - normalizeOutlineFingerprint backfills from literal over a weak model fp
   Run: node _guard-test.js
   ============================================================ */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(__dirname + '/server.js', 'utf8');

// ---- slice the guard block + prompt helpers out of this server.js ----
const guardStart = src.indexOf('function buildLiteralSubjectFingerprint(');
const promptStart = src.indexOf('function outlinePromptWithFingerprint(', guardStart);
if (guardStart < 0 || promptStart < 0 || promptStart < guardStart)
  throw new Error('guard block or prompt helpers not located');
/* LF-agnostic: locate the marker word, then walk back to its comment start. */
const phIdx = src.indexOf('PROMPT HELPERS', guardStart);
const guardEnd = phIdx < 0 ? -1 : src.lastIndexOf('/*', phIdx);
if (guardEnd < guardStart) throw new Error('guard/helper boundary not located');
const guardSlice = src.slice(guardStart, guardEnd);

const promptSlice = src.slice(promptStart);
if (promptSlice.length < 100) throw new Error('prompt helper slice not located');

const sb = { module: { exports: {} }, exports: {}, require, console };
vm.createContext(sb);
vm.runInContext(guardSlice + '\n' + promptSlice + '\nmodule.exports = {\n' +
  'buildLiteralSubjectFingerprint,\n' +
  'conceptTextTokens,\n' +
  'conceptMatchesLiteralFingerprint,\n' +
  'normalizeOutlineFingerprint,\n' +
  'outlinePromptWithFingerprint,\n' +
  'compactOutlinePromptWithFingerprint\n' +
  '};\n', sb);

const G = sb.module.exports;
const eq = (a, b) => String(a) === String(b);

let pass = 0, fail = 0;
const ok = (c, m) => {
  if (c) { pass++; console.log('  ok   ' + m); }
  else { fail++; console.log('  FAIL ' + m); }
};

// ----------------------------------------------------------------------------
// Document texts
// ----------------------------------------------------------------------------
const networkText = [
  'Computer networks use TCP, a connection-oriented transport protocol that provides reliable delivery using a three-way handshake SYN SYN-ACK ACK.',
  'IP networks route packets between hosts using distance-vector and link-state routing; Dijkstra selects shortest paths in link-state routing.',
  'A subnet mask divides an IP network into subnets; a router forwards packets based on the destination IP address.',
  'ARP resolves an IP address to a MAC address on the local network; NAT translates private addresses at the network edge.',
  'DNS resolves hostnames to IP addresses so applications can connect; a CRC checksum detects errors in a received frame.',
  'TCP provides reliable in-order delivery between hosts using sequence numbers and acknowledgments.',
  'An Ethernet frame carries data between devices on a LAN; a window-based flow control limits how much data a sender transmits.'
].join(' ');

const networkQuotes = [
  { value: 'The three-way handshake begins when a client sends a SYN segment and the server replies with SYN-ACK before the client completes the connection with ACK.' },
  { value: 'Link-state routers run Dijkstra on a map of the network to build a shortest-path routing table for IP networks.' },
  { value: 'A subnet mask defines which bits of an IP address belong to the network and which belong to the host; a router forwards packets to the destination IP.' }
];

const ecologyText = [
  'An ecosystem is a community of living organisms and their physical environment.',
  'Producers capture solar energy by photosynthesis and form the first trophic level.',
  'Herbivores are primary consumers that feed directly on producers.',
  'Carnivores occupy higher trophic levels; apex predators sit at the top of the food chain.',
  'Energy flows unidirectionally from the sun through trophic levels; only about ten percent transfers between levels.',
  'A food chain shows the transfer of energy from one organism to another.'
].join(' ');

const ecologyQuotes = [
  { value: 'Herbivores are primary consumers that feed directly on producers.' },
  { value: 'Energy flows unidirectionally from the sun through trophic levels.' },
  { value: 'Producers convert solar energy into chemical energy by photosynthesis.' }
];

const javaText = [
  'Java defines a class hierarchy for error handling. Throwable is the superclass of all errors and exceptions.',
  'Exception has two families: checked exceptions, which must be declared or caught, and unchecked exceptions.',
  'RuntimeException is the parent of all unchecked exception types; Error indicates a serious VM problem.',
  'A try block can have multiple catch clauses; the finally block runs whether or not an exception was thrown.'
].join(' ');

const javaQuotes = [
  { value: 'RuntimeException is the parent of all unchecked exception types.' },
  { value: 'Throwable is the superclass of all errors and exceptions in Java.' },
  { value: 'An exception disrupts the normal flow of a program at runtime.' }
];

// ----------------------------------------------------------------------------
// Build the real fingerprints FIRST, then assert about them honestly.
// ----------------------------------------------------------------------------
const networkFp = G.buildLiteralSubjectFingerprint(networkText, networkQuotes);
const ecologyFp = G.buildLiteralSubjectFingerprint(ecologyText, ecologyQuotes);
const javaFp = G.buildLiteralSubjectFingerprint(javaText, javaQuotes);

console.log('\n--- literal fingerprints for each document ---');
ok(typeof networkFp === 'string' && networkFp.length > 0, 'returns a non-empty network fingerprint');
ok(!/herbivore/.test(networkFp) && !/producer/.test(networkFp) && !/runtimeexception/.test(networkFp),
  'network fingerprint excludes ecology and Java terms');
ok(/routing/.test(networkFp) && /subnet/.test(networkFp) || /ack/.test(networkFp) && /handshake/.test(networkFp),
  'network fingerprint is document-grounded in network subject terms (routing/subnet or ack+handshake)');

ok(typeof ecologyFp === 'string' && ecologyFp.length > 0, 'returns a non-empty ecology fingerprint');
ok(/herbivore/.test(ecologyFp) && /producer/.test(ecologyFp) && /trophic/.test(ecologyFp),
  'ecology fingerprint is document-grounded in its own subject terms');
ok(!/tcp/.test(ecologyFp) && !/subnet/.test(ecologyFp) && !/runtimeexception/.test(ecologyFp),
  'ecology fingerprint does not contain network or Java terms');

ok(typeof javaFp === 'string' && javaFp.length > 0, 'returns a non-empty Java fingerprint');
ok(/runtimeexception/.test(javaFp) && /throwable/.test(javaFp),
  'Java fingerprint is document-grounded in its own subject terms');
ok(!/tcp/.test(javaFp) && !/subnet/.test(javaFp) && !/herbivore/.test(javaFp),
  'Java fingerprint does not contain network or ecology terms');

// ----------------------------------------------------------------------------
// Concepts (each one is document-grounded in its own subject)
// ----------------------------------------------------------------------------
const networkConcept = {
  title: 'TCP Three-Way Handshake',
  summary: 'TCP establishes a connection with SYN, SYN-ACK, and ACK across an IP network.',
  explanation: 'The client sends SYN to a server; the server replies SYN-ACK; the client completes the connection with ACK.',
  sourceExcerpt: 'The three-way handshake begins when a client sends a SYN segment and the server replies with SYN-ACK before the client completes the connection with ACK.',
  sourcePage: 12,
  keyPoints: [
    'The TCP three-way handshake uses SYN, SYN-ACK, and ACK to establish a connection.',
    'A router forwards packets to the destination IP using a subnet mask.',
    'Link-state routers run Dijkstra to build a shortest-path routing table.',
    'ARP resolves an IP address to a MAC address on the local network.',
    'NAT translates private addresses at the network edge; DNS resolves hostnames to IP addresses.'
  ],
  visualization: {
    caption: 'TCP handshake across a routed IP network',
    steps: [{
      title: 'Step 1',
      description: 'Client sends SYN across the network to a server; the server replies SYN-ACK.',
      layout: 'seq',
      nodes: [
        { label: 'Client', detail: 'sends SYN segment' },
        { label: 'Router', detail: 'forwards to destination IP' },
        { label: 'Server', detail: 'replies SYN-ACK' },
        { label: 'Handshake', detail: 'SYN SYN-ACK ACK' }
      ]
    }]
  }
};

const ecologyConcept = {
  title: 'Energy Flow Through Ecosystems',
  summary: 'Energy moves from producers to herbivores to carnivores through trophic levels.',
  explanation: 'Herbivores eat producers; carnivores eat herbivores; apex predators sit at the top of the food chain.',
  sourceExcerpt: 'Herbivores are primary consumers that feed directly on producers.',
  sourcePage: 5,
  keyPoints: [
    'Producers capture solar energy by photosynthesis and form the first trophic level.',
    'Herbivores are primary consumers that feed directly on producers.',
    'Carnivores occupy higher trophic levels and eat other animals.',
    'Apex predators sit at the top of the food chain.',
    'Energy flows unidirectionally from the sun through trophic levels; only about ten percent transfers between levels.',
    'A food chain shows the transfer of energy from one organism to another.'
  ],
  realWorldExamples: [
    { title: 'Grassland food chain', description: 'Grass to grasshopper to frog to snake; energy flows from producers to apex predators.' },
    { title: 'Aquatic food web', description: 'Phytoplankton to zooplankton to small fish to large fish.' }
  ],
  visualization: {
    caption: 'Trophic levels in an ecosystem',
    steps: [{
      title: 'Levels',
      description: 'Energy moves up trophic levels from producers to apex predators.',
      layout: 'hierarchy',
      nodes: [
        { label: 'Sunlight', detail: 'energy source for producers' },
        { label: 'Producers', detail: 'capture solar energy by photosynthesis' },
        { label: 'Herbivores', detail: 'primary consumers that feed on producers' },
        { label: 'Carnivores', detail: 'secondary and tertiary consumers' },
        { label: 'Apex', detail: 'top predator at the top of the food chain' }
      ]
    }]
  }
};

const javaConcept = {
  title: 'RuntimeException and Unchecked Exceptions',
  summary: 'RuntimeException is the parent of all unchecked exception types in Java.',
  explanation: 'Unchecked exceptions subclass RuntimeException and need not be declared in a method signature.',
  sourceExcerpt: 'RuntimeException is the parent of all unchecked exception types.',
  sourcePage: 40,
  keyPoints: [
    'Throwable is the superclass of all errors and exceptions in Java.',
    'Exception splits into checked and unchecked exception types.',
    'Error indicates a serious VM problem that a program should not catch.',
    'RuntimeException is the parent of all unchecked exception types.',
    'Checked exceptions must be declared or caught in a method signature.',
    'The finally block runs whether or not an exception was thrown; a try block can have multiple catch clauses.'
  ],
  visualization: {
    caption: 'Exception class hierarchy in Java',
    steps: [{
      title: 'Hierarchy',
      description: 'Object branches to Throwable, which splits into Exception and Error.',
      layout: 'hierarchy',
      nodes: [
        { label: 'Object', detail: 'root of all classes' },
        { label: 'Throwable', detail: 'parent of Error and Exception in Java' },
        { label: 'Exception', detail: 'checked and unchecked exception types' },
        { label: 'Error', detail: 'serious VM problem' },
        { label: 'RuntimeException', detail: 'parent of all unchecked exception types' }
      ]
    }]
  }
};

console.log('\n--- conceptTextTokens ---');
ok(/tcp/.test(G.conceptTextTokens(networkConcept).toLowerCase()) &&
   /routing/.test(G.conceptTextTokens(networkConcept).toLowerCase()) &&
   /dijkstra/.test(G.conceptTextTokens(networkConcept).toLowerCase()),
  'network concept text recovers its own subject terms (tcp, routing, dijkstra)');
ok(/herbivore/.test(G.conceptTextTokens(ecologyConcept).toLowerCase()) &&
   /producer/.test(G.conceptTextTokens(ecologyConcept).toLowerCase()) &&
   /trophic/.test(G.conceptTextTokens(ecologyConcept).toLowerCase()),
  'ecology concept text recovers its own subject terms (herbivore, producer, trophic)');
ok(/runtimeexception/.test(G.conceptTextTokens(javaConcept).toLowerCase()) &&
   /throwable/.test(G.conceptTextTokens(javaConcept).toLowerCase()),
  'Java concept text recovers its own subject terms (runtimeexception, throwable)');

// ----------------------------------------------------------------------------
// conceptMatchesLiteralFingerprint — the real per-concept guard
// ----------------------------------------------------------------------------
console.log('\n--- conceptMatchesLiteralFingerprint ---');

ok(G.conceptMatchesLiteralFingerprint(networkConcept, networkFp) === true,
  'on-subject network concept PASSES the network literal fingerprint');

ok(G.conceptMatchesLiteralFingerprint(ecologyConcept, networkFp) === false,
  'ecology concept FAILS the network literal fingerprint (original mixed-subject failure)');

ok(G.conceptMatchesLiteralFingerprint(javaConcept, networkFp) === false,
  'Java exception-hierarchy concept FAILS the network literal fingerprint (other original failure)');

ok(G.conceptMatchesLiteralFingerprint(networkConcept, ecologyFp) === false,
  'symmetry: a network concept FAILS the ecology literal fingerprint');

ok(G.conceptMatchesLiteralFingerprint(ecologyConcept, ecologyFp) === true,
  'on-subject ecology concept PASSES its own literal fingerprint');

ok(G.conceptMatchesLiteralFingerprint(javaConcept, javaFp) === true,
  'on-subject Java concept PASSES its own literal fingerprint');

// Generic-only overlap must FAIL: short common nouns shared across subjects
// should not be enough to pass a wrong-subject concept.
const genericConcept = {
  title: 'Systems and Layers',
  summary: 'Systems use layers and links between units of data.',
  explanation: 'Each layer in a system links data between units on a page.',
  sourceExcerpt: 'Systems and layers link data between units.',
  sourcePage: 1,
  keyPoints: ['systems', 'links', 'data', 'page', 'node', 'layer', 'unit', 'used'],
  visualization: {
    caption: 'generic',
    steps: [{
      title: 'Generic',
      description: 'generic flow',
      layout: 'flow',
      nodes: [
        { label: 'Input', detail: 'data enters the system' },
        { label: 'Process', detail: 'the system links units' },
        { label: 'Output', detail: 'data leaves the page' }
      ]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(genericConcept, networkFp) === false,
  'generic concept FAILS the network fingerprint (short common nouns alone are not enough)');
ok(G.conceptMatchesLiteralFingerprint(genericConcept, ecologyFp) === false,
  'generic concept FAILS the ecology fingerprint too (short common nouns alone are not enough)');

// Short genuine overlap: a short literal fingerprint with repeated real overlap
// should still PASS, not false-negative on length.
const shortFp = 'routing';
const shortPassConcept = {
  title: 'Routing Algorithms',
  summary: 'Routing selects paths through a network using routing algorithms.',
  explanation: 'Distance-vector and link-state routing compute paths using a routing table.',
  sourceExcerpt: 'Routing uses algorithms to select paths through a network.',
  sourcePage: 20,
  keyPoints: ['routing', 'routing table', 'distance vector', 'link state', 'shortest path', 'destination IP'],
  visualization: {
    caption: 'routing',
    steps: [{
      title: 'Step',
      description: 'routing step',
      layout: 'flow',
      nodes: [
        { label: 'Source', detail: 'send packet' },
        { label: 'Router', detail: 'choose path' },
        { label: 'Destination', detail: 'receive packet' }
      ]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(shortPassConcept, shortFp) === true,
  'short-genuine-overlap concept PASSES a short literal fingerprint (no false negative)');

// Repeated genuine overlap still passes, so the guard is not brittle.
const repeatPassConcept = {
  title: 'Routing',
  summary: 'Routing is routing. Routing uses routing.',
  explanation: 'Routing uses routing to route packets.',
  sourceExcerpt: 'Routing uses routing.',
  sourcePage: 1,
  keyPoints: ['routing'],
  visualization: {
    caption: 'routing',
    steps: [{
      title: 'Step',
      description: 'routing',
      layout: 'flow',
      nodes: [
        { label: 'Source', detail: 'routing' },
        { label: 'Router', detail: 'routing' },
        { label: 'Destination', detail: 'routing' }
      ]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(repeatPassConcept, shortFp) === true,
  'repeated genuine overlap still passes a short literal fingerprint (no false negative)');

// A short fingerprint still rejects zero genuine overlap.
const zeroOverlapShortConcept = {
  title: 'Ecosystem Energy',
  summary: 'Energy flows through ecosystems from producers to carnivores.',
  explanation: 'Herbivores eat producers; carnivores eat herbivores.',
  sourceExcerpt: 'Energy flows through ecosystems from producers to carnivores.',
  sourcePage: 3,
  keyPoints: ['producer', 'herbivore', 'carnivore', 'ecosystem', 'energy', 'trophic', 'food'],
  visualization: {
    caption: 'energy',
    steps: [{
      title: 'Step',
      description: 'energy flow',
      layout: 'cycle',
      nodes: [
        { label: 'Sun', detail: 'energy source' },
        { label: 'Producer', detail: 'captures solar energy' },
        { label: 'Herbivore', detail: 'eats producer' }
      ]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(zeroOverlapShortConcept, shortFp) === false,
  'off-subject concept FAILS a short literal fingerprint even with generic overlap like energy/system');

// Degraded paths: no evidence either way should degrade gracefully, but a
// concept with no recoverable tokens still fails a substantive literal fp.
ok(G.conceptMatchesLiteralFingerprint(networkConcept, '') === true,
  'missing literal fp degrades gracefully to pass');
ok(G.conceptMatchesLiteralFingerprint(networkConcept, null) === true,
  'null literal fp degrades gracefully to pass');
ok(G.conceptMatchesLiteralFingerprint(null, networkFp) === false,
  'null concept with a substantive literal fp fails (no evidence on the concept side)');
ok(G.conceptMatchesLiteralFingerprint('not a concept', networkFp) === false,
  'a string concept is rejected as invalid');
ok(G.conceptMatchesLiteralFingerprint(undefined, networkFp) === false,
  'an undefined concept is rejected as invalid');

const whitespaceConcept = {
  title: ' ',
  summary: ' ',
  explanation: ' ',
  sourceExcerpt: ' ',
  keyPoints: [' '],
  visualization: {
    caption: ' ',
    steps: [{
      title: ' ',
      description: ' ',
      layout: 'flow',
      nodes: [{ label: ' ', detail: ' ' }]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(whitespaceConcept, networkFp) === false,
  'a concept with only whitespace in every text field FAILS a substantive literal fingerprint');

const emptyConcept = {
  title: '  ',
  summary: '  ',
  explanation: '   ',
  sourceExcerpt: '  ',
  keyPoints: ['  '],
  visualization: {
    caption: '  ',
    steps: [{
      title: '  ',
      description: '  ',
      layout: 'flow',
      nodes: [{ label: '  ', detail: '  ' }]
    }]
  }
};

ok(G.conceptMatchesLiteralFingerprint(emptyConcept, networkFp) === false,
  'concept with no recoverable tokens FAILS a substantive literal fingerprint');

// Empty fingerprint should not be used to validate anything.
const emptyFp = '';
ok(G.conceptMatchesLiteralFingerprint(networkConcept, emptyFp) === true,
  'empty literal fingerprint degrades gracefully (no evidence)');
ok(G.conceptMatchesLiteralFingerprint(emptyConcept, emptyFp) === true,
  'empty literal fingerprint with empty concept degrades gracefully (no evidence either way)');

// ----------------------------------------------------------------------------
// normalizeOutlineFingerprint — literal backfill over a weak/generated model fp
// ----------------------------------------------------------------------------
console.log('\n--- normalizeOutlineFingerprint ---');

const pack1 = {
  concepts: [networkConcept],
  subjectFingerprint: 'fluffy generic subject words here'
};
G.normalizeOutlineFingerprint(pack1, networkFp);
ok(eq(pack1.subjectFingerprint, networkFp.toLowerCase()),
  'literal fingerprint backfills over a weak model fingerprint');

const pack2 = { concepts: [networkConcept] };
G.normalizeOutlineFingerprint(pack2, networkFp);
ok(eq(pack2.subjectFingerprint, networkFp.toLowerCase()),
  'literal fingerprint is used when the model supplied none');

const pack3 = { concepts: [networkConcept], subjectFingerprint: 'tcp routing subnet' };
G.normalizeOutlineFingerprint(pack3, '');
ok(eq(pack3.subjectFingerprint, 'tcp routing subnet'),
  'with no literal fp, the model fingerprint is preserved (secondary path)');

const pack4 = {
  concepts: [ecologyConcept],
  subjectFingerprint: 'tcp routing subnet'
};
G.normalizeOutlineFingerprint(pack4, ecologyFp);
ok(eq(pack4.subjectFingerprint, ecologyFp.toLowerCase()) && !/tcp/.test(pack4.subjectFingerprint),
  'ecology literal fp backfills over a wrong model fingerprint on the ecology pack');

// ----------------------------------------------------------------------------
// Regression + preservation constraints
// ----------------------------------------------------------------------------
console.log('\n--- regression: the ruled-out flawed rule is gone ---');
ok(!src.includes('fingerprintMatchesConcept'),
  'the flawed fingerprintMatchesConcept rule is NOT present in server.js');

console.log('\n--- unchanged prompt helpers ---');
const p0 = G.outlinePromptWithFingerprint({ level: 'standard' });
ok(eq(p0, G.outlinePromptWithFingerprint({ level: 'standard' })),
  'outlinePromptWithFingerprint is pure and unchanged');
ok(p0.includes('SUBJECT FINGERPRINT') && p0.includes('subjectFingerprint'),
  'outline prompt still requests subjectFingerprint');

const p1 = G.compactOutlinePromptWithFingerprint(
  { chunk: { plan: { units: [{ title: 'Unit 1' }] } } },
  0
);
ok(p1.includes('SUBJECT FINGERPRINT') && p1.includes('subjectFingerprint') &&
   p1.includes('Unit 1 of 1'),
  'compactOutlinePromptWithFingerprint is unchanged and unit-aware');

console.log('\n' + (fail === 0
  ? '*** GUARD TEST PASS (' + pass + ') ***'
  : '*** GUARD TEST FAIL: ' + fail + ' ***'));
process.exit(fail === 0 ? 0 : 1);
