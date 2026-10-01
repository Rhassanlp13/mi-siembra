/* ════════════════════════════════════════════════════════════
   SERVICE WORKER — Mi Siembra
   ════════════════════════════════════════════════════════════ */

const VERSION = 'v7';
const CACHE_STATIC = `mi-siembra-static-${VERSION}`;
const CACHE_CDN    = `mi-siembra-cdn-${VERSION}`;
const CACHE_API    = `mi-siembra-api-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] No se pudo cachear:', url, err.message);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => ![CACHE_STATIC, CACHE_CDN, CACHE_API].includes(k))
          .map(k => {
            console.log('[SW] Borrando caché vieja:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Supabase → Network-first
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  // CDN de Tailwind → Cache-first (así funciona offline después de la primera carga)
  if (
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(request, CACHE_CDN));
    return;
  }

  // Mismo origen → Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

async function cacheFirst(request, cacheName){
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst falló:', request.url, err.message);
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Recurso no disponible offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function networkFirst(request, cacheName){
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_API_CACHE') {
    caches.delete(CACHE_API).then(() => {
      console.log('[SW] Caché de API borrada');
    });
  }
});