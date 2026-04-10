/* ══════════════════════════════════════
   TYPEWRITER EFFECT
══════════════════════════════════════ */
(function(){
  const el = document.getElementById('hero-typewriter');
  if (!el) return;
  const lines = [
    'Survival Minecraft Bedrock paling kompetitif di Indonesia.',
    'Gratis. Fair. Tanpa pay-to-win.',
    'Economy system, 14+ fitur eksklusif, event mingguan.',
    'Bergabung dengan komunitas aktif kami!'
  ];
  let lineIdx = 0, charIdx = 0, isDeleting = false;
  const PAUSE_END = 2200, PAUSE_DELETE = 800, SPEED_TYPE = 38, SPEED_DEL = 18;

  function type() {
    const current = lines[lineIdx];
    if (!isDeleting) {
      charIdx++;
      el.textContent = current.slice(0, charIdx);
      if (charIdx === current.length) {
        // Selesai mengetik — pause lalu hapus (loop selamanya)
        setTimeout(() => { isDeleting = true; type(); }, PAUSE_END);
        return;
      }
      setTimeout(type, SPEED_TYPE + (Math.random() * 20 - 10));
    } else {
      charIdx--;
      el.textContent = current.slice(0, charIdx);
      if (charIdx === 0) {
        isDeleting = false;
        lineIdx = (lineIdx + 1) % lines.length; // wrap ke awal
        setTimeout(type, PAUSE_DELETE);
        return;
      }
      setTimeout(type, SPEED_DEL);
    }
  }
  // Start after hero is visible
  setTimeout(type, 900);
})();
