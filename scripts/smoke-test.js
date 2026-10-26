#!/usr/bin/env node
/**
 * scripts/smoke-test.js
 * Verifies PDF extraction, schema validation, Aura AI grounded retrieval, and
 * FreeTierPoolRouter round-robin rotation.
 */
const assert = require('assert');
const { extractPdfPages } = require('../lib/pdf-extractor');
const { FreeTierPoolRouter } = require('../lib/provider-router');
const { retrieveTopChunks } = require('../lib/aura-grounded-tutor');
const { validateTopicPack } = require('../lib/schemas');

async function runTests() {
  console.log('Running XamCode AI v2.0 smoke tests...');

  // 1. Test Multi-Key Round-Robin Router
  process.env.GEMINI_API_KEYS = 'test_key_1,test_key_2,test_key_3';
  const router = new FreeTierPoolRouter();
  assert.strictEqual(router.geminiKeys.length, 3, 'Should parse 3 comma-separated Gemini keys');
  const k1 = router._getNextKey('gemini', router.geminiKeys);
  const k2 = router._getNextKey('gemini', router.geminiKeys);
  assert.notStrictEqual(k1, k2, 'Should rotate keys round-robin');

  // 2. Test PDF Extractor
  const sampleBuf = Buffer.from('%PDF-1.4\n(Unit 1 Computer Networks)\n(TCP 3-Way Handshake Overview)');
  const extracted = await extractPdfPages(sampleBuf);
  assert(extracted.numPages >= 1, 'Should extract at least 1 page');

  // 3. Test Aura AI Grounded Retrieval (including Tanglish fallback to active topic)
  const chunks = [
    { id: 'c1', pageNumber: 2, text: 'TCP uses a 3-way handshake SYN, SYN-ACK, ACK to synchronize sequence numbers.' }
  ];
  const tanglishResult = retrieveTopChunks({
    question: 'Idha easy-ah explain pannu bro',
    chunks,
    activeTopic: { title: 'TCP Handshake', startPage: 1, endPage: 5 }
  });
  assert.strictEqual(tanglishResult.inScope, true, 'Tanglish query should stay in-scope via activeTopic fallback');

  // 4. Test Topic Pack Validator (including automatic per-question visual diagram enforcement)
  const demoPack = {
    title: 'TCP Handshake',
    visual: { type: 'packet_flow', title: 'Flow', steps: [{ label: 'S1', detail: 'D1' }, { label: 'S2', detail: 'D2' }] },
    cheatCode: { why: 'w', like: 'l', wrong: 'x', right: 'r', see: 's', oneLine: 'o' },
    vaathiyar: { crash: [], explain: [], compare: {}, solve: {}, life: [], history: [], flash: [], eli5: {} },
    quiz: [{ q: 'What is ACK?', opts: ['1', '2', '3', '4'], a: 1, why: 'Because +1', wrong: 'Traps' }]
  };
  assert.strictEqual(validateTopicPack(demoPack), true, 'TopicPack should validate and backfill quiz visual');
  assert(demoPack.quiz[0].visual && demoPack.quiz[0].visual.type, 'Quiz question should have a guaranteed visual diagram');

  console.log('✅ All smoke tests passed!');
}

runTests().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});

