/* Service Worker — Laughtale SMP Monitor
   Strategy: NETWORK-FIRST (stale-while-revalidate untuk offline fallback)
   Selalu coba ambil dari server. Jika berhasil, update cache.
   Jika offline, fallback ke cache terakhir.

   Bump CACHE version setiap deploy untuk force cleanup cache lama. */
var CACHE = 'lt-monitor-v4';
var ASSETS = [
  'monitor.html',
  'js/monitor-page.js',
  'css/pages.css',
  'assets/favicon.svg'
];

self.addEventListener('install', function (e) {
  // Pre-cache assets untuk offline support
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  // Langsung aktifkan SW baru tanpa tunggu tab ditutup
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  // Hapus semua cache lama (versi sebelumnya)
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  // Langsung ambil kontrol semua tab yang terbuka
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  // API calls (Supabase) — selalu network-only, no cache
  if (e.request.url.indexOf('supabase.co') !== -1) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }

  // Semua asset lain — NETWORK FIRST, fallback ke cache
  e.respondWith(
    fetch(e.request).then(function (res) {
      // Network berhasil -> update cache dengan versi terbaru
      if (res.status === 200) {
        var cl = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, cl); });
      }
      return res;
    }).catch(function () {
      // Offline -> serve dari cache
      return caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        // Navigasi tanpa cache -> tampilkan halaman offline
        if (e.request.mode === 'navigate') {
          return new Response(
            '<html><body style="background:#09090f;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>Laughtale SMP</h2><p>Monitor membutuhkan koneksi internet.</p><p style="opacity:.5">Coba refresh halaman saat online.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      });
    })
  );
});

// Listen for skip-waiting message dari halaman
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
