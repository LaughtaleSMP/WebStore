/* Patch: daftarkan nav item & inisialisasi grafik saat section player-graph dibuka */
(function () {
  // Inject nav item ke sidebar setelah DOM ready
  function injectNav() {
    const navGroups = document.querySelectorAll('.nav-group-label');
    let serverGroup = null;
    navGroups.forEach(g => { if (g.textContent.trim() === 'Server') serverGroup = g; });
    if (!serverGroup) return;

    // Cek kalau sudah ada
    if (document.getElementById('nav-player-graph')) return;

    const item = document.createElement('div');
    item.className  = 'nav-item';
    item.id         = 'nav-player-graph';
    item.innerHTML  = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      Grafik Player
    `;
    item.onclick = function () { showSection('player-graph', this); };

    // Sisipkan setelah nav-item Server Status
    const ssNav = document.getElementById('nav-player-graph');
    const parent = serverGroup.parentNode;
    // Cari posisi setelah server-status nav item
    const allNavItems = Array.from(parent.querySelectorAll('.nav-item'));
    const serverStatusNav = allNavItems.find(n => n.getAttribute('onclick') && n.getAttribute('onclick').includes('server-status'));
    if (serverStatusNav) {
      serverStatusNav.after(item);
    } else {
      serverGroup.after(item);
    }
  }

  // Patch showSection agar init grafik
  const _origShow = window.showSection;
  window.showSection = function (id, el) {
    if (_origShow) _origShow(id, el);
    if (id === 'player-graph') {
      setTimeout(() => window.initPlayerGraph && window.initPlayerGraph(), 50);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    // Tunggu auth selesai lalu inject ulang (sidebar mungkin belum render)
    setTimeout(injectNav, 1500);
    setTimeout(injectNav, 3000);
  });
})();
