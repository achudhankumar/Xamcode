'use strict';

/**
 * Provider Key Pool Rotation Harness (v2.0)
 * Eliminates AI provider rate-limit failures through resilient, self-healing,
 * round-robin key pool rotation across Gemini, Groq, and OpenRouter.
 */

class ProviderKeyPoolHarness {
  /**
   * @param {object} [envOverrides] - Optional environment dictionary for isolated testing
   */
  constructor(envOverrides = null) {
    this.env = envOverrides || process.env;
    this.pools = {
      gemini: [],
      groq: [],
      openrouter: []
    };
    this.cursors = {
      gemini: 0,
      groq: 0,
      openrouter: 0
    };
    this.defaultCooldownMs = 60000; // 60 seconds default cooldown on 429
    this.initPools();
  }

  /**
   * Parse comma-separated keys from environment variables with fallback
   * @param {string|string[]} primaryEnv
   * @param {string} [secondaryEnv]
   * @returns {string[]}
   */
  _parseKeys(primaryVal, secondaryVal) {
    const raw = String(primaryVal || secondaryVal || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
  }

  /**
   * Initialize key state objects for Gemini, Groq, and OpenRouter
   */
  initPools() {
    const env = this.env;

    // 1. Gemini Keys: GEMINI_API_KEYS -> GEMINI_API_KEY + GEMINI_KEY_1..9 / GEMINI_API_KEY_1..9
    const geminiRaw = this._parseKeys(env.GEMINI_API_KEYS, env.GEMINI_API_KEY);
    for (let i = 1; i <= 9; i++) {
      const k1 = String(env['GEMINI_KEY_' + i] || '').trim();
      const k2 = String(env['GEMINI_API_KEY_' + i] || '').trim();
      if (k1 && !geminiRaw.includes(k1)) geminiRaw.push(k1);
      if (k2 && !geminiRaw.includes(k2)) geminiRaw.push(k2);
    }
    this.pools.gemini = geminiRaw.map(key => this._createKeyState(key, 'gemini'));

    // 2. Groq Keys: GROQ_API_KEYS -> GROQ_API_KEY
    const groqRaw = this._parseKeys(env.GROQ_API_KEYS, env.GROQ_API_KEY);
    this.pools.groq = groqRaw.map(key => this._createKeyState(key, 'groq'));

    // 3. OpenRouter Keys: OPENROUTER_API_KEYS -> OPENROUTER_API_KEY
    const orRaw = this._parseKeys(env.OPENROUTER_API_KEYS, env.OPENROUTER_API_KEY);
    this.pools.openrouter = orRaw.map(key => this._createKeyState(key, 'openrouter'));
  }

  /**
   * Constructs the standard key tracking state object
   * @param {string} key
   * @param {'gemini'|'groq'|'openrouter'} provider
   */
  _createKeyState(key, provider) {
    return {
      key,
      provider,
      failures: 0,
      rateLimitedUntil: 0,
      successCount: 0,
      lastUsedAt: 0
    };
  }

  /**
   * Returns all key states for a provider
   * @param {'gemini'|'groq'|'openrouter'} provider
   * @returns {Array<{ key: string, provider: string, failures: number, rateLimitedUntil: number }>}
   */
  getPool(provider) {
    return this.pools[provider] || [];
  }

  /**
   * Checks if at least one key is configured for provider
   * @param {'gemini'|'groq'|'openrouter'} provider
   */
  isConfigured(provider) {
    return Array.isArray(this.pools[provider]) && this.pools[provider].length > 0;
  }

  /**
   * Retrieves the next active key for the provider.
   * Skips keys in active rate-limit cooldown.
   * If all keys are in cooldown, falls back to the key closest to expiration.
   *
   * @param {'gemini'|'groq'|'openrouter'} provider
   * @returns {string|null} The API key string or null if unconfigured
   */
  getNextKey(provider) {
    const pool = this.pools[provider];
    if (!pool || !pool.length) return null;

    const now = Date.now();
    const len = pool.length;

    // Search round-robin starting from current cursor for an active, non-blocked key
    for (let step = 0; step < len; step++) {
      const idx = (this.cursors[provider] + step) % len;
      const state = pool[idx];
      if (now >= state.rateLimitedUntil) {
        this.cursors[provider] = (idx + 1) % len;
        state.lastUsedAt = now;
        return state.key;
      }
    }

    // All keys are currently in cooldown; pick the key that unlocks soonest
    let earliestState = pool[0];
    let earliestTime = pool[0].rateLimitedUntil || Infinity;
    for (const state of pool) {
      if (state.rateLimitedUntil < earliestTime) {
        earliestTime = state.rateLimitedUntil;
        earliestState = state;
      }
    }

    earliestState.lastUsedAt = now;
    return earliestState.key;
  }

  /**
   * Flag a key as rate-limited with an expiration timestamp
   * @param {string} key
   * @param {number} [cooldownMs=60000]
   */
  markRateLimited(key, cooldownMs = this.defaultCooldownMs) {
    if (!key) return;
    const state = this.findKeyState(key);
    if (state) {
      state.failures += 1;
      state.rateLimitedUntil = Date.now() + cooldownMs;
    }
  }

  /**
   * Flag a key as successful, resetting failure counter
   * @param {string} key
   */
  markSuccess(key) {
    if (!key) return;
    const state = this.findKeyState(key);
    if (state) {
      state.failures = 0;
      state.successCount += 1;
      state.rateLimitedUntil = 0;
    }
  }

  /**
   * Flag general failure on a key
   * @param {string} key
   * @param {Error|object} [error]
   */
  markFailure(key, error = null) {
    if (!key) return;
    const state = this.findKeyState(key);
    if (!state) return;

    state.failures += 1;
    const status = error && (error.status || error.statusCode);
    const msg = error && (error.message || String(error));
    const isRateLimit = status === 429 || /rate[- ]limit|quota|too many requests|resource_exhausted/i.test(msg || '');

    if (isRateLimit) {
      state.rateLimitedUntil = Date.now() + this.defaultCooldownMs;
    }
  }

  /**
   * Helper to locate state object by key string across all providers
   * @param {string} key
   */
  findKeyState(key) {
    for (const provider of ['gemini', 'groq', 'openrouter']) {
      const match = this.pools[provider].find(item => item.key === key);
      if (match) return match;
    }
    return null;
  }

  /**
   * Resets all rate limits and cooldowns (useful for tests or manual reset)
   */
  resetAllCooldowns() {
    for (const provider of ['gemini', 'groq', 'openrouter']) {
      for (const item of this.pools[provider]) {
        item.rateLimitedUntil = 0;
        item.failures = 0;
      }
    }
  }

  /**
   * Returns a telemetry snapshot of all key pools
   */
  getStatus() {
    const now = Date.now();
    const snapshot = {};

    for (const provider of ['gemini', 'groq', 'openrouter']) {
      const pool = this.pools[provider];
      const total = pool.length;
      const active = pool.filter(k => now >= k.rateLimitedUntil).length;
      const cooledDown = total - active;
      snapshot[provider] = {
        total,
        active,
        coolingDown: cooledDown,
        keys: pool.map(k => ({
          keyMasked: k.key.length > 8 ? (k.key.slice(0, 4) + '...' + k.key.slice(-4)) : '***',
          failures: k.failures,
          rateLimitedUntil: k.rateLimitedUntil,
          inCooldown: now < k.rateLimitedUntil
        }))
      };
    }

    return snapshot;
  }
}

// Default singleton instance using environment variables
const defaultHarness = new ProviderKeyPoolHarness();

module.exports = {
  ProviderKeyPoolHarness,
  defaultHarness
};

