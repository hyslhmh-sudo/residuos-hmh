/* Service worker — Portal de Residuos HZT / HMH
   Cambiá VERSION cada vez que subas un index.html nuevo para forzar la actualización. */
const VERSION = 'residuos-v7';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png?v=3',
  './icons/icon-512.png?v=3',
  './icons/icon-maskable-512.png?v=3',
  './icons/apple-touch-icon.png?v=3',
  './icons/favicon-32.png?v=3'
];

const ICON_FONT_CSS = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';

// Guarda también la fuente de íconos, para que se vean bien sin conexión desde el primer uso.
async function cacheIconFont(cache) {
  try {
    const res = await fetch(ICON_FONT_CSS);
    if (!res.ok) return;
    await cache.put(ICON_FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(urls.map((u) => fetch(u).then((r) => r.ok && cache.put(u, r))));
  } catch (e) { /* sin conexión al instalar: se guardará en el próximo uso */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE).then(() => cacheIconFont(c)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;               // formularios (Formspree) pasan directo
  const url = new URL(req.url);

  // Página: primero la red (para ver siempre la última versión), si no hay conexión, la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Íconos Material Symbols (Google Fonts): se guardan la primera vez y después funcionan sin conexión.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Archivos propios del sitio: caché con actualización en segundo plano.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
