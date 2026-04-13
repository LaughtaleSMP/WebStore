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

  // Tampilkan badge pesanan masuk langsung setelah login
  if (typeof window.ordersInitBadge === 'function') {
    window.ordersInitBadge();
  }
}

async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

function goToMain() { window.location.href = 'index.html'; }