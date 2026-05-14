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
      document.body.style.overflow = '';
      return;
    }
    sessionStorage.setItem('ls_visited', '1');
  } catch(e) { /* sessionStorage blocked */ }

  // [PERF] Skip total kalau user prefer reduced motion / data saver
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (prefers-reduced-data: reduce)').matches) {
      screen.style.display = 'none';
      document.body.style.overflow = '';
      return;
    }
  } catch(e) {}

  // [PERF] Mobile: durasi lebih pendek (1.2s vs 1.75s) agar tidak terlalu lama menunggu
  var isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  var DURATION = isMobile ? 1200 : 1750;
  var MSG_INTERVAL = isMobile ? 350 : 420;

  var messages = ['MEMUAT ASET...', 'MENYAMBUNGKAN...', 'MENYIAPKAN SERVER...', 'SELAMAT DATANG!'];
  var idx = 0;

  // Cycle status messages
  var msgInterval = setInterval(function() {
    idx = Math.min(idx + 1, messages.length - 1);
    if (status) status.textContent = messages[idx];
  }, MSG_INTERVAL);

  // Dismiss after DURATION
  setTimeout(function() {
    clearInterval(msgInterval);
    if (status) status.textContent = 'SELAMAT DATANG!';
    screen.classList.add('fade-out');
    setTimeout(function() {
      screen.style.display = 'none';
      document.body.style.overflow = '';
    }, isMobile ? 400 : 700);
  }, DURATION);

  // Prevent scroll during loading
  document.body.style.overflow = 'hidden';
})();
