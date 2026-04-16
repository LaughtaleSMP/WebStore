// ==================== TAB SWITCHER ====================
// switchAuthTab didefinisikan di admin/index.html (inline script)

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

    const { data: role, error: roleErr } = await sb
      .from('admin_roles')
      .select('role,display_name,phone')
      .eq('user_id', data.user.id)
      .single();

    if (roleErr || !role) {
      await sb.auth.signOut();
      throw new Error('Akun ini tidak terdaftar sebagai admin. Hubungi super admin.');
    }

    await afterLogin(data.user, role);
  } catch (e) {
    errMsg.textContent = e.message || 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = 'flex';
    btn.textContent = 'Masuk ke Panel';
    btn.disabled = false;
  }
}

async function afterLogin(user, roleData = null) {
  if (!roleData) {
    const { data, error } = await sb
      .from('admin_roles')
      .select('role,display_name,phone')
      .eq('user_id', user.id)
      .single();
    if (error || !data) { await sb.auth.signOut(); return; }
    roleData = data;
  }

  currentUser = user;
  currentRole = roleData;

  document.getElementById('topbar-email').textContent = roleData.display_name || user.email;
  document.getElementById('topbar-role').textContent  = roleData.role;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');

  // Sembunyikan nav lama permintaan akses — digantikan oleh admin-users.js
  const reqNavItem = document.getElementById('nav-access-requests');
  if (reqNavItem) reqNavItem.style.display = 'none';

  // Inject nav "Manajemen Admin" untuk superadmin
  if (roleData.role === 'superadmin') {
    if (typeof window.usersInjectNav === 'function') {
      window.usersInjectNav();
    }
  }

  // Log aktivitas login — kirim display_name langsung agar tidak fallback ke 'Admin'
  if (typeof window.logAdminActivity === 'function') {
    window.logAdminActivity('login', 'session', user.id, {
      email:        user.email,
      role:         roleData?.role || '?',
      _adminName:   roleData?.display_name || user.email.split('@')[0],
    });
  }

  await loadAllConfig();
  await loadWAAdmins();

  if (typeof window._idleStartTracking === 'function') window._idleStartTracking();

  // Bug #3 fix: ordersInitBadge didefinisi di admin-orders.js
  if (typeof window.ordersInitBadge === 'function') {
    window.ordersInitBadge();
  }

  // Subscribe realtime orders
  if (typeof window.ordersSubscribe === 'function') {
    window.ordersSubscribe();
  }

  // Badge permintaan akses untuk superadmin
  if (roleData.role === 'superadmin') {
    if (typeof window.mgrUpdateBadge === 'function') {
      window.mgrUpdateBadge();
    } else {
      loadAccessRequestBadge();
    }
  }

  // Bug #6 fix: HAPUS background financeV2Init — chart canvas punya width=0 saat section hidden
  // Finance V2 akan di-init saat user klik menu "Manajemen Keuangan"
}

async function doLogout() {
  if (typeof window._idleStopTracking === 'function') window._idleStopTracking();

  // Log aktivitas logout
  if (typeof window.logAdminActivity === 'function' && window.currentUser) {
    window.logAdminActivity('logout', 'session', window.currentUser.id, {
      email:      window.currentUser.email,
      _adminName: window.currentRole?.display_name || window.currentUser.email.split('@')[0],
    });
  }

  await sb.auth.signOut();
  location.reload();
}

function goToMain() { window.location.href = '../index.html'; }

