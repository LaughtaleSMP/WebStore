// ==================== SUPABASE ====================
const SUPABASE_URL = window.SB_URL;
const SUPABASE_KEY = window.SB_KEY;

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

// ==================== PASSWORD RECOVERY HANDLER ====================
let _isRecoveryMode = false;

// ── Early URL detection: check hash BEFORE Supabase processes it ──
// Supabase implicit flow appends #access_token=...&type=recovery to the redirect URL
(function _detectRecoveryFromUrl() {
  try {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    // Check URL hash (implicit flow): #type=recovery or #...&type=recovery
    if (hash && hash.includes('type=recovery')) {
      _isRecoveryMode = true;
      return;
    }
    // Check URL search params (PKCE flow): ?code=...
    // PKCE recovery also has the code verifier stored with /PASSWORD_RECOVERY suffix
    if (params.has('code')) {
      const codeVerifier = localStorage.getItem(
        `sb-jlxtnbnrirxhwuyqjlzw-auth-token-code-verifier`
      );
      if (codeVerifier && codeVerifier.includes('PASSWORD_RECOVERY')) {
        _isRecoveryMode = true;
      }
    }
  } catch { }
})();

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    _isRecoveryMode = true;
    _showRecoveryModal();
  }
});

function _showRecoveryModal() {
  // Hide auth screen login form, show recovery overlay
  const existing = document.getElementById('recovery-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'recovery-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(7,10,14,0.95);backdrop-filter:blur(12px);
    display:flex;align-items:center;justify-content:center;padding:1.5rem;
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface,#0c1017);border:1px solid rgba(74,143,255,0.2);border-radius:16px;
                padding:2rem;max-width:400px;width:100%;font-family:'Inter',sans-serif;">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">🔐</div>
        <h3 style="font-size:1.1rem;font-weight:700;color:#eef1f7;margin-bottom:0.3rem;">Reset Password</h3>
        <p style="font-size:12.5px;color:#5a6478;line-height:1.6;">Masukkan password baru untuk akun admin kamu.</p>
      </div>
      <div id="recovery-alert" class="alert alert-error" style="display:none;margin-bottom:12px;">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span id="recovery-alert-msg"></span>
      </div>
      <div style="margin-bottom:13px;">
        <label style="display:block;font-size:10.5px;font-weight:600;color:#5a6478;
                      letter-spacing:0.4px;text-transform:uppercase;margin-bottom:5px;">Password Baru</label>
        <input id="recovery-pw" type="password" placeholder="Minimal 6 karakter"
               style="width:100%;background:#111820;border:1px solid rgba(255,255,255,0.09);
                      border-radius:9px;padding:9.5px 12px;color:#eef1f7;font-size:13.5px;
                      font-family:'Inter',sans-serif;outline:none;" />
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:10.5px;font-weight:600;color:#5a6478;
                      letter-spacing:0.4px;text-transform:uppercase;margin-bottom:5px;">Konfirmasi Password</label>
        <input id="recovery-pw2" type="password" placeholder="Ulangi password baru"
               style="width:100%;background:#111820;border:1px solid rgba(255,255,255,0.09);
                      border-radius:9px;padding:9.5px 12px;color:#eef1f7;font-size:13.5px;
                      font-family:'Inter',sans-serif;outline:none;" />
      </div>
      <button id="recovery-submit-btn" onclick="doResetPassword()"
              style="width:100%;padding:10.5px;background:#4a8fff;color:#fff;border:none;
                     border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;
                     font-family:'Inter',sans-serif;transition:background .16s;">
        Simpan Password Baru
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Focus first input
  setTimeout(() => {
    const inp = document.getElementById('recovery-pw');
    if (inp) inp.focus();
  }, 100);

  // Enter key support
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doResetPassword();
  });
}

async function doResetPassword() {
  const pw  = document.getElementById('recovery-pw').value;
  const pw2 = document.getElementById('recovery-pw2').value;
  const btn = document.getElementById('recovery-submit-btn');
  const alertEl  = document.getElementById('recovery-alert');
  const alertMsg = document.getElementById('recovery-alert-msg');

  alertEl.style.display = 'none';

  if (!pw || pw.length < 6) {
    alertEl.className = 'alert alert-error';
    alertMsg.textContent = 'Password minimal 6 karakter.';
    alertEl.style.display = 'flex';
    return;
  }
  if (pw !== pw2) {
    alertEl.className = 'alert alert-error';
    alertMsg.textContent = 'Konfirmasi password tidak cocok.';
    alertEl.style.display = 'flex';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;

    // Success — remove overlay, show toast, reload to login fresh
    const overlay = document.getElementById('recovery-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div style="background:#0c1017;border:1px solid rgba(52,211,153,0.25);border-radius:16px;
                    padding:2rem;max-width:380px;width:100%;text-align:center;font-family:'Inter',sans-serif;">
          <div style="font-size:2.5rem;margin-bottom:0.75rem;">✅</div>
          <h3 style="font-size:1.1rem;font-weight:700;color:#6ee7b7;margin-bottom:0.5rem;">Password Berhasil Diubah!</h3>
          <p style="font-size:12.5px;color:#5a6478;line-height:1.6;">
            Mengalihkan ke halaman login...
          </p>
        </div>
      `;
    }

    // Sign out & reload so they can login with new password
    await sb.auth.signOut();
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    alertEl.className = 'alert alert-error';
    alertMsg.textContent = e.message || 'Gagal menyimpan password. Coba lagi.';
    alertEl.style.display = 'flex';
    btn.disabled = false;
    btn.textContent = 'Simpan Password Baru';
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  const pwInput = document.getElementById('login-password');
  if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // Skip auto-login if in password recovery mode
  if (!_isRecoveryMode) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await afterLogin(session.user);
  }

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
