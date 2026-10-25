'use strict';

const fs = require('fs');
const path = require('path');
const { I18nEngine, SUPPORTED_LANGUAGES, INDIC_FONT_CONFIG } = require('./lib/i18n-engine');

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
console.log('TEST: PHASE A3 — MULTILINGUAL ENGINE (EN, TA, HI, TE, KN)');
console.log('============================================================\n');

const i18n = new I18nEngine();

// 1. Language Registry & Beta Labels
console.log('--- Testing Language Registry & Beta Labels ---');
assert(Object.keys(SUPPORTED_LANGUAGES).length === 5, 'Exactly 5 languages configured (en, ta, hi, te, kn)');
assert(SUPPORTED_LANGUAGES.en.beta === false, 'English is general release');
assert(SUPPORTED_LANGUAGES.ta.beta === false, 'Tamil is verified general release');
assert(SUPPORTED_LANGUAGES.hi.beta === false, 'Hindi is verified general release');
assert(SUPPORTED_LANGUAGES.te.beta === true, 'Telugu is accurately marked as Beta pending native review');
assert(SUPPORTED_LANGUAGES.kn.beta === true, 'Kannada is accurately marked as Beta pending native review');

// 2. Indic Font Line-Height Safeguards
console.log('\n--- Testing Indic Font Line-Heights ---');
assert(parseFloat(INDIC_FONT_CONFIG.ta.lineHeight) >= 1.6, 'Tamil line-height >= 1.6 to prevent script glyph clipping');
assert(parseFloat(INDIC_FONT_CONFIG.hi.lineHeight) >= 1.6, 'Hindi line-height >= 1.6 to prevent Devanagari shirorekha clipping');
assert(parseFloat(INDIC_FONT_CONFIG.te.lineHeight) >= 1.65, 'Telugu line-height >= 1.65 to prevent circular glyph clipping');
assert(parseFloat(INDIC_FONT_CONFIG.kn.lineHeight) >= 1.65, 'Kannada line-height >= 1.65 to prevent complex conjunct clipping');

// 3. Mid-Topic Language Switching & Invariants
console.log('\n--- Testing Mid-Topic Language Switching & Invariants ---');
const sampleTopic = {
  id: 'cn-hamming-code',
  title: 'Hamming Single-Bit Error Correction',
  pdfQuote: 'Hamming distance defines the minimum number of bit substitutions required to transform one codeword into another.',
  pdfPage: 'Page 6',
  explanation: 'Hamming codes use parity bits at powers-of-two positions to detect and correct single-bit inversions.',
  keyPoints: [
    'Parity check matrix H',
    'Syndrome decoding',
    'Minimum distance d_min >= 3'
  ],
  visual: {
    type: 'hamming',
    title: 'Hamming(7,4) Matrix',
    steps: [
      { title: 'Step 1', desc: 'Data bits loaded' },
      { title: 'Step 2', desc: 'Parity calculation' },
      { title: 'Step 3', desc: 'Syndrome check' }
    ]
  }
};

const languages = ['en', 'ta', 'hi', 'te', 'kn'];
languages.forEach(lang => {
  const localized = i18n.translateTopic(sampleTopic, lang);

  // Invariant 1: JSON keys stay in English
  const keys = Object.keys(localized);
  assert(keys.includes('title') && keys.includes('pdfQuote') && keys.includes('explanation') && keys.includes('visual'), `JSON keys for language "${lang}" strictly remain in English`);

  // Invariant 2: Original PDF excerpt remains unchanged in source language
  assert(localized.pdfQuote === sampleTopic.pdfQuote, `PDF excerpt for "${lang}" stays in verbatim original language`);

  // Invariant 3: Visual type & structure untouched
  assert(localized.visual.type === sampleTopic.visual.type, `Visual type for "${lang}" remains ${sampleTopic.visual.type}`);
  assert(localized.visual.steps.length === sampleTopic.visual.steps.length, `Visual step count for "${lang}" remains exactly 3`);
});

// 4. Generate 20 Sample Topics per Language for docs/lang-review/
console.log('\n--- Generating 20 Review Topics per Language (docs/lang-review/) ---');
const reviewDir = path.join(__dirname, 'docs', 'lang-review');
if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });

languages.forEach(lang => {
  const reviewBatch = [];
  for (let i = 1; i <= 20; i++) {
    const t = {
      id: `review-topic-${i}`,
      title: `Engineering Concept ${i}`,
      pdfQuote: `Verbatim engineering excerpt from textbook page ${i}.`,
      pdfPage: `Page ${i}`,
      explanation: `Detailed mechanical explanation for concept ${i}.`,
      keyPoints: [`Core rule ${i}`, `Calculation formula ${i}`, `Exam takeaway ${i}`],
      visual: {
        type: 'process_flow',
        title: `Process ${i}`,
        steps: [
          { title: 'Phase A', desc: 'Step 1' },
          { title: 'Phase B', desc: 'Step 2' },
          { title: 'Phase C', desc: 'Step 3' }
        ]
      }
    };
    reviewBatch.push(i18n.translateTopic(t, lang));
  }

  const langFilePath = path.join(reviewDir, `${lang}.json`);
  fs.writeFileSync(langFilePath, JSON.stringify(reviewBatch, null, 2), 'utf8');
  assert(fs.existsSync(langFilePath), `Saved 20 sample topics for ${lang.toUpperCase()} in docs/lang-review/${lang}.json`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

