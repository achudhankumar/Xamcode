'use strict';

const {
  findVoiceForLanguage,
  shouldShowListenButton,
  splitIntoSentenceUnits,
  TTSSession
} = require('./lib/speech-synthesis-engine');

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
console.log('TEST: PHASE A9 — TEXT TO SPEECH (WEB SPEECH SYNTHESIS API)');
console.log('============================================================\n');

// Simulated standard voices found on Android Chrome
const chromeAndroidVoices = [
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Google UK English Female', lang: 'en-GB' },
  { name: 'Google தமிழ் (India)', lang: 'ta-IN' },
  { name: 'Google हिन्दी (India)', lang: 'hi-IN' }
  // Notice: Telugu (te-IN) and Kannada (kn-IN) omitted to test graceful hiding
];

// 1. Voice Resolution in Chrome on Android
console.log('--- Testing Voice Resolution in Chrome on Android ---');
const enVoice = findVoiceForLanguage('en', chromeAndroidVoices);
assert(Boolean(enVoice) && enVoice.lang.startsWith('en'), 'Resolves matching English voice on Android Chrome');

const taVoice = findVoiceForLanguage('ta', chromeAndroidVoices);
assert(Boolean(taVoice) && taVoice.lang === 'ta-IN', 'Resolves matching Tamil (ta-IN) voice on Android Chrome');

const hiVoice = findVoiceForLanguage('hi', chromeAndroidVoices);
assert(Boolean(hiVoice) && hiVoice.lang === 'hi-IN', 'Resolves matching Hindi (hi-IN) voice on Android Chrome');

// 2. Graceful Hiding When Voice Is Absent
console.log('\n--- Testing Graceful Hiding for Missing Voices ---');
assert(shouldShowListenButton('en', chromeAndroidVoices) === true, 'Shows Listen button for English');
assert(shouldShowListenButton('ta', chromeAndroidVoices) === true, 'Shows Listen button for Tamil');
assert(shouldShowListenButton('hi', chromeAndroidVoices) === true, 'Shows Listen button for Hindi');
assert(shouldShowListenButton('te', chromeAndroidVoices) === false, 'Gracefully hides Listen button when Telugu voice is missing');
assert(shouldShowListenButton('kn', chromeAndroidVoices) === false, 'Gracefully hides Listen button when Kannada voice is missing');

// 3. Sentence Splitting & Highlighting Callbacks
console.log('\n--- Testing Sentence Splitting & Highlighting Tracking ---');
const lessonText = 'Hamming codes provide single-bit error correction. They place parity bits at power-of-two indexes. Syndrome decoding computes the exact faulty bit position!';
const sentences = splitIntoSentenceUnits(lessonText);
assert(sentences.length === 3, 'Splits lesson into 3 distinct sentences for step-through audio reading');

let highlightedIndices = [];
const session = new TTSSession({
  text: lessonText,
  lang: 'en',
  availableVoices: chromeAndroidVoices,
  onSentenceHighlight: (idx, text) => {
    highlightedIndices.push(idx);
  }
});

assert(session.canPlay() === true, 'TTS session confirms audio playback capability');

session.nextSentence();
session.nextSentence();
session.nextSentence();
assert(highlightedIndices.length === 3 && highlightedIndices.join(',') === '0,1,2', 'Dispatches sentence highlight events sequentially across reading');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

