/* ══════════════════════════════════════════════════════════════
   auto-refresh.js — Smart auto-update for all dashboard pages

   STRATEGY:
   - Cek Service Worker update saat tab kembali aktif
   - Jika ada SW baru → langsung activate + reload 1x
   - Version-based reload: bump PAGE_VERSION → force reload on all clients
   - Tidak lagi hard reload setiap 30 menit (bikin UX buruk)
   - Tetap clear data cache saat kembali dari background > 5 menit

   USAGE:
     <script src="js/auto-refresh.js"></script>
     (put AFTER the page's own script)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Config ──
  var PAGE_VERSION = '2026.05.24a';       // bump this to force reload on all clients
  var VER_KEY = '_page_ver';
  var SW_CHECK_INTERVAL = 5 * 60 * 1000;  // cek SW update tiap 5 menit

  // ── Version check: force reload if code was updated ──
  try {
    var savedVer = localStorage.getItem(VER_KEY);
    if (savedVer && savedVer !== PAGE_VERSION) {
      // Version changed — clear data caches and force reload
      _clearDataCaches();
      localStorage.setItem(VER_KEY, PAGE_VERSION);
      // Jika ada SW, unregister dulu agar cache lama terhapus
      _forceSwUpdate(function () { location.reload(); });
      return;
    }
    localStorage.setItem(VER_KEY, PAGE_VERSION);
  } catch (e) {}

  // ── Service Worker update checker ──
  // Cek berkala apakah ada SW baru. Jika ada, langsung aktifkan dan reload.
  function _checkSwUpdate() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        reg.update().then(function () {
          // Jika ada waiting worker, kirim skip_waiting
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }).catch(function () {});

        // Listen untuk controllerchange = SW baru aktif
        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (reloading) return;
          reloading = true;
          _clearDataCaches();
          location.reload();
        });
      });
    } catch (e) {}
  }

  // Cek SW update saat load dan berkala
  _checkSwUpdate();
  setInterval(_checkSwUpdate, SW_CHECK_INTERVAL);

  // ── visibilitychange: cek update + fresh data saat kembali ke tab ──
  var _lastVisible = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      var away = Date.now() - _lastVisible;
      // Kembali dari background > 5 menit → clear data cache + cek SW update
      if (away > 300000) {
        _clearDataCaches();
        _checkSwUpdate();
      }
    } else {
      _lastVisible = Date.now();
    }
  });

  // ── Helper: clear data caches (localStorage eco_*/mon_*) ──
  function _clearDataCaches() {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('eco_') === 0 || k.indexOf('mon_') === 0)) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  // ── Helper: force SW update + callback ──
  function _forceSwUpdate(callback) {
    if (!('serviceWorker' in navigator)) { callback(); return; }
    try {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) { callback(); return; }
        // Hapus semua cache lama
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }).then(function () {
          // Update SW
          reg.update().then(function () {
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            callback();
          }).catch(function () { callback(); });
        }).catch(function () { callback(); });
      }).catch(function () { callback(); });
    } catch (e) { callback(); }
  }
})();
