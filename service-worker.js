/* ════════════════════════════════════════════════════════════
   SERVICE WORKER — Mi Siembra
   - Cache-first para archivos locales
   - Cache-first para CDN de Tailwind (para offline tras primera carga)
   - Network-first para Supabase
   - Soporte offline completo
   - Notificaciones de fase lunar
   ════════════════════════════════════════════════════════════ */

const VERSION = 'v19';
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

/* ─── INSTALL: precachea los archivos base ─── */
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

/* ─── ACTIVATE: limpia cachés viejas ─── */
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

/* ─── FETCH: estrategia según el tipo de petición ─── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // 1) Supabase → Network-first con fallback a caché
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  // 2) CDN de Tailwind y Google Fonts → Cache-first
  if (
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(request, CACHE_CDN));
    return;
  }

  // 3) Mismo origen (archivos locales) → Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // 4) Otros → red con fallback a caché runtime
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* ─── Estrategia: Cache-first ─── */
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

/* ─── Estrategia: Network-first ─── */
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

/* ─── Mensajes desde la app ─── */
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

/* ─── Click en notificación ─── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
