/**
 * lib/telemetry-analytics.js
 * Telemetry and analytics event tracking for XamCode AI (Phase 13).
 * 
 * Tracks key student lifecycle events:
 * - upload: PDF document uploaded
 * - unit_ready: Background pipeline finished a unit
 * - topic_completed: Student completed studying a topic
 * - mode_opened: Vaathiyar mode accessed (story, exam, viva, etc.)
 * - theme_chosen: Theme switched by student
 */

const VALID_EVENT_TYPES = [
  'upload',
  'unit_ready',
  'topic_completed',
  'mode_opened',
  'theme_chosen'
];

class TelemetryAnalytics {
  constructor(options = {}) {
    this.events = [];
    this.onEventCallback = options.onEventCallback || null;
  }

  track(eventType, payload = {}) {
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      throw new Error(`Invalid telemetry event type: "${eventType}". Allowed: ${VALID_EVENT_TYPES.join(', ')}`);
    }

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      payload: Object.assign({}, payload)
    };

    // Scrub any sensitive PII (e.g. passwords, raw payment details)
    if (event.payload.password) delete event.payload.password;
    if (event.payload.token) delete event.payload.token;
    if (event.payload.apiKey) delete event.payload.apiKey;

    this.events.push(event);

    if (typeof this.onEventCallback === 'function') {
      try {
        this.onEventCallback(event);
      } catch (e) {
        console.error('Telemetry callback error:', e);
      }
    }

    return event;
  }

  getEvents(filterType = null) {
    if (filterType) {
      return this.events.filter(e => e.type === filterType);
    }
    return [...this.events];
  }

  getSummary() {
    const counts = {};
    for (const t of VALID_EVENT_TYPES) counts[t] = 0;
    for (const e of this.events) counts[e.type] = (counts[e.type] || 0) + 1;
    return {
      total: this.events.length,
      counts
    };
  }

  clear() {
    this.events = [];
  }
}

module.exports = {
  TelemetryAnalytics,
  VALID_EVENT_TYPES
};

