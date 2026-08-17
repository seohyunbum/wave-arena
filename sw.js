// 웨이브 아레나 서비스 워커
// 설치할 때 게임 파일을 통째로 받아 두어, 다음부터는 인터넷이 없어도 실행된다.
// 게임을 고쳐서 올릴 때는 VERSION 을 올려야 새 파일이 내려간다.
const VERSION = 'wave-arena-v1';
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

// 게임 파일은 저장해 둔 것을 먼저 쓰고(즉시 실행), 뒤에서 조용히 새 버전을 받아 둔다.
// 다음에 켤 때 새 버전이 적용된다 — 비행기 모드에서도 항상 켜지는 방식.
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  ev.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => null);

    if (cached) return cached;
    const res = await network;
    if (res) return res;
    // 오프라인인데 저장본도 없으면 최소한 게임 화면이라도 띄운다
    return (await caches.match('./index.html')) || Response.error();
  })());
});
