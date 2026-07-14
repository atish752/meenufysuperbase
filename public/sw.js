// ── Meenufy Service Worker ────────────────────────────────────────────────
// To invalidate the cache on a new deploy, bump the CACHE_VERSION number.
const CACHE_VERSION = 5;
const CACHE_NAME = `meenufy-v${CACHE_VERSION}`;
const ADMIN_CACHE_NAME = `meenufy-admin-v${CACHE_VERSION}`;

// Static shell files for the customer app
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

// Static shell files for the admin app
const ADMIN_SHELL = [
  '/admin',
  '/index.html',
  '/admin-manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

// ── Install: cache both app shells ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL)),
      caches.open(ADMIN_CACHE_NAME).then((cache) => cache.addAll(ADMIN_SHELL)),
    ])
  );
  // Take over immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) =>
            name.startsWith('meenufy-') &&
            name !== CACHE_NAME &&
            name !== ADMIN_CACHE_NAME
          )
          .map((name) => caches.delete(name))
      )
    )
  );
  // Claim all open clients so updates apply immediately
  self.clients.claim();
});

// ── Helper: is this an admin route? ──────────────────────────────────────
function isAdminPath(pathname) {
  return pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/');
}

// ── Fetch: network-first with offline fallback ────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, chrome-extension://, and Firebase/CDN requests
  if (
    request.method !== 'GET' ||
    !request.url.startsWith('http') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('ipapi') ||
    url.hostname.includes('fonts.goo')
  ) {
    return;
  }

  // For navigation requests (HTML page): network-first, fallback to the right cached shell
  if (request.mode === 'navigate') {
    const admin = isAdminPath(url.pathname);
    const fallbackCache = admin ? ADMIN_CACHE_NAME : CACHE_NAME;

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(fallbackCache).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Serve admin-manifest.json directly when requested
  if (url.pathname === '/admin-manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(ADMIN_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For Vite-hashed JS/CSS assets (immutable): cache-first (they change names on rebuild)
  if (url.pathname.startsWith('/assets/') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For images: stale-while-revalidate
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
