const CACHE_VERSION = "timeflow-offline-v2";
const APP_SHELL = [
  "./", "./index.html", "./login.html", "./manifest.json",
  "./css/style.css", "./js/supabase.js", "./js/auth.js",
  "./js/auth-guard.js", "./js/offline-store.js", "./js/app.js",
  "./icon/icon-192.png", "./icon/icon-512.png"
];
const CDN_URLS = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled(APP_SHELL.map(path => cache.add(path)));
    await Promise.allSettled(CDN_URLS.map(async url => {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("timeflow-") && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !CDN_URLS.some(item => url.href.startsWith(item))) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_VERSION)).put(request, response.clone());
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_VERSION);
        return await cache.match(request) || await cache.match("./index.html") || await cache.match("./login.html");
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) { throw error; }
  })());
});
