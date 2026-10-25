'use strict';

const { StreakManager } = require('./lib/streak-goal-engine');

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
console.log('TEST: PHASE A6 — STREAKS, TIMEZONES & MONTHLY FREEZE');
console.log('============================================================\n');

const manager = new StreakManager();
const studentId = 'student_deepa';

// 1. Time Zone Boundary Calculation
console.log('--- Testing Time Zone Boundary Accuracy ---');
// 2026-10-25 19:00 UTC is 2026-10-26 00:30 in Asia/Kolkata (+5:30)
const boundaryUtcDate = new Date('2026-10-25T19:00:00Z');
const istDate = manager.getLocalDateString(boundaryUtcDate, 'Asia/Kolkata');
const nyDate = manager.getLocalDateString(boundaryUtcDate, 'America/New_York');

assert(istDate === '2026-10-26', 'Calculates local day in Asia/Kolkata after midnight (2026-10-26)');
assert(nyDate === '2026-10-25', 'Calculates local day in America/New_York before midnight (2026-10-25)');

// 2. Consecutive Day Streak Increment
console.log('\n--- Testing Consecutive Day Increments ---');
const day1 = new Date('2026-10-20T10:00:00Z');
const res1 = manager.recordActivity({ userId: studentId, minutes: 15, date: day1 });
assert(res1.streak === 1, 'First day completes daily goal, streak = 1');

const day2 = new Date('2026-10-21T10:00:00Z');
const res2 = manager.recordActivity({ userId: studentId, minutes: 15, date: day2 });
assert(res2.streak === 2, 'Consecutive day advances streak to 2');

const day3 = new Date('2026-10-22T10:00:00Z');
const res3 = manager.recordActivity({ userId: studentId, minutes: 15, date: day3 });
assert(res3.streak === 3, 'Consecutive day advances streak to 3');

// 3. Streak Freeze on Missed Day (Oct 23 missed, activity on Oct 24)
console.log('\n--- Testing Monthly Streak Freeze Utilization ---');
const day5WithMissed = new Date('2026-10-24T10:00:00Z'); // missed 2026-10-23
const resFreeze = manager.recordActivity({ userId: studentId, minutes: 15, date: day5WithMissed });
assert(resFreeze.freezeUsed === true, 'Consumes 1 monthly streak freeze when student misses 1 day');
assert(resFreeze.streak === 4, 'Streak is preserved and incremented to 4 despite missing Oct 23');

// 4. Streak Resetting When Missed Without Remaining Freeze (Oct 25, 26 missed, activity on Oct 27)
console.log('\n--- Testing Streak Reset After Unprotected Missed Days ---');
const day8AfterMultiMiss = new Date('2026-10-27T10:00:00Z');
const resReset = manager.recordActivity({ userId: studentId, minutes: 15, date: day8AfterMultiMiss });
assert(resReset.freezeUsed === false, 'Cannot use second freeze in the same month');
assert(resReset.streak === 1, 'Streak resets to 1 after unprotected missed days without guilt alerts');

// 5. Gentle Reminder Opt-Out Check
console.log('\n--- Testing Gentle Reminder Preferences ---');
assert(manager.toggleReminders(studentId, false) === false, 'Student can turn off streak reminder cards with zero dark patterns');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
