/* ══════════════════════════════════════════════════
   loading.js — Loading screen controller
   Skip on revisit, auto-dismiss after 1.2s on mobile, 1.75s on desktop
══════════════════════════════════════════════════ */
(function() {
  var screen = document.getElementById('loading-screen');
  var status = document.getElementById('loading-status');

  if (!screen) return;

  // Skip loading screen jika sudah pernah dikunjungi (revisit)
  try {
    if (sessionStorage.getItem('ls_visited')) {
      screen.style.display = 'none';
      return;
    }
    sessionStorage.setItem('ls_visited', '1');
  } catch(e) { /* sessionStorage blocked */ }

  // [PERF] Skip total kalau user prefer reduced motion / data saver
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (prefers-reduced-data: reduce)').matches) {
      screen.style.display = 'none';
      return;
    }
  } catch(e) {}

  // [PERF] Dynamic asset load tracking & interactive progress bar
  var isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  var MIN_TIME = 700; // Minimum time to show gorgeous logo intro (0.7s)
  var MAX_TIME = isMobile ? 1200 : 1600; // Safe backup fallback cap

  var startTime = Date.now();
  var msgInterval;
  var messages = ['MEMUAT ASET...', 'MENYAMBUNGKAN...', 'MENYIAPKAN SERVER...', 'SELAMAT DATANG!'];
  var idx = 0;

  // Faster cycling of messages for active and responsive feel
  var MSG_INTERVAL = isMobile ? 220 : 280;
  msgInterval = setInterval(function() {
    idx = Math.min(idx + 1, messages.length - 1);
    if (status) status.textContent = messages[idx];
  }, MSG_INTERVAL);

  var bar = document.getElementById('loading-bar');
  function updateBar(p) {
    if (bar) bar.style.width = p + '%';
  }

  // Set initial starting point
  updateBar(12);

  // Retrieve page images to track loading progress
  var imgs = document.querySelectorAll('img');
  var totalAssets = imgs.length;
  var loadedAssets = 0;

  if (totalAssets > 0) {
    Array.prototype.forEach.call(imgs, function(img) {
      if (img.complete) {
        onAssetLoaded();
      } else {
        img.addEventListener('load', onAssetLoaded);
        img.addEventListener('error', onAssetLoaded);
      }
    });
  }

  function onAssetLoaded() {
    loadedAssets++;
    var p = 12 + Math.round((loadedAssets / totalAssets) * 78); // dynamic scale remaining 78%
    updateBar(Math.min(90, p)); // cap at 90% until page completely ready
  }

  var dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearInterval(msgInterval);
    if (status) status.textContent = 'SELAMAT DATANG!';
    screen.classList.add('fade-out');
    setTimeout(function() {
      screen.style.display = 'none';
      document.documentElement.classList.remove('no-scroll');
      document.body.classList.remove('no-scroll');
    }, isMobile ? 300 : 450);
  }

  function tryDismiss() {
    updateBar(100); // instant full visual progress
    var elapsed = Date.now() - startTime;
    var remaining = Math.max(0, MIN_TIME - elapsed);
    setTimeout(dismiss, remaining);
  }

  // Prevent scroll during loading
  document.documentElement.classList.add('no-scroll');
  document.body.classList.add('no-scroll');

  // Bind loading completion triggers
  if (document.readyState === 'complete') {
    tryDismiss();
  } else {
    window.addEventListener('load', tryDismiss);
    // Safety fallback cap
    setTimeout(dismiss, MAX_TIME);
  }
})();
