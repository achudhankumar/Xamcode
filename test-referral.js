'use strict';

const { ReferralManager, BONUS_PAGES_PER_REFERRAL, MAX_MONTHLY_BONUS_PAGES } = require('./lib/referral-engine');

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
console.log('TEST: PHASE A8 — REFERRAL ENGINE & ANTI-ABUSE FRAUD SHIELD');
console.log('============================================================\n');

const manager = new ReferralManager();
const aliceCode = manager.createReferralCode('usr_alice', 'ALICE');

// 1. Successful Bilateral Referral Grant
console.log('--- Testing Successful Bilateral Referral ---');
const res1 = manager.applyReferralOnFirstUpload({
  referralCode: aliceCode,
  newUserId: 'usr_student_bob',
  deviceFingerprint: 'device_fp_bob_1'
});

assert(res1.success === true, 'Referral accepted on first PDF upload');
assert(res1.referrerPagesGranted === 50, 'Referrer (Alice) granted 50 bonus pages');
assert(res1.refereePagesGranted === 50, 'Referee (Bob) granted 50 bonus pages');

// 2. Self-Referral Blocking
console.log('\n--- Testing Self-Referral Prevention ---');
try {
  manager.applyReferralOnFirstUpload({
    referralCode: aliceCode,
    newUserId: 'usr_alice',
    deviceFingerprint: 'device_fp_alice_own'
  });
  assert(false, 'Should reject self-referral');
} catch (err) {
  assert(err.message.includes('Self-referrals are strictly prohibited'), 'Strictly blocks self-referral attempts');
}

// 3. Repeated Device Fingerprint Blocking
console.log('\n--- Testing Duplicate Device Fingerprint Blocking ---');
try {
  manager.applyReferralOnFirstUpload({
    referralCode: aliceCode,
    newUserId: 'usr_student_charlie',
    deviceFingerprint: 'device_fp_bob_1' // Same device as Bob
  });
  assert(false, 'Should reject duplicate device signup');
} catch (err) {
  assert(err.message.includes('repeated sign-up detected from this device'), 'Strictly blocks repeated signups from identical hardware device');
}

// 4. Monthly 500 Bonus Page Cap
console.log('\n--- Testing 500 Bonus Page Monthly Cap ---');
// Alice already has 50 bonus pages. Let's add 9 more successful referrals (9 * 50 = 450 -> total 500)
for (let i = 2; i <= 10; i++) {
  manager.applyReferralOnFirstUpload({
    referralCode: aliceCode,
    newUserId: `usr_student_${i}`,
    deviceFingerprint: `device_fp_unique_${i}`
  });
}

const aliceState = manager.getUserBonusState('usr_alice');
assert(aliceState.bonusPages === MAX_MONTHLY_BONUS_PAGES, `Alice hits exact 500-page monthly cap (${aliceState.bonusPages} pages)`);

// Attempt 11th referral in the same month -> Referrer gets 0 additional bonus pages (capped)
const res11 = manager.applyReferralOnFirstUpload({
  referralCode: aliceCode,
  newUserId: 'usr_student_11',
  deviceFingerprint: 'device_fp_unique_11'
});
assert(res11.referrerPagesGranted === 0, 'Caps referrer bonus at 0 additional pages once 500-page limit reached');
assert(manager.getUserBonusState('usr_alice').bonusPages === 500, 'Total bonus pages remain strictly capped at 500');

// 5. Monthly Expiry
console.log('\n--- Testing Monthly Bonus Expiry ---');
const nextMonthDate = new Date('2026-11-01T10:00:00Z');
const aliceNextMonthState = manager.getUserBonusState('usr_alice', manager.getCurrentMonthKey(nextMonthDate));
assert(aliceNextMonthState.bonusPages === 0, 'Bonus pages expire upon transition to new calendar month');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

