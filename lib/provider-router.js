'use strict';

/**
 * Provider Router Interface
 * Coordinates AI requests between Gemini (primary) and configured fallback providers.
 * Enforces structured JSON output and provides a 1-shot self-healing retry
 * when validation checks fail.
 * Also exports FreeTierPoolRouter (v2.0 Multi-Key Round-Robin across Gemini, Groq, and OpenRouter).
 */

const { FreeTierPoolRouter } = require('./xamcode-upgrade-suite');
const defaultRouter = new FreeTierPoolRouter();

function cleanJsonString(raw) {
  if (!raw || typeof raw !== 'string') return '{}';
  let str = raw.trim();
  // Strip Markdown code fences if returned by model
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return str;
}

class ProviderRouter {
  constructor(options = {}) {
    this.primaryProvider = options.primaryProvider || 'gemini';
    this.fallbackProvider = options.fallbackProvider || 'groq';
    this.callAiFn = options.callAiFn || null; // Injected callAI from server or test harness
  }

  /**
   * Calls the AI model requesting a structured JSON response.
   * If validationFn is provided and fails, performs ONE retry passing the error message back to the model.
   *
   * @param {object} params
   * @param {string} params.systemInstruction
   * @param {string} params.prompt
   * @param {object} [params.schema] - Target JSON schema or description
   * @param {function} [params.validationFn] - (parsedJson) => { valid: boolean, errors: string[] }
   * @param {function} [params.mockFallbackFn] - Deterministic fallback generator for test fixtures
   * @returns {Promise<{ ok: boolean, data: object, retried: boolean, errors?: string[] }>}
   */
  async generateStructuredJson({
    systemInstruction,
    prompt,
    schema = null,
    validationFn = null,
    mockFallbackFn = null
  }) {
    let lastError = null;
    let attempts = 0;
    let currentPrompt = prompt;

    while (attempts < 2) {
      attempts++;
      let rawResponse = null;

      try {
        if (typeof this.callAiFn === 'function') {
          rawResponse = await this.callAiFn(
            [{ text: currentPrompt }],
            { systemInstruction, schema: true }
          );
        } else if (typeof mockFallbackFn === 'function') {
          rawResponse = await mockFallbackFn(currentPrompt, attempts > 1 ? lastError : null);
        } else {
          throw new Error('No AI provider or mock generator configured in ProviderRouter');
        }

        let parsed = null;
        if (typeof rawResponse === 'string') {
          parsed = JSON.parse(cleanJsonString(rawResponse));
        } else if (rawResponse && typeof rawResponse === 'object') {
          parsed = rawResponse;
        }

        // Run validation if supplied
        if (typeof validationFn === 'function') {
          const valRes = validationFn(parsed);
          if (!valRes.valid) {
            lastError = valRes.errors.join('; ');
            if (attempts === 1) {
              // Construct 1-shot retry prompt with explicit error report
              currentPrompt = `${prompt}\n\n[CORRECTION REQUIRED - PREVIOUS OUTPUT FAILED VALIDATION]\nThe previous JSON had the following errors:\n${lastError}\n\nPlease regenerate the JSON correcting these exact issues. Ensure 100% compliance with the schema and lexical excerpt rules.`;
              continue;
            } else {
              return {
                ok: false,
                data: parsed,
                retried: true,
                errors: valRes.errors
              };
            }
          }
          return {
            ok: true,
            data: valRes.data || parsed,
            retried: attempts > 1
          };
        }

        return {
          ok: true,
          data: parsed,
          retried: attempts > 1
        };

      } catch (err) {
        lastError = err.message;
        if (attempts === 1) {
          currentPrompt = `${prompt}\n\n[CORRECTION REQUIRED - PARSE ERROR]\nError parsing response as valid JSON: ${err.message}\nReturn ONLY a valid JSON object.`;
          continue;
        }
        return {
          ok: false,
          data: null,
          retried: attempts > 1,
          errors: [err.message]
        };
      }
    }

    return {
      ok: false,
      data: null,
      retried: true,
      errors: [lastError || 'Generation failed after retry']
    };
  }
}

module.exports = {
  ProviderRouter,
  cleanJsonString,
  FreeTierPoolRouter,
  defaultRouter,
  generateStructuredJson: (opts) => defaultRouter.generateStructuredJson(opts)
};
