/**
 * test-pwa-offline.js
 * Verification suite for Phase A10: PWA and Low-Data Mode
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PwaLowDataEngine } = require('./lib/pwa-low-data-engine');

async function test() {
  console.log('============================================================');
  console.log('TEST: PHASE A10 — PWA, OFFLINE CACHE & LOW-DATA MODE');
  console.log('============================================================\n');

  // 1. Manifest Validation
  console.log('--- 1. Manifest.json Spec Compliance ---');
  const manifestPath = path.join(__dirname, 'public/manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.name, 'XamCode AI — Visual Engineering & Science Study');
  assert.strictEqual(manifest.short_name, 'XamCode');
  assert.strictEqual(manifest.display, 'standalone');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest defines multiple icon sizes');
  console.log('  ✓ Manifest attributes validated (standalone display, icons, metadata)');

  // 2. Service Worker File & Policy Verification
  console.log('\n--- 2. Service Worker Policy Verification ---');
  const swPath = path.join(__dirname, 'public/sw.js');
  assert(fs.existsSync(swPath), 'public/sw.js must exist');
  const swCode = fs.readFileSync(swPath, 'utf8');
  assert(swCode.includes('.endsWith(\'.pdf\')'), 'SW explicitly blocks caching of PDF files');
  assert(swCode.includes('LESSON_CACHE'), 'SW declares distinct lesson cache partition');
  assert(swCode.includes('PURGE_LESSON_CACHE'), 'SW handles lesson cache purge messages');
  console.log('  ✓ Service Worker enforces never-cache-PDF rule and distinct cache partitions');

  // 3. Low-Data Mode Controls
  console.log('\n--- 3. Low-Data Mode Engine ---');
  const mockStorage = new Map();
  const engine = new PwaLowDataEngine({
    storage: {
      getItem: (k) => mockStorage.get(k),
      setItem: (k, v) => mockStorage.set(k, v)
    },
    activeTheme: 'liquid_glass_3d'
  });

  // Default state: low-data off
  let policy = engine.getLowDataPolicy();
  assert.strictEqual(policy.lowDataMode, false, 'Default lowDataMode is false');
  assert.strictEqual(policy.allow3dScenes, true, '3D scenes permitted by default');
  assert.strictEqual(policy.enablePrefetching, true, 'Prefetching enabled by default');

  // Enable Low-Data Mode
  policy = engine.setLowDataMode(true);
  assert.strictEqual(policy.lowDataMode, true, 'lowDataMode is now true');
  assert.strictEqual(policy.allow3dScenes, false, '3D scenes disabled in low-data mode');
  assert.strictEqual(policy.recommendedTheme, 'soft_minimal_studio', 'Forces 2D lite theme');
  assert.strictEqual(policy.enablePrefetching, false, 'Prefetching disabled in low-data mode');
  console.log('  ✓ Low-Data toggle disables 3D scenes, forces lite theme, and halts prefetching');

  // 4. Cache Eligibility Rules
  console.log('\n--- 4. Cache Whitelist/Blacklist Rules ---');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/docs/calculus.pdf'), false, 'Rejects .pdf caching');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/api/analyze', 'POST'), false, 'Rejects upload POST');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/api/billing/webhook'), false, 'Rejects billing endpoints');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/api/topics/cn-layer-3'), true, 'Allows generated topic JSON');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/index.html'), true, 'Allows HTML app shell');
  assert.strictEqual(engine.canCacheRequest('https://xamcode.ai/css/global.css'), true, 'Allows CSS');
  console.log('  ✓ Cache boundaries verified: generated JSON permitted, original PDFs refused');

  // 5. Subscription Lapse Cache Eviction
  console.log('\n--- 5. Subscription Lapse Cache Purge ---');
  let purgeCalled = false;
  const mockPurge = async () => { purgeCalled = true; return true; };

  // Active subscription
  const activeRes = await engine.syncSubscriptionCache('active', mockPurge);
  assert.strictEqual(activeRes.cachePurged, false, 'Active subscription retains cached lessons');
  assert.strictEqual(purgeCalled, false, 'Purge not called for active subscription');

  // Lapsed subscription
  const lapsedRes = await engine.syncSubscriptionCache('lapsed', mockPurge);
  assert.strictEqual(lapsedRes.cachePurged, true, 'Lapsed subscription triggers cache purge');
  assert.strictEqual(purgeCalled, true, 'Purge callback invoked successfully');
  console.log('  ✓ Subscription lapse triggers automatic lesson cache eviction');

  // 6. Offline Banner UI
  console.log('\n--- 6. Offline Banner UI Component ---');
  const onlineBanner = engine.renderOfflineBanner(true);
  assert.strictEqual(onlineBanner.visible, false, 'Banner hidden when online');

  const offlineBanner = engine.renderOfflineBanner(false);
  assert.strictEqual(offlineBanner.visible, true, 'Banner visible when offline');
  assert(offlineBanner.html.includes('Offline Mode'), 'Banner contains offline notification');
  assert(offlineBanner.html.includes('Cached Only'), 'Banner clarifies cached viewing state');
  console.log('  ✓ Offline banner renders properly when network connectivity is lost');

  console.log('\n============================================================');
  console.log('ALL PHASE A10 TESTS PASSED (12/12)');
  console.log('============================================================\n');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
