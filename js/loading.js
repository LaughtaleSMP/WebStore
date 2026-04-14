/* ══════════════════════════════════════════════════
   loading.js — Dismiss loading screen setelah halaman siap
══════════════════════════════════════════════════ */
(function () {
  const BAR_ANIM_DURATION = 2300; // cocokkan dengan barFill (0.6s delay + 1.6s fill + sedikit buffer)

  function dismissLoader() {
    const screen = document.getElementById('loading-screen');
    if (!screen) return;
    screen.classList.add('fade-out');
    // Hapus dari DOM setelah transisi selesai (0.9s sesuai CSS)
    setTimeout(() => {
      screen.style.display = 'none';
    }, 950);
  }

  // Tunggu animasi bar selesai, lalu dismiss
  if (document.readyState === 'complete') {
    setTimeout(dismissLoader, BAR_ANIM_DURATION);
  } else {
    window.addEventListener('load', function () {
      setTimeout(dismissLoader, BAR_ANIM_DURATION);
    });
  }

  // Safety fallback: paksa dismiss setelah 5 detik
  setTimeout(function () {
    const screen = document.getElementById('loading-screen');
    if (screen && !screen.classList.contains('fade-out')) {
      dismissLoader();
    }
  }, 5000);
})();
