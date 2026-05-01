// ==================== NAVIGATION ====================
function showSection(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  if (el)  el.classList.add('active');

  const labels = {
    'server':           'Info Server',
    'maintenance':      'Maintenance',
    'motd':             'MOTD / Pengumuman',
    'season':           'Season & World',
    'admins-wa':        'Admin WhatsApp',
    'server-status':    'Server Status Config',
    'shop':             'Shop Items',
    'wa-template':      'Format Pesan WA',
    'orders':           'Pesanan Masuk',
    'all-orders':       'Semua Pesanan',
    'finance':          'Laporan Keuangan',
    'finance-v2':       'Manajemen Keuangan',
    'access-requests':  'Permintaan Akses',
    'manage-admins':    'Manajemen Admin',
    'activity-log':     'Log Aktivitas',
    'gem-topup':         'Topup Gem / Koin',
  };
  document.getElementById('topbar-section').textContent = labels[name] || name;

  if (name === 'access-requests' && typeof window.loadAccessRequests === 'function') {
    window.loadAccessRequests();
  }

  if (name === 'finance-v2' && typeof window.financeV2Init === 'function') {
    window.financeV2Init();
  }

  if (name === 'orders') {
    /* Inisialisasi notifikasi saat pertama kali buka halaman orders */
    if (typeof window._ordersInitNotifBar === 'function') {
      window._ordersInitNotifBar();
    }
    if (typeof window.ordersLoad === 'function') window.ordersLoad();
    if (typeof window.ordersSubscribe === 'function') window.ordersSubscribe();
  }

  if (name === 'all-orders') {
    if (typeof window.allOrdersLoad === 'function') window.allOrdersLoad();
  }

  if (name === 'activity-log' && typeof window._alLoad === 'function') {
    window._alLoad();
  }

  if (name === 'gem-topup' && typeof window.gtInit === 'function') {
    window.gtInit();
  }
}

window.showSection = showSection;

/* ─────────────────────────────────────────────────────
   Inject tombol notifikasi di section orders (sekali)
───────────────────────────────────────────────────── */
window._ordersInitNotifBar = function () {
  if (document.getElementById('orders-notif-btn')) return; // sudah ada

  const liveBar = document.querySelector('#sec-orders > div[style*="display:flex"]');
  if (!liveBar) return;

  const btn = document.createElement('button');
  btn.id        = 'orders-notif-btn';
  btn.className = 'btn-ghost';
  btn.style.cssText = 'font-size:11.5px;padding:5px 10px;display:inline-flex;align-items:center;gap:4px;margin-left:4px';
  btn.textContent = '🔔 Aktifkan Notifikasi';
  btn.onclick     = () => {
    if (typeof window._ordersRequestNotif === 'function') window._ordersRequestNotif();
  };
  liveBar.appendChild(btn);

  /* Perbarui teks tombol sesuai status notifikasi saat ini */
  if (typeof window._updateNotifBtn === 'function') window._updateNotifBtn();
};

// ==================== SIDEBAR TOGGLE (MOBILE) ====================
function toggleSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const icon     = document.getElementById('hamburger-icon');
  const isOpen   = sidebar.classList.contains('open');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('visible');
    icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  }
}

function closeSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const icon     = document.getElementById('hamburger-icon');
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  icon.innerHTML = '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar  = closeSidebar;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item, .sidebar-back').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
});
