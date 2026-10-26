'use strict';

/**
 * lib/env-validator.js
 * Validates environment variables and reports Free API Key Pool readiness on startup.
 */
function validateEnv(env = process.env) {
  const warnings = [];
  const geminiKeys = (env.GEMINI_API_KEYS || env.GEMINI_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);
  const groqKeys = (env.GROQ_API_KEYS || env.GROQ_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);
  const openRouterKeys = (env.OPENROUTER_API_KEYS || env.OPENROUTER_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);

  if (geminiKeys.length === 0 && groqKeys.length === 0 && openRouterKeys.length === 0) {
    warnings.push('No AI API keys found in .env (GEMINI_API_KEYS / GROQ_API_KEYS). Running in Interactive Demo Fallback Mode.');
  }
  return {
    ok: true,
    counts: {
      gemini: geminiKeys.length,
      groq: groqKeys.length,
      openrouter: openRouterKeys.length
    },
    warnings
  };
}

module.exports = { validateEnv };
