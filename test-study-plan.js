'use strict';

const { generateStudyPlan, rescheduleMissedDays } = require('./lib/study-plan-generator');

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
console.log('TEST: PHASE A1 — STUDY PLAN GENERATOR & ADAPTIVE RESCHEDULER');
console.log('============================================================\n');

// Mock syllabus data
const sampleUnits = [
  {
    unit_number: 1,
    unit_title: 'Network Architectures',
    page_start: 1,
    end_page: 25,
    difficulty: 3,
    topics: Array.from({ length: 10 }, (_, i) => ({ id: `u1-t${i}`, title: `Network Topic ${i + 1}` }))
  },
  {
    unit_number: 2,
    unit_title: 'Data Link & MAC Layer',
    page_start: 26,
    end_page: 55,
    difficulty: 4,
    topics: Array.from({ length: 12 }, (_, i) => ({ id: `u2-t${i}`, title: `Data Link Topic ${i + 1}` }))
  },
  {
    unit_number: 3,
    unit_title: 'Network & Routing',
    page_start: 56,
    end_page: 90,
    difficulty: 4,
    topics: Array.from({ length: 10 }, (_, i) => ({ id: `u3-t${i}`, title: `Routing Topic ${i + 1}` }))
  }
];

// 1. Test 7-Day Plan
console.log('--- Testing 7-Day Plan ---');
const plan7 = generateStudyPlan({ totalDays: 7, minutesPerDay: 60, units: sampleUnits, level: 'intermediate' });
assert(plan7.dailySchedule.length === 7, '7-day plan creates exactly 7 daily schedule slots');
assert(plan7.revisionDaysCount >= 1, '7-day plan reserves final revision days');
assert(plan7.dailySchedule.some(d => d.type === 'MOCK_TEST'), '7-day plan schedules weekly mock assessment slot');

// 2. Test 30-Day Plan
console.log('\n--- Testing 30-Day Plan ---');
const plan30 = generateStudyPlan({ totalDays: 30, minutesPerDay: 60, units: sampleUnits, level: 'intermediate' });
assert(plan30.dailySchedule.length === 30, '30-day plan creates exactly 30 daily schedule slots');
assert(plan30.revisionDaysCount === 6, '30-day plan allocates exact 20% (6 days) exclusively for revision');
const hasDay1Review = plan30.dailySchedule[1].revisionTasks.length > 0;
assert(hasDay1Review, 'Spaced repetition revision task scheduled on Day +1');

// 3. Test 90-Day Plan
console.log('\n--- Testing 90-Day Plan ---');
const plan90 = generateStudyPlan({ totalDays: 90, minutesPerDay: 45, units: sampleUnits, level: 'beginner' });
assert(plan90.dailySchedule.length === 90, '90-day plan creates exactly 90 daily schedule slots');
assert(plan90.revisionDaysCount === 18, '90-day plan allocates exact 20% (18 days) exclusively for revision');
const mockSlots = plan90.dailySchedule.filter(d => d.type === 'MOCK_TEST');
assert(mockSlots.length >= 10, '90-day plan schedules weekly mock test slots');

// 4. Missing 3 Days Rescheduling & 2x Daily Cap Verification
console.log('\n--- Testing Missed 3 Days & 2x Daily Minutes Cap Invariant ---');
const missedDays = [2, 3, 4]; // student missed days index 2, 3, 4
const rescheduledPlan = rescheduleMissedDays({ plan: plan30, missedDayIndexes: missedDays });

assert(rescheduledPlan.rescheduledTasksCount > 0, 'Reschedules orphaned topics into remaining available days');

// Verify that no day exceeds 2x the daily minutes (60 * 2 = 120 mins)
let capViolated = false;
let maxObservedMinutes = 0;
for (const day of rescheduledPlan.dailySchedule) {
  const totalMins = day.tasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0) +
    day.revisionTasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  if (totalMins > maxObservedMinutes) maxObservedMinutes = totalMins;
  if (totalMins > plan30.minutesPerDay * 2) {
    capViolated = true;
  }
}

assert(!capViolated, `No single day exceeds 2x daily minutes cap (max observed: ${maxObservedMinutes}m <= 120m)`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
