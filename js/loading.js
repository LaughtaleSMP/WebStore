/* ══════════════════════════════════════════════════
   loading.js — Loading screen controller
   Skip on revisit, auto-dismiss after 1.75s
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

  var messages = ['MEMUAT ASET...', 'MENYAMBUNGKAN...', 'MENYIAPKAN SERVER...', 'SELAMAT DATANG!'];
  var idx = 0;

  // Cycle status messages
  var msgInterval = setInterval(function() {
    idx = Math.min(idx + 1, messages.length - 1);
    if (status) status.textContent = messages[idx];
  }, 420);

  // Dismiss after ~1.75s
  setTimeout(function() {
    clearInterval(msgInterval);
    if (status) status.textContent = 'SELAMAT DATANG!';
    screen.classList.add('fade-out');
    setTimeout(function() {
      screen.style.display = 'none';
      document.body.style.overflow = '';
    }, 700);
  }, 1750);

  // Prevent scroll during loading
  document.body.style.overflow = 'hidden';
})();
