const APP_CACHE = "nonomaps-app-v1";
const TILE_CACHE = "nonomaps-tiles-v1";
const MAX_TILES = 3000;

const APP_ASSETS = [
  "/",                 
  "/index.html",
  "/map.html",
  "/itineraire.html",
  "/arnaud.html",
  "/ajout_appareil.html",
  "/ajout_poste.html",
  "/version.html",
  "/manifest.json",
  "/robots.txt",

  "/ico/acces.png",
  "/ico/poste.png",
  "/ico/int.png",
  "/ico/TT.png",
  "/ico/sect.png",
  "/ico/stop.png",
  "/ico/arrow.png",
  "/favicon/favicon.ico",
  "/Logo EALE.png"
];

const TILE_DOMAINS = [
  "server.arcgisonline.com",   // ESRI satellite
  "tile.openstreetmap.org"     // OSM
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Toujours online pour les JSON (données fraîches)
  if (url.endsWith("postes.json") || url.endsWith("appareils.json")) {
    return;
  }

  // Cache des tuiles satellite + OSM
  if (TILE_DOMAINS.some(domain => url.includes(domain))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request, { mode: "no-cors" });
          cache.put(event.request, response.clone());
          limitTileCache();
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // HTML toujours à jour (network first)
  event.respondWith(
    (async () => {
      const req = event.request;

      if (req.destination === "document") {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(APP_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return caches.match(req); // fallback offline
        }
      }

      // Le reste : cache-first
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const cache = await caches.open(APP_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});

// LIMITE TUILES
async function limitTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();

  if (keys.length > MAX_TILES) {
    const excess = keys.length - MAX_TILES;

    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}
