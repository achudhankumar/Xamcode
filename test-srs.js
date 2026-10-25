'use strict';

const { calculateSM2, RATINGS, SRSCardStore } = require('./lib/srs-engine');

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
console.log('TEST: PHASE A2 — SPACED REPETITION (SM-2) & DAILY REVIEW');
console.log('============================================================\n');

// 1. SM-2 Sequence Progression Verification
console.log('--- Testing SM-2 Sequence Progression ---');

// Fresh card rated Good -> reps 1, interval 1
let step1 = calculateSM2({ repetitions: 0, intervalDays: 0, easeFactor: 2.5, rating: RATINGS.GOOD });
assert(step1.repetitions === 1 && step1.intervalDays === 1, 'First rating Good gives 1-day interval');

// Rated Good second time -> reps 2, interval 6
let step2 = calculateSM2({ repetitions: step1.repetitions, intervalDays: step1.intervalDays, easeFactor: step1.easeFactor, rating: RATINGS.GOOD });
assert(step2.repetitions === 2 && step2.intervalDays === 6, 'Second rating Good gives 6-day interval');

// Rated Good third time -> reps 3, interval 6 * 2.5 = 15 days
let step3 = calculateSM2({ repetitions: step2.repetitions, intervalDays: step2.intervalDays, easeFactor: step2.easeFactor, rating: RATINGS.GOOD });
assert(step3.repetitions === 3 && step3.intervalDays === 15, 'Third rating Good scales by ease factor (15 days)');

// Student forgets card (Again) -> resets reps to 0, interval 1, lowers ease
let stepFail = calculateSM2({ repetitions: step3.repetitions, intervalDays: step3.intervalDays, easeFactor: step3.easeFactor, rating: RATINGS.AGAIN });
assert(stepFail.repetitions === 0 && stepFail.intervalDays === 1, 'Rating Again resets repetitions to 0 and interval to 1');
assert(stepFail.easeFactor < step3.easeFactor, 'Rating Again lowers ease factor');

// Rating Easy on fresh card gives 4-day interval and increases ease
let stepEasy = calculateSM2({ repetitions: 0, intervalDays: 0, easeFactor: 2.5, rating: RATINGS.EASY });
assert(stepEasy.intervalDays === 4 && stepEasy.easeFactor > 2.5, 'Rating Easy grants bonus initial interval (4 days) and increases ease');

// 2. Card Creation & Daily Review Queue Verification
console.log('\n--- Testing Daily Review Queue & Session Caps ---');
const store = new SRSCardStore();
const testUserId = 'student_alex';

// Add cards from flashcard mode
store.addCard({
  userId: testUserId,
  topicId: 'cn-hamming',
  front: 'What is the minimum Hamming distance to correct 1-bit errors?',
  back: 'd_min >= 2t + 1 = 3',
  source: 'flashcard'
});

// Add card from missed quiz question
store.addCard({
  userId: testUserId,
  topicId: 'cn-sliding-window',
  front: 'In Go-Back-N with 3-bit seq numbers, what is max window size?',
  back: '2^3 - 1 = 7 (not 8, to avoid ambiguity)',
  source: 'missed_quiz'
});

// Add 25 more cards to test 20-card session cap
for (let i = 0; i < 25; i++) {
  store.addCard({
    userId: testUserId,
    topicId: `topic_${i}`,
    front: `Question ${i + 1}`,
    back: `Answer ${i + 1}`
  });
}

const reviewSession = store.getDueCards(testUserId, 20);
assert(reviewSession.cards.length === 20, `Daily Review caps active session at exactly 20 cards (got ${reviewSession.cards.length})`);
assert(reviewSession.totalDue === 27, `Accurately reports total due count across courses (got ${reviewSession.totalDue})`);
assert(reviewSession.hasMore === true, 'Offers student "Continue Session" option when queue exceeds 20 cards');

// Reviewing a card reschedules it into the future so it drops from the immediate queue
const firstCard = reviewSession.cards[0];
store.recordReview(firstCard.id, RATINGS.GOOD);
const updatedReview = store.getDueCards(testUserId, 20);
assert(updatedReview.totalDue === 26, 'Reviewed card is rescheduled to next interval and removed from immediate due queue');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
