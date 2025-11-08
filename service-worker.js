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
  "server.arcgisonline.com",
  "tile.openstreetmap.org"
];


// INSTALLATION
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});


// ACTIVATION
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
  const req = event.request;
  const url = req.url;

  // ✅ Bloquer POST/PUT
  if (req.method !== "GET") return;

  // ✅ Ne gérer que ton dossier GitHub Pages
  if (!url.startsWith(self.location.origin + BASE)) return;


  // ✅ JSON : Stale-While-Revalidate
  if (url.endsWith("postes.json") || url.endsWith("appareils.json")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);
        const cached = await cache.match(req);

        // Téléchargement en arrière-plan
        const networkFetch = fetch(req)
          .then(response => {
            if (response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Si offline : renvoie cache
        if (cached) return cached;

        // Si online mais cache vide : réseau
        return networkFetch;
      })()
    );
    return;
  }


  // ✅ Cache ESRI / OSM (tuiles satellite)
  if (TILE_DOMAINS.some(domain => url.includes(domain))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const response = await fetch(req, { mode: "no-cors" });
          cache.put(req, response.clone());
          limitTileCache();
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }


  // ✅ HTML : toujours mise à jour
  if (req.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(APP_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return caches.match(req);
        }
      })()
    );
    return;
  }


  // ✅ Le reste : cache-first
  event.respondWith(
    (async () => {
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


// ✅ Limitation du cache des tuiles
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
