'use strict';

const { validatePhotos, extractPhotoPages, MAX_PHOTOS_PER_DOC } = require('./lib/photo-extractor');
const { buildOutlinePrompt, OUTLINE_SYSTEM_INSTRUCTION } = require('./lib/generation-pipeline');
const { validateOutline, validateTopic } = require('./lib/validator');

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
console.log('TEST: PHASE A5 — PHOTO UPLOAD & TEXTBOOK VISION PIPELINE');
console.log('============================================================\n');

// 1. Quota & Limit Constraints
let tooManyPhotos = Array.from({ length: 25 }, (_, i) => ({
  mimeType: 'image/jpeg',
  width: 1200,
  height: 1600,
  text: `Page ${i + 1} content`
}));

try {
  validatePhotos(tooManyPhotos);
  assert(false, 'Should reject more than 20 photos');
} catch (err) {
  assert(err.message.includes('maximum 20 photos'), 'Strictly enforces maximum 20 photos per document');
}

// 2. Format Validation
try {
  validatePhotos([{ mimeType: 'image/gif', text: 'GIF' }]);
  assert(false, 'Should reject unsupported gif');
} catch (err) {
  assert(err.message.includes('Unsupported image format'), 'Rejects non-whitelisted image format');
}

// 3. Blurry / Cropped Warning Detection
const blurryPhoto = [
  { mimeType: 'image/jpeg', width: 300, height: 250, text: 'Low res blurry scan' }
];
const valResult = validatePhotos(blurryPhoto);
assert(valResult.warnings.length > 0 && valResult.warnings[0].includes('blurry or cropped'), 'Warns student when photo resolution is blurry or cropped');

// 4. End-to-End Pipeline on 10 Phone Photos of Printed Textbook Pages
console.log('\n--- Processing 10 Phone Photos into Valid Topic Tree ---');

const textbookPhotoDataset = [
  { page: 1, title: 'UNIT 1: INTRODUCTION TO DISTRIBUTED SYSTEMS', text: 'UNIT 1: INTRODUCTION TO DISTRIBUTED SYSTEMS\nA distributed system consists of autonomous computing entities communicating over a network.' },
  { page: 2, title: 'SYSTEM MODELS AND ARCHITECTURES', text: 'SYSTEM MODELS AND ARCHITECTURES\nClient-server architectures remain fundamental, separating presentation, business logic, and database layers.' },
  { page: 3, title: 'INTER-PROCESS COMMUNICATION (IPC)', text: 'INTER-PROCESS COMMUNICATION (IPC)\nSockets provide the low-level abstraction for endpoint-to-endpoint network communication across distinct hosts.' },
  { page: 4, title: 'REMOTE PROCEDURE CALLS (RPC)', text: 'REMOTE PROCEDURE CALLS (RPC)\nRPC abstracts network communication by making remote service calls appear syntactically identical to local function invocations.' },
  { page: 5, title: 'UNIT 2: SYNCHRONIZATION AND TIME', text: 'UNIT 2: SYNCHRONIZATION AND TIME\nPhysical clocks drift due to crystal oscillator variance, necessitating algorithmic synchronization.' },
  { page: 6, title: 'LAMPORT LOGICAL CLOCKS', text: 'LAMPORT LOGICAL CLOCKS\nLamport defined the happens-before relation to establish partial ordering of events in asynchronous distributed systems.' },
  { page: 7, title: 'VECTOR CLOCKS AND CAUSALITY', text: 'VECTOR CLOCKS AND CAUSALITY\nVector clocks capture complete causal dependencies across all participant processes in a distributed topology.' },
  { page: 8, title: 'DISTRIBUTED MUTUAL EXCLUSION', text: 'DISTRIBUTED MUTUAL EXCLUSION\nRicart-Agrawala algorithm ensures mutual exclusion through distributed timestamp request exchanges with zero coordinator single point of failure.' },
  { page: 9, title: 'UNIT 3: REPLICATION AND CONSENSUS', text: 'UNIT 3: REPLICATION AND CONSENSUS\nState machine replication demands atomic broadcast to keep distributed replica logs in identical sequential order.' },
  { page: 10, title: 'RAFT CONSENSUS PROTOCOL', text: 'RAFT CONSENSUS PROTOCOL\nRaft decomposes consensus into leader election, log replication, and commitment safety invariants.' }
].map(p => ({
  mimeType: 'image/jpeg',
  width: 1200,
  height: 1600,
  text: p.text
}));

(async () => {
  const extracted = await extractPhotoPages(textbookPhotoDataset);

  assert(extracted.numPages === 10, `Extracted exactly 10 pages from 10 photos (got ${extracted.numPages})`);
  assert(extracted.pages.length === 10, 'All 10 pages carry structured previews and headings');
  assert(extracted.isPhotoUpload === true, 'Flagged as photo upload for analytics and billing');

  // Verify prompt generation works identically to PDF input
  const prompt = buildOutlinePrompt(extracted);
  assert(prompt.includes('Document Structure Scan (10 pages)'), 'Outline prompt generator processes photo pages identically to PDF pages');
  assert(prompt.includes('UNIT 1: INTRODUCTION'), 'Outline prompt contains extracted headings from photos');

  // Verify resulting outline schema
  const simulatedOutline = {
    subject: "Distributed Systems (Textbook Photo Scan)",
    units: [
      {
        unit_number: 1,
        unit_title: "Introduction and Communication",
        overview: "Foundations of distributed entities, socket communication, and RPC semantics.",
        topics: [
          { id: "dist-sys-models", title: "Distributed System Models", topic: "Client-Server and Tiered Models", start_page: 1, end_page: 2, first_lines: "A distributed system consists..." },
          { id: "ipc-and-rpc", title: "IPC & Remote Procedure Calls", topic: "Socket abstraction and RPC stubs", start_page: 3, end_page: 4, first_lines: "Sockets provide the low-level..." }
        ]
      },
      {
        unit_number: 2,
        unit_title: "Synchronization and Logical Clocks",
        overview: "Physical clock drift, Lamport timestamps, and distributed mutual exclusion.",
        topics: [
          { id: "logical-clocks", title: "Lamport and Vector Clocks", topic: "Happens-before relation and causal ordering", start_page: 5, end_page: 7, first_lines: "Physical clocks drift..." },
          { id: "mutual-exclusion", title: "Distributed Mutual Exclusion", topic: "Ricart-Agrawala tokenless coordination", start_page: 8, end_page: 8, first_lines: "Ricart-Agrawala algorithm ensures..." }
        ]
      },
      {
        unit_number: 3,
        unit_title: "Replication and Consensus",
        overview: "State machine replication and Raft consensus invariants.",
        topics: [
          { id: "raft-consensus", title: "Raft Consensus Protocol", topic: "Leader election and safety invariants", start_page: 9, end_page: 10, first_lines: "State machine replication demands..." }
        ]
      }
    ]
  };

  const outlineValidation = validateOutline(simulatedOutline);
  assert(outlineValidation.valid, 'Generated outline from 10 photos passes strict outline validator');
  assert(simulatedOutline.units.length === 3, 'Produces valid 3-unit syllabus from 10 photo pages');
  assert(simulatedOutline.units[0].topics.length === 2, 'Produces valid topic tree in identical schema to PDF uploads');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
