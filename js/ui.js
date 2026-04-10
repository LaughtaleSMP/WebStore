/* ===================================================================
   SECTION TRANSITIONS — IntersectionObserver Engine
   =================================================================== */
(function() {

  // ── Section top-line progress reveal ──
  const secObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('section-in-view');
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('section').forEach(s => secObserver.observe(s));

  // ── Section label + desc + rule stagger ──
  const labelObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const container = e.target;

      // Animate section-label
      const label = container.querySelector('.section-label:not(.no-dot)');
      if (label && !label.classList.contains('s-animated')) {
        label.classList.add('s-animated');
      }

      // Animate section-rule
      const rule = container.querySelector('.section-rule');
      if (rule) {
        setTimeout(() => rule.classList.add('revealed'), 80);
      }

      // Ambient glow
      const wrap = container.querySelector('.section-label-wrap');
      if (wrap) wrap.classList.add('section-active');

      // Animate section-desc
      const desc = container.querySelector('.section-desc');
      if (desc && !desc.classList.contains('s-animated')) {
        setTimeout(() => desc.classList.add('s-animated'), 120);
      }

      labelObserver.unobserve(container);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.container').forEach(c => labelObserver.observe(c));

  // ── Card stagger reveal ──
  const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const grid = e.target;
      const cards = grid.querySelectorAll(
        '.feat-card, .rule-card, .social-card, .shop-card, .live-stat-card'
      );
      cards.forEach((card, i) => {
        if (!card.classList.contains('s-animated')) {
          card.style.animationDelay = `${i * 0.065}s`;
          card.classList.add('s-animated');
        }
      });
      cardObserver.unobserve(grid);
    });
  }, { threshold: 0.06 });

  document.querySelectorAll(
    '.features-grid, .rules-grid, .social-grid, .shop-grid, .status-live-stats'
  ).forEach(g => cardObserver.observe(g));

  // ── Section ambient color pulse on nav ──
  // Add subtle body background color shift per section
  const sectionColors = {
    'status':    'rgba(168,85,247,0.025)',
    'fitur':     'rgba(92,189,58,0.02)',
    'peraturan': 'rgba(244,196,48,0.02)',
    'shop':      'rgba(192,132,252,0.025)',
    'komunitas': 'rgba(37,211,102,0.02)',
    'donasi':    'rgba(168,85,247,0.025)',
    'seed':      'rgba(78,227,227,0.02)',
  };

  const ambientObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      const color = sectionColors[id];
      if (color) {
        document.body.style.transition = 'background-color 1.2s ease';
        // Very subtle; resets after 1.5s
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 1500);
      }
    });
  }, { threshold: 0.3 });

  Object.keys(sectionColors).forEach(id => {
    const el = document.getElementById(id);
    if (el) ambientObserver.observe(el);
  });

})();
