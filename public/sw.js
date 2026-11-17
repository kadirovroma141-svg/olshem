const C = 'olshem-v2';
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/manifest.webmanifest'])).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Network-first с резервом из кэша: работает офлайн после первого открытия. Данные пользователя здесь не кэшируются (они в IndexedDB).
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('/'))));
});
