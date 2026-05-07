/* ══════════════════════════════════════════════════════════════
   auto-refresh.js — Universal auto-refresh for all dashboard pages

   FEATURES:
   - Auto-clear localStorage cache & force re-fetch on interval
   - Auto-reload entire page every 30 min to pick up code changes
   - Works on mobile without manual hard refresh
   - Version-based reload: if PAGE_VERSION changes, force reload

   USAGE:
     <script src="js/auto-refresh.js"></script>
     (put AFTER the page's own script)

   COST:
   - Memory: 2 timers (setInterval)
   - CPU: negligible (1 check per second for countdown)
   - Network: 0 extra requests (only triggers existing fetch logic)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Config ──
  var PAGE_VERSION = '2026.05.07a';       // bump this to force reload on all clients
  var AUTO_RELOAD_MS = 30 * 60 * 1000;    // full page reload every 30 min
  var VER_KEY = '_page_ver';
  var RELOAD_KEY = '_last_reload';

  // ── Version check: force reload if code was updated ──
  try {
    var savedVer = localStorage.getItem(VER_KEY);
    if (savedVer && savedVer !== PAGE_VERSION) {
      // Version changed — clear all caches and force reload
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('eco_') === 0 || k.indexOf('mon_') === 0)) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
      localStorage.setItem(VER_KEY, PAGE_VERSION);
      location.reload();
      return;
    }
    localStorage.setItem(VER_KEY, PAGE_VERSION);
  } catch (e) {}

  // ── Auto page reload every 30 min ──
  // On mobile, users can't hard-refresh, so we auto-reload to pick up
  // any code changes deployed to the hosting.
  try {
    var lastReload = parseInt(localStorage.getItem(RELOAD_KEY)) || 0;
    var sinceReload = Date.now() - lastReload;
    var nextReload = Math.max(60000, AUTO_RELOAD_MS - sinceReload); // at least 1 min

    setTimeout(function () {
      try { localStorage.setItem(RELOAD_KEY, String(Date.now())); } catch (e) {}
      // Clear data caches before reload so fresh data is fetched
      try {
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var k = localStorage.key(i);
          if (k && (k.indexOf('eco_') === 0 || k.indexOf('mon_') === 0)) localStorage.removeItem(k);
        }
      } catch (e) {}
      location.reload();
    }, nextReload);

    // Mark this reload
    if (!lastReload) {
      try { localStorage.setItem(RELOAD_KEY, String(Date.now())); } catch (e) {}
    }
  } catch (e) {}

  // ── visibilitychange: force fresh data when returning to tab ──
  // (handles mobile tab switching / screen lock)
  var _lastVisible = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      var away = Date.now() - _lastVisible;
      // If away > 5 min, clear cache so next fetch gets fresh data
      if (away > 300000) {
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (k && (k.indexOf('eco_') === 0 || k.indexOf('mon_') === 0)) localStorage.removeItem(k);
          }
        } catch (e) {}
      }
    } else {
      _lastVisible = Date.now();
    }
  });
})();
