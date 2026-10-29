'use strict';

/**
 * ============================================================================
 * XAMCODE AI — COMPLETE DROP-IN UPGRADE SUITE (v2.0)
 * ============================================================================
 * Contains the 4 core production modules:
 *   1. MODULE A: Free Multi-Key & Multi-Provider Router (FreeTierPoolRouter)
 *   2. MODULE B: 10MB–14MB PDF Pipeline + Subject-Adaptive Topic & Quiz Visual
 *                Generator (computePdfCacheKey, pdfHashCache, SUBJECT_ARCHETYPES)
 *   3. MODULE C: Upgraded Aura AI Grounded Tutor with Live Diagram Generation &
 *                Tanglish/English Support (retrieveGroundedContextV2, askAuraTutorV2)
 *   4. MODULE D: 3D Experience Themes & Vibe-Coding Spatial Engine
 *                (XAMCODE_3D_EXPERIENCE_THEMES, initXamCode3DExperience)
 * ============================================================================
 */

const crypto = require('crypto');

/* ============================================================================
 * MODULE A: FREE MULTI-KEY & MULTI-PROVIDER ROUTER
 * Supports comma-separated free keys in .env:
 *   GEMINI_API_KEYS=key1,key2,key3,key4
 *   GROQ_API_KEYS=gsk_1,gsk_2,gsk_3
 *   OPENROUTER_API_KEYS=sk-or-1,sk-or-2
 * Automatically rotates keys round-robin and puts rate-limited (429) keys on a
 * 60-second cooldown so 10MB PDF jobs never fail mid-way!
 * ============================================================================ */

