'use strict';

const CACHE = 'gym-v31';
const STATIC = [
  '/', '/index.html', '/style.css', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/js/app.js', '/js/api.js', '/js/insforge.js',
  '/js/views/today.js', '/js/views/workout.js',
  '/js/views/settings.js', '/js/views/templates.js',
  '/js/views/exercises.js', '/js/views/history.js',
  '/js/views/login.js',
  '/js/vendor/insforge-sdk-bundle.mjs',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Network-only for OAuth callbacks and API calls
  if (url.searchParams.has('insforge_code') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for JS files so updates deploy immediately
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (static assets)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return r;
      });
    })
  );
});
