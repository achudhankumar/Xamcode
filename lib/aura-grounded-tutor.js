'use strict';

/**
 * AURA Grounded Tutor Engine (Phase 8 + v2.0 Upgrade)
 * Implements page-level document chunking (500-800 tokens), semantic & fuzzy stem retrieval,
 * active topic context fallback (for English & Tanglish student questions),
 * exact page citations, out-of-scope detection, visual answers, and per-user rate limits.
 */

const {
  retrieveGroundedContextV2,
  askAuraTutorV2
} = require('./xamcode-upgrade-suite');

const CHUNK_MIN_CHARS = 1200;
const CHUNK_MAX_CHARS = 2400; // ~500 to 800 tokens

function chunkDocumentPages(extractedPages = []) {
  const pages = Array.isArray(extractedPages)
    ? extractedPages
    : (extractedPages && Array.isArray(extractedPages.pages) ? extractedPages.pages : []);
  const chunks = [];
  let chunkIdCounter = 1;

  pages.forEach(p => {
    const pageNum = p.pageNumber || 1;
    const text = (p.text || p.fullText || '').trim();
    if (!text) return;

    if (text.length <= CHUNK_MAX_CHARS) {
      chunks.push({
        id: `chunk_${chunkIdCounter++}`,
        pageNumber: pageNum,
        text,
        headings: p.headings || []
      });
    } else {
      const paragraphs = text.split(/\n\s*\n/);
      let curText = '';
      paragraphs.forEach(para => {
        if (curText.length + para.length > CHUNK_MAX_CHARS && curText.length >= CHUNK_MIN_CHARS) {
          chunks.push({
            id: `chunk_${chunkIdCounter++}`,
            pageNumber: pageNum,
            text: curText.trim(),
            headings: p.headings || []
          });
          curText = para + '\n';
        } else {
          curText += para + '\n';
        }
      });
      if (curText.trim().length > 0) {
        chunks.push({
          id: `chunk_${chunkIdCounter++}`,
          pageNumber: pageNum,
          text: curText.trim(),
          headings: p.headings || []
        });
      }
    }
  });

  return chunks;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'what', 'how', 'why', 'who', 'which', 'when', 'where',
  'during', 'this', 'that', 'with', 'from', 'over', 'into', 'under', 'between',
  'are', 'was', 'were', 'is', 'in', 'on', 'at', 'by', 'an', 'a', 'to', 'of', 'it', 'its', 'can', 'does', 'explain', 'describe'
]);

/**
 * Supports both:
 *   1. v2 object signature: retrieveTopChunks({ question, chunks, activeTopic, topK })
 *      -> returns { inScope, mode, selectedChunks }
 *   2. Phase 8 positional signature: retrieveTopChunks(query, chunks, topK = 3)
 *      -> returns Array<{ chunk, score, matchedDistinctTerms, totalTerms }>
 */
function retrieveTopChunks(queryOrOpts, chunks, topK = 3) {
  if (queryOrOpts && typeof queryOrOpts === 'object' && !Array.isArray(queryOrOpts)) {
    return retrieveGroundedContextV2(queryOrOpts);
  }
  const query = String(queryOrOpts || '');
  const qTerms = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
  if (qTerms.length === 0) return [];

  const scored = (chunks || []).map(chunk => {
    const lowerText = chunk.text.toLowerCase();
    let score = 0;
    let matchedDistinctTerms = 0;

    qTerms.forEach(term => {
      const regex = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(lowerText)) {
        matchedDistinctTerms++;
        score += 20;
        const matches = (lowerText.match(new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi')) || []).length;
        score += Math.min(matches * 2, 10);
      }
    });

    // Heading match boost
    (chunk.headings || []).forEach(h => {
      const lowerH = h.toLowerCase();
      qTerms.forEach(t => {
        const regex = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (regex.test(lowerH)) score += 25;
      });
    });

    return { chunk, score, matchedDistinctTerms, totalTerms: qTerms.length };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

class AuraTutor {
  constructor(chunks = []) {
    this.chunks = chunks;
    this.userQueryLog = new Map(); // userId -> timestamps[]
    this.RATE_LIMIT_PER_MINUTE = 30;
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const windowStart = now - 60000;
    const history = (this.userQueryLog.get(userId) || []).filter(ts => ts > windowStart);
    if (history.length >= this.RATE_LIMIT_PER_MINUTE) {
      throw new Error(`Rate limit exceeded for user ${userId}. Maximum ${this.RATE_LIMIT_PER_MINUTE} queries per minute.`);
    }
    history.push(now);
    this.userQueryLog.set(userId, history);
    return true;
  }

  ask({ question, userId = 'user_default', wantVisual = false, activeTopic = null }) {
    this.checkRateLimit(userId);

    const topMatches = retrieveTopChunks(question, this.chunks, 3);
    const top = topMatches[0];
    const coverage = top ? top.matchedDistinctTerms / Math.max(top.totalTerms, 1) : 0;

    let bestChunk = null;
    if (!top || top.matchedDistinctTerms < 2 || coverage < 0.30 || top.score < 30) {
      // If activeTopic is provided (e.g., Tanglish query on open topic), fall back to activeTopic context
      if (activeTopic && this.chunks.length > 0) {
        const v2 = retrieveGroundedContextV2({ question, chunks: this.chunks, activeTopic });
        if (v2.inScope && v2.selectedChunks.length > 0) {
          bestChunk = v2.selectedChunks[0];
        }
      }
      if (!bestChunk) {
        return {
          inScope: false,
          citedPage: null,
          quote: null,
          answer: 'This concept is not covered in your uploaded document.',
          trustLabel: 'Outside knowledge, not from your PDF',
          visual: null
        };
      }
    } else {
      bestChunk = top.chunk;
    }

    let answerText = `Based on your course material on Page ${bestChunk.pageNumber}, `;
    const sentences = bestChunk.text.split(/(?<=[.?!])\s+/);
    const quote = sentences[0] || bestChunk.text.slice(0, 120);
    answerText += quote;

    let visual = null;
    if (wantVisual) {
      visual = {
        type: 'process_flow',
        title: `AURA Visual Explanation: ${question.slice(0, 30)}`,
        steps: [
          { title: 'Initial Condition', label: 'Initial Condition', desc: `State described on Page ${bestChunk.pageNumber}`, detail: `State described on Page ${bestChunk.pageNumber}` },
          { title: 'Protocol Transition', label: 'Protocol Transition', desc: 'Execution dynamics and state verification', detail: 'Execution dynamics and state verification' },
          { title: 'Final State', label: 'Final State', desc: 'Resolved delivery and confirmed acknowledgement', detail: 'Resolved delivery and confirmed acknowledgement' }
        ]
      };
    }

    return {
      inScope: true,
      citedPage: bestChunk.pageNumber,
      quote,
      answer: answerText,
      trustLabel: null,
      visual
    };
  }
}

module.exports = {
  CHUNK_MIN_CHARS,
  CHUNK_MAX_CHARS,
  chunkDocumentPages,
  retrieveTopChunks,
  retrieveGroundedContextV2,
  askAuraTutor: askAuraTutorV2,
  AuraTutor
};
