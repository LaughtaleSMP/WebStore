/* ---- Hamburger / Nav Drawer ---- */
(function() {
  const btn     = document.getElementById('hamburger-btn');
  const drawer  = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-overlay');
  const links   = document.querySelectorAll('.drawer-link');

  function closeDrawer() {
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  function openDrawer() {
    drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  btn.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  links.forEach(link => link.addEventListener('click', closeDrawer));
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Tutup dengan Escape + Focus Trap
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
      btn.focus();
      return;
    }
    // Focus trap: Tab hanya loop di dalam drawer saat terbuka
    if (e.key === 'Tab' && drawer.classList.contains('open')) {
      const focusable = Array.from(drawer.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });
  // Fokus ke elemen pertama drawer saat dibuka
  const _origOpen = openDrawer;
})();

/* ---- Nav scroll effect ---- */
window.addEventListener('scroll', () => {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ---- Counter animation & Fade-up: di-handle oleh js/animations.js ---- */

/* ---- Particle canvas: di-handle oleh js/particles.js ---- */

/* ── Copy IP ── */
(function(){
  function showToast(msg) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toast-msg');
    if (!t) return;
    if (m) m.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2400);
  }

  function copyIP() {
    const ip = 'laughtale.my.id:19214';
    const btn = document.getElementById('hero-ip-copy-btn');
    navigator.clipboard.writeText(ip).then(() => {
      showToast('✓ IP berhasil disalin!');
      if (btn) {
        btn.classList.add('copied');
        btn.querySelector('svg').outerHTML = '';
        btn.innerHTML = '✓ DISALIN';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>SALIN';
        }, 2000);
      }
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = ip; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✓ IP berhasil disalin!');
    });
  }

  const box = document.getElementById('hero-ip-box');
  const btn = document.getElementById('hero-ip-copy-btn');
  if (box) box.addEventListener('click', copyIP);
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); copyIP(); });
  if (box) box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') copyIP(); });
})();

/* ── Count-up animation with IntersectionObserver ── */
/* OLD COUNTER REPLACED */

/* ── Shop empty state ── */
(function(){
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  const mo = new MutationObserver(() => {
    const realItems = grid.querySelectorAll('.shop-card, .product-card, [class*="card"]');
    const empty = grid.querySelector('.shop-empty');
    if (realItems.length === 0 && !empty) {
      grid.innerHTML = `<div class="shop-empty">
        <div class="shop-empty-icon">🛒</div>
        <h3>BELUM ADA PRODUK</h3>
        <p>Belum ada item di kategori ini. Coba cek kategori lain!</p>
      </div>`;
    }
  });
  mo.observe(grid, { childList: true, subtree: false });
})();


// ── Nav: Scroll Progress Bar ──
(function(){
  const nav = document.getElementById('main-nav');
  function updateProgress(){
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight * 100).toFixed(2) : 0;
    nav.style.setProperty('--scroll-pct', pct + '%');
  }
  window.addEventListener('scroll', updateProgress, {passive: true});
  updateProgress();
})();

// ── Nav: Active link tracking with IntersectionObserver ──
(function(){
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  const pill  = document.getElementById('nav-pill');
  const sections = [];

  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const sec = document.getElementById(id);
    if(sec) sections.push({a, sec});
  });

  function movePill(a){
    if(!pill || !a) { if(pill) pill.style.opacity='0'; return; }
    const li = a.parentElement;
    const ul = li.parentElement;
    const ulRect = ul.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    pill.style.left  = (liRect.left - ulRect.left) + 'px';
    pill.style.width = liRect.width + 'px';
    pill.style.opacity = '1';
  }

  // hover
  links.forEach(a => {
    a.addEventListener('mouseenter', () => movePill(a));
  });
  document.querySelector('.nav-links')?.addEventListener('mouseleave', () => {
    const active = document.querySelector('.nav-links a.active');
    if(active) movePill(active); else if(pill) pill.style.opacity='0';
  });

  // scroll-based active
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const match = sections.find(s => s.sec === entry.target);
        if(match){
          links.forEach(l => l.classList.remove('active'));
          match.a.classList.add('active');
          movePill(match.a);
          // sync drawer
          document.querySelectorAll('.drawer-link').forEach(dl => {
            dl.classList.toggle('active-link', dl.getAttribute('href') === match.a.getAttribute('href'));
          });
        }
      }
    });
  }, {rootMargin: '-20% 0px -70% 0px', threshold: 0});

  sections.forEach(s => io.observe(s.sec));
  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-links a.active');
    if(active) movePill(active);
  });
})();



