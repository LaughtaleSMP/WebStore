/* ── SCROLL FADE-UP ── */
// Nama _fadeObserver (dengan prefix _) agar tidak konflik dengan variabel lain
const _fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      _fadeObserver.unobserve(e.target); // FIX: unobserve setelah visible agar hemat memori
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

// Observe elemen .fade-up yang sudah ada saat halaman dimuat
document.querySelectorAll('.fade-up').forEach(el => _fadeObserver.observe(el));

// Observe elemen .fade-up yang ditambahkan secara dinamis (misal: kartu toko)
const _mutationObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return; // skip non-element nodes
      // Cek node itu sendiri
      if (node.classList && node.classList.contains('fade-up')) {
        _fadeObserver.observe(node);
      }
      // Cek semua child yang punya class fade-up
      if (node.querySelectorAll) {
        node.querySelectorAll('.fade-up').forEach(el => _fadeObserver.observe(el));
      }
    });
  });
});
_mutationObserver.observe(document.body, { childList: true, subtree: true });

/* ── COUNTER ANIMATION ── */
function animateCount(el, target) {
  let current = 0;
  const step = target / 40;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(current);
  }, 30);
}

const _counterObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting && e.target.dataset.target) {
      animateCount(e.target, parseInt(e.target.dataset.target));
      _counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => _counterObserver.observe(el));

/* ── SMOOTH SCROLL ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});