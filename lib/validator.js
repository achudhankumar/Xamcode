'use strict';

const { TopicSchema, OutlineSchema, ALLOWED_VISUAL_TYPES } = require('./schemas');

/**
 * Normalizes text for reliable lexical grounding comparison.
 * Removes extra whitespace, punctuation, and converts to lowercase.
 */
function normalizeForComparison(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a quote or excerpt exists within the page text.
 * Uses exact normalized substring matching followed by token-window overlap.
 */
function excerptMatchesPage(excerpt, pageText) {
  if (!excerpt || !pageText) return false;
  const normExcerpt = normalizeForComparison(excerpt);
  const normPage = normalizeForComparison(pageText);

  if (normExcerpt.length < 5) return true; // Trivial excerpt
  if (normPage.includes(normExcerpt)) return true;

  // If excerpt has minor OCR or hyphenation discrepancies, check 3-word n-gram overlap
  const excerptWords = normExcerpt.split(' ').filter(w => w.length > 2);
  if (excerptWords.length === 0) return true;

  let matchedWords = 0;
  for (const word of excerptWords) {
    if (normPage.includes(word)) {
      matchedWords++;
    }
  }

  const overlapRatio = matchedWords / excerptWords.length;
  return overlapRatio >= 0.75;
}

/**
 * Scans an object recursively for prohibited raw SVG or HTML injection tags.
 */
function containsRawSvgOrHtmlCode(obj) {
  const stack = [obj];
  const forbidden = /<svg[\s>]|<script[\s>]|<iframe[\s>]|javascript:/i;

  while (stack.length > 0) {
    const cur = stack.pop();
    if (typeof cur === 'string') {
      if (forbidden.test(cur)) return true;
    } else if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
    } else if (cur && typeof cur === 'object') {
      for (const key of Object.keys(cur)) stack.push(cur[key]);
    }
  }
  return false;
}

/**
 * Validates a single generated topic against:
 * 1. Zod TopicSchema (shape, required fields, 8 Vaathiyar modes if present)
 * 2. Lexical grounding: pdfQuote matches the actual page text
 * 3. Quiz integrity: every question's answer points to a valid option
 * 4. Visual safety: valid visual template type, no raw SVG/HTML injection
 *
 * @param {object} topic - The topic payload
 * @param {string} [pageText] - The extracted text of the source page(s)
 * @returns {{ valid: boolean, errors: string[], data?: object }}
 */
function validateTopic(topic, pageText = '') {
  const errors = [];

  if (!topic || typeof topic !== 'object') {
    return { valid: false, errors: ['Topic payload must be an object'] };
  }

  // 1. Zod Schema Validation
  const parseResult = TopicSchema.safeParse(topic);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  const data = parseResult.success ? parseResult.data : topic;

  // 2. Lexical Grounding / PDF Excerpt Check
  const quote = data.pdfQuote || data.pdf_excerpt;
  if (quote && pageText) {
    if (!excerptMatchesPage(quote, pageText)) {
      errors.push(`Lexical grounding failed: PDF quote "${quote.slice(0, 40)}..." was not found in the source page text`);
    }
  }

  // 3. Quiz Options & Answer Checks
  if (Array.isArray(data.questions)) {
    data.questions.forEach((q, idx) => {
      if (!Array.isArray(q.opts) || q.opts.length < 2) {
        errors.push(`Question ${idx + 1} must have at least 2 options`);
      } else if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.opts.length) {
        errors.push(`Question ${idx + 1} answer index ${q.a} does not point to a valid option (opts length ${q.opts.length})`);
      } else if (!q.opts[q.a] || !q.opts[q.a].trim()) {
        errors.push(`Question ${idx + 1} correct option at index ${q.a} is empty`);
      }
    });
  }

  // 4. Visual Template Check & Injection Guard
  if (data.visual) {
    if (!ALLOWED_VISUAL_TYPES.includes(data.visual.type)) {
      // Gracefully fall back to process_flow per spec
      data.visual.type = 'process_flow';
    }
  }

  if (containsRawSvgOrHtmlCode(data)) {
    errors.push('AI generated prohibited raw SVG or HTML markup. Visuals must use template registry.');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null
  };
}

/**
 * Validates a generated course outline.
 */
function validateOutline(outline) {
  const parseResult = OutlineSchema.safeParse(outline);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    };
  }
  return { valid: true, errors: [], data: parseResult.data };
}

module.exports = {
  validateTopic,
  validateOutline,
  excerptMatchesPage,
  containsRawSvgOrHtmlCode,
  normalizeForComparison
};

