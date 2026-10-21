/* Flippy service worker — offline support.
   Served from assets/ alongside the app icons (same layout as Reelio and
   Blip), so the paths below are relative to this file. APP_URL is the app
   root (the scope's parent). Bump VERSION when the shell changes so old
   caches are replaced. */
const VERSION = "5";
const CACHE = "flippy-v" + VERSION;
const APP_URL = self.registration.scope.replace(/assets\/?$/, "");
const CORE = [
  APP_URL,
  APP_URL + "index.html",
  APP_URL + "assets/manifest.webmanifest",
  APP_URL + "assets/flippy-logo.webp",
  APP_URL + "assets/icon-192.png",
  APP_URL + "assets/icon-512.png",
  APP_URL + "assets/icon-maskable-512.png",
  APP_URL + "assets/apple-touch-icon.png",
  APP_URL + "assets/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("flippy-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page navigations: network first so a fresh deploy shows up, falling
  // back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(APP_URL + "index.html", copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || caches.match(APP_URL + "index.html")))
    );
    return;
  }

  // Everything else (icons, logo, fonts): cache-first, the network only
  // fills a slot that is empty, so Flippy keeps working offline.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
