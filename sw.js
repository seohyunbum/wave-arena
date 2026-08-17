// 웨이브 아레나 서비스 워커
// 설치할 때 게임 파일을 통째로 받아 두어, 다음부터는 인터넷이 없어도 실행된다.
// 게임을 고쳐서 올릴 때는 VERSION 을 올려야 새 파일이 내려간다.
const VERSION = 'wave-arena-v2';
const ASSETS = [
  './',
  './index.html',
  './studio-ident.js',
  './manifest.webmanifest',
  './icon.ico',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-apple-180.png'
];

self.addEventListener('install', ev => {
  // 일부 파일이 없어도 설치가 통째로 실패하지 않도록 하나씩 담는다
  ev.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(ASSETS.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 게임 본체(HTML/JS)는 "새 것 먼저, 안 되면 저장본" — 게임을 고쳐 올리면 바로 반영된다.
//   (저장본 우선으로 하면 앱을 설치한 뒤로는 영영 옛날 버전만 나온다)
// 아이콘 같은 안 변하는 파일은 "저장본 먼저" — 빠르고 데이터도 아낀다.
// 어느 쪽이든 인터넷이 없으면 저장본으로 실행되므로 비행기 모드에서도 켜진다.
const FRESH_FIRST = /\.(html|js|webmanifest)$|\/$/i;

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const freshFirst = req.mode === 'navigate' || FRESH_FIRST.test(url.pathname);

  ev.respondWith((async () => {
    const put = res => {
      if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    };
    if (freshFirst) {
      try {
        const res = await fetch(req);
        if (res && res.ok) return put(res);
      } catch (e) { /* 오프라인 → 아래 저장본으로 */ }
      return (await caches.match(req, { ignoreSearch: true }))
          || (await caches.match('./index.html'))
          || Response.error();
    }
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return put(await fetch(req)); } catch (e) { return Response.error(); }
  })());
});
