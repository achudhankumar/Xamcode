'use strict';

/**
 * Text-to-Speech Engine using Web Speech API (Phase A9)
 * Zero paid APIs. Matches voices to target language tags and hides gracefully
 * when a voice is unavailable on the student's device.
 */

const LANG_VOICE_PREFIXES = {
  en: ['en-IN', 'en-US', 'en-GB', 'en'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  hi: ['hi-IN', 'hi'],
  te: ['te-IN', 'te'],
  kn: ['kn-IN', 'kn']
};

function findVoiceForLanguage(langCode, availableVoices = []) {
  if (!Array.isArray(availableVoices) || availableVoices.length === 0) return null;
  const prefixes = LANG_VOICE_PREFIXES[langCode] || [langCode];

  for (const prefix of prefixes) {
    const match = availableVoices.find(v => {
      const vLang = (v.lang || '').replace('_', '-').toLowerCase();
      return vLang === prefix.toLowerCase() || vLang.startsWith(prefix.toLowerCase() + '-');
    });
    if (match) return match;
  }

  return null;
}

function shouldShowListenButton(langCode, availableVoices = []) {
  return findVoiceForLanguage(langCode, availableVoices) !== null;
}

function splitIntoSentenceUnits(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.?!।\n])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

class TTSSession {
  constructor({ text, lang = 'en', availableVoices = [], onSentenceHighlight = () => {} }) {
    this.sentences = splitIntoSentenceUnits(text);
    this.lang = lang;
    this.voice = findVoiceForLanguage(lang, availableVoices);
    this.onSentenceHighlight = onSentenceHighlight;
    this.currentIndex = 0;
    this.isActive = false;
  }

  canPlay() {
    return this.voice !== null && this.sentences.length > 0;
  }

  nextSentence() {
    if (this.currentIndex >= this.sentences.length) {
      this.isActive = false;
      return null;
    }
    const currentSentence = this.sentences[this.currentIndex];
    this.onSentenceHighlight(this.currentIndex, currentSentence);
    this.currentIndex++;
    return currentSentence;
  }
}

module.exports = {
  LANG_VOICE_PREFIXES,
  findVoiceForLanguage,
  shouldShowListenButton,
  splitIntoSentenceUnits,
  TTSSession
};
