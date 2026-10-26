#!/usr/bin/env node
/**
 * scripts/apply-v2-upgrade.js
 * Verifies the environment and all XamCode AI v2.0 modules.
 */
const fs = require('fs');
const path = require('path');

console.log('=== XamCode AI v2.0 Upgrade Verifier ===');
const requiredFiles = [
  'server.js',
  'XamCode.html',
  'lib/pdf-extractor.js',
  'lib/provider-router.js',
  'lib/generation-pipeline.js',
  'lib/aura-grounded-tutor.js',
  'lib/schemas.js',
  'lib/gemini-schemas.js',
  'js/theme-studio-3d.js',
  'js/app.js',
  'css/experience-3d.css',
  '.env.example'
];

let allPresent = true;
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allPresent = false;
}

if (allPresent) {
  console.log('\n🎉 All XamCode AI v2.0 modules are verified and ready! Run `npm start` to launch.');
} else {
  process.exitCode = 1;
}
