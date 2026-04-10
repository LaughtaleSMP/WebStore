<script>
/* ═══════════════════════════════════════════════
   SERVER CONFIG — Edit nilai di sini untuk update
   semua angka di halaman sekaligus
═══════════════════════════════════════════════ */
window.SERVER_CONFIG = {
  ip:           'laughtale.my.id:19214',
  season:       'XII',
  seed:          120,
  totalFitur:    14,
  totalPeraturan:11,
  namaServer:   'Laughtale SMP',
  versi:        'Bedrock Edition',
};
</script>
<script>
/* Sync stat counters with SERVER_CONFIG */
(function() {
  var cfg = window.SERVER_CONFIG;
  if (!cfg) return;
  var map = { 'Total Fitur': cfg.totalFitur, 'Peraturan': cfg.totalPeraturan, 'Seed': cfg.seed };
  document.querySelectorAll('.stat-val[data-target]').forEach(function(el) {
    var label = el.closest('.stat-item') && el.closest('.stat-item').querySelector('.stat-label');
    if (label && map[label.textContent.trim()] !== undefined) {
      el.setAttribute('data-target', map[label.textContent.trim()]);
      el.textContent = '0';
    }
  });
  // Sync season text
  document.querySelectorAll('.stat-label').forEach(function(el) {
    if (el.textContent.trim() === 'Season') {
      var val = el.previousElementSibling;
      if (val) val.textContent = cfg.season;
    }
  });
})();
</script>


<!-- Back to Top Button -->
<button type="button" id="back-to-top" aria-label="Kembali ke atas" title="Kembali ke atas"
  style="position:fixed;bottom:5rem;right:1.5rem;z-index:900;
         width:44px;height:44px;border-radius:10px;border:1px solid rgba(168,85,247,0.4);
         background:rgba(13,17,23,0.85);backdrop-filter:blur(12px);
         color:var(--green);cursor:pointer;
         display:flex;align-items:center;justify-content:center;
         opacity:0;transform:translateY(10px);pointer-events:none;
         transition:opacity 0.3s,transform 0.3s,box-shadow 0.2s;
         box-shadow:0 4px 20px rgba(168,85,247,0.15);">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
</button>
<script>
(function(){
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    const show = window.scrollY > 400;
    btn.style.opacity        = show ? '1'    : '0';
    btn.style.transform      = show ? 'translateY(0)' : 'translateY(10px)';
    btn.style.pointerEvents  = show ? 'auto' : 'none';
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  btn.addEventListener('mouseenter', () => { btn.style.boxShadow = '0 6px 28px rgba(168,85,247,0.4)'; });
  btn.addEventListener('mouseleave', () => { btn.style.boxShadow = '0 4px 20px rgba(168,85,247,0.15)'; });
})();
</script>
