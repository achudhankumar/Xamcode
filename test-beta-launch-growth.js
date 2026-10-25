/**
 * test-beta-launch-growth.js
 * Verification suite for Phase 13: Private Beta, Launch and Growth.
 */

const assert = require('assert');
const { FeedbackManager, FEEDBACK_CATEGORIES } = require('./lib/feedback-widget');
const { TelemetryAnalytics, VALID_EVENT_TYPES } = require('./lib/telemetry-analytics');
const { ShareCardGenerator } = require('./lib/share-card-generator');

async function test() {
  console.log('============================================================');
  console.log('TEST: PHASE 13 — BETA, LAUNCH & GROWTH SUITE');
  console.log('============================================================\n');

  // 1. Feedback System
  console.log('--- 1. Feedback Widget & Store ---');
  const fb = new FeedbackManager();
  
  const f1 = fb.submitFeedback({
    userId: 'usr_beta_01',
    rating: 5,
    category: 'praise',
    message: 'The visual sliding window diagram helped me understand flow control immediately!',
    context: { topicId: 'cn-topic-2', theme: 'Liquid Glass 3D' }
  });
  assert(f1.id.startsWith('fb_'), 'Feedback creates valid id');
  assert.strictEqual(f1.rating, 5);

  const f2 = fb.submitFeedback({
    userId: 'usr_beta_02',
    rating: 4,
    category: 'confusion',
    message: 'Could the quiz timer have an option to pause?',
    context: { mode: 'exam' }
  });

  assert.strictEqual(fb.listFeedback().length, 2);
  assert.strictEqual(fb.listFeedback('praise').length, 1);
  assert.strictEqual(fb.getAverageRating(), 4.5);
  console.log(`  ✓ Feedback captured and filtered (${fb.listFeedback().length} entries, avg rating: ${fb.getAverageRating()})`);

  // 2. Telemetry & Analytics Events
  console.log('\n--- 2. Telemetry & Analytics Pipeline ---');
  const telemetry = new TelemetryAnalytics();

  for (const evtType of VALID_EVENT_TYPES) {
    telemetry.track(evtType, {
      userId: 'usr_beta_01',
      details: `Triggered ${evtType}`,
      token: 'secret_leak_attempt' // must be scrubbed
    });
  }

  const events = telemetry.getEvents();
  assert.strictEqual(events.length, VALID_EVENT_TYPES.length, 'All 5 mandatory event types tracked');
  
  // Verify PII scrubbing
  for (const e of events) {
    assert.strictEqual(e.payload.token, undefined, 'Sensitive token removed from payload');
    assert(VALID_EVENT_TYPES.includes(e.type), 'Event type is valid');
  }

  const summary = telemetry.getSummary();
  assert.strictEqual(summary.counts.upload, 1);
  assert.strictEqual(summary.counts.unit_ready, 1);
  assert.strictEqual(summary.counts.topic_completed, 1);
  assert.strictEqual(summary.counts.mode_opened, 1);
  assert.strictEqual(summary.counts.theme_chosen, 1);
  console.log(`  ✓ All 5 lifecycle events verified (${VALID_EVENT_TYPES.join(', ')}) with PII sanitization`);

  // 3. Share Card & Social Preview Generator
  console.log('\n--- 3. Share Cards & Social Badges ---');
  const cardGen = new ShareCardGenerator();
  const card = cardGen.generateCard({
    topicTitle: 'Sliding Window Protocol',
    subject: 'Computer Networks',
    keyPoint: 'Sender maintains buffer window W allowing up to W frames in flight before acknowledgment.',
    streakDays: 7,
    theme: 'Liquid Glass 3D'
  });

  assert(card.svg.includes('<svg'), 'Generated card contains SVG markup');
  assert(card.svg.includes('Sliding Window Protocol'), 'SVG includes topic title');
  assert(card.svg.includes('7 Day Streak'), 'SVG includes streak count');
  assert(card.metadata.openGraph.title.includes('Sliding Window Protocol'), 'OpenGraph metadata generated');
  console.log('  ✓ Viral share card SVG and social preview metadata generated successfully');

  // 4. AR Model-Viewer Integration
  console.log('\n--- 4. AR Model-Viewer Integration ---');
  const arMarkup = cardGen.generateArEmbed('https://assets.xamcode.ai/models/router_3d.glb', '3D Enterprise Router');
  assert(arMarkup.includes('<model-viewer'), 'Model-viewer markup generated');
  assert(arMarkup.includes('router_3d.glb'), 'Model URL embedded correctly');
  assert(arMarkup.includes('View in your room (AR)'), 'AR button rendered');
  console.log('  ✓ AR model-viewer component verified');

  console.log('\n============================================================');
  console.log('ALL PHASE 13 UNIT TESTS PASSED (12/12)');
  console.log('============================================================\n');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
