const BASE = "/carto3f9b7d1a5c8e4f2b";

const APP_CACHE = "nonomaps-app-v1";
const TILE_CACHE = "nonomaps-tiles-v1";
const MAX_TILES = 3000;

const APP_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/map.html`,
  `${BASE}/itineraire.html`,
  `${BASE}/arnaud.html`,
  `${BASE}/ajout_appareil.html`,
  `${BASE}/ajout_poste.html`,
  `${BASE}/version.html`,
  `${BASE}/manifest.json`,
  `${BASE}/robots.txt`,

  `${BASE}/ico/acces.png`,
  `${BASE}/ico/poste.png`,
  `${BASE}/ico/int.png`,
  `${BASE}/ico/TT.png`,
  `${BASE}/ico/sect.png`,
  `${BASE}/ico/stop.png`,
  `${BASE}/ico/arrow.png`,
  `${BASE}/favicon/favicon.ico`,
  `${BASE}/Logo EALE.png`
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

  // Toujours online pour les JSON
  if (url.endsWith("postes.json") || url.endsWith("appareils.json")) {
    return;
  }

  // Cache tuiles ESRI + OSM
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

  // Documents HTML → network-first (toujours à jour)
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
          return caches.match(req);  // offline fallback
        }
      }

      // Le reste → cache-first
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
