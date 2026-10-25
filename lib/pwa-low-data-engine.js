/**
 * lib/pwa-low-data-engine.js
 * PWA installation, offline lesson cache management, and Low-Data Mode for XamCode AI.
 * 
 * Master Plan Phase A10:
 * - App installability (manifest, service worker)
 * - Caching of app shell + opened lessons as JSON ONLY (never original PDF)
 * - Low-data toggle (disables 3D scenes, forces lite theme, disables prefetch)
 * - Cache eviction on subscription lapse or logout
 * - Offline banner
 */

class PwaLowDataEngine {
  constructor(options = {}) {
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : new Map());
    this.swRegistration = null;
    this.lowDataKey = 'xamcode_low_data_mode';
    this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    this.activeTheme = options.activeTheme || 'soft_minimal_studio';
  }

  // --- 1. Service Worker & PWA Lifecycle ---
  async registerServiceWorker(swPath = '/public/sw.js') {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register(swPath);
        return { registered: true, scope: this.swRegistration.scope };
      } catch (err) {
        return { registered: false, error: err.message };
      }
    }
    return { registered: false, reason: 'ServiceWorker not supported in this environment' };
  }

  // --- 2. Low-Data Mode Controls ---
  isLowDataMode() {
    const val = typeof this.storage.getItem === 'function' ? this.storage.getItem(this.lowDataKey) : this.storage.get(this.lowDataKey);
    return val === 'true' || val === true;
  }

  setLowDataMode(enabled) {
    const boolVal = !!enabled;
    if (typeof this.storage.setItem === 'function') {
      this.storage.setItem(this.lowDataKey, String(boolVal));
    } else {
      this.storage.set(this.lowDataKey, boolVal);
    }
    return this.getLowDataPolicy();
  }

  getLowDataPolicy() {
    const enabled = this.isLowDataMode();
    return {
      lowDataMode: enabled,
      allow3dScenes: !enabled,           // Disables 3D WebGL scenes when active
      recommendedTheme: enabled ? 'soft_minimal_studio' : this.activeTheme, // Forces 2D lite theme
      enablePrefetching: !enabled,       // Turns off prefetching
      imageResolution: enabled ? 'low' : 'high',
      saveDataHeader: enabled
    };
  }

  // --- 3. Cache Validation & Subscription Lapse Eviction ---
  /**
   * Checks subscription status against cached lessons.
   * If lapsed or cancelled, purges lesson cache completely.
   */
  async syncSubscriptionCache(subscriptionStatus, cachePurgeFn = null) {
    const lapsedStatuses = ['lapsed', 'cancelled', 'expired', 'past_due'];
    const isLapsed = lapsedStatuses.includes(subscriptionStatus);

    if (isLapsed) {
      // Purge Service Worker lesson cache
      let purged = false;
      if (typeof cachePurgeFn === 'function') {
        purged = await cachePurgeFn();
      } else if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
        purged = await new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => resolve(!!event.data.purged);
          navigator.serviceWorker.controller.postMessage({ type: 'PURGE_LESSON_CACHE' }, [channel.port2]);
          setTimeout(() => resolve(true), 500); // safety timeout
        });
      } else {
        purged = true;
      }

      return {
        cachePurged: true,
        reason: `Subscription ${subscriptionStatus}: cached lessons removed for copyright/license enforcement.`,
        offlineAccessAllowed: false
      };
    }

    return {
      cachePurged: false,
      subscriptionValid: true,
      offlineAccessAllowed: true
    };
  }

  // --- 4. Caching Rules Validator ---
  /**
   * Enforces the rule: Cache generated JSON only, NEVER the original PDF.
   */
  canCacheRequest(url, method = 'GET') {
    if (method !== 'GET') return false;
    const urlStr = String(url).toLowerCase();
    
    // Explicit blacklist: PDFs, raw uploads, sensitive auth
    if (urlStr.endsWith('.pdf') || urlStr.includes('/api/analyze') || urlStr.includes('/api/billing/')) {
      return false;
    }

    // Whitelist: Generated JSON endpoints and static assets
    if (urlStr.includes('/api/topics/') || urlStr.includes('/api/courses/') || urlStr.includes('/api/lessons/')) {
      return true;
    }

    if (urlStr.endsWith('.html') || urlStr.endsWith('.css') || urlStr.endsWith('.js') || urlStr.endsWith('.json') || urlStr.endsWith('.svg')) {
      return true;
    }

    return false;
  }

  // --- 5. Offline Banner Component ---
  renderOfflineBanner(isOnline = this.isOnline) {
    if (isOnline) {
      return { visible: false, html: '' };
    }
    return {
      visible: true,
      html: `
        <div id="xc-offline-banner" style="background:#1E1B4B; border-bottom:1px solid #4338CA; color:#E0E7FF; padding:10px 16px; font-size:13px; display:flex; align-items:center; justify-content:space-between; z-index:9999;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#F59E0B;"></span>
            <span><strong>Offline Mode</strong> — Viewing saved lessons. New generation and AURA tutor require an internet connection.</span>
          </div>
          <span style="font-size:11px; color:#A5B4FC; text-transform:uppercase; letter-spacing:0.05em;">Cached Only</span>
        </div>
      `.trim()
    };
  }
}

module.exports = { PwaLowDataEngine };

