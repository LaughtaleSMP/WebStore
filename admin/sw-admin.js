/* ═══════════════════════════════════════════════════════════════
   sw-admin.js — Service Worker for Laughtale SMP Admin Panel
   Strategy: NETWORK-FIRST + offline fallback
   Bump CACHE_VERSION on every deploy to force cache invalidation.
   ═══════════════════════════════════════════════════════════════ */

var CACHE_VERSION = 'lt-admin-v1';

// Core shell files to pre-cache for offline support
var SHELL_ASSETS = [
  '/admin/',
  '/admin/index.html',
  '/admin/css/admin.css',
  '/admin/css/finance.css',
  '/admin/css/admin-enhance.css',
  '/admin/css/admin-panels.css',
  '/admin/css/mobile.css',
  '/admin/js/supabase-config.js',
  '/admin/js/admin-init.js',
  '/admin/js/admin-nav.js',
  '/admin/js/admin-glyph-manager.js',
  '/admin/js/gestures.js',
  '/admin/manifest.json',
  '/libs/supabase.js',
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // addAll fails silently per-item to avoid one missing file killing install
      return Promise.allSettled(
        SHELL_ASSETS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW Admin] Failed to cache:', url, err.message);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_VERSION; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* ── Fetch: Network-first, cache fallback ── */
self.addEventListener('fetch', function (e) {
  var url = e.request.url;

  // Always bypass SW for: Supabase API, auth, POST requests
  if (
    url.indexOf('supabase.co') !== -1 ||
    url.indexOf('googleapis.com') !== -1 ||
    url.indexOf('cdn.jsdelivr.net') !== -1 ||
    e.request.method !== 'GET'
  ) {
    return; // let browser handle it normally
  }

  e.respondWith(
    fetch(e.request)
      .then(function (networkRes) {
        // Network OK → update cache in background
        if (networkRes.ok) {
          var toCache = networkRes.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(e.request, toCache);
          });
        }
        return networkRes;
      })
      .catch(function () {
        // Offline → try cache
        return caches.match(e.request).then(function (cached) {
          if (cached) return cached;

          // Navigation fallback: show offline page
          if (e.request.mode === 'navigate') {
            return caches.match('/admin/index.html').then(function (shell) {
              return shell || new Response(
                '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<title>Laughtale Admin — Offline</title>' +
                '<style>*{margin:0;padding:0;box-sizing:border-box}' +
                'body{background:#070a0e;color:#dde3ec;font-family:Inter,sans-serif;' +
                'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1.5rem}' +
                '.box{text-align:center;max-width:340px}' +
                '.icon{font-size:3rem;margin-bottom:1rem;opacity:.5}' +
                'h2{font-size:1.1rem;font-weight:700;margin-bottom:.5rem;color:#eef1f7}' +
                'p{font-size:13px;color:#5a6478;line-height:1.7;margin-bottom:1.25rem}' +
                'button{padding:9px 22px;background:#4a8fff;color:#fff;border:none;' +
                'border-radius:9px;font-size:13px;font-weight:600;cursor:pointer}' +
                '</style></head><body>' +
                '<div class="box">' +
                '<div class="icon">🔌</div>' +
                '<h2>Panel Offline</h2>' +
                '<p>Admin panel memerlukan koneksi internet.<br>Periksa jaringan lalu coba lagi.</p>' +
                '<button onclick="location.reload()">Coba Lagi</button>' +
                '</div></body></html>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
          }
        });
      })
  );
});

/* ── Message: force update from page ── */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
