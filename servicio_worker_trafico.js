const APP_CACHE = 'spotters-radar-shell-v19';
const MAP_CACHE = 'spotters-radar-map-v2';
const PAGE_SHELL = [
  './index.html', './radar_trafico.html', './avistament.html', './aerolineas.html',
  './meteorologia.html', './noticias.html', './enciclopedia.html', './info_aeropu.html',
  './mi_espasio_spain.html', './acerca.html', './colaboracion.html', './emergencias_supabase.html',
  './enlaces.html', './in.html', './p_spotting.html', './simulacion_fotos.html',
  './admin_avistamientos.html', './admin_usuarios.html'
];
const CORE_ASSETS = [
  './assets/leaflet/leaflet.css', './assets/leaflet/leaflet.js',
  './assets/leaflet/images/layers.png', './assets/leaflet/images/layers-2x.png',
  './assets/leaflet/images/marker-icon.png', './assets/leaflet/images/marker-icon-2x.png',
  './assets/leaflet/images/marker-shadow.png'
];
const APP_SHELL = [...PAGE_SHELL, ...CORE_ASSETS];

async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  await Promise.all(APP_SHELL.map(async asset => {
    const assetUrl = new URL(asset, self.location.href);
    const response = await fetch(new Request(assetUrl.href, {cache:'reload'}));
    if (!response.ok) throw new Error(`No se pudo actualizar ${asset}: ${response.status}`);
    await cache.put(assetUrl.href, response);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('spotters-radar-') && key !== APP_CACHE && key !== MAP_CACHE && key !== 'spotters-radar-map-v1')
    .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

function isMapTile(url) {
  const host = url.hostname;
  return host.endsWith('.tile.openstreetmap.org') || host === 'tile.openstreetmap.org' ||
    host === 'server.arcgisonline.com' || host.endsWith('.tile.opentopomap.org') ||
    host === 'tile.opentopomap.org' || host === 'tilecache.rainviewer.com';
}

function isAppAsset(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return true;
  return ['script', 'style', 'image', 'font', 'worker'].includes(request.destination);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(key => cache.delete(key)));
  }
}

async function networkAndUpdate(request, cache, maxEntries) {
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    await trimCache(cache, maxEntries);
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isMapTile(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(MAP_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(networkAndUpdate(request, cache, 700).catch(() => {}));
        return cached;
      }
      return networkAndUpdate(request, cache, 700);
    })());
    return;
  }

  // Live traffic, weather, accounts, and other API calls always go directly to the network.
  if (!isAppAsset(request, url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(networkAndUpdate(request, cache, 350).catch(() => {}));
      return cached;
    }
    try {
      return await networkAndUpdate(request, cache, 350);
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
