/**
 * sw.js - Service Worker for XamCode AI (Phase A10)
 * 
 * Rules:
 * - Cache the app shell (HTML, CSS, JS, manifest, fonts)
 * - Cache opened lessons as generated JSON ONLY (/api/courses/*, /api/topics/*, /api/lessons/*)
 * - NEVER cache original PDF documents or raw uploads (/api/analyze raw bytes)
 * - Clear lesson cache on PURGE_LESSON_CACHE message (logout or subscription lapse)
 * - Offline banner support and graceful offline fallback
 */

const CACHE_VERSION = 'xamcode-v1.0.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const LESSON_CACHE = `${CACHE_VERSION}-lessons`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/build',
  '/public/manifest.json',
  '/css/global.css',
  '/js/app.js',
  '/shared/themes/index.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Best-effort cache of shell assets
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        console.warn('[SW] App shell precache notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NEVER cache original PDF files or upload POST requests
  if (url.pathname.endsWith('.pdf') || (url.pathname.includes('/api/analyze') && req.method === 'POST')) {
    return; // Pass through straight to network, do not touch cache
  }

  // 2. Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  // 3. Lesson JSON Cache: Cache generated course/topic JSON only
  if (url.pathname.startsWith('/api/topics/') || url.pathname.startsWith('/api/courses/') || url.pathname.startsWith('/api/lessons/')) {
    event.respondWith(
      caches.open(LESSON_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(req);
          if (networkRes.ok) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          const cachedRes = await cache.match(req);
          if (cachedRes) {
            return cachedRes;
          }
          return new Response(JSON.stringify({
            error: 'Offline: This lesson has not been opened yet for offline study.',
            offline: true
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // 4. App Shell & Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes.ok && req.method === 'GET') {
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, networkRes.clone()));
        }
        return networkRes;
      }).catch(() => {
        // Return cached version or offline fallback
        return cached || new Response('<h1>Offline</h1><p>You are currently offline.</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      });
      return cached || fetchPromise;
    })
  );
});

// Message listener for subscription lapse or user logout purge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PURGE_LESSON_CACHE') {
    event.waitUntil(
      caches.delete(LESSON_CACHE).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ purged: true });
        }
      })
    );
  }
});

