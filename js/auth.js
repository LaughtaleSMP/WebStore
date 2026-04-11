/* ══════════════════════════════════════════════════════════════
   auth.js — Login & Register untuk Laughtale SMP
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Cek jika sudah login, langsung redirect ke beranda ──────
sb.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = './';
  }
});

// ── Tampilkan alert ─────────────────────────────────────────
function showAlert(msg, type = 'error') {
  const el = document.getElementById('auth-alert');
  el.textContent = msg;
  el.className = `auth-alert ${type} show`;
}
function hideAlert() {
  const el = document.getElementById('auth-alert');
  el.className = 'auth-alert';
}

// ── Switch tab Login / Register ─────────────────────────────
function switchTab(tab) {
  hideAlert();
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').classList.toggle('active', tab === 'register');
}

// ── Handle Login ────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  hideAlert();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('btn-login');

  btn.disabled   = true;
  btn.textContent = 'Memproses...';

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.includes('Invalid login')
      ? 'Email atau password salah.'
      : error.message;
    showAlert(msg, 'error');
    btn.disabled    = false;
    btn.textContent = 'Masuk';
  } else {
    showAlert('Login berhasil! Mengalihkan...', 'success');
    setTimeout(() => { window.location.href = './'; }, 1200);
  }
}

// ── Handle Register ─────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn      = document.getElementById('btn-register');

  if (password !== confirm) {
    showAlert('Password tidak cocok.', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Memproses...';

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://laughtalesmp.github.io/WebStore/'
    }
  });

  if (error) {
    showAlert(error.message, 'error');
    btn.disabled    = false;
    btn.textContent = 'Buat Akun';
  } else {
    showAlert('Akun berhasil dibuat! Cek email kamu untuk konfirmasi.', 'success');
    btn.textContent = 'Terkirim ✓';
  }
}
