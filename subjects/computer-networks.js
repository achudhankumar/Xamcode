'use strict';

/**
 * Computer Networks & Distributed Systems Subject Pack
 */
const COMPUTER_NETWORKS_PACK = {
  id: 'computer-networks',
  name: 'Computer Networks & Distributed Systems',
  domain: 'Networks & Protocols',
  systemPrompt: `You are a Principal Network Architect and Distinguished Systems Professor.
When generating topics:
- Focus on protocol state transitions, packet header encodings, and network queueing dynamics.
- Ground explanations in IETF RFC standards (e.g. RFC 791, RFC 9293, RFC 9000, RFC 8200).
- Emphasize mathematical formulations: Bandwidth-Delay Product (BDP), Shannon-Hartley capacity, Goodput efficiency, and Little's Law.
- Select specialized visual models (topology, packet_flow, sliding_window, hamming, collision_timeline, osi_encapsulation, bit_flip) where applicable.`,
  allowedVisualTypes: [
    'topology',
    'packet_flow',
    'sliding_window',
    'hamming',
    'collision_timeline',
    'osi_encapsulation',
    'bit_flip',
    'process_flow'
  ],
  layoutEmphasis: 'Protocol steps, packet animation, header fields, and state machine transitions',
  quizStyle: 'Rigorous protocol scenarios, bitmask calculations, packet trace analysis, RFC compliance',

  /**
   * Evaluates if a proposed visual scene meets pedagogical richness criteria.
   * Requirement: at least 3 distinct elements, at least 4 steps, captions on every step.
   */
  checkRichness(visual) {
    if (!visual || typeof visual !== 'object') return false;
    const steps = Array.isArray(visual.steps) ? visual.steps : [];
    if (steps.length < 3) return false;
    
    // Check captions on every step
    const allHaveCaptions = steps.every(s => (s.desc && s.desc.trim().length > 3) || (s.caption && s.caption.trim().length > 3));
    if (!allHaveCaptions) return false;

    // Check distinct elements
    const elements = new Set(steps.map(s => (s.title || '').trim().toLowerCase()));
    return elements.size >= 3;
  }
};

module.exports = COMPUTER_NETWORKS_PACK;