// ==================== SELF REGISTER (REQUEST ACCESS) ====================
window.doRequestAccess = async function () {
  const email   = document.getElementById('req-email').value.trim();
  const pw      = document.getElementById('req-password').value;
  const pw2     = document.getElementById('req-password2').value;
  const display = document.getElementById('req-display').value.trim();
  const role    = document.getElementById('req-role').value;
  const reason  = document.getElementById('req-reason').value.trim();
  const errEl   = document.getElementById('req-error');
  const errMsg  = document.getElementById('req-error-msg');
  const sucEl   = document.getElementById('req-success');
  const btn     = document.getElementById('req-submit-btn');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!email || !pw || !display) {
    errMsg.textContent = 'Email, password, dan nama tampilan wajib diisi.';
    errEl.style.display = 'flex'; return;
  }
  if (pw.length < 6) {
    errMsg.textContent = 'Password minimal 6 karakter.';
    errEl.style.display = 'flex'; return;
  }
  if (pw !== pw2) {
    errMsg.textContent = 'Konfirmasi password tidak cocok.';
    errEl.style.display = 'flex'; return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim permintaan...';

  try {
    const { data: existing } = await sb
      .from('admin_pending_requests')
      .select('id,status')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        throw new Error('Email ini sudah mengajukan permintaan dan sedang menunggu approval.');
      } else if (existing.status === 'rejected') {
        throw new Error('Permintaan akses dengan email ini sebelumnya ditolak. Hubungi super admin.');
      } else if (existing.status === 'approved') {
        throw new Error('Email ini sudah disetujui. Silakan login.');
      }
    }

    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({ email, password: pw });
    if (signUpErr) throw signUpErr;

    const userId = signUpData?.user?.id;
    if (!userId) throw new Error('Gagal mendapatkan user ID setelah registrasi.');

    const { error: insertErr } = await sb.from('admin_pending_requests').insert({
      user_id:      userId,
      email,
      display_name: display,
      reason:       reason || null,
      status:       'pending',
    });
    if (insertErr) throw insertErr;

    sucEl.style.display = 'flex';
    ['req-email','req-password','req-password2','req-display','req-reason'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  } catch (e) {
    errMsg.textContent = e.message || 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = 'flex';
  }

  btn.disabled = false;
  btn.textContent = 'Kirim Permintaan Akses';
};

// ==================== BADGE PERMINTAAN AKSES (legacy fallback) ====================
async function loadAccessRequestBadge() {
  const { count } = await sb
    .from('admin_pending_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const badge = document.getElementById('access-req-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}
window.loadAccessRequestBadge = loadAccessRequestBadge;

// ==================== APPROVE / REJECT — DELEGATE KE admin-users.js ====================
window.approveRequest = function (id) {
  if (typeof window._mgrApprove === 'function') {
    window._mgrApprove(id);
  } else {
    showAdminToast('Sistem manajemen belum siap. Refresh halaman.', 'error');
  }
};

window.rejectRequest = function (id) {
  if (typeof window._mgrReject === 'function') {
    window._mgrReject(id);
  } else {
    showAdminToast('Sistem manajemen belum siap. Refresh halaman.', 'error');
  }
};

// ==================== LOAD DAFTAR PERMINTAAN AKSES (legacy — compat) ====================
window.loadAccessRequests = async function () {
  if (typeof window._mgrLoadRequests === 'function') {
    window._mgrLoadRequests();
    return;
  }

  const container = document.getElementById('access-requests-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat data...</div>';

  const { data, error } = await sb
    .from('admin_pending_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    container.innerHTML = '<div class="empty-state">Tidak ada permintaan akses.</div>';
    return;
  }

  const statusColor = { pending:'#f4c430', approved:'#4ade80', rejected:'#f87171' };
  const statusLabel = { pending:'⏳ Menunggu', approved:'✅ Disetujui', rejected:'❌ Ditolak' };

  container.innerHTML = data.map(r => `
    <div class="req-card" id="req-card-${r.id}">
      <div class="req-card-info">
        <div class="req-card-name">${escHtml(r.display_name)}</div>
        <div class="req-card-email">${escHtml(r.email)}</div>
        <div class="req-card-meta">
          <span class="req-role-badge">${escHtml(r.role || '-')}</span>
          <span style="font-size:11px;color:${statusColor[r.status]||'#888'}">
            ${statusLabel[r.status]||r.status}
          </span>
          <span style="font-size:11px;color:var(--text-faint)">
            ${new Date(r.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
          </span>
        </div>
        ${r.reason ? `<div class="req-card-reason">"${escHtml(r.reason)}"</div>` : ''}
      </div>
      ${r.status === 'pending' ? `
        <div class="req-card-actions">
          <button class="btn-approve" onclick="approveRequest('${r.id}')">✓ Setujui</button>
          <button class="btn-reject"  onclick="rejectRequest('${r.id}')">✗ Tolak</button>
        </div>
      ` : ''}
    </div>
  `).join('');
};

// ==================== LEGACY ====================
function toggleRegisterForm() {
  const form = document.getElementById('register-form-wrap');
  const btn  = document.getElementById('toggle-register-btn');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.textContent = isOpen ? '+ Daftarkan Admin Baru' : '− Tutup Form';
}
