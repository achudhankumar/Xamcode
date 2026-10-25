'use strict';

/**
 * Vaathiyar Modes & Cache Engine (Phase 7)
 * Implements on-demand lazy generation, prefetching, and trust labels
 * for all 8 Vaathiyar learning modes.
 */

class ModeCache {
  constructor() {
    this.cache = new Map(); // key: `${topicId}:${mode}`
    this.prefetchQueue = [];
  }

  getCacheKey(topicId, mode) {
    return `${topicId}:${mode}`;
  }

  has(topicId, mode) {
    return this.cache.has(this.getCacheKey(topicId, mode));
  }

  get(topicId, mode) {
    return this.cache.get(this.getCacheKey(topicId, mode)) || null;
  }

  set(topicId, mode, data) {
    this.cache.set(this.getCacheKey(topicId, mode), {
      data,
      cachedAt: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  /**
   * Generates a 5-node complete mesh diagram with all 10 links explicitly drawn.
   * Eliminates the row-of-dots antipattern.
   */
  generateFullMeshSvg(nodeCount = 5) {
    const width = 460;
    const height = 220;
    const cx = 230;
    const cy = 105;
    const radius = 80;

    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      nodes.push({
        id: String.fromCharCode(65 + i),
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle))
      });
    }

    let linksSvg = '';
    let linkCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        linkCount++;
        linksSvg += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="#38bdf8" stroke-width="1.8" opacity="0.85" />`;
      }
    }

    let nodesSvg = '';
    nodes.forEach(n => {
      nodesSvg += `
        <g>
          <circle cx="${n.x}" cy="${n.y}" r="16" fill="#0f172a" stroke="#f97316" stroke-width="2.5" />
          <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff">${n.id}</text>
        </g>
      `;
    });

    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:100%;max-width:480px" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="10" fill="#030712" />
      <text x="${cx}" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#94a3b8">COMPLETE MESH TOPOLOGY (${nodeCount} NODES · ${linkCount} DEDICATED LINKS)</text>
      ${linksSvg}
      ${nodesSvg}
    </svg>`;
  }

  /**
   * Lazily loads or generates mode content on demand with trust labels.
   */
  async loadMode(topicId, mode, topicData = {}) {
    const t0 = Date.now();
    const existing = this.get(topicId, mode);
    if (existing) {
      return {
        mode,
        topicId,
        content: existing.data,
        cached: true,
        durationMs: Date.now() - t0
      };
    }

    // Generate mode payload on demand
    let content = null;
    switch (mode) {
      case 'crash':
        content = {
          mode: 'crash',
          slides: [
            { tag: 'ESSENCE', text: `${topicData.title || 'Core Concept'} synthesized in 60 seconds.` },
            { tag: 'RULE', text: 'Exam takeaway: memorize the primary state transitions and bandwidth trade-offs.' }
          ],
          trustLabel: null
        };
        break;

      case 'compare':
        content = {
          mode: 'compare',
          left: 'Approach A',
          right: 'Approach B',
          rows: [['Overhead', 'Low', 'High'], ['Throughput', 'High', 'Moderate']],
          // Label rule: Charts & Compare tables use facts from PDF, otherwise marked "AI estimate"
          trustLabel: 'AI estimate'
        };
        break;

      case 'solve':
        content = {
          mode: 'solve',
          q: 'A network has 5 nodes connected in a full mesh. How many physical links are required?',
          formula: 'Links = n(n-1) / 2',
          steps: [
            { label: 'STEP 1', math: 'n = 5 nodes', note: 'Every node links to (n-1) neighbours' },
            { label: 'STEP 2', math: 'Links = 5 * 4 / 2 = 10 links', note: 'Dividing by 2 prevents double-counting bidirectional pairs' }
          ],
          diagram: this.generateFullMeshSvg(5),
          trustLabel: null
        };
        break;

      case 'life':
        content = {
          mode: 'life',
          application: 'High-frequency trading architectures and CDN edge proxies.',
          // Label rule: History and Real-Life content carries label "Extra knowledge, not from your PDF"
          trustLabel: 'Extra knowledge, not from your PDF'
        };
        break;

      case 'history':
        content = {
          mode: 'history',
          milestone: 'Inception in ARPANET RFCs (1970-1983).',
          // Label rule: History and Real-Life content carries label "Extra knowledge, not from your PDF"
          trustLabel: 'Extra knowledge, not from your PDF'
        };
        break;

      case 'flash':
        content = {
          mode: 'flash',
          cards: [
            { q: `What is the primary function of ${topicData.title || 'this mechanism'}?`, a: 'Enforces reliable transport and fault tolerance.' }
          ],
          trustLabel: null
        };
        break;

      case 'exam':
        content = {
          mode: 'exam',
          q: 'Explain the protocol operation with a neat timing sequence diagram [8 Marks].',
          modelAnswer: 'Delineate packet headers, state transitions, and timeout recovery sequences.',
          trustLabel: null
        };
        break;

      case 'eli5':
        content = {
          mode: 'eli5',
          kid: 'Imagine passing a toy train back and forth between two friends who take turns saying got it!',
          engg: 'Full duplex sliding window synchronization over unshielded twisted pair with CRC error rejection.',
          trustLabel: null
        };
        break;

      default:
        throw new Error(`Unsupported Vaathiyar mode: "${mode}"`);
    }

    this.set(topicId, mode, content);
    const durationMs = Date.now() - t0;

    return {
      mode,
      topicId,
      content,
      cached: false,
      durationMs
    };
  }

  /**
   * Prefetches Crash Lesson and Flashcards for a selected topic
   */
  async prefetchTopic(topicId, topicData = {}) {
    await Promise.all([
      this.loadMode(topicId, 'crash', topicData),
      this.loadMode(topicId, 'flash', topicData)
    ]);
  }
}

const defaultModeCache = new ModeCache();

module.exports = {
  ModeCache,
  defaultModeCache
};

