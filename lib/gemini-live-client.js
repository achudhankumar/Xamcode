'use strict';

const fs = require('fs');
const path = require('path');

function getGeminiConfig() {
  let key = process.env.GEMINI_API_KEY;
  let model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

  if (!key && fs.existsSync(path.join(__dirname, '..', '.env'))) {
    const raw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const mKey = raw.match(/GEMINI_API_KEY=([^\r\n]+)/);
    if (mKey) key = mKey[1].trim();
    const mModel = raw.match(/GEMINI_MODEL=([^\r\n]+)/);
    if (mModel) model = mModel[1].trim();
  }

  if (!key) {
    throw new Error('GEMINI_API_KEY is not set. Please set it in .env.');
  }

  return { key, model };
}

/**
 * Calls Google Gemini API with native OpenAPI structured output schema.
 * Returns { text, parsed, usage: { promptTokens, candidateTokens, totalTokens }, durationMs }
 */
async function callGeminiStructured({ systemInstruction, prompt, schema, timeoutMs = 60000 }) {
  const { key, model } = getGeminiConfig();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  if (schema) {
    body.generationConfig.responseSchema = schema;
  }

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const startMs = Date.now();
  let attempts = 0;

  while (attempts < 3) {
    attempts++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      const json = await res.json();

      if (!res.ok) {
        const errMsg = json.error ? json.error.message : `HTTP ${res.status}`;
        if (res.status === 429 && attempts < 3) {
          // Backoff on rate limit
          await new Promise(r => setTimeout(r, 2000 * attempts));
          continue;
        }
        throw new Error(`Gemini API error [${res.status}]: ${errMsg}`);
      }

      const candidate = json.candidates && json.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        throw new Error('Gemini API returned an empty candidate response.');
      }

      const text = candidate.content.parts[0].text;
      const usage = {
        promptTokens: json.usageMetadata?.promptTokenCount || 0,
        candidateTokens: json.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: json.usageMetadata?.totalTokenCount || 0
      };

      const durationMs = Date.now() - startMs;
      const parsed = JSON.parse(text);

      return {
        text,
        parsed,
        usage,
        durationMs
      };
    } catch (err) {
      if (attempts >= 3 || err.name === 'AbortError') {
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * attempts));
    }
  }

  throw new Error('Gemini call failed after 3 attempts.');
}

module.exports = {
  callGeminiStructured,
  getGeminiConfig
};

