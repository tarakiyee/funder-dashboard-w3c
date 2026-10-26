'use strict';
// Cache the static shell only. W3C/GitHub/CDN requests always go directly to the network;
// app.js decides whether a failed API call can use an exact URL in demo-cache.json.
const CACHE = 'funder-dashboard-shell-v1';
const ASSETS = ['index.html', 'style.css', 'app.js', 'demo-cache.json'];
const assetURLs = ASSETS.map(asset => new URL(asset, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(assetURLs.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('funder-dashboard-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const isAppNavigation = request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL('index.html', scope).pathname);
  if (!isAppNavigation && !assetURLs.includes(url.href)) return;
  const cacheKey = isAppNavigation ? new URL('index.html', scope).href : url.href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      const stored = await cache.match(cacheKey);
      if (stored) return stored;
      throw error;
    }
  })());
});
