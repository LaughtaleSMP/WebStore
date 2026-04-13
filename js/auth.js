/* ══════════════════════════════════════════════════════════════
   auth.js — Login + Register (Admin Panel)
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Redirect jika sudah login ───────────────────────────────
sb.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = './';
});

// ── Handle Login ────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  if (typeof hideAlert === 'function') hideAlert();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  setLoading('btn-login', true);

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.includes('Invalid login')
      ? 'Email atau password salah.'
      : 'Terjadi kesalahan, coba lagi.';
    if (typeof showAlert === 'function') showAlert(msg, 'error');
    setLoading('btn-login', false);
  } else {
    if (typeof showAlert === 'function') showAlert('Login berhasil! Mengalihkan…', 'success');
    setTimeout(() => { window.location.href = './'; }, 1000);
  }
}

// ── Handle Register ─────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  if (typeof hideAlert === 'function') hideAlert();

  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (password !== confirm) {
    if (typeof showAlert === 'function') showAlert('Password tidak cocok!', 'error');
    return;
  }
  if (password.length < 8) {
    if (typeof showAlert === 'function') showAlert('Password minimal 8 karakter.', 'error');
    return;
  }

  setLoading('btn-register', true);

  const { error } = await sb.auth.signUp({ email, password });

  if (error) {
    let msg = 'Gagal mendaftar, coba lagi.';
    if (error.message.includes('already registered')) msg = 'Email sudah terdaftar.';
    if (error.message.includes('weak password'))      msg = 'Password terlalu lemah.';
    if (typeof showAlert === 'function') showAlert(msg, 'error');
    setLoading('btn-register', false);
  } else {
    if (typeof showAlert === 'function') showAlert('Akun dibuat! Cek email untuk konfirmasi, lalu login.', 'success');
    setLoading('btn-register', false);
    document.getElementById('form-register').reset();
    // Kembali ke tab login setelah 2 detik
    setTimeout(() => {
      if (typeof switchTab === 'function') switchTab('login');
      if (typeof hideAlert === 'function') hideAlert();
    }, 2500);
  }
}
