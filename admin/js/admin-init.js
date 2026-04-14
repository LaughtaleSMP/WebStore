// ==================== SUPABASE ====================
const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

// Expose untuk temp-client di admin-users.js
window._supabaseUrl = SUPABASE_URL;
window._supabaseKey = SUPABASE_KEY;

// createClient utama (session persistent — untuk admin yang sedang login)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
window._adminSb = sb;

// ==================== STATE ====================
let currentUser = null;
let currentRole = null;
let configData  = {};
let waAdmins    = { main: [], gem: [] };
let waAddingFor = null;

// ==================== GLOBAL UTILS ====================

/**
 * escHtml — escape karakter HTML berbahaya untuk mencegah XSS.
 */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escHtml = escHtml;

// Alias esc → escHtml (dipakai admin-wa.js, admin-server-status.js, dll)
function esc(s) { return escHtml(s); }
window.esc = esc;

/**
 * showAdminToast — toast notifikasi global admin panel.
 */
function showAdminToast(msg, type) {
  type = type || 'success';
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.style.cssText = [
    'padding:10px 16px',
    'border-radius:10px',
    'font-size:13px',
    'font-weight:500',
    'color:#fff',
    'box-shadow:0 4px 16px rgba(0,0,0,.35)',
    'opacity:0',
    'transform:translateY(8px)',
    'transition:opacity .22s,transform .22s',
    'pointer-events:none',
    'max-width:320px',
    'word-break:break-word',
    type === 'error'
      ? 'background:rgba(239,68,68,.92)'
      : 'background:rgba(34,197,94,.88)',
  ].join(';');
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}
window.showAdminToast = showAdminToast;

// Alias toast() agar admin-config.js tetap bekerja
function toast(msg, type) { showAdminToast(msg, type); }
window.toast = toast;

// ==================== IDLE AUTO-LOGOUT (1 jam) ====================
(function () {
  const IDLE_LIMIT = 60 * 60 * 1000;
  let idleTimer  = null;
  let isLoggedIn = false;

  function resetIdleTimer() {
    if (!isLoggedIn) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showIdleWarning, IDLE_LIMIT);
  }

  function showIdleWarning() {
    const overlay = document.createElement('div');
    overlay.id = 'idle-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.82);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;padding:1.5rem;
    `;
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(239,68,68,0.35);border-radius:16px;
                  padding:2rem;max-width:400px;width:100%;text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">⏰</div>
        <h3 style="font-family:'Inter',sans-serif;font-size:1rem;font-weight:700;
                   color:#fff;margin-bottom:0.5rem;">Sesi Hampir Habis</h3>
        <p style="font-size:0.85rem;color:#888;margin-bottom:1.5rem;line-height:1.6;">
          Tidak ada aktivitas selama <strong style="color:#ef4444">1 jam</strong>.<br>
          Anda akan otomatis keluar dalam
          <strong id="idle-countdown" style="color:#f4c430">30</strong> detik.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="idle-stay-btn"
            style="padding:9px 22px;border-radius:9px;border:1px solid rgba(91,127,244,0.4);
                   background:rgba(91,127,244,0.12);color:#4f7df0;font-family:'Inter',sans-serif;
                   font-size:13px;font-weight:600;cursor:pointer;">Tetap Login</button>
          <button id="idle-logout-btn"
            style="padding:9px 22px;border-radius:9px;border:none;
                   background:rgba(239,68,68,0.85);color:#fff;font-family:'Inter',sans-serif;
                   font-size:13px;font-weight:600;cursor:pointer;">Keluar Sekarang</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let countdown = 30;
    const countEl = document.getElementById('idle-countdown');
    const timer = setInterval(() => {
      countdown--;
      if (countEl) countEl.textContent = countdown;
      if (countdown <= 0) { clearInterval(timer); forceLogout(); }
    }, 1000);

    document.getElementById('idle-stay-btn').addEventListener('click', () => {
      clearInterval(timer);
      overlay.remove();
      resetIdleTimer();
    });
    document.getElementById('idle-logout-btn').addEventListener('click', () => {
      clearInterval(timer);
      forceLogout();
    });
  }

  async function forceLogout() {
    const overlay = document.getElementById('idle-overlay');
    if (overlay) overlay.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;
                  padding:2rem;max-width:360px;width:100%;text-align:center;">
        <div style="font-size:2rem;margin-bottom:1rem;">👋</div>
        <p style="font-size:0.9rem;color:#888;font-family:'Inter',sans-serif;">
          Sesi telah berakhir karena tidak aktif. Mengalihkan ke halaman login...
        </p>
      </div>`;
    await sb.auth.signOut();
    setTimeout(() => location.reload(), 1500);
  }

  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  window._idleStartTracking = function () { isLoggedIn = true; resetIdleTimer(); };
  window._idleStopTracking  = function () { isLoggedIn = false; clearTimeout(idleTimer); };
})();

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  const pwInput = document.getElementById('login-password');
  if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(session.user);

  ['cfg-status_api_provider', 'cfg-status_refresh_interval', 'cfg-status_custom_url'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  updateStatusPreview);
    el.addEventListener('change', updateStatusPreview);
  });

  ['cfg-server_ip', 'cfg-server_type', 'cfg-server_name'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  updateServerPreview);
    el.addEventListener('change', updateServerPreview);
  });

  fetchLiveStatus();
});
