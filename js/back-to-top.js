/* ═══════════════════════════════════════════════
   back-to-top.js — Tombol kembali ke atas
═══════════════════════════════════════════════ */
(function () {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', function () {
    const show = window.scrollY > 400;
    btn.style.opacity       = show ? '1'              : '0';
    btn.style.transform     = show ? 'translateY(0)'  : 'translateY(10px)';
    btn.style.pointerEvents = show ? 'auto'           : 'none';
  }, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btn.addEventListener('mouseenter', function () {
    btn.style.boxShadow = '0 6px 28px rgba(168,85,247,0.4)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.boxShadow = '0 4px 20px rgba(168,85,247,0.15)';
  });
})();
