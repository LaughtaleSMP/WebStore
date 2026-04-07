/* ════════════════════════════════════
   particles.js — Minecraft block rain
   ════════════════════════════════════ */

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
const COLORS = ['#5dbd3a','#3a8c1e','#4ee3e3','#f4c430','#ff3a3a','#8b5e3c','#7d7d7d'];
let W, H, blocks = [];

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function rnd(min, max) { return Math.random() * (max - min) + min; }

function spawn() {
  return {
    x: rnd(0, W),
    y: rnd(-100, H + 100),
    vx: rnd(-0.3, 0.3),
    vy: rnd(-0.6, -0.2),
    size: rnd(8, 18),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: rnd(0.2, 0.6),
    rot: rnd(0, Math.PI * 2),
    rotV: rnd(-0.01, 0.01)
  };
}

function init() {
  blocks = [];
  for (let i = 0; i < 55; i++) blocks.push(spawn());
}

function drawBlock(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = b.alpha;
  ctx.fillStyle = b.color;
  ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-b.size / 2, -b.size / 2, b.size, b.size);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.35);
  ctx.restore();
}

function animate() {
  ctx.clearRect(0, 0, W, H);
  blocks.forEach(b => {
    b.x += b.vx;
    b.y += b.vy;
    b.rot += b.rotV;
    if (b.y < -40) { Object.assign(b, spawn()); b.y = H + 20; }
    drawBlock(b);
  });
  requestAnimationFrame(animate);
}

resize();
init();
animate();
window.addEventListener('resize', () => { resize(); init(); });
