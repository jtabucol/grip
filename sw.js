const CACHE_NAME = 'grip-v3';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install — only cache icons and manifest, NOT index.html
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - index.html → ALWAYS network first, never serve stale
// - Supabase API calls → always network, no cache
// - Static assets (icons, fonts) → cache first
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase calls
  if (url.hostname.includes('supabase.co')) return;

  // For the app shell (HTML navigation) — always go to network first
  if (event.request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets — cache first
  if (STATIC_ASSETS.some(a => url.pathname === a)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request)
          .then(res => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            return res;
          })
        )
    );
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request));
});
