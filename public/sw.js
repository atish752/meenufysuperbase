// ── Meenufy Service Worker ────────────────────────────────────────────────
// To invalidate the cache on a new deploy, bump the CACHE_VERSION number.
const CACHE_VERSION = 6;
const CACHE_NAME = `meenufy-v${CACHE_VERSION}`;

// ── Install: minimal cache — only icons and manifests (NOT HTML pages) ────
// HTML navigation requests are always served network-first so the app shell
// is always fresh. We only cache assets (JS/CSS) and static files.
const STATIC_SHELL = [
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/admin-manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual try/catch so a missing file doesn't fail entire install
      return Promise.allSettled(STATIC_SHELL.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// Handle SKIP_WAITING message from main.tsx to force immediate activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: delete ALL old caches ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('meenufy-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch handler ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, non-http, and all third-party/Firebase/CDN requests
  if (
    request.method !== 'GET' ||
    !request.url.startsWith('http') ||
    url.hostname !== self.location.hostname
  ) {
    return;
  }

  // ── HTML navigation requests: ALWAYS network-first, NO cache fallback ───
  // This ensures the user always gets the latest index.html with fresh JS
  // bundle hashes. Do NOT cache navigation responses — stale cached HTML
  // is the root cause of "blank screen on reload" bugs.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Offline-only fallback: return cached index.html if network fails
        return caches.match('/index.html');
      })
    );
    return;
  }

  // ── Vite-hashed JS/CSS assets: cache-first (immutable — hash changes on rebuild) ──
  if (
    url.pathname.startsWith('/assets/') &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Manifest & icon files: cache-first ───────────────────────────────────
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/admin-manifest.json' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Default: network-first for everything else ────────────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
