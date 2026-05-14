/* ════════════════════════════════════
   particles.js — Minecraft floating blocks
   Optimasi: deteksi mobile, throttle FPS, pause saat hidden,
   skip total saat prefers-reduced-motion atau low-end device
   ════════════════════════════════════ */
(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  // ── 1. Skip total saat user minta reduced motion ──
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    canvas.style.display = 'none';
    return;
  }

  // ── 2. Deteksi device kelas: mobile / low-end ──
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  // deviceMemory < 4 GB atau hardwareConcurrency <= 4 = low-end
  const dm = navigator.deviceMemory ?? 8;
  const hc = navigator.hardwareConcurrency ?? 8;
  const isLowEnd = dm < 4 || hc <= 4;

  // ── 3. Skip total di low-end mobile ──
  if (isMobile && isLowEnd) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  const COLORS = ['#5dbd3a', '#3a8c1e', '#4ee3e3', '#f4c430', '#ff3a3a', '#8b5e3c', '#7d7d7d'];

  // ── 4. Tuning per kelas device ──
  // Mobile: count diturunkan, FPS dibatasi 30
  // Desktop: count normal, 60 FPS
  const COUNT = isMobile ? 18 : (isLowEnd ? 25 : 55);
  const TARGET_FPS = isMobile ? 30 : 60;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  let W = 0, H = 0;
  const blocks = [];
  let running = true;
  let lastFrame = 0;
  let rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rnd(min, max) { return Math.random() * (max - min) + min; }

  function spawn(b) {
    b.x = rnd(0, W);
    b.y = rnd(-100, H + 100);
    b.vx = rnd(-0.3, 0.3);
    b.vy = rnd(-0.6, -0.2);
    b.size = rnd(8, 18);
    b.color = COLORS[(Math.random() * COLORS.length) | 0];
    b.alpha = rnd(0.2, 0.6);
    b.rot = rnd(0, Math.PI * 2);
    b.rotV = rnd(-0.01, 0.01);
    return b;
  }

  function init() {
    blocks.length = 0;
    for (let i = 0; i < COUNT; i++) blocks.push(spawn({}));
  }

  function drawBlock(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.globalAlpha = b.alpha;
    const half = b.size / 2;
    ctx.fillStyle = b.color;
    ctx.fillRect(-half, -half, b.size, b.size);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-half, -half, b.size, b.size);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-half, -half, b.size, b.size * 0.35);
    ctx.restore();
  }

  function tick(ts) {
    if (!running) { rafId = 0; return; }
    rafId = requestAnimationFrame(tick);

    // Throttle ke TARGET_FPS — frame skip kalau belum waktunya
    const elapsed = ts - lastFrame;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrame = ts - (elapsed % FRAME_INTERVAL);

    ctx.clearRect(0, 0, W, H);
    // for-loop lebih cepat dari forEach di hot path
    for (let i = 0, n = blocks.length; i < n; i++) {
      const b = blocks[i];
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.rotV;
      if (b.y < -40) { spawn(b); b.y = H + 20; }
      drawBlock(b);
    }
  }

  function start() {
    if (rafId) return;
    running = true;
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // Clear canvas saat dihentikan agar tidak ada static frame yang dipertahankan
    try { ctx.clearRect(0, 0, W, H); } catch (_) {}
  }

  // ── 5. Pause saat tab hidden — hemat baterai mobile ──
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  }, { passive: true });

  // ── 6. Resize debounced agar tidak spam re-init ──
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); init(); }, 200);
  }, { passive: true });

  resize();
  init();
  start();
})();
