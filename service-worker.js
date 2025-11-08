const TILE_CACHE = 'tiles-pro-v1';
const MAX_TILES = 3000;

const CACHE_DOMAINS = [
  'tile.openstreetmap.org',
  'data.geopf.fr',
  '/MapServer/'
];

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const excess = keys.length - maxItems;

    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}


self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (!CACHE_DOMAINS.some(domain => url.includes(domain))) {
    return;
  }

  event.respondWith(
    caches.open(TILE_CACHE).then(async cache => {


      const cached = await cache.match(event.request);
      if (cached) return cached;

 
      try {
        const response = await fetch(event.request, { mode: 'no-cors' });

  
        cache.put(event.request, response.clone());

  
        limitCacheSize(TILE_CACHE, MAX_TILES);

        return response;

      } catch (err) {
        // Offline total → on renvoie le cache si dispo
        return cached || Response.error();
      }
    })
  );
});
