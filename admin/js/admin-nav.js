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
    'orders':           'Pesanan Masuk',
    'all-orders':       'Semua Pesanan',
    'finance':          'Laporan Keuangan',
    'access-requests':  'Permintaan Akses',
  };
  document.getElementById('topbar-section').textContent = labels[name] || name;

  if (name === 'access-requests' && typeof window.loadAccessRequests === 'function') {
    window.loadAccessRequests();
  }
}

window.showSection = showSection;

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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item, .sidebar-back').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
});
