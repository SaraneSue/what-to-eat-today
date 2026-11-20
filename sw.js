const SCOPE = new URL('./', self.location.href).href;
const PREFIX = `meal-v0-shell-${new URL(SCOPE).pathname}-`;
const CACHE = PREFIX + '0.5.0';
const FILES = ['./','./index.html','./styles.css','./app.js','./core.js','./data.js','./online.js','./recommendations.js','./scenes.js','./updates.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, SCOPE).href)))));
self.addEventListener('message', event => { if(event.data==='GET_VERSION')event.ports?.[0]?.postMessage({version:'0.5.0'}); if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Only remove this app's own caches. A Pages origin can host other PWAs.
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(SCOPE)) return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      // Keep the document and modules on the same shell version until update is accepted.
      return (await (await caches.open(CACHE)).match(new URL('./index.html', SCOPE).href)) || fetch(event.request);
    })());
  } else {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});
