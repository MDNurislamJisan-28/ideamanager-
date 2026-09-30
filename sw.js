/* ============================================================
   IdeaManager — Service Worker
   Copyright © 2026 Md. Nur Islam Jissan. All Rights Reserved.
   Purpose: 100% offline support with intelligent caching
   ============================================================ */

const CACHE_VERSION = 'ideamanager-v1.0.0';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

/* ========== INSTALL — Cache all essential assets ========== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Install cache failed:', err);
      })
  );
});

/* ========== ACTIVATE — Clean old caches ========== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ========== FETCH — Cache-first with network fallback ========== */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (let them pass through)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        // Update cache in background (stale-while-revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_VERSION).then((cache) => {
                cache.put(request, networkResponse.clone());
              });
            }
          })
          .catch(() => { /* Offline — ignore */ });

        return cachedResponse;
      }

      // Not in cache — try network
      return fetch(request)
        .then((networkResponse) => {
          // Cache successful same-origin responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed — try fallback
          if (request.mode === 'navigate') {
            // Navigation request — serve index.html
            return caches.match('./index.html').then((fallback) => {
              if (fallback) return fallback;
              return caches.match('./');
            });
          }
          // Other requests — return empty response
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    })
  );
});

/* ========== MESSAGE — For manual cache updates ========== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    caches.open(CACHE_VERSION).then((cache) => {
      cache.addAll(CACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .then(() => console.log('[SW] Manual cache update complete'));
    });
  }
});

console.log('[SW] IdeaManager Service Worker loaded — © Md. Nur Islam Jissan');
