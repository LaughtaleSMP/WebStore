// ==================== AUTH ====================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  const btn   = document.getElementById('login-btn');
  const errEl = document.getElementById('auth-error');
  const errMsg= document.getElementById('auth-error-msg');

  errEl.style.display = 'none';
  btn.textContent = 'Memuat...';
  btn.disabled = true;

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;

    const { data: role } = await sb.from('admin_roles')
      .select('role,display_name')
      .eq('user_id', data.user.id)
      .single();

    if (!role) {
      await sb.auth.signOut();
      throw new Error('Akun ini tidak terdaftar sebagai admin. Hubungi super admin.');
    }

    await afterLogin(data.user, role);
  } catch(e) {
    errMsg.textContent = e.message;
    errEl.style.display = 'flex';
    btn.textContent = 'Masuk ke Panel';
    btn.disabled = false;
  }
}

async function afterLogin(user, roleData = null) {
  if (!roleData) {
    const { data } = await sb.from('admin_roles')
      .select('role,display_name')
      .eq('user_id', user.id)
      .single();
    if (!data) { await sb.auth.signOut(); return; }
    roleData = data;
  }

  currentUser = user;
  currentRole = roleData;

  document.getElementById('topbar-email').textContent = roleData.display_name || user.email;
  document.getElementById('topbar-role').textContent  = roleData.role;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');

  await loadAllConfig();
  await loadWAAdmins();

  // Mulai pelacak idle setelah login berhasil
  if (typeof window._idleStartTracking === 'function') {
    window._idleStartTracking();
  }

  // Tampilkan badge pesanan masuk langsung setelah login
  if (typeof window.ordersInitBadge === 'function') {
    window.ordersInitBadge();
  }
}

async function doLogout() {
  if (typeof window._idleStopTracking === 'function') {
    window._idleStopTracking();
  }
  await sb.auth.signOut();
  location.reload();
}

function goToMain() { window.location.href = 'index.html'; }

// ==================== REGISTER ADMIN ====================
function toggleRegisterForm() {
  const form = document.getElementById('register-form-wrap');
  const btn  = document.getElementById('toggle-register-btn');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '+ Daftarkan Admin Baru' : '− Tutup Form';
  if (!isOpen) {
    const firstInput = form.querySelector('input');
    if (firstInput) firstInput.focus();
    // Reset form
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-display').value = '';
    document.getElementById('reg-role').value = 'admin';
    const rErr = document.getElementById('register-error');
    if (rErr) rErr.style.display = 'none';
    const rSuc = document.getElementById('register-success');
    if (rSuc) rSuc.style.display = 'none';
  }
}

async function doRegisterAdmin() {
  const email   = document.getElementById('reg-email').value.trim();
  const pw      = document.getElementById('reg-password').value;
  const display = document.getElementById('reg-display').value.trim();
  const role    = document.getElementById('reg-role').value;
  const errEl   = document.getElementById('register-error');
  const sucEl   = document.getElementById('register-success');
  const btn     = document.getElementById('register-btn');

  if (errEl) errEl.style.display = 'none';
  if (sucEl) sucEl.style.display = 'none';

  if (!email || !pw || !display) {
    if (errEl) { errEl.textContent = 'Email, password, dan nama tampilan wajib diisi.'; errEl.style.display = 'block'; }
    return;
  }
  if (pw.length < 6) {
    if (errEl) { errEl.textContent = 'Password minimal 6 karakter.'; errEl.style.display = 'block'; }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mendaftarkan...';

  try {
    // Buat akun di Supabase Auth
    const { data, error } = await sb.auth.admin
      ? // Gunakan admin API jika tersedia
        await sb.auth.admin.createUser({ email, password: pw, email_confirm: true })
      : await sb.auth.signUp({ email, password: pw });

    if (error) throw error;

    const userId = data?.user?.id || data?.id;
    if (!userId) throw new Error('Gagal mendapatkan ID user baru.');

    // Tambahkan ke tabel admin_roles
    const { error: roleErr } = await sb.from('admin_roles').insert({
      user_id:      userId,
      role:         role,
      display_name: display,
    });

    if (roleErr) throw roleErr;

    if (sucEl) {
      sucEl.textContent = `✅ Admin "${display}" (${email}) berhasil didaftarkan!`;
      sucEl.style.display = 'block';
    }
    // Reset
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-display').value = '';
    document.getElementById('reg-role').value = 'admin';

  } catch (e) {
    if (errEl) {
      errEl.textContent = 'Gagal: ' + (e.message || 'Terjadi kesalahan.');
      errEl.style.display = 'block';
    }
  }

  btn.disabled = false;
  btn.textContent = 'Daftarkan Admin';
}
