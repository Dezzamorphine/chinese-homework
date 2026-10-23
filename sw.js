/* «Тушь» — service worker. Оболочка и статика сайта офлайн.
 * HTML/JS/manifest — stale-while-revalidate; иконки и шрифты — cache-first; zh-api и прочие чужие запросы не трогаем.
 * VERSION и PRECACHE подставляет build.py (zhhw/build.py, render_sw). */
'use strict';
const VERSION = '64b70f25061f'/*VERSION*/;
const PRECACHE = /*PRECACHE*/["./app.html", "./audio-01.html", "./audio-02.html", "./audio-03.html", "./audio-04.html", "./audio-05.html", "./audio-06.html", "./audio-07.html", "./audio-08.html", "./audio-09.html", "./audio-10.html", "./audio-11.html", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./index.html", "./manifest.webmanifest", "./progress.js", "./review.html", "./sessions.js", "./sync.js", "./talk.html"]/*END*/;
const CACHE = 'tush-' + VERSION;
const FONTS = 'tush-fonts';

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.indexOf('tush-') === 0 && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function cacheFirst(req, name) {
  return caches.open(name).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  })));
}

// офлайн-фолбэк на app.html — только для навигации; скрипт или картинка получают сетевую ошибку, а не HTML
function isNavigation(req) {
  return req.mode === 'navigate' || /text\/html/.test((req.headers && req.headers.get('accept')) || '');
}

function staleWhileRevalidate(ev, req) {
  return caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => {
      if (res && res.ok) c.put(req, res.clone());
      return res;
    }).catch(() => hit || (isNavigation(req) ? caches.match('./app.html') : Response.error()));
    if (hit) { ev.waitUntil(net.catch(() => null)); return hit; }
    return net;
  }));
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.indexOf('/zh-api/') >= 0) return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (/\/icons\/|\.(png|jpe?g|svg|webp|ico)$/i.test(url.pathname)) {
    ev.respondWith(cacheFirst(req, CACHE));
    return;
  }
  if (req.mode === 'navigate' || /\.(html|js|webmanifest|json|css)$/i.test(url.pathname) || url.pathname.endsWith('/')) {
    ev.respondWith(staleWhileRevalidate(ev, req));
  }
});
