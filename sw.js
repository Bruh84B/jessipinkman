/* Слюда — service worker: офлайн-работа после первого открытия.
   Сначала сеть (всегда свежая версия), без сети — копия из кеша. Только файлы самого приложения. */
const CACHE = 'sluda-v1';
const ASSETS = ['./', './index.html', './style.css?v=1', './store.js?v=1', './md.js?v=1', './graph.js?v=1', './app.js?v=1',
  './vendor/marked.min.js?v=1', './vendor/purify.min.js?v=1', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.indexOf('sluda-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((c) => c || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
