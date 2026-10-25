'use strict';

const { assembleMockTestFromCache } = require('./lib/mock-test-engine');
const { SRSCardStore } = require('./lib/srs-engine');

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
console.log('TEST: PHASE A7 — MOCK TEST ENGINE & WEAK-TOPIC DIAGNOSTICS');
console.log('============================================================\n');

// 1. Assemble 20-Question Test Offline from Cached Question Pool
console.log('--- Testing Offline Assembly from Cached Question Pools ---');
const sampleTopicPool = [
  {
    id: 'cn-hamming',
    title: 'Hamming Error Correction',
    questions: [
      { q: 'What is parity bit index?', opts: ['Powers of 2', 'Odd numbers', 'Even numbers', 'Prime numbers'], a: 0, diff: 'Easy', why: 'Parity bits are at 1, 2, 4, 8' },
      { q: 'How many parity bits for 4 data bits?', opts: ['2', '3', '4', '5'], a: 1, diff: 'Medium', why: '2^p >= p + d + 1 => p=3' }
    ]
  },
  {
    id: 'cn-sliding-window',
    title: 'Sliding Window ARQ',
    questions: [
      { q: 'What is max window in Go-Back-N?', opts: ['2^n', '2^n - 1', 'n', '2n'], a: 1, diff: 'Medium', why: 'Avoid sequence ambiguity' },
      { q: 'Does Selective Repeat buffer out-of-order frames?', opts: ['Yes', 'No', 'Sometimes', 'Never'], a: 0, diff: 'Easy', why: 'Selective Repeat has independent buffers' }
    ]
  },
  {
    id: 'cn-tcp-handshake',
    title: 'TCP Connection Handshake',
    questions: [
      { q: 'What flags are sent in Step 2?', opts: ['SYN', 'SYN-ACK', 'ACK', 'FIN'], a: 1, diff: 'Easy', why: 'Server responds with SYN-ACK' },
      { q: 'What protects against SYN floods?', opts: ['SYN Cookies', 'Larger buffers', 'UDP fallback', 'Dropping ACK'], a: 0, diff: 'Hard', why: 'Stateless cryptographic cookies' }
    ]
  }
];

// Replicate pool to ensure >= 20 questions available
while (sampleTopicPool.reduce((acc, t) => acc + t.questions.length, 0) < 25) {
  sampleTopicPool.push({
    id: `topic_extra_${sampleTopicPool.length}`,
    title: `Extra Topic ${sampleTopicPool.length}`,
    questions: [
      { q: 'Sample question 1', opts: ['A', 'B', 'C', 'D'], a: 0, diff: 'Medium', why: 'A is correct' },
      { q: 'Sample question 2', opts: ['A', 'B', 'C', 'D'], a: 2, diff: 'Hard', why: 'C is correct' }
    ]
  });
}

const session = assembleMockTestFromCache({ questionCount: 20, topicPool: sampleTopicPool });
assert(session.questions.length === 20, `Assembled exactly 20 questions for mock test (got ${session.questions.length})`);
assert(session.noHints === true, 'Hints strictly disabled during active examination');

// 2. Submit Answers (15 correct, 5 wrong across specific topics)
console.log('\n--- Simulating Test Responses & Timing ---');
for (let i = 0; i < 20; i++) {
  // Purposefully answer questions 0, 1 wrong (Hamming), and question 2 wrong (Sliding Window)
  if (i === 0 || i === 1) {
    session.submitAnswer(i, 3, 25000); // wrong answer for Hamming
  } else if (i === 2) {
    session.submitAnswer(i, 0, 35000); // wrong answer for Sliding Window
  } else if (i === 4 || i === 5) {
    session.submitAnswer(i, 3, 30000); // wrong answers for TCP
  } else {
    // Correct answers
    session.submitAnswer(i, session.questions[i].correctAnswerIndex, 20000);
  }
}

// 3. Evaluate Results, Diagnostics & SRS Dispatch
console.log('\n--- Testing Evaluation, Weak Topics & SRS Card Dispatch ---');
const srsStore = new SRSCardStore();
const results = session.evaluateResults(srsStore, 'student_test');

assert(results.totalQuestions === 20, 'Evaluates all 20 questions');
assert(results.correctCount === 15, `Scores exactly 15 correct answers (got ${results.correctCount})`);
assert(results.scorePct === 75, `Calculates 75% score (got ${results.scorePct}%)`);
assert(results.weakTopics.length > 0, 'Generates diagnostic weak topics report');

// Verify weak topics identified correctly
const topWeakTopic = results.weakTopics[0];
assert(topWeakTopic.topicId === 'cn-hamming' && topWeakTopic.missedCount === 2, 'Accurately diagnoses "Hamming Error Correction" as #1 weak topic (2 missed)');

const secondWeakTopic = results.weakTopics.find(w => w.topicId === 'cn-tcp-handshake');
assert(Boolean(secondWeakTopic) && secondWeakTopic.missedCount === 2, 'Accurately diagnoses "TCP Connection Handshake" as weak topic');

// Verify missed questions automatically dispatched into SM-2 Spaced Repetition queue
const srsDue = srsStore.getDueCards('student_test', 10);
assert(srsDue.totalDue === 5, `Dispatched all 5 missed questions into student's SM-2 spaced repetition queue (got ${srsDue.totalDue})`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
