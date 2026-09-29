const CACHE = 'mi-siembra-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Instalación: cachea los archivos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache first para archivos locales, red directa para Supabase
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No cachear peticiones a Supabase (queremos datos frescos)
  if (url.hostname.includes('supabase.co')) return;

  // No cachear CDN de Tailwind ni Google Fonts (ya tienen su propio cache)
  if (url.hostname.includes('tailwindcss.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});