class FreeTierPoolRouter {
  constructor() {
    const baseGemini = this._parseKeys(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
    for (let i = 1; i <= 9; i++) {
      const kA = String(process.env['GEMINI_KEY_' + i] || '').trim();
      const kB = String(process.env['GEMINI_API_KEY_' + i] || '').trim();
      if (kA && !baseGemini.includes(kA)) baseGemini.push(kA);
      if (kB && !baseGemini.includes(kB)) baseGemini.push(kB);
    }
    this.geminiKeys = baseGemini;
    this.groqKeys = this._parseKeys(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY);
    this.openRouterKeys = this._parseKeys(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);

    this.cursor = { gemini: 0, groq: 0, openrouter: 0 };
    this.cooldownUntil = new Map(); // key -> timestamp
  }

  _parseKeys(raw) {
    if (!raw) return [];
    return String(raw)
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  _getNextKey(provider, keys) {
    if (!keys.length) return null;
    const now = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const idx = (this.cursor[provider] + i) % keys.length;
      const candidate = keys[idx];
      const blockedUntil = this.cooldownUntil.get(candidate) || 0;
      if (now >= blockedUntil) {
        this.cursor[provider] = (idx + 1) % keys.length;
        return candidate;
      }
    }
    let bestKey = keys[0];
    let earliest = Infinity;
    for (const k of keys) {
      const t = this.cooldownUntil.get(k) || 0;
      if (t < earliest) {
        earliest = t;
        bestKey = k;
      }
    }
    return bestKey;
  }

  markRateLimited(key, cooldownMs = 60000) {
    if (key) {
      this.cooldownUntil.set(key, Date.now() + cooldownMs);
    }
  }

  async generateStructuredJson({
    systemInstruction,
    prompt,
    responseSchema = null,
    maxOutputTokens = 16384,
    temperature = 0.25,
    timeoutMs = 95000,
    validateFn = null
  }) {
    const errors = [];

    // 1. Try Gemini Free Pool First (Supports native responseSchema + 1M context)
    for (let attempt = 0; attempt < Math.max(2, this.geminiKeys.length); attempt++) {
      const apiKey = this._getNextKey('gemini', this.geminiKeys);
      if (!apiKey) break;
      try {
        const rawText = await this._callGemini({
          apiKey,
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          systemInstruction,
          prompt,
          responseSchema,
          maxOutputTokens,
          temperature,
          timeoutMs
        });
        const parsed = this._cleanAndParseJson(rawText);
        if (validateFn) validateFn(parsed);
        return { ok: true, provider: 'gemini', data: parsed };
      } catch (err) {
        errors.push(`Gemini attempt ${attempt + 1}: ${err.message}`);
        if (err.status === 429 || /429|quota|rate/i.test(err.message)) {
          this.markRateLimited(apiKey, 65000);
          continue;
        }
        if (attempt === 0 && /JSON|schema|validation/i.test(err.message)) {
          prompt = `${prompt}\n\n[SELF-HEALING CORRECTION REQUIRED]: Your previous response failed validation with error: ${err.message}. Return ONLY valid JSON matching every required key.`;
        }
      }
    }

    // 2. Fallback to Groq Free Pool (Llama-3.3-70b-versatile)
    for (let attempt = 0; attempt < Math.max(1, this.groqKeys.length); attempt++) {
      const apiKey = this._getNextKey('groq', this.groqKeys);
      if (!apiKey) break;
      try {
        const rawText = await this._callOpenAICompatible({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey,
          model: 'llama-3.3-70b-versatile',
          systemInstruction,
          prompt,
          maxOutputTokens: Math.min(maxOutputTokens, 8192),
          temperature,
          timeoutMs
        });
        const parsed = this._cleanAndParseJson(rawText);
        if (validateFn) validateFn(parsed);
        return { ok: true, provider: 'groq', data: parsed };
      } catch (err) {
        errors.push(`Groq attempt ${attempt + 1}: ${err.message}`);
        if (err.status === 429 || /429|rate/i.test(err.message)) {
          this.markRateLimited(apiKey, 60000);
        }
      }
    }

    // 3. Fallback to OpenRouter Free Pool
    const orKey = this._getNextKey('openrouter', this.openRouterKeys);
    if (orKey) {
      try {
        const rawText = await this._callOpenAICompatible({
          url: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey: orKey,
          model: 'google/gemini-2.0-flash-exp:free',
          systemInstruction,
          prompt,
          maxOutputTokens: 8192,
          temperature,
          timeoutMs
        });
        const parsed = this._cleanAndParseJson(rawText);
        if (validateFn) validateFn(parsed);
        return { ok: true, provider: 'openrouter', data: parsed };
      } catch (err) {
        errors.push(`OpenRouter fallback: ${err.message}`);
      }
    }

    throw new Error(`All Free AI Pools exhausted or failed: ${errors.join(' | ')}`);
  }

  _cleanAndParseJson(raw) {
    if (!raw || typeof raw !== 'string') {
      throw new Error('Empty JSON response from LLM');
    }
    let cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else {
      startIdx = Math.max(firstBrace, firstBracket);
    }
    if (startIdx > 0) cleaned = cleaned.slice(startIdx);

    return JSON.parse(cleaned);
  }

  async _callGemini({
    apiKey,
    model,
    systemInstruction,
    prompt,
    responseSchema,
    maxOutputTokens,
    temperature,
    timeoutMs
  }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const generationConfig = {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json'
      };
      if (responseSchema) {
        generationConfig.responseSchema = responseSchema;
      }
      const body = {
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) {
        const errBody = await res.text();
        const err = new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned empty candidate text');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async _callOpenAICompatible({
    url,
    apiKey,
    model,
    systemInstruction,
    prompt,
    maxOutputTokens,
    temperature,
    timeoutMs
  }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxOutputTokens,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errBody = await res.text();
        const err = new Error(`Provider HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ============================================================================
 * MODULE B: 10MB–14MB PDF PIPELINE + SUBJECT-ADAPTIVE TOPIC & QUIZ VISUALS
 * ============================================================================ */

const pdfHashCache = new Map(); // sha256 -> completed study pack

const SUBJECT_ARCHETYPES = {
  systems_cs: {
    preferredVisuals: ['packet_flow', 'state_machine', 'topology', 'sliding_window', 'process_flow'],
    pedagogyHint: 'Focus on protocol flows, state transitions, step-by-step trace, and bit/packet calculations.'
  },
  math_quant: {
    preferredVisuals: ['chart', 'process_flow', 'comparison_visual', 'labeled_diagram'],
    pedagogyHint: 'Focus on intuitive formula derivation, step-by-step numerical solve, and sign/unit pitfalls.'
  },
  bio_medical: {
    preferredVisuals: ['cycle', 'hierarchy_tree', 'labeled_diagram', 'process_flow'],
    pedagogyHint: 'Focus on biological cycles, anatomical hierarchies, clinical correlations, and memory mnemonics.'
  },
  law_humanities: {
    preferredVisuals: ['timeline', 'hierarchy_tree', 'comparison_visual'],
    pedagogyHint: 'Focus on chronological evolution, constitutional/legal comparisons, and real-world landmark cases.'
  },
  general_exam: {
    preferredVisuals: ['process_flow', 'comparison_visual', 'cycle', 'hierarchy_tree', 'timeline'],
    pedagogyHint: 'Focus on high-yield exam shortcuts, option-elimination tricks, and vivid everyday analogies.'
  }
};

function computePdfCacheKey(buffer, examDaysMode = '10days', level = 'medium') {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return `${hash}:${examDaysMode}:${level}`;
}

function buildUpgradedOutlinePrompt(extractedPages, examDaysMode = '10days') {
  const isCrashMode = examDaysMode === '2days';
  const isJunkText = (s) => /(?:charprocs|cidtogidmap|fontbbox|fontmatrix|tounicode|firstchar|lastchar|differences|identity-h|\bwidths\b|\bidentity\b|\bencoding\b)/i.test(s);
  const pageIndex = extractedPages.pages
    .map(
      (p) => {
        const cleanH = (p.headings || []).filter(h => !isJunkText(h));
        const cleanFl = (!p.firstLines || isJunkText(p.firstLines)) ? '' : p.firstLines;
        return `[Page ${p.pageNumber}] Headings: ${cleanH.join(' | ') || 'None'} :: Preview: ${cleanFl.slice(0, 180)}`;
      }
    )
    .join('\n');

  return `You are XamCode AI, an elite exam preparation architect.
Analyze this ${extractedPages.numPages}-page study PDF index and organize it into Units and High-Yield Topics.

EXAM TIMELINE MODE: ${
    isCrashMode
      ? '2 DAYS TO EXAM (SURVIVAL CRASH MODE — Pick top 80/20 highest-probability exam topics per unit and mark examPriority: "CRITICAL" or "HIGH")'
      : '10 DAYS TO EXAM (COMPLETE MASTERY MODE — Cover all syllabus units and topics systematically)'
  }

Return JSON with this exact structure:
{
  "title": "Document Course Title",
  "subjectArchetype": "systems_cs | math_quant | bio_medical | law_humanities | general_exam",
  "examStrategyBanner": "1-sentence tailored strategy for the student",
  "units": [
    {
      "unitNumber": 1,
      "title": "Unit Title",
      "startPage": 1,
      "endPage": 25,
      "topics": [
        {
          "id": "u1-t1",
          "title": "Topic Name",
          "startPage": 1,
          "endPage": 6,
          "examPriority": "CRITICAL | HIGH | CORE",
          "estimatedMinutes": 12,
          "recommendedVisualType": "process_flow | topology | packet_flow | sliding_window | hamming | timeline | comparison_visual | chart | state_machine | cycle | hierarchy_tree | labeled_diagram"
        }
      ]
    }
  ]
}

DOCUMENT PAGE INDEX:
${pageIndex}`;
}

function buildUpgradedTopicPrompt({ topicMeta, unitTitle, subjectArchetype, pageSliceText, examDaysMode }) {
  const archetypeConfig = SUBJECT_ARCHETYPES[subjectArchetype] || SUBJECT_ARCHETYPES.general_exam;

  return `You are XamCode AI ("Vaathiyar Mode" + Dynamic Visual Engine).
Generate the complete interactive study pack for Topic "${topicMeta.title}" (Unit: "${unitTitle}", Pages ${topicMeta.startPage}-${topicMeta.endPage}).

SUBJECT ARCHETYPE GUIDANCE: ${archeconeHint(archetypeConfig, examDaysMode)}
PREFERRED DYNAMIC VISUAL TYPES: ${archetypeConfig.preferredVisuals.join(', ')}
RECOMMENDED VISUAL FOR THIS TOPIC: ${topicMeta.recommendedVisualType || archetypeConfig.preferredVisuals[0]}

CRITICAL RULES FOR VISUALS & VAATHIYAR MODE:
1. "visual" (Topic Visual Mode): Must be a rich, multi-step interactive diagram specification using one of the allowed types (process_flow, topology, packet_flow, sliding_window, hamming, timeline, comparison_visual, chart, state_machine, cycle, hierarchy_tree, labeled_diagram) with at least 4 animated/interactive steps so students visually understand the concept immediately.
2. "cheatCode": Must use ultra-simple everyday analogies ("like"), why we learn this ("why"), common exam trap ("wrong"), exact winning rule ("right"), visual memory cue ("see"), and a 1-line formula/takeaway ("oneLine").
3. "vaathiyar" (All 8 Mandatory Sections):
   - "crash": 3–4 rapid interactive story scenes ({ tag, text, visual, readMs })
   - "explain": 3–4 deep conceptual breakdowns ({ h, t })
   - "compare": Side-by-side comparison table ({ left, right, rows: [{ metric, left, right }] })
   - "solve": Worked exam problem with step-by-step solution ({ q, figure, steps: [{ step, label, text }] })
   - "life": 3 real-world industry/daily life applications ({ ic, h, t })
   - "history": 3 chronological milestones explaining why this was invented ({ yr, h, t })
   - "flash": 4 active-recall flashcards ({ q, a })
   - "eli5": 3-level progressive explanation ({ kid: "Explain like I am 10", middle: "High school / intuition level", engg: "University exam level definition" })
4. "quiz": Generate 4 exam-grade MCQs. EVERY single question MUST include:
   - "q": Clear question stem
   - "opts": Exactly 4 options
   - "a": Correct option index (0 to 3)
   - "why": Detailed explanation of why the correct option is right
   - "wrong": Detailed breakdown of why the other options are traps/wrong
   - "page": Cited PDF page number
   - "quote": Short verbatim quote from the PDF
   - "visual": A dedicated dynamic visual diagram object specifically illustrating the question scenario so if the student is confused by the question text, the live diagram above the question makes it crystal clear!

SOURCE PDF PAGES (${topicMeta.startPage} to ${topicMeta.endPage}):
${pageSliceText}`;
}

function archeconeHint(archetypeConfig, examDaysMode) {
  return `${archetypeConfig.pedagogyHint} (${examDaysMode === '2days' ? '2-Day Survival Crash Mode' : '10-Day Complete Mastery'})`;
}

/* ============================================================================
 * MODULE C: UPGRADED AURA AI GROUNDED TUTOR
 * ============================================================================ */

function retrieveGroundedContextV2({ question, chunks, activeTopic = null, topK = 4 }) {
  const cleanQ = String(question || '').toLowerCase();
  const terms = cleanQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['what', 'why', 'how', 'the', 'this', 'explain', 'epdi', 'enna', 'sollu', 'puriya'].includes(w));

  const scored = (chunks || []).map((chunk) => {
    const hay = String(chunk.text || '').toLowerCase();
    let score = 0;
    let matchedTerms = 0;

    for (const term of terms) {
      const stem = term.slice(0, Math.max(3, term.length - 2));
      if (hay.includes(term)) {
        score += 18;
        matchedTerms++;
      } else if (hay.includes(stem)) {
        score += 10;
        matchedTerms++;
      }
    }

    if (
      activeTopic &&
      chunk.pageNumber >= (activeTopic.startPage || 1) &&
      chunk.pageNumber <= (activeTopic.endPage || 9999)
    ) {
      score += 25;
    }

    return { ...chunk, score, matchedTerms };
  });

  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, topK).filter((c) => c.score > 0);

  if (topChunks.length === 0 && activeTopic && chunks && chunks.length > 0) {
    const topicChunks = chunks
      .filter(
        (c) =>
          c.pageNumber >= (activeTopic.startPage || 1) &&
          c.pageNumber <= (activeTopic.endPage || 9999)
      )
      .slice(0, 3);
    return {
      inScope: true,
      mode: 'active_topic_context',
      selectedChunks: topicChunks.length ? topicChunks : chunks.slice(0, 2)
    };
  }

  return {
    inScope: topChunks.length > 0,
    mode: 'semantic_chunk_match',
    selectedChunks: topChunks.length ? topChunks : (chunks || []).slice(0, 2)
  };
}

async function askAuraTutorV2({ router, question, chunks, activeTopic, languagePref = 'tanglish' }) {
  const retrieval = retrieveGroundedContextV2({ question, chunks, activeTopic });
  const contextBlock = retrieval.selectedChunks
    .map((c) => `[PDF Page ${c.pageNumber}]:\n${c.text}`)
    .join('\n\n---\n\n');

  const systemInstruction = `You are Aura AI Tutor inside XamCode AI.
Explain concepts clearly like a friendly senior/Vaathiyar.
Language Style: ${
    languagePref === 'tanglish'
      ? 'Respond in clear Tanglish + English technical terms so Tamil Nadu students grasp it in 10 seconds.'
      : 'Respond in clear, engaging English with intuitive analogies.'
  }
Always ground your answer in the provided PDF pages, include a real-world analogy, and ALWAYS generate a dynamic "visual" diagram object (process_flow, comparison_visual, cycle, state_machine, or hierarchy_tree) so the student sees a live visual diagram alongside your answer.`;

  const prompt = `STUDENT QUESTION: "${question}"
CURRENTLY VIEWING TOPIC: "${activeTopic?.title || 'General Course Overview'}"

RELEVANT PDF EXCERPTS:
${contextBlock}

Return JSON with this exact structure:
{
  "answer": "Clear, structured explanation with bullet points and analogy",
  "oneLineTakeaway": "1-sentence exam memory hook",
  "citedPage": 1,
  "quote": "Short verbatim quote from the PDF excerpt",
  "trustLabel": "Grounded in your PDF",
  "followUpQuestions": ["Suggested question 1?", "Suggested question 2?"],
  "visual": {
    "type": "process_flow",
    "title": "Visual Breakdown of Your Question",
    "steps": [
      { "label": "Step 1", "detail": "How it starts" },
      { "label": "Step 2", "detail": "Core mechanism" },
      { "label": "Step 3", "detail": "Final outcome" }
    ]
  }
}`;

  const result = await router.generateStructuredJson({
    systemInstruction,
    prompt,
    maxOutputTokens: 4096
  });
  return result.data;
}

/* ============================================================================
 * MODULE D: 3D EXPERIENCE THEMES & VIBE-CODING SPATIAL ENGINE
 * ============================================================================ */

const XAMCODE_3D_EXPERIENCE_THEMES = {
  'quantum-holo': {
    name: 'Quantum Holo-Deck 3D',
    badge: 'FLAGSHIP 3D',
    bgPrimary: '#040611',
    bgElevated: 'rgba(12, 19, 44, 0.72)',
    accentPrimary: '#00F0FF',
    accentSecondary: '#FF2A85',
    accentGlow: 'rgba(0, 240, 255, 0.32)',
    gridColor: 'rgba(0, 240, 255, 0.12)',
    particleColor: '#00F0FF',
    perspectivePx: 1200,
    maxTiltDeg: 8
  },
  'cyber-vaathiyar': {
    name: 'Cyber-Vaathiyar Neon Grid',
    badge: 'VIBE CODING',
    bgPrimary: '#090314',
    bgElevated: 'rgba(26, 11, 46, 0.75)',
    accentPrimary: '#FFB800',
    accentSecondary: '#B537F2',
    accentGlow: 'rgba(255, 184, 0, 0.30)',
    gridColor: 'rgba(181, 55, 242, 0.16)',
    particleColor: '#FFB800',
    perspectivePx: 1100,
    maxTiltDeg: 10
  },
  'neural-synapse': {
    name: 'Neural Synapse Bio-3D',
    badge: 'LIVE NEURAL',
    bgPrimary: '#020F0D',
    bgElevated: 'rgba(6, 34, 29, 0.74)',
    accentPrimary: '#10B981',
    accentSecondary: '#06B6D4',
    accentGlow: 'rgba(16, 185, 129, 0.30)',
    gridColor: 'rgba(16, 185, 129, 0.12)',
    particleColor: '#10B981',
    perspectivePx: 1250,
    maxTiltDeg: 7
  },
  'solaris-chrono': {
    name: 'Solaris Spatial Glass',
    badge: 'ZERO EYE STRAIN',
    bgPrimary: '#0E0B07',
    bgElevated: 'rgba(33, 25, 16, 0.78)',
    accentPrimary: '#F59E0B',
    accentSecondary: '#EC4899',
    accentGlow: 'rgba(245, 158, 11, 0.26)',
    gridColor: 'rgba(245, 158, 11, 0.10)',
    particleColor: '#FBBF24',
    perspectivePx: 1400,
    maxTiltDeg: 6
  },
  'abyssal-prism': {
    name: 'Bioluminescent Abyss 3D',
    badge: 'DEEP FOCUS',
    bgPrimary: '#010916',
    bgElevated: 'rgba(7, 25, 52, 0.75)',
    accentPrimary: '#38BDF8',
    accentSecondary: '#818CF8',
    accentGlow: 'rgba(56, 189, 248, 0.28)',
    gridColor: 'rgba(56, 189, 248, 0.11)',
    particleColor: '#38BDF8',
    perspectivePx: 1200,
    maxTiltDeg: 8
  },
  'obsidian-monolith': {
    name: 'Obsidian Carbon 3D',
    badge: '2-DAY CRASH MODE',
    bgPrimary: '#060608',
    bgElevated: 'rgba(20, 20, 26, 0.85)',
    accentPrimary: '#F43F5E',
    accentSecondary: '#E2E8F0',
    accentGlow: 'rgba(244, 63, 94, 0.28)',
    gridColor: 'rgba(244, 63, 94, 0.10)',
    particleColor: '#F43F5E',
    perspectivePx: 1000,
    maxTiltDeg: 9
  }
};

function initXamCode3DExperience(defaultThemeId = 'quantum-holo') {
  if (typeof document === 'undefined') return;

  const applyTheme = (themeId) => {
    const t = XAMCODE_3D_EXPERIENCE_THEMES[themeId] || XAMCODE_3D_EXPERIENCE_THEMES['quantum-holo'];
    const root = document.documentElement;
    root.style.setProperty('--xc-bg-primary', t.bgPrimary);
    root.style.setProperty('--xc-bg-elevated', t.bgElevated);
    root.style.setProperty('--xc-accent-primary', t.accentPrimary);
    root.style.setProperty('--xc-accent-secondary', t.accentSecondary);
    root.style.setProperty('--xc-accent-glow', t.accentGlow);
    root.style.setProperty('--xc-grid-color', t.gridColor);
    root.style.setProperty('--xc-perspective', `${t.perspectivePx}px`);
    root.setAttribute('data-xc-3d-theme', themeId);
    try {
      localStorage.setItem('xc_3d_theme', themeId);
    } catch (_) {}
  };

  const bind3DTiltCards = () => {
    const cards = document.querySelectorAll(
      '.xc-3d-card, .study-card, .visual-stage, .cheat-card, .vaathiyar-panel, .quiz-card, .q-card'
    );
    cards.forEach((card) => {
      if (card.dataset.tiltBound === '1') return;
      card.dataset.tiltBound = '1';
      card.style.transformStyle = 'preserve-3d';
      card.style.transition = 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const rotateX = (-y * 6).toFixed(2);
        const rotateY = (x * 6).toFixed(2);
        card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(4px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      });
    });
  };

  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('xc_3d_theme')) || defaultThemeId;
  applyTheme(saved);
  bind3DTiltCards();

  return { applyTheme, bind3DTiltCards, themes: XAMCODE_3D_EXPERIENCE_THEMES };
}

module.exports = {
  FreeTierPoolRouter,
  SUBJECT_ARCHETYPES,
  computePdfCacheKey,
  pdfHashCache,
  buildUpgradedOutlinePrompt,
  buildUpgradedTopicPrompt,
  retrieveGroundedContextV2,
  askAuraTutorV2,
  XAMCODE_3D_EXPERIENCE_THEMES,
  initXamCode3DExperience
};

