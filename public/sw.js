'use strict';

const CACHE = 'gym-v1';
const STATIC = [
  '/', '/index.html', '/style.css', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/js/app.js', '/js/api.js',
  '/js/views/today.js', '/js/views/workout.js',
  '/js/views/schedule.js', '/js/views/templates.js',
  '/js/views/exercises.js', '/js/views/history.js',
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

  // Network-first for API (read-only offline fallback)
  if (url.pathname.startsWith('/api/')) {
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

  // Cache-first for everything else
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
