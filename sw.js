/* Baron Greenback SW (safe mode)
   - No HTML caching (always fresh)
   - Light caching for images/audio for faster repeat loads
*/

const VERSION = 'gbaron-safe-v1';
const RUNTIME = `runtime-${VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k.startsWith('runtime-') && k !== RUNTIME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache documents (HTML) or the router pages.
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  const isHtml = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  if (isDoc || isHtml) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Cache-first for static assets (images/audio), with network refresh in background.
  const isStatic = ['image','audio','font','style','script'].includes(req.destination);
  if (!isStatic) {
    // default: network
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    const cached = await cache.match(req);
    if (cached) {
      // Update in background
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        } catch(_) {}
      })());
      return cached;
    }

    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      try { await cache.put(req, fresh.clone()); } catch(_) {}
    }
    return fresh;
  })());
});