/* typewriter → js/typewriter.js */

/* ══════════════════════════════════════
   IP COPY PARTICLE BURST
══════════════════════════════════════ */
(function(){
  const btn = document.getElementById('hero-ip-copy-btn');
  if (!btn) return;
  const colors = ['#a855f7','#c084fc','#ffffff','#7c3aed','#e9d5ff'];

  function spawnParticles(e) {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'copy-particle';
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const dist = 40 + Math.random() * 55;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 15;
      const dur = (0.5 + Math.random() * 0.35).toFixed(2) + 's';
      const size = (4 + Math.random() * 5).toFixed(1) + 'px';
      p.style.cssText = `
        left:${cx}px; top:${cy}px;
        width:${size}; height:${size};
        background:${colors[i % colors.length]};
        --tx:${tx}px; --ty:${ty}px; --dur:${dur};
        box-shadow: 0 0 6px ${colors[i % colors.length]};
      `;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  // Hook into existing copyIP click
  btn.addEventListener('click', spawnParticles);
  const ipBox = document.getElementById('hero-ip-box');
  if (ipBox) ipBox.addEventListener('click', spawnParticles);
})();

/* ══════════════════════════════════════
   COUNTER UPGRADE — glow on done
══════════════════════════════════════ */
(function(){
  const vals = document.querySelectorAll('.stat-val[data-target]');
  vals.forEach(el => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(el);
        const target = parseInt(el.dataset.target, 10);
        if (isNaN(target)) return;
        const dur = 1400;
        const start = performance.now();
        el.classList.add('counting');
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.floor(ease * target);
          if (p < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = target;
            el.classList.remove('counting');
            el.classList.add('done');
          }
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    observer.observe(el);
  });
})();

/* ══════════════════════════════════════
   SHOP SKELETON LOADER
══════════════════════════════════════ */
(function(){
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  function showSkeleton(count = 4) {
    grid.innerHTML = Array.from({length: count}, () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-line skeleton-img"></div>
        <div class="skeleton-line skeleton-tag"></div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-price"></div>
        <div class="skeleton-line skeleton-btn"></div>
      </div>
    `).join('');
  }

  // Show skeleton immediately if grid is empty
  if (grid.children.length === 0) showSkeleton(4);

  // Watch for real content replacing skeleton
  const mo = new MutationObserver(() => {
    const real = grid.querySelectorAll('.shop-card, .product-card, [class*="card"]:not(.skeleton-card)');
    if (real.length > 0) {
      // Remove skeleton cards
      grid.querySelectorAll('.skeleton-card').forEach(s => s.remove());
      mo.disconnect();
    }
  });
  mo.observe(grid, { childList: true, subtree: true });

  // Also watch tab changes to re-show skeleton
  const tabs = document.getElementById('shop-tabs');
  if (tabs) {
    tabs.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab],[data-category],[role="tab"]');
      if (tab) {
        setTimeout(() => {
          if (grid.children.length === 0) showSkeleton(4);
        }, 80);
      }
    });
  }
})();

/* ══════════════════════════════════════
   STICKY MOBILE CTA
══════════════════════════════════════ */
(function(){
  const cta = document.getElementById('sticky-cta');
  const closeBtn = document.getElementById('sticky-cta-close');
  if (!cta) return;

  let hidden = false;
  let shown = false;

  // Show after scrolling past hero (300px)
  function onScroll() {
    if (hidden) return;
    const y = window.scrollY;
    // Show when past hero, hide when near komunitas CTA
    const komunitas = document.getElementById('komunitas');
    const komunityTop = komunitas ? komunitas.getBoundingClientRect().top + window.scrollY : Infinity;
    const nearBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 80);

    if (y > 280 && window.scrollY < komunityTop - 100 && !nearBottom) {
      if (!shown) { cta.classList.add('visible'); cta.setAttribute('aria-hidden','false'); shown = true; }
    } else {
      if (shown) { cta.classList.remove('visible'); shown = false; }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  closeBtn && closeBtn.addEventListener('click', () => {
    hidden = true;
    cta.classList.remove('visible');
    cta.setAttribute('aria-hidden', 'true');
  });
})();
