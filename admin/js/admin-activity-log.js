/* ================================================================
   admin-activity-log.js — Log Aktivitas Admin
   Laughtale SMP Admin Panel

   Tabel: admin_activity_log
     id, admin_user_id, admin_name, action, target_type,
     target_id, details (jsonb), created_at

   Global yang di-expose:
     window.logAdminActivity(action, targetType, targetId, details)
================================================================ */
(function () {
  'use strict';

  function getSb() { return window._adminSb; }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (typeof window.showAdminToast === 'function') window.showAdminToast(msg, type || 'success');
  }

  /* ══════════════════════════════════════════════════════════
     HELPER: resolve nama + id admin yang sedang login
     — coba window.currentUser/currentRole dulu
     — kalau null (timing issue), ambil ulang dari sb.auth.getUser()
  ══════════════════════════════════════════════════════════ */
  async function _resolveAdmin() {
    let user     = window.currentUser  || null;
    let roleData = window.currentRole  || null;

    // Kalau currentUser belum ada, ambil dari Supabase auth langsung
    if (!user) {
      const sb = getSb();
      if (sb) {
        try {
          const { data } = await sb.auth.getUser();
          user = data?.user || null;
        } catch (e) { /* noop */ }
      }
    }

    // Prioritas nama:
    //   1. currentRole.display_name
    //   2. user_metadata.display_name
    //   3. user_metadata.full_name
    //   4. prefix email (sebelum @)
    //   5. email penuh
    const name =
      roleData?.display_name                          ||
      user?.user_metadata?.display_name              ||
      user?.user_metadata?.full_name                 ||
      (user?.email ? user.email.split('@')[0] : null) ||
      user?.email                                    ||
      null;

    return { user, name };
  }

  /* ══════════════════════════════════════════════════════════
     GLOBAL: log satu aksi ke tabel
     Dipanggil dari admin-orders.js, admin-shop.js, dll.

     Prioritas nama admin:
       1. details._adminName  (dikirim langsung dari caller — paling akurat)
       2. window.currentRole?.display_name
       3. user_metadata.display_name / full_name
       4. prefix email
       5. email penuh
       (tidak ada lagi fallback string 'Admin' / 'admin')
  ══════════════════════════════════════════════════════════ */
  window.logAdminActivity = async function (action, targetType, targetId, details) {
    const sb = getSb();
    if (!sb) return;

    // Resolve siapa yang login
    const { user, name: resolvedName } = await _resolveAdmin();

    // Prioritas 1: _adminName yang dikirim dari caller
    const adminName = (details && details._adminName) || resolvedName || '(unknown)';

    // Bersihkan _adminName dari details sebelum disimpan ke DB
    let cleanDetails = details ? { ...details } : null;
    if (cleanDetails && cleanDetails._adminName) delete cleanDetails._adminName;
    if (cleanDetails && Object.keys(cleanDetails).length === 0) cleanDetails = null;

    const adminId = user?.id || null;

    try {
      await sb.from('admin_activity_log').insert([{
        admin_user_id: adminId,
        admin_name:    adminName,
        action:        action,
        target_type:   targetType   || null,
        target_id:     targetId != null ? String(targetId) : null,
        details:       cleanDetails || null,
      }]);
    } catch (e) {
      console.warn('[ActivityLog] Gagal mencatat log:', e.message);
    }
  };

  /* ══════════════════════════════════════════════════════════
     INJECT NAV
  ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectSection();
  });

  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('nav-activity-log')) return;

    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-activity-log';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      Log Aktivitas`;
    item.onclick = () => {
      if (typeof showSection === 'function') showSection('activity-log', item);
      loadActivityLog();
    };

    /* Sisipkan setelah nav-finance-v2 jika ada */
    const anchor = document.getElementById('nav-finance-v2');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(item, anchor.nextSibling);
    } else {
      sidebar.appendChild(item);
    }
  }

  /* ══════════════════════════════════════════════════════════
     INJECT SECTION HTML
  ══════════════════════════════════════════════════════════ */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-activity-log')) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-activity-log';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Log Aktivitas Admin</div>
          <div class="page-sub">Rekam jejak semua aksi yang dilakukan di admin panel — untuk keperluan audit</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-ghost" style="font-size:12px;padding:6px 13px" onclick="window._alLoad()">&#8635; Refresh</button>
          <button class="btn-ghost" style="font-size:12px;padding:6px 13px;color:#f87171;border-color:rgba(248,113,113,.3)" onclick="window._alClear()">&#128465; Hapus Log Lama</button>
        </div>
      </div>

      <!-- Stats strip -->
      <div class="orders-stats-strip" style="margin-bottom:16px">
        <div class="ostat-card"><div class="ostat-num" id="al-stat-total">—</div><div class="ostat-label">Total Log</div></div>
        <div class="ostat-card"><div class="ostat-num" id="al-stat-today">—</div><div class="ostat-label">Hari Ini</div></div>
        <div class="ostat-card"><div class="ostat-num" id="al-stat-admins">—</div><div class="ostat-label">Admin Aktif</div></div>
      </div>

      <!-- Filter bar -->
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:14px;
                  background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;">
        <label style="font-size:11px;font-weight:600;color:var(--text-faint)">Aksi:</label>
        <select id="al-filter-action" onchange="window._alLoad()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                 color:var(--text);padding:5px 9px;font-size:12px;outline:none;font-family:inherit">
          <option value="">Semua Aksi</option>
          <option value="order_done">✅ Order Selesai</option>
          <option value="order_delete">🗑 Hapus Order</option>
          <option value="order_edit">✏️ Edit Order</option>
          <option value="item_create">➕ Tambah Item</option>
          <option value="item_edit">✏️ Edit Item</option>
          <option value="item_delete">🗑 Hapus Item</option>
          <option value="admin_approve">✅ Approve Admin</option>
          <option value="admin_reject">❌ Tolak Admin</option>
          <option value="admin_delete">🗑 Hapus Admin</option>
          <option value="config_save">💾 Simpan Config</option>
          <option value="login">🔑 Login</option>
        </select>
        <label style="font-size:11px;font-weight:600;color:var(--text-faint)">Admin:</label>
        <input id="al-filter-admin" placeholder="Nama admin…" oninput="window._alLoad()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                 color:var(--text);padding:5px 9px;font-size:12px;outline:none;min-width:120px">
        <label style="font-size:11px;font-weight:600;color:var(--text-faint)">Dari:</label>
        <input type="date" id="al-filter-from" onchange="window._alLoad()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                 color:var(--text);padding:5px 9px;font-size:12px;outline:none;color-scheme:dark">
        <label style="font-size:11px;font-weight:600;color:var(--text-faint)">Sampai:</label>
        <input type="date" id="al-filter-to" onchange="window._alLoad()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                 color:var(--text);padding:5px 9px;font-size:12px;outline:none;color-scheme:dark">
      </div>

      <!-- List container -->
      <div id="al-list"><div class="empty-state">Memuat log aktivitas…</div></div>
    `;

    injectStyles();
    main.appendChild(sec);
    registerGlobals();
  }

  function injectStyles() {
    if (document.getElementById('al-styles')) return;
    const s = document.createElement('style');
    s.id = 'al-styles';
    s.textContent = `
      .al-wrap {
        background:var(--surface); border:1px solid var(--border);
        border-radius:12px; overflow:hidden;
      }
      .al-row {
        display:flex; align-items:flex-start; gap:12px;
        padding:11px 15px; border-bottom:1px solid var(--border);
        transition:background 120ms;
      }
      .al-row:last-child { border-bottom:none; }
      .al-row:hover { background:var(--surface2); }
      .al-avatar {
        width:32px; height:32px; border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:700; flex-shrink:0; text-transform:uppercase;
        background:var(--accent-muted2); color:var(--accent);
        border:1px solid rgba(74,143,255,.18);
      }
      .al-badge {
        display:inline-block; font-size:10px; font-weight:700;
        padding:2px 7px; border-radius:5px; letter-spacing:.3px;
        text-transform:uppercase;
      }
      .al-badge-order_done    { background:rgba(52,211,153,.12); color:#34d399; border:1px solid rgba(52,211,153,.2); }
      .al-badge-order_delete  { background:rgba(248,113,113,.1); color:#f87171; border:1px solid rgba(248,113,113,.2); }
      .al-badge-order_edit    { background:rgba(74,143,255,.1);  color:var(--accent); border:1px solid rgba(74,143,255,.2); }
      .al-badge-item_create   { background:rgba(52,211,153,.08); color:#34d399; border:1px solid rgba(52,211,153,.18); }
      .al-badge-item_edit     { background:rgba(74,143,255,.08); color:var(--accent); border:1px solid rgba(74,143,255,.18); }
      .al-badge-item_delete   { background:rgba(248,113,113,.1); color:#f87171; border:1px solid rgba(248,113,113,.2); }
      .al-badge-admin_approve { background:rgba(52,211,153,.1);  color:#34d399; border:1px solid rgba(52,211,153,.2); }
      .al-badge-admin_reject  { background:rgba(248,113,113,.1); color:#f87171; border:1px solid rgba(248,113,113,.2); }
      .al-badge-admin_delete  { background:rgba(248,113,113,.1); color:#f87171; border:1px solid rgba(248,113,113,.2); }
      .al-badge-config_save   { background:rgba(251,191,36,.1);  color:#fbbf24; border:1px solid rgba(251,191,36,.2); }
      .al-badge-login         { background:rgba(167,139,250,.1); color:#a78bfa; border:1px solid rgba(167,139,250,.2); }
      .al-badge-default       { background:var(--surface3); color:var(--text-muted); border:1px solid var(--border); }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     LOAD & RENDER
  ══════════════════════════════════════════════════════════ */
  async function loadActivityLog() {
    const container = document.getElementById('al-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat…</div>';

    const sb = getSb();
    if (!sb) {
      container.innerHTML = '<div class="empty-state" style="color:#f87171">⚠️ Supabase belum siap.</div>';
      return;
    }

    const actionF = document.getElementById('al-filter-action')?.value || '';
    const adminF  = (document.getElementById('al-filter-admin')?.value  || '').trim().toLowerCase();
    const fromF   = document.getElementById('al-filter-from')?.value   || '';
    const toF     = document.getElementById('al-filter-to')?.value     || '';

    /* Query */
    let q = sb.from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (actionF) q = q.eq('action', actionF);
    if (fromF)   q = q.gte('created_at', fromF + 'T00:00:00');
    if (toF)     q = q.lte('created_at', toF   + 'T23:59:59');

    const { data, error } = await q;

    if (error) {
      container.innerHTML = `<div class="empty-state" style="color:#f87171">
        Gagal: ${escHtml(error.message)}<br>
        <small style="opacity:.7">Pastikan tabel admin_activity_log sudah dibuat.</small>
      </div>`;
      return;
    }

    let rows = data || [];
    if (adminF) rows = rows.filter(r => (r.admin_name || '').toLowerCase().includes(adminF));

    /* Stats */
    const today = new Date().toISOString().slice(0, 10);
    const todayCount   = rows.filter(r => r.created_at?.slice(0, 10) === today).length;
    const uniqueAdmins = new Set(rows.map(r => r.admin_user_id)).size;
    const totalEl  = document.getElementById('al-stat-total');
    const todayEl  = document.getElementById('al-stat-today');
    const adminEl  = document.getElementById('al-stat-admins');
    if (totalEl)  totalEl.textContent  = rows.length;
    if (todayEl)  todayEl.textContent  = todayCount;
    if (adminEl)  adminEl.textContent  = uniqueAdmins;

    if (!rows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada log aktivitas ditemukan.</div>';
      return;
    }

    const ACTION_LABEL = {
      order_done:    '✅ Order Selesai',
      order_delete:  '🗑 Hapus Order',
      order_edit:    '✏️ Edit Order',
      item_create:   '➕ Tambah Item',
      item_edit:     '✏️ Edit Item',
      item_delete:   '🗑 Hapus Item',
      admin_approve: '✅ Approve Admin',
      admin_reject:  '❌ Tolak Admin',
      admin_delete:  '🗑 Hapus Admin',
      config_save:   '💾 Simpan Config',
      login:         '🔑 Login',
    };

    container.innerHTML = `
      <div class="al-wrap">
        ${rows.map(r => {
          const initials = (r.admin_name || '?')[0].toUpperCase();
          const label    = ACTION_LABEL[r.action] || r.action;
          const dt = new Date(r.created_at).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });

          let detailHtml = '';
          try {
            const d = r.details;
            if (d && typeof d === 'object' && Object.keys(d).length) {
              detailHtml = '<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">' +
                Object.entries(d).map(([k, v]) =>
                  `<span style="color:var(--text-faint)">${escHtml(k)}:</span> ${escHtml(String(v))}`
                ).join(' &nbsp;·&nbsp; ') +
              '</div>';
            }
          } catch (e) { /* noop */ }

          return `
            <div class="al-row">
              <div class="al-avatar">${initials}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px">
                  <span style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(r.admin_name || '?')}</span>
                  <span class="al-badge al-badge-${escHtml(r.action || 'default')}">${label}</span>
                  ${r.target_type
                    ? `<span style="font-size:11px;color:var(--text-faint)">${escHtml(r.target_type)}: ${escHtml(r.target_id || '')}</span>`
                    : ''}
                </div>
                ${detailHtml}
                <div style="font-size:11px;color:var(--text-faint);margin-top:3px">${dt}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="padding:8px 14px;font-size:11.5px;color:var(--text-faint);border-top:1px solid var(--border)">
        Menampilkan <strong style="color:var(--text)">${rows.length}</strong> log
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════
     HAPUS LOG > 30 HARI
  ══════════════════════════════════════════════════════════ */
  async function clearOldLogs() {
    const doDelete = async () => {
      const sb = getSb();
      if (!sb) return;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { error } = await sb
        .from('admin_activity_log')
        .delete()
        .lt('created_at', cutoff.toISOString());
      if (error) { toast('Gagal hapus log: ' + error.message, 'error'); return; }
      toast('Log lebih dari 30 hari berhasil dihapus ✅');
      loadActivityLog();
    };

    if (typeof window.showMgrConfirm === 'function') {
      window.showMgrConfirm({
        title:       'Hapus Log Lama?',
        message:     'Log aktivitas lebih dari <strong>30 hari</strong> akan dihapus permanen dari database.',
        confirmText: '🗑 Ya, Hapus Log Lama',
        danger:      true,
        onConfirm:   doDelete,
      });
    } else {
      if (confirm('Hapus log aktivitas lebih dari 30 hari?')) await doDelete();
    }
  }

  function registerGlobals() {
    window._alLoad  = loadActivityLog;
    window._alClear = clearOldLogs;
  }
})();
