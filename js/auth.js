/* ══════════════════════════════════════════════════════════════
   auth.js — Login Only (Admin Panel)
   Daftar/Register sudah dinonaktifkan.
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
  const btn      = document.getElementById('btn-login');

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
