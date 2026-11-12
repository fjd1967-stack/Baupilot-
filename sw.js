// Minimaler Service Worker: macht die App installierbar und startet auch bei schlechtem Netz.
const CACHE = 'app-shell-v12';
const SHELL = ['./', './index.html', './danke.html', './app.html', './style.css', './site.config.js', './install.js', './demo.js', './profil.js', './profil.css', './firma.js', './blaetter.js', './app.js', './team.js', './konto.js', './sprachen.js', './woerter.js', './i18n.js', './login.html', './install.html', './start.html', './bau.html', './claude-shim.js', './bau-ext.js', './bau.webmanifest', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Probelauf ohne Server: Dateien (Fotos, PDFs) liegen im Browser dieses Geräts und werden unter _blob/<id> ausgeliefert.
function dateiAusSpeicher(id) {
  return new Promise(ok => {
    try {
      const r = indexedDB.open('bp-lokal', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('dok', { keyPath: 'p' }); r.result.createObjectStore('assets', { keyPath: 'id' }); };
      r.onerror = () => ok(null);
      r.onsuccess = () => { const d = r.result; try { const g = d.transaction('assets', 'readonly').objectStore('assets').get(id); g.onsuccess = () => { d.close(); ok(g.result || null); }; g.onerror = () => { d.close(); ok(null); }; } catch (e) { d.close(); ok(null); } };
    } catch (e) { ok(null); }
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  const blobM = req.method === 'GET' && new URL(req.url).origin === location.origin && /\/_blob\/([\w-]+)$/.exec(new URL(req.url).pathname);
  if (blobM) { e.respondWith(dateiAusSpeicher(blobM[1]).then(rec => rec ? new Response(rec.blob, { headers: { 'Content-Type': rec.typ || 'application/octet-stream', 'Cache-Control': 'no-store' } }) : fetch(req))); return; }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith('/api/') || new URL(req.url).pathname.startsWith('/_blob/')) return;
  // Seiten: erst Netz, bei Ausfall Cache. Dateien: erst Cache, im Hintergrund aktualisieren.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
