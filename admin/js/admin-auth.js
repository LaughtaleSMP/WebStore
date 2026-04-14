// ==================== TAB SWITCHER ====================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  const tabBtn = document.getElementById('tab-' + tab + '-btn');
  const panel  = document.getElementById('panel-' + tab);
  if (tabBtn) tabBtn.classList.add('active');
  if (panel)  panel.classList.add('active');
}
window.switchAuthTab = switchAuthTab;

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

  // Tampilkan menu Permintaan Akses hanya untuk superadmin
  const reqNavItem = document.getElementById('nav-access-requests');
  if (reqNavItem) {
    reqNavItem.style.display = (roleData.role === 'superadmin') ? 'flex' : 'none';
  }

  await loadAllConfig();
  await loadWAAdmins();

  if (typeof window._idleStartTracking === 'function') {
    window._idleStartTracking();
  }
  if (typeof window.ordersInitBadge === 'function') {
    window.ordersInitBadge();
  }

  // Load badge permintaan akses jika superadmin
  if (roleData.role === 'superadmin') {
    loadAccessRequestBadge();
  }
}

async function doLogout() {
  if (typeof window._idleStopTracking === 'function') {
    window._idleStopTracking();
  }
  await sb.auth.signOut();
  location.reload();
}

function goToMain() { window.location.href = '../index.html'; }

// ==================== SELF REGISTER (REQUEST ACCESS) ====================
window.doRequestAccess = async function() {
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
    // Cek apakah email sudah ada di pending requests
    const { data: existing } = await sb.from('admin_requests')
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

    const { error: insertErr } = await sb.from('admin_requests').insert({
      email,
      display_name: display,
      role,
      reason: reason || null,
      status: 'pending',
      password_temp: pw,
    });

    if (insertErr) throw insertErr;

    sucEl.style.display = 'flex';
    document.getElementById('req-email').value = '';
    document.getElementById('req-password').value = '';
    document.getElementById('req-password2').value = '';
    document.getElementById('req-display').value = '';
    document.getElementById('req-reason').value = '';

  } catch(e) {
    errMsg.textContent = e.message || 'Terjadi kesalahan. Coba lagi.';
    errEl.style.display = 'flex';
  }

  btn.disabled = false;
  btn.textContent = 'Kirim Permintaan Akses';
};

// ==================== BADGE PERMINTAAN AKSES ====================
async function loadAccessRequestBadge() {
  const { count } = await sb.from('admin_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const badge = document.getElementById('access-req-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}
window.loadAccessRequestBadge = loadAccessRequestBadge;

// ==================== LOAD DAFTAR PERMINTAAN AKSES ====================
window.loadAccessRequests = async function() {
  const container = document.getElementById('access-requests-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat data...</div>';

  const { data, error } = await sb.from('admin_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = '<div class="empty-state">Tidak ada permintaan akses.</div>';
    return;
  }

  const statusColor = { pending: '#f4c430', approved: '#4ade80', rejected: '#f87171' };
  const statusLabel = { pending: '⏳ Menunggu', approved: '✅ Disetujui', rejected: '❌ Ditolak' };

  container.innerHTML = data.map(r => `
    <div class="req-card" id="req-card-${r.id}" style="
      background:var(--surface2,#1a1a2e);
      border:1px solid var(--border,rgba(255,255,255,0.08));
      border-radius:12px;
      padding:16px 18px;
      margin-bottom:12px;
      display:flex;
      align-items:center;
      gap:16px;
      flex-wrap:wrap;
    ">
      <div style="flex:1;min-width:200px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-main,#e8e8f0);margin-bottom:2px;">
          ${escHtml(r.display_name)}
        </div>
        <div style="font-size:12px;color:var(--text-faint,#666);margin-bottom:4px;">${escHtml(r.email)}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:11px;background:var(--surface3,#252540);padding:2px 8px;border-radius:20px;color:var(--text-sub,#a0a0b8);">
            ${escHtml(r.role)}
          </span>
          <span style="font-size:11px;color:${statusColor[r.status] || '#888'}">
            ${statusLabel[r.status] || r.status}
          </span>
          <span style="font-size:11px;color:var(--text-faint,#555);">
            ${new Date(r.created_at).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})}
          </span>
        </div>
        ${r.reason ? `<div style="font-size:12px;color:var(--text-sub,#a0a0b8);margin-top:6px;font-style:italic;">"${escHtml(r.reason)}"</div>` : ''}
      </div>
      ${r.status === 'pending' ? `
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button onclick="approveRequest('${r.id}')"
            style="padding:7px 16px;border-radius:8px;
                   background:rgba(74,222,128,0.15);color:#4ade80;
                   font-size:12px;font-weight:600;cursor:pointer;
                   border:1px solid rgba(74,222,128,0.25);transition:all .18s;"
            onmouseover="this.style.background='rgba(74,222,128,0.25)'"
            onmouseout="this.style.background='rgba(74,222,128,0.15)'">
            ✓ Setujui
          </button>
          <button onclick="rejectRequest('${r.id}')"
            style="padding:7px 16px;border-radius:8px;
                   background:rgba(248,113,113,0.12);color:#f87171;
                   font-size:12px;font-weight:600;cursor:pointer;
                   border:1px solid rgba(248,113,113,0.25);transition:all .18s;"
            onmouseover="this.style.background='rgba(248,113,113,0.22)'"
            onmouseout="this.style.background='rgba(248,113,113,0.12)'">
            ✗ Tolak
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
};

// ==================== APPROVE REQUEST ====================
window.approveRequest = async function(id) {
  const { data: r, error: fetchErr } = await sb.from('admin_requests').select('*').eq('id', id).single();
  if (fetchErr || !r) { showAdminToast('Data tidak ditemukan', 'error'); return; }

  const card = document.getElementById('req-card-' + id);
  if (card) card.style.opacity = '0.5';

  try {
    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
      email: r.email,
      password: r.password_temp,
    });
    if (signUpErr) throw signUpErr;

    const userId = signUpData?.user?.id;
    if (!userId) throw new Error('Gagal mendapatkan user ID.');

    const { error: roleErr } = await sb.from('admin_roles').insert({
      user_id: userId,
      role: r.role,
      display_name: r.display_name,
    });
    if (roleErr) throw roleErr;

    await sb.from('admin_requests').update({
      status: 'approved',
      approved_by: currentUser?.id || null,
      approved_at: new Date().toISOString(),
      password_temp: null,
    }).eq('id', id);

    showAdminToast(`✅ ${r.display_name} (${r.email}) berhasil disetujui!`);
    await loadAccessRequests();
    await loadAccessRequestBadge();

  } catch(e) {
    if (card) card.style.opacity = '1';
    showAdminToast('Gagal menyetujui: ' + (e.message || 'Error tidak diketahui'), 'error');
  }
};

// ==================== REJECT REQUEST ====================
window.rejectRequest = async function(id) {
  if (!confirm('Yakin ingin menolak permintaan ini?')) return;

  const { error } = await sb.from('admin_requests').update({
    status: 'rejected',
    password_temp: null,
  }).eq('id', id);

  if (error) {
    showAdminToast('Gagal menolak permintaan', 'error');
  } else {
    showAdminToast('Permintaan ditolak.');
    await loadAccessRequests();
    await loadAccessRequestBadge();
  }
};

// ==================== LEGACY ====================
function toggleRegisterForm() {
  const form = document.getElementById('register-form-wrap');
  const btn  = document.getElementById('toggle-register-btn');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '+ Daftarkan Admin Baru' : '− Tutup Form';
}
