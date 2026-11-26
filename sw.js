// Finny app service worker: network-first for the page (always the newest published dashboard), cached copy only when offline.
// Data never goes through this cache: Supabase requests are not intercepted.
const CACHE = 'finny-shell-202611261637';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './manifest.webmanifest', './icon-192.png', './icon-512.png']))); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;          // Supabase, CDNs: straight to the network
  // 2026-11-23: the page itself skips the browser's HTTP cache (GitHub Pages sends max-age=600), so a new publish shows on the next open, not 10 min later
  const page = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  e.respondWith((page ? fetch(e.request.url, {cache: 'no-cache', credentials: 'same-origin'}) : fetch(e.request)).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});
// 2026-11-17: alert notifications (Web Push from the push function). Payload {title, body, url, tag}; tapping opens / focuses the app on the watchlist.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Finny', {body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: {url: d.url || './'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(ws => { for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.focus(); w.postMessage({finny: 'open-watchlist'}); return; } return clients.openWindow(url); }));
});
