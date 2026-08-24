// 웨이브 아레나 서비스 워커
// build ID, cache version, precache 목록은 src/build-meta.js가 단일 정본이다.
importScripts('./src/build-meta.js');

const VERSION = WA_BUILD_META.cacheVersion;
const ASSETS = WA_BUILD_META.precache;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // core asset 하나라도 없으면 설치를 실패시켜 오프라인 false-green을 막는다.
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

const FRESH_FIRST = /\.(html|js|webmanifest)$|\/$/i;

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const freshFirst = request.mode === 'navigate' || FRESH_FIRST.test(url.pathname);
  event.respondWith((async () => {
    const put = response => {
      if (response && response.ok) caches.open(VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    };
    if (freshFirst) {
      try {
        const response = await fetch(request);
        if (response && response.ok) return put(response);
      } catch {}
      return (await caches.match(request, { ignoreSearch: true }))
        || (await caches.match('./index.html'))
        || Response.error();
    }
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try { return put(await fetch(request)); } catch { return Response.error(); }
  })());
});
