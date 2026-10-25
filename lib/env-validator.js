'use strict';

/**
 * Validates environment variables at boot.
 * Ensures required keys are present and correctly formatted without leaking secret values.
 *
 * @param {object} [env=process.env]
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
function validateEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];

  // 1. Core Node & Port
  if (env.PORT && isNaN(Number(env.PORT))) {
    errors.push('PORT must be a valid integer.');
  }

  // 2. AI Provider Keys
  const hasGemini = Boolean(env.GEMINI_API_KEY || env.GEMINI_API_KEYS || env.GEMINI_API_KEY_2);
  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

  if (!hasGemini && !hasGroq && !hasOpenRouter) {
    warnings.push('No primary AI provider key found (GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY). Offline mode only.');
  }

  // 3. Cloudflare R2
  const r2Configured = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
  if (!r2Configured) {
    warnings.push('Cloudflare R2 storage credentials incomplete; using local memory/fallback store.');
  }

  // 4. Supabase
  const supabaseConfigured = Boolean(env.SUPABASE_URL && (env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
  if (!supabaseConfigured) {
    warnings.push('Supabase database credentials incomplete; durable multi-user persistence disabled.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateEnvironment
};

