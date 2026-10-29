'use strict';
const assert = require('assert');
const { ProviderKeyPoolHarness } = require('./lib/provider-harness');

console.log('============================================================');
console.log('TEST: MULTI-KEY POOL ROTATION HARNESS (lib/provider-harness.js)');
console.log('============================================================\n');

// 1. Test Key Parsing & Fallbacks
console.log('--- 1. Testing Key Parsing & Fallbacks ---');
const testEnv1 = {
  GEMINI_API_KEYS: 'gem-key-1, gem-key-2 , gem-key-3',
  GROQ_API_KEY: 'groq-single-key', // fallback test
  OPENROUTER_API_KEYS: 'or-key-a,or-key-b'
};

const harness1 = new ProviderKeyPoolHarness(testEnv1);

assert.strictEqual(harness1.pools.gemini.length, 3, 'Gemini pool must have 3 keys');
assert.strictEqual(harness1.pools.groq.length, 1, 'Groq pool must fall back to GROQ_API_KEY');
assert.strictEqual(harness1.pools.openrouter.length, 2, 'OpenRouter pool must have 2 keys');
assert.strictEqual(harness1.isConfigured('gemini'), true);
assert.strictEqual(harness1.isConfigured('groq'), true);
assert.strictEqual(harness1.isConfigured('openrouter'), true);

console.log('  ✓ Gemini parsed 3 keys from comma-separated GEMINI_API_KEYS');
console.log('  ✓ Groq parsed 1 key falling back to GROQ_API_KEY');
console.log('  ✓ OpenRouter parsed 2 keys from OPENROUTER_API_KEYS');

// 2. Test Key State Tracking Object Structure
console.log('\n--- 2. Testing Key State Tracking Structure ---');
const sampleState = harness1.pools.gemini[0];
assert.strictEqual(typeof sampleState.key, 'string');
assert.strictEqual(sampleState.key, 'gem-key-1');
assert.strictEqual(sampleState.provider, 'gemini');
assert.strictEqual(typeof sampleState.failures, 'number');
assert.strictEqual(sampleState.failures, 0);
assert.strictEqual(typeof sampleState.rateLimitedUntil, 'number');
assert.strictEqual(sampleState.rateLimitedUntil, 0);

console.log('  ✓ Key state object contains key, provider, failures, and rateLimitedUntil');

// 3. Test Round-Robin Rotation
console.log('\n--- 3. Testing Round-Robin Key Rotation ---');
const k1 = harness1.getNextKey('gemini');
const k2 = harness1.getNextKey('gemini');
const k3 = harness1.getNextKey('gemini');
const k4 = harness1.getNextKey('gemini');

assert.strictEqual(k1, 'gem-key-1', 'First call must return key 1');
assert.strictEqual(k2, 'gem-key-2', 'Second call must return key 2');
assert.strictEqual(k3, 'gem-key-3', 'Third call must return key 3');
assert.strictEqual(k4, 'gem-key-1', 'Fourth call must cycle back to key 1');
console.log('  ✓ Round-robin cycled across gem-key-1 -> gem-key-2 -> gem-key-3 -> gem-key-1');

// 4. Test Rate-Limiting & Self-Healing Bypass
console.log('\n--- 4. Testing Rate-Limiting & Auto-Bypass ---');
// Mark gem-key-1 as rate-limited for 60 seconds
harness1.markRateLimited('gem-key-1', 60000);
const stateK1 = harness1.findKeyState('gem-key-1');
assert.strictEqual(stateK1.failures, 1);
assert.ok(stateK1.rateLimitedUntil > Date.now() + 50000);

// Next keys should skip gem-key-1 entirely
const nextA = harness1.getNextKey('gemini');
const nextB = harness1.getNextKey('gemini');
const nextC = harness1.getNextKey('gemini');

assert.strictEqual(nextA, 'gem-key-2', 'Must skip rate-limited gem-key-1 and use gem-key-2');
assert.strictEqual(nextB, 'gem-key-3', 'Must continue to gem-key-3');
assert.strictEqual(nextC, 'gem-key-2', 'Must wrap around to gem-key-2, skipping gem-key-1');
console.log('  ✓ Rate-limited key was automatically bypassed');

// 5. Test Recovery on markSuccess
console.log('\n--- 5. Testing Recovery & Success Reset ---');
harness1.markSuccess('gem-key-1');
assert.strictEqual(stateK1.rateLimitedUntil, 0);
assert.strictEqual(stateK1.failures, 0);

// Now gem-key-1 is active again
const allKeys = [
  harness1.getNextKey('gemini'),
  harness1.getNextKey('gemini'),
  harness1.getNextKey('gemini')
];
assert.ok(allKeys.includes('gem-key-1'), 'gem-key-1 must be returned after success reset');
console.log('  ✓ markSuccess restored key to active pool and reset failures');

// 6. Test All Keys Rate-Limited Fallback
console.log('\n--- 6. Testing All-Keys Rate-Limited Fallback ---');
const testEnv2 = { GROQ_API_KEYS: 'groq-1, groq-2' };
const harness2 = new ProviderKeyPoolHarness(testEnv2);

// Mark groq-1 for 10 seconds, groq-2 for 30 seconds
harness2.markRateLimited('groq-1', 10000);
harness2.markRateLimited('groq-2', 30000);

// Should pick groq-1 because it unlocks soonest
const best = harness2.getNextKey('groq');
assert.strictEqual(best, 'groq-1', 'Must choose the key unlocking earliest when all are rate-limited');
console.log('  ✓ Selects earliest unlocking key when all pool keys are in cooldown');

// 7. Test Telemetry Status Snapshot
console.log('\n--- 7. Testing Telemetry Status Snapshot ---');
const status = harness2.getStatus();
assert.strictEqual(status.groq.total, 2);
assert.strictEqual(status.groq.active, 0);
assert.strictEqual(status.groq.coolingDown, 2);
assert.strictEqual(status.groq.keys.length, 2);
assert.strictEqual(typeof status.groq.keys[0].keyMasked, 'string');
assert.strictEqual(status.groq.keys[0].inCooldown, true);
console.log('  ✓ getStatus reports accurate active and cooldown metrics');

console.log('\n============================================================');
console.log('✓ ALL MULTI-KEY POOL ROTATION HARNESS TESTS PASSED');
console.log('============================================================');

