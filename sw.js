// Plush Titans service worker (same discipline as Plush Squad).
// Code (html/js/json) = network-first, so updates show up at once; pictures, fonts and libraries = cache-first (offline play).
// Release rule: CACHE matches VERSION in js/main.js, and every game file is in FILES (tests/unit/release.test.js checks both).
const CACHE = 'plushtitans-v0.1.0';
const FILES = [
  './', 'index.html', 'manifest.json',
  'vendor/phaser.min.js',
  'js/economy.js', 'js/util.js', 'js/save.js', 'js/layout.js', 'js/art.js', 'js/ui.js', 'js/main.js',
  'js/scenes/boot.js', 'js/scenes/title.js',
  'assets/fonts/Poppins-Bold.ttf', 'assets/fonts/Poppins-Medium.ttf',
  'assets/icons/apple-touch-icon.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith('plushtitans')).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const isCode = (url) => url.pathname.endsWith('/') || (/\.(html|js|json|mjs)$/.test(url.pathname) && !url.pathname.includes('/vendor/'));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (isCode(url)) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
