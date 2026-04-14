/* ════════════════════════════════════════════════════════════════
   admin-users.js — Manajemen Admin (Super Admin Only)
   
   FIX UTAMA vs versi lama:
   • signUp() dilakukan via sbTemp (non-persistent client) sehingga
     session super admin yang sedang login TIDAK ter-replace / logout.
   • Semua approve/reject dipusatkan di sini; admin-auth.js cukup delegate.
   • Better error handling + loading state di setiap tombol.
   
   Tabel yang dipakai:
   • admin_roles            → daftar user yang punya akses panel
   • admin_pending_requests → permintaan akses dari pendaftar baru
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── helpers ── */
  function getSb() { return window._adminSb; }

  /**
   * Buat Supabase client sementara (non-persistent) untuk signUp.
   * Tanpa ini, signUp() akan mengganti session aktif super admin → logout!
   */
  function makeTempClient() {
    if (!window.supabase || !window._supabaseUrl || !window._supabaseKey) {
      throw new Error('Supabase library atau config belum tersedia.');
    }
    return window.supabase.createClient(
      window._supabaseUrl,
      window._supabaseKey,
      {
        auth: {
          persistSession:      false,
          autoRefreshToken:    false,
          detectSessionInUrl:  false,
          storage: {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
          },
        },
      }
    );
  }

  function generateTempPw() {
    return (
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10) +
      'Aa1!'
    );
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function toast(msg, type = 'success') {
    if (typeof window.showAdminToast === 'function') {
      window.showAdminToast(msg, type); return;
    }
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const c = document.getElementById('toast');
    if (c) { c.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }

  /* ══════════════════════════════════════════════════
     INJECT NAV ITEM (dipanggil setelah login, hanya superadmin)
  ══════════════════════════════════════════════════ */
  window.usersInjectNav = function () {
    if (document.getElementById('nav-manage-admins')) return;

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    let grp = document.getElementById('nav-grp-superadmin');
    if (!grp) {
      grp = document.createElement('div');
      grp.className = 'nav-group-label';
      grp.id = 'nav-grp-superadmin';
      grp.textContent = 'Super Admin';
      sidebar.appendChild(grp);
    }

    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-manage-admins';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      Manajemen Admin
      <span class="nav-badge" id="mgr-req-badge" style="display:none">0</span>`;
    item.onclick = () => showMgrSection(item);
    sidebar.appendChild(item);
  };

  function showMgrSection(el) {
    if (typeof showSection === 'function') {
      showSection('manage-admins', el);
    } else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-manage-admins');
      if (sec) sec.classList.add('active');
      if (el) el.classList.add('active');
      const bc = document.getElementById('topbar-section');
      if (bc) bc.textContent = 'Manajemen Admin';
    }
    mgrLoad();
  }

  /* ══════════════════════════════════════════════════
     INJECT HTML SECTION
  ══════════════════════════════════════════════════ */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-manage-admins')) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-manage-admins';
    sec.innerHTML = `
      <div class="page-header">
        <div class="page-title">Manajemen Admin</div>
        <div class="page-sub">Kelola akses admin panel — setujui pendaftar, edit role, atau cabut akses</div>
      </div>

      <!-- TABS -->
      <div style="display:flex;gap:6px;margin-bottom:1.2rem;flex-wrap:wrap" id="mgr-tabs">
        <button class="scfg-tab active" data-tab="requests" onclick="window._mgrTab('requests',this)">
          📥 Permintaan Akses
          <span id="mgr-tab-req-badge" style="display:none;background:#ef4444;color:#fff;
            font-size:10px;font-weight:700;border-radius:999px;padding:1px 6px;margin-left:4px;">0</span>
        </button>
        <button class="scfg-tab" data-tab="admins" onclick="window._mgrTab('admins',this)">
          👥 Daftar Admin
        </button>
      </div>

      <!-- LOADING -->
      <div id="mgr-loading" style="padding:2rem;color:var(--text-faint);font-size:13px">Memuat data…</div>

      <!-- ══ TAB: REQUESTS ══ -->
      <div id="mgr-tab-requests" class="mgr-tab-content" style="display:none">
        <div class="orders-stats-strip" style="margin-bottom:16px">
          <div class="ostat-card"><div class="ostat-num" id="mgr-stat-pending">—</div><div class="ostat-label">Menunggu</div></div>
          <div class="ostat-card"><div class="ostat-num" id="mgr-stat-approved">—</div><div class="ostat-label">Disetujui</div></div>
          <div class="ostat-card"><div class="ostat-num" id="mgr-stat-rejected">—</div><div class="ostat-label">Ditolak</div></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <select id="mgr-req-filter" onchange="window._mgrLoadRequests()"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                   color:var(--text);padding:6px 12px;font-size:13px;outline:none;">
            <option value="">Semua Status</option>
            <option value="pending">⏳ Menunggu</option>
            <option value="approved">✅ Disetujui</option>
            <option value="rejected">❌ Ditolak</option>
          </select>
          <button class="btn-ghost" style="padding:6px 14px;font-size:12px;margin-left:auto"
            onclick="window._mgrLoadRequests()">⟳ Refresh</button>
        </div>
        <div id="mgr-requests-list"></div>
      </div>

      <!-- ══ TAB: ADMINS ══ -->
      <div id="mgr-tab-admins" class="mgr-tab-content" style="display:none">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <input id="mgr-admin-search" placeholder="🔍 Cari nama atau email…"
            oninput="window._mgrFilterAdmins(this.value)"
            style="flex:1;min-width:180px;background:var(--surface2);border:1px solid var(--border);
                   border-radius:8px;color:var(--text);padding:7px 12px;font-size:13px;outline:none;">
          <button class="btn-ghost" style="padding:6px 14px;font-size:12px"
            onclick="window._mgrLoadAdmins()">⟳ Refresh</button>
        </div>
        <div id="mgr-admins-list"></div>
      </div>

      <!-- ══ EDIT MODAL ══ -->
      <div id="mgr-edit-modal" style="
        display:none;position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);
        align-items:center;justify-content:center;padding:16px;">
        <div style="
          background:var(--surface1,#1a1a2e);border:1px solid var(--border,rgba(255,255,255,0.1));
          border-radius:16px;width:100%;max-width:420px;padding:24px;
          box-shadow:0 24px 64px rgba(0,0,0,0.5);animation:oeditIn .22s ease;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div style="font-size:15px;font-weight:700;color:var(--text)">✏️ Edit Admin</div>
            <button onclick="window._mgrCloseEdit()"
              style="background:none;border:none;color:var(--text-faint);cursor:pointer;
                     font-size:18px;padding:4px 8px;border-radius:6px;transition:color .15s"
              onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-faint)'">✕</button>
          </div>
          <input type="hidden" id="mgr-edit-user-id">
          <div class="oedit-field">
            <label>Nama Tampilan</label>
            <input id="mgr-edit-display" type="text" placeholder="Nama admin…">
          </div>
          <div class="oedit-field" style="margin-top:12px">
            <label>Role</label>
            <select id="mgr-edit-role"
              style="width:100%;box-sizing:border-box;background:var(--surface2);
                     border:1px solid var(--border);border-radius:8px;color:var(--text);
                     font-size:13px;padding:8px 12px;outline:none;font-family:inherit">
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          <div style="font-size:11.5px;color:var(--text-faint);margin-top:8px;line-height:1.5">
            ⚠️ Mengubah role berlaku saat admin tersebut login berikutnya.
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
            <button class="btn-ghost" onclick="window._mgrCloseEdit()"
              style="padding:8px 18px;font-size:13px">Batal</button>
            <button class="save-btn" id="mgr-edit-save-btn" onclick="window._mgrSaveEdit()"
              style="padding:8px 20px;font-size:13px">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    `;

    injectStyles();
    main.appendChild(sec);
    registerGlobals();
  }

  function injectStyles() {
    if (document.getElementById('mgr-styles')) return;
    const s = document.createElement('style');
    s.id = 'mgr-styles';
    s.textContent = `
      .scfg-tab {
        padding:7px 16px;border-radius:20px;font-size:12.5px;
        background:var(--surface2);border:1px solid var(--border);
        color:var(--text-muted);cursor:pointer;transition:all .15s;
      }
      .scfg-tab:hover { color:var(--text);border-color:var(--border3); }
      .scfg-tab.active {
        background:var(--accent-muted);border-color:rgba(79,125,240,.3);color:var(--accent);
      }
      .mgr-req-card {
        background:var(--surface);border:1px solid var(--border);
        border-radius:12px;padding:16px 18px;margin-bottom:10px;
        display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;
        transition:border-color .2s;
      }
      .mgr-req-card:hover { border-color:var(--border2); }
      .mgr-admin-row {
        background:var(--surface);border:1px solid var(--border);
        border-radius:12px;padding:14px 18px;margin-bottom:8px;
        display:flex;align-items:center;gap:14px;flex-wrap:wrap;
        transition:border-color .2s;
      }
      .mgr-admin-row:hover { border-color:var(--border2); }
      .mgr-admin-avatar {
        width:38px;height:38px;border-radius:10px;
        background:var(--accent-muted2);border:1px solid rgba(91,127,244,0.18);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:700;color:var(--accent);
        flex-shrink:0;text-transform:uppercase;
      }
      .mgr-role-pill {
        font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;
        letter-spacing:.4px;text-transform:uppercase;
      }
      .mgr-role-superadmin { background:rgba(168,85,247,.15);color:#c084fc;border:1px solid rgba(168,85,247,.3); }
      .mgr-role-admin      { background:var(--accent-muted);color:var(--accent);border:1px solid rgba(91,127,244,.25); }
      .mgr-role-moderator  { background:rgba(34,197,94,.1);color:#4ade80;border:1px solid rgba(34,197,94,.25); }
      .mgr-status-pending  { background:rgba(250,204,21,.1);color:#facc15;border:1px solid rgba(250,204,21,.25); }
      .mgr-status-approved { background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.25); }
      .mgr-status-rejected { background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25); }
      @media(max-width:600px){
        .mgr-req-card,.mgr-admin-row { flex-direction:column; align-items:flex-start; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════
     GLOBALS
  ══════════════════════════════════════════════════ */
  function registerGlobals() {
    window._mgrTab          = switchTab;
    window._mgrLoad         = mgrLoad;
    window._mgrLoadRequests = loadRequests;
    window._mgrLoadAdmins   = loadAdmins;
    window._mgrFilterAdmins = filterAdmins;
    window._mgrApprove      = approveRequest;
    window._mgrReject       = rejectRequest;
    window._mgrEditOpen     = openEditModal;
    window._mgrCloseEdit    = closeEditModal;
    window._mgrSaveEdit     = saveEdit;
    window._mgrDeleteAdmin  = deleteAdmin;
  }

  /* ══════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════ */
  let currentTab = 'requests';

  function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('#mgr-tabs .scfg-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.mgr-tab-content').forEach(el => (el.style.display = 'none'));
    const el = document.getElementById('mgr-tab-' + tab);
    if (el) el.style.display = 'block';
    if (tab === 'requests') loadRequests();
    if (tab === 'admins')   loadAdmins();
  }

  /* ══════════════════════════════════════════════════
     LOAD ALL
  ══════════════════════════════════════════════════ */
  async function mgrLoad() {
    const loadEl = document.getElementById('mgr-loading');
    if (loadEl) loadEl.style.display = 'block';
    document.querySelectorAll('.mgr-tab-content').forEach(el => (el.style.display = 'none'));

    await loadRequestStats();
    await loadRequests();

    if (loadEl) loadEl.style.display = 'none';
    switchTab(currentTab, document.querySelector(`#mgr-tabs [data-tab="${currentTab}"]`));
  }

  /* ══════════════════════════════════════════════════
     PERMINTAAN AKSES — STATS
  ══════════════════════════════════════════════════ */
  async function loadRequestStats() {
    const sb = getSb();
    if (!sb) return;

    const statuses = ['pending', 'approved', 'rejected'];
    for (const status of statuses) {
      const { count } = await sb
        .from('admin_pending_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      const el = document.getElementById('mgr-stat-' + status);
      if (el) el.textContent = count ?? '—';
    }

    const { count: pendingCount } = await sb
      .from('admin_pending_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    updatePendingBadge(pendingCount || 0);
  }

  function updatePendingBadge(n) {
    [
      document.getElementById('mgr-req-badge'),
      document.getElementById('mgr-tab-req-badge'),
    ].forEach(b => {
      if (!b) return;
      b.textContent = n;
      b.style.display = n > 0 ? 'inline-flex' : 'none';
    });
  }

  /* ══════════════════════════════════════════════════
     PERMINTAAN AKSES — LIST
  ══════════════════════════════════════════════════ */
  async function loadRequests() {
    const sb = getSb();
    if (!sb) return;

    const container = document.getElementById('mgr-requests-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat…</div>';

    const filter = document.getElementById('mgr-req-filter')?.value || '';
    let q = sb.from('admin_pending_requests').select('*').order('created_at', { ascending: false });
    if (filter) q = q.eq('status', filter);

    const { data, error } = await q;
    await loadRequestStats();

    if (error) {
      container.innerHTML = `<div class="empty-state" style="color:#f87171">Gagal memuat: ${esc(error.message)}</div>`;
      return;
    }
    if (!data || !data.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada permintaan akses ditemukan.</div>';
      return;
    }

    const statusLabel = { pending:'⏳ Menunggu', approved:'✅ Disetujui', rejected:'❌ Ditolak' };
    const statusCls   = { pending:'mgr-status-pending', approved:'mgr-status-approved', rejected:'mgr-status-rejected' };

    container.innerHTML = data.map(r => `
      <div class="mgr-req-card" id="mgr-req-${r.id}">
        <div class="mgr-admin-avatar" style="width:44px;height:44px;border-radius:12px;font-size:16px">
          ${esc((r.display_name || '?')[0]).toUpperCase()}
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px">
            ${esc(r.display_name || '(tanpa nama)')}
          </div>
          <div style="font-size:12px;color:var(--text-faint);margin-bottom:6px">${esc(r.email)}</div>
          <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
            <span class="mgr-role-pill ${statusCls[r.status]||''}">${statusLabel[r.status]||esc(r.status)}</span>
            <span style="font-size:11px;color:var(--text-faint)">
              ${new Date(r.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
            </span>
          </div>
          ${r.reason ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;
              font-style:italic;border-left:3px solid var(--border2);padding-left:8px">
              "${esc(r.reason)}"</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;align-items:center;flex-wrap:wrap">
          ${r.status === 'pending' ? `
            <button id="btn-approve-${r.id}"
              onclick="window._mgrApprove('${r.id}')"
              style="padding:7px 16px;border-radius:8px;background:rgba(74,222,128,.15);
                     color:#4ade80;font-size:12px;font-weight:600;cursor:pointer;
                     border:1px solid rgba(74,222,128,.25);transition:background .15s;font-family:inherit"
              onmouseover="this.style.background='rgba(74,222,128,.25)'"
              onmouseout="this.style.background='rgba(74,222,128,.15)'">✓ Setujui</button>
            <button id="btn-reject-${r.id}"
              onclick="window._mgrReject('${r.id}')"
              style="padding:7px 16px;border-radius:8px;background:rgba(248,113,113,.12);
                     color:#f87171;font-size:12px;font-weight:600;cursor:pointer;
                     border:1px solid rgba(248,113,113,.25);transition:background .15s;font-family:inherit"
              onmouseover="this.style.background='rgba(248,113,113,.22)'"
              onmouseout="this.style.background='rgba(248,113,113,.12)'">✗ Tolak</button>
          ` : r.status === 'rejected' ? `
            <button id="btn-approve-${r.id}"
              onclick="window._mgrApprove('${r.id}')"
              style="padding:6px 14px;border-radius:8px;background:rgba(91,127,244,.1);
                     color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;
                     border:1px solid rgba(91,127,244,.25);transition:background .15s;font-family:inherit"
              onmouseover="this.style.background='rgba(91,127,244,.2)'"
              onmouseout="this.style.background='rgba(91,127,244,.1)'">↩ Setujui Ulang</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  /* ══════════════════════════════════════════════════
     APPROVE REQUEST
  ══════════════════════════════════════════════════ */
  async function approveRequest(reqId) {
    const sb = getSb();
    if (!sb) return;

    const approveBtn = document.getElementById('btn-approve-' + reqId);
    const rejectBtn  = document.getElementById('btn-reject-' + reqId);
    if (approveBtn) { approveBtn.disabled = true; approveBtn.textContent = '⏳ Memproses…'; }
    if (rejectBtn)  rejectBtn.disabled = true;

    const card = document.getElementById('mgr-req-' + reqId);
    if (card) card.style.opacity = '0.6';

    try {
      // 1. Ambil data request dari admin_pending_requests
      const { data: r, error: fetchErr } = await sb
        .from('admin_pending_requests')
        .select('*')
        .eq('id', reqId)
        .single();

      if (fetchErr || !r) throw new Error('Data permintaan tidak ditemukan.');
      if (!r.email)       throw new Error('Email pendaftar tidak tersedia di data request.');

      let userId = r.user_id || null;

      // 2. Jika belum punya user_id, buat akun Supabase Auth baru
      if (!userId) {
        const password = generateTempPw();

        let sbTemp;
        try {
          sbTemp = makeTempClient();
        } catch (clientErr) {
          throw new Error('Gagal inisialisasi client: ' + clientErr.message);
        }

        const { data: signUpData, error: signUpErr } = await sbTemp.auth.signUp({
          email:    r.email,
          password: password,
        });

        if (signUpErr) {
          if (signUpErr.message?.toLowerCase().includes('already registered')) {
            const { data: existingRoleByEmail } = await sb
              .from('admin_roles')
              .select('user_id')
              .eq('email', r.email)
              .maybeSingle();
            if (existingRoleByEmail?.user_id) {
              userId = existingRoleByEmail.user_id;
            } else {
              throw new Error(
                'Email sudah terdaftar di Supabase Auth tapi tidak ditemukan di admin_roles. ' +
                'Hubungi super admin untuk mengurus manual.'
              );
            }
          } else {
            throw signUpErr;
          }
        } else {
          userId = signUpData?.user?.id;
          if (!userId) {
            throw new Error(
              'Gagal mendapatkan user ID setelah signUp. ' +
              'Pastikan "Email Confirmations" DINONAKTIFKAN di Supabase Auth → Settings.'
            );
          }
        }

        // Simpan user_id ke tabel request
        await sb.from('admin_pending_requests').update({ user_id: userId }).eq('id', reqId);
      }

      // 3. Cek apakah sudah ada di admin_roles
      const { data: existingRole } = await sb
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        const { error: updateErr } = await sb
          .from('admin_roles')
          .update({ display_name: r.display_name })
          .eq('user_id', userId);
        if (updateErr) throw new Error('Gagal update role: ' + updateErr.message);
      } else {
        const { error: roleErr } = await sb.from('admin_roles').insert({
          user_id:      userId,
          role:         'admin',
          display_name: r.display_name,
        });
        if (roleErr) throw new Error('Gagal tambah ke admin_roles: ' + roleErr.message);
      }

      // 4. Update status request → approved
      const { error: updateReqErr } = await sb.from('admin_pending_requests').update({
        status:      'approved',
        reviewed_at: new Date().toISOString(),
      }).eq('id', reqId);
      if (updateReqErr) throw new Error('Gagal update status: ' + updateReqErr.message);

      toast(`✅ ${r.display_name} (${r.email}) berhasil disetujui!`);
      await loadRequests();

    } catch (e) {
      if (card) card.style.opacity = '1';
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.textContent = '✓ Setujui';
      }
      if (rejectBtn) rejectBtn.disabled = false;

      console.error('[mgrApprove] Error:', e);
      toast('Gagal menyetujui: ' + (e.message || 'Error tidak diketahui'), 'error');
    }
  }

  /* ══════════════════════════════════════════════════
     REJECT REQUEST
  ══════════════════════════════════════════════════ */
  async function rejectRequest(reqId) {
    const sb = getSb();
    if (!sb) return;

    const { data: r } = await sb
      .from('admin_pending_requests')
      .select('display_name')
      .eq('id', reqId)
      .single();

    showMgrConfirm({
      title:       'Tolak Permintaan?',
      message:     `Permintaan akses dari <strong>${esc(r?.display_name || '?')}</strong> akan ditolak.`,
      confirmText: '✗ Ya, Tolak',
      danger:      true,
      onConfirm:   async () => {
        const rejectBtn = document.getElementById('btn-reject-' + reqId);
        if (rejectBtn) { rejectBtn.disabled = true; rejectBtn.textContent = '⏳…'; }

        const { error } = await sb.from('admin_pending_requests').update({
          status:      'rejected',
          reviewed_at: new Date().toISOString(),
        }).eq('id', reqId);

        if (error) {
          toast('Gagal menolak: ' + error.message, 'error');
          if (rejectBtn) { rejectBtn.disabled = false; rejectBtn.textContent = '✗ Tolak'; }
          return;
        }
        toast('Permintaan ditolak.');
        await loadRequests();
      },
    });
  }

  /* ══════════════════════════════════════════════════
     DAFTAR ADMIN
  ══════════════════════════════════════════════════ */
  let allAdmins = [];

  async function loadAdmins() {
    const sb = getSb();
    if (!sb) return;

    const container = document.getElementById('mgr-admins-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat…</div>';

    const { data, error } = await sb
      .from('admin_roles')
      .select('*')
      .order('role', { ascending: true });

    if (error) {
      container.innerHTML = `<div class="empty-state" style="color:#f87171">Gagal memuat: ${esc(error.message)}</div>`;
      return;
    }

    allAdmins = data || [];
    renderAdminList(allAdmins);
  }

  function filterAdmins(q) {
    if (!q.trim()) { renderAdminList(allAdmins); return; }
    const lq = q.toLowerCase();
    renderAdminList(allAdmins.filter(a =>
      (a.display_name || '').toLowerCase().includes(lq) ||
      (a.email        || '').toLowerCase().includes(lq) ||
      (a.role         || '').toLowerCase().includes(lq)
    ));
  }

  function renderAdminList(list) {
    const container = document.getElementById('mgr-admins-list');
    if (!container) return;

    const me = window.currentUser?.id;

    if (!list.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada admin ditemukan.</div>';
      return;
    }

    const roleOrder = { superadmin: 0, admin: 1, moderator: 2 };
    const sorted = [...list].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

    container.innerHTML = sorted.map(a => {
      const isMe = a.user_id === me;
      const initials = (a.display_name || a.email || '?')[0].toUpperCase();
      const avatarColor = a.role === 'superadmin'
        ? 'background:rgba(168,85,247,.15);border-color:rgba(168,85,247,.25);color:#c084fc'
        : a.role === 'moderator'
        ? 'background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.25);color:#4ade80'
        : 'background:var(--accent-muted2);border-color:rgba(91,127,244,.2);color:var(--accent)';

      const adminDataStr = esc(JSON.stringify({
        user_id:      a.user_id,
        id:           a.id,
        display_name: a.display_name,
        role:         a.role,
        email:        a.email,
      }));

      return `
        <div class="mgr-admin-row" id="mgr-admin-${a.user_id}">
          <div class="mgr-admin-avatar" style="${avatarColor}">${initials}</div>
          <div style="flex:1;min-width:160px">
            <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:2px">
              ${esc(a.display_name || '(tanpa nama)')}
              ${isMe ? '<span style="font-size:10px;color:var(--text-faint);font-weight:400;margin-left:5px">(kamu)</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text-faint);margin-bottom:5px">${esc(a.email || '—')}</div>
            <span class="mgr-role-pill mgr-role-${esc(a.role)}">${esc(a.role)}</span>
          </div>
          <div style="font-size:11px;color:var(--text-faint);text-align:right;min-width:80px">
            ${a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn-edit"
              onclick="window._mgrEditOpen('${adminDataStr}')"
              title="Edit admin">✏️ Edit</button>
            ${!isMe ? `
              <button class="btn-del"
                onclick="window._mgrDeleteAdmin('${esc(a.user_id)}','${esc(a.display_name || a.email || '')}')"
                title="Hapus akses">🗑</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════════════════
     EDIT ADMIN
  ══════════════════════════════════════════════════ */
  function openEditModal(adminDataRaw) {
    let a;
    try {
      a = typeof adminDataRaw === 'string' ? JSON.parse(adminDataRaw) : adminDataRaw;
    } catch (e) {
      toast('Gagal membuka form edit.', 'error');
      return;
    }

    document.getElementById('mgr-edit-user-id').value = a.user_id || '';
    document.getElementById('mgr-edit-display').value = a.display_name || '';
    document.getElementById('mgr-edit-role').value    = a.role || 'admin';

    const modal = document.getElementById('mgr-edit-modal');
    modal.style.display = 'flex';

    setTimeout(() => {
      const inp = document.getElementById('mgr-edit-display');
      if (inp) inp.focus();
    }, 50);
  }

  function closeEditModal() {
    const modal = document.getElementById('mgr-edit-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveEdit() {
    const sb = getSb();
    if (!sb) return;

    const userId      = document.getElementById('mgr-edit-user-id').value;
    const displayName = document.getElementById('mgr-edit-display').value.trim();
    const role        = document.getElementById('mgr-edit-role').value;

    if (!displayName) { toast('Nama tampilan tidak boleh kosong.', 'error'); return; }
    if (!userId)      { toast('User ID tidak ditemukan.', 'error'); return; }

    const btn = document.getElementById('mgr-edit-save-btn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    const { error } = await sb
      .from('admin_roles')
      .update({ display_name: displayName, role })
      .eq('user_id', userId);

    btn.disabled = false;
    btn.textContent = 'Simpan Perubahan';

    if (error) { toast('Gagal simpan: ' + error.message, 'error'); return; }

    toast('Data admin berhasil diperbarui ✅');
    closeEditModal();
    await loadAdmins();
  }

  /* ══════════════════════════════════════════════════
     DELETE ADMIN
  ══════════════════════════════════════════════════ */
  function deleteAdmin(userId, displayName) {
    showMgrConfirm({
      title:       'Cabut Akses Admin?',
      message:     `Akses panel untuk <strong>${esc(displayName)}</strong> akan dicabut. Mereka tidak bisa login lagi ke panel.`,
      confirmText: '🗑️ Ya, Cabut Akses',
      danger:      true,
      onConfirm:   async () => {
        const sb = getSb();
        if (!sb) { toast('Supabase belum siap.', 'error'); return; }

        const { error } = await sb.from('admin_roles').delete().eq('user_id', userId);
        if (error) { toast('Gagal hapus: ' + error.message, 'error'); return; }

        const row = document.getElementById('mgr-admin-' + userId);
        if (row) {
          row.style.transition = 'opacity .3s, transform .3s';
          row.style.opacity    = '0';
          row.style.transform  = 'translateX(20px)';
          setTimeout(() => row.remove(), 320);
        }

        allAdmins = allAdmins.filter(a => a.user_id !== userId);
        toast('Akses admin berhasil dicabut.');
      },
    });
  }

  /* ══════════════════════════════════════════════════
     CUSTOM CONFIRM DIALOG
  ══════════════════════════════════════════════════ */
  function showMgrConfirm({ title, message, confirmText, danger = false, onConfirm }) {
    const old = document.getElementById('mgr-confirm-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mgr-confirm-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '10000',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: '16px',
      opacity: '0', transition: 'opacity .18s',
    });

    const confirmColor  = danger ? 'rgba(239,68,68,.85)' : 'var(--accent)';
    const confirmBorder = danger ? 'rgba(239,68,68,.4)'  : 'rgba(91,127,244,.4)';

    overlay.innerHTML = `
      <div id="mgr-confirm-box"
        style="background:var(--surface1,#1a1a2e);border:1px solid rgba(255,255,255,.1);
               border-radius:14px;width:100%;max-width:360px;padding:24px;
               box-shadow:0 20px 60px rgba(0,0,0,.5);
               transform:scale(.94) translateY(12px);
               transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .18s;opacity:0">
        <div style="font-size:15px;font-weight:700;color:var(--text,#fff);margin-bottom:8px">${title}</div>
        <div style="font-size:13px;color:var(--text-faint,#888);line-height:1.55;margin-bottom:20px">${message}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="mgr-cc-cancel"
            style="padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;
                   background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
                   color:var(--text-muted,#ccc);cursor:pointer;font-family:inherit">Batal</button>
          <button id="mgr-cc-confirm"
            style="padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;
                   background:${confirmColor};border:1px solid ${confirmBorder};
                   color:#fff;cursor:pointer;font-family:inherit">${confirmText || 'Ya'}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        const box = document.getElementById('mgr-confirm-box');
        if (box) { box.style.opacity = '1'; box.style.transform = 'scale(1) translateY(0)'; }
      });
    });

    function closeConfirm() {
      const box = document.getElementById('mgr-confirm-box');
      if (box) { box.style.opacity = '0'; box.style.transform = 'scale(.94) translateY(12px)'; }
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 220);
    }

    document.getElementById('mgr-cc-cancel').onclick  = closeConfirm;
    document.getElementById('mgr-cc-confirm').onclick = () => { closeConfirm(); onConfirm && onConfirm(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });

    function onKey(e) {
      if (e.key === 'Escape') { closeConfirm(); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
  }

  /* ══════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectSection();

    const editModal = document.getElementById('mgr-edit-modal');
    if (editModal) {
      editModal.addEventListener('click', function (e) {
        if (e.target === this) closeEditModal();
      });
    }

    const _orig = window.showSection;
    window.showSection = function (name, el) {
      _orig && _orig(name, el);
      if (name === 'manage-admins') mgrLoad();
    };
  });

  /* Expose badge updater — dipanggil dari admin-auth.js setelah login */
  window.mgrUpdateBadge = async function () {
    const sb = getSb();
    if (!sb) return;
    const { count } = await sb
      .from('admin_pending_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    updatePendingBadge(count || 0);
  };

})();
