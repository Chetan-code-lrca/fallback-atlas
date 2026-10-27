/* Fallback Atlas offline app shell.
 * Cache same-origin app assets only. Never cache /api responses or third-party
 * map/geocoder requests; reports must always reach the network before local fallback.
 */
const CACHE_NAME = 'fallback-atlas-shell-v1';
const SHELL_PATHS = ['/', '/index.html', '/manifest.json', '/icon.svg', '/favicon.ico'];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  for (const path of SHELL_PATHS) {
    try {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok) await cache.put(path, response);
    } catch (error) {
      // Skip optional resources; installation can still succeed.
    }
  }

  const indexResponse = await cache.match('/index.html');
  if (!indexResponse) return;
  const html = await indexResponse.text();
  const paths = Array.from(html.matchAll(/(?:src|href)=["']([^"']+)["']/g))
    .map((match) => match[1])
    .filter((path) => path.startsWith('/static/'));

  await Promise.all(paths.map(async (path) => {
    try {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok) await cache.put(path, response);
    } catch (error) {
      // A single asset failure must not block offline shell installation.
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('fallback-atlas-shell-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match('/index.html');
        return cached || new Response('Open Fallback Atlas once while connected, then retry offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/static/') ||
      url.pathname === '/manifest.json' ||
      url.pathname === '/icon.svg' ||
      url.pathname === '/favicon.ico') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
