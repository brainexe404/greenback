/* sw.js — Baron Greenback
   Goal: stop stale caching (especially GitHub Pages / mobile browsers)
   Strategy: network-first for html & assets, fallback to cache when offline
*/

const CACHE_VERSION = "1000"; // bump with index BUILD
const RUNTIME = `gbaron-runtime-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(RUNTIME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("gbaron-runtime-") && k !== RUNTIME) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

function isHTML(req){
  return req.destination === "document" ||
    (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Always try network first for HTML (mobile.html/desktop.html/index etc)
  if (isHTML(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // For assets: network-first but cache fallback
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    try{
      const fresh = await fetch(req, { cache: "no-store" });
      // cache only successful basic responses
      if (fresh && fresh.ok && fresh.type === "basic") cache.put(req, fresh.clone());
      return fresh;
    }catch(e){
      const cached = await caches.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});
