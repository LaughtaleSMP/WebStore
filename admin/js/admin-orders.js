// admin-orders.js — Pesanan Masuk + Semua Pesanan
//
// PERUBAHAN v2:
//  1. Browser Notification API + suara saat order baru masuk
//  2. Batasan akses per role (moderator tidak bisa hapus)
//  3. Custom confirm dialog (showMgrConfirm) gantikan confirm() native
//  4. Indikator timeout order (pending > 30 menit)
//  5. Export Excel "Semua Pesanan" sesuai filter aktif
//  6. Activity log otomatis di setiap aksi penting
//

/* ─────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  if (typeof window.showAdminToast === 'function') return window.showAdminToast(msg, type);
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

function getSb()   { return window._adminSb || null; }
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Role helpers */
function _getRole()      { return window.currentRole?.role || 'admin'; }
function _canDelete()    { return _getRole() !== 'moderator'; }
function _getAdminName() {
  const r = window.currentRole;
  const u = window.currentUser;
  return (r && r.display_name) || (u && (u.user_metadata?.full_name || u.email)) || 'admin';
}

function _getDisplayName() {
  const r = window.currentRole;
  const u = window.currentUser;
  return (r && r.display_name)
    || (u && (u.user_metadata?.display_name || u.user_metadata?.full_name || u.email))
    || null;
}

/* Ambil email admin yang sedang login */
function _getAdminEmail() {
  return window.currentUser?.email || null;
}

/* Ambil nomor WA admin yang sedang login dari admin_roles */
function _getAdminPhone() {
  return window.currentRole?.phone || null;
}

/* Custom confirm dialog — gunakan showMgrConfirm jika tersedia */
function _confirm({ title, message, confirmText, danger = false }, onConfirm) {
  if (typeof window.showMgrConfirm === 'function') {
    window.showMgrConfirm({ title, message, confirmText, danger, onConfirm });
  } else {
    const plain = (message || '').replace(/<[^>]+>/g, '');
    if (confirm(plain)) onConfirm();
  }
}

/* ─────────────────────────────────────────────────────
   1. BROWSER NOTIFICATIONS + SOUND
───────────────────────────────────────────────────── */
let _notifPermission  = 'default';
let _titleFlashTimer  = null;
const _originalTitle  = document.title;

async function _initNotifications() {
  if (!('Notification' in window)) return;
  _notifPermission = Notification.permission;
  if (_notifPermission === 'default') {
    _notifPermission = await Notification.requestPermission();
  }
  _updateNotifBtn();
}

function _playNotifSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [[880, 0], [1100, 0.13], [880, 0.26]].forEach(([freq, t]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) { /* noop */ }
}

function _flashTabTitle(msg) {
  clearInterval(_titleFlashTimer);
  let toggle = false;
  _titleFlashTimer = setInterval(() => {
    document.title = toggle ? msg : _originalTitle;
    toggle = !toggle;
  }, 900);
  setTimeout(() => {
    clearInterval(_titleFlashTimer);
    document.title = _originalTitle;
  }, 12000);
}

function _showOrderNotification(order) {
  _playNotifSound();

  const itemName = order.item_name || '?';
  const username = order.username  || '?';

  if (_notifPermission === 'granted') {
    const n = new Notification('🛒 Pesanan Baru!', {
      body:             `Item: ${itemName}  •  User: ${username}`,
      icon:             '../favicon.ico',
      tag:              'order-' + order.id,
      requireInteraction: false,
    });
    n.onclick = () => {
      window.focus();
      if (typeof showSection === 'function') {
        showSection('orders', document.getElementById('nav-orders'));
      }
      n.close();
    };
  }

  _flashTabTitle('🛒 Pesanan Baru!');
  showToast('🛒 Pesanan baru: ' + itemName + ' dari ' + username, 'success');
}

function _updateNotifBtn() {
  const btn = document.getElementById('orders-notif-btn');
  if (!btn) return;
  if (_notifPermission === 'granted') {
    btn.textContent = '🔔 Notifikasi Aktif';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'rgba(52,211,153,.3)';
  } else if (_notifPermission === 'denied') {
    btn.textContent = '🔕 Notifikasi Diblokir';
    btn.style.color = '#f87171';
    btn.style.borderColor = 'rgba(248,113,113,.3)';
    btn.title = 'Aktifkan notifikasi di pengaturan browser';
  } else {
    btn.textContent = '🔔 Aktifkan Notifikasi';
  }
}

window._ordersRequestNotif = async function () {
  if (!('Notification' in window)) {
    showToast('Browser tidak mendukung notifikasi.', 'error');
    return;
  }
  if (Notification.permission === 'denied') {
    showToast('Notifikasi diblokir. Aktifkan manual di pengaturan browser.', 'error');
    return;
  }
  _notifPermission = await Notification.requestPermission();
  _updateNotifBtn();
  if (_notifPermission === 'granted') showToast('Notifikasi berhasil diaktifkan 🔔', 'success');
};

/* ─────────────────────────────────────────────────────
   4. TIMEOUT INDICATOR
───────────────────────────────────────────────────── */
const ORDER_TIMEOUT_MINUTES = 30;

function _minutesSince(isoDate) {
  return (Date.now() - new Date(isoDate)) / 60000;
}

function _overdueTag(order) {
  const mins = _minutesSince(order.created_at);
  if (mins < ORDER_TIMEOUT_MINUTES) return '';
  const label = mins >= 60
    ? Math.floor(mins / 60) + ' jam'
    : Math.floor(mins) + ' menit';
  return `<span style="background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3);
    border-radius:5px;font-size:10px;font-weight:700;padding:2px 7px;">⏰ ${label} tertunda</span>`;
}

/* ─────────────────────────────────────────────────────
   AUTO-RECORD FINANCE
───────────────────────────────────────────────────── */
async function _recordFinanceTx(order) {
  const sb = getSb();
  if (!sb || !order?.total_price || Number(order.total_price) <= 0) return;

  const ref = 'order:' + order.id;
  const { data: existing } = await sb
    .from('finance_transactions')
    .select('id')
    .eq('reference', ref)
    .maybeSingle();
  if (existing) return;

  const category = (order.item_name || '').toLowerCase().includes('gem') ? 'gem' : 'shop';
  await sb.from('finance_transactions').insert([{
    type:        'income',
    category,
    amount:      Number(order.total_price),
    note:        'Order: ' + (order.item_name || '?'),
    reference:   ref,
    recorded_by: order.completed_by_name || _getAdminName(),
    created_at:  order.completed_at || new Date().toISOString(),
  }]);
}

/* ─────────────────────────────────────────────────────
   BADGE INIT
───────────────────────────────────────────────────── */
window.ordersInitBadge = async function () {
  const sb = getSb();
  if (!sb) return;
  const { count } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  const badge = document.getElementById('orders-badge');
  if (!badge) return;
  badge.textContent    = count || 0;
  badge.style.display  = count > 0 ? 'inline-flex' : 'none';

  /* Juga inisialisasi notifikasi */
  _initNotifications();
};

/* ─────────────────────────────────────────────────────
   PESANAN MASUK
───────────────────────────────────────────────────── */
window.ordersLoad = async function () {
  const sb = getSb();
  if (!sb) return;
  const container = document.getElementById('orders-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:10px 0;">Memuat pesanan…</p>';

  const { data, error } = await sb
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }); // terlama di atas (prioritas)

  const badge = document.getElementById('orders-badge');

  if (error) {
    container.innerHTML = `<p style="color:var(--red)">Gagal: ${escHtml(error.message)}</p>`;
    return;
  }

  const pendingEl = document.getElementById('ostat-pending');
  if (pendingEl) pendingEl.textContent = data ? data.length : 0;

  if (!data || !data.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:10px 0;">Tidak ada pesanan masuk saat ini.</p>';
    if (badge) badge.style.display = 'none';
    await _loadTodayStats();
    return;
  }

  if (badge) { badge.textContent = data.length; badge.style.display = 'inline-flex'; }

  /* Cek ada yang overdue */
  const overdueCount = data.filter(o => _minutesSince(o.created_at) >= ORDER_TIMEOUT_MINUTES).length;
  const overdueWarn  = overdueCount > 0
    ? `<div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:8px;
         padding:8px 13px;margin-bottom:12px;font-size:12.5px;color:#f87171;">
         ⏰ <strong>${overdueCount} pesanan</strong> telah pending lebih dari ${ORDER_TIMEOUT_MINUTES} menit!
       </div>`
    : '';

  container.innerHTML = overdueWarn + data.map(o => {
    const canDel = _canDelete();
    return `
    <div class="order-card" id="ocard-${escHtml(o.id)}" style="${_minutesSince(o.created_at) >= ORDER_TIMEOUT_MINUTES ? 'border-color:rgba(248,113,113,.35)' : ''}">
      <div class="order-card-head">
        <span class="order-id-badge">#${escHtml(String(o.id).slice(-4).toUpperCase())}</span>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          ${_overdueTag(o)}
          <span class="order-time">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}))}</span>
        </div>
      </div>
      <div class="order-item-name">${escHtml(o.item_name || '—')}</div>
      <div class="order-tags" style="display:flex;flex-wrap:wrap;gap:5px;margin:7px 0">
        ${o.username    ? `<span class="order-tag">👤 ${escHtml(o.username)}</span>`  : ''}
        ${o.qty         ? `<span class="order-tag">×${escHtml(String(o.qty))}</span>` : ''}
        ${o.total_price ? `<span class="order-tag price-tag">Rp ${Number(o.total_price).toLocaleString('id-ID')}</span>` : ''}
        ${o.wa_admin_name ? `<span class="order-tag">💬 ${escHtml(o.wa_admin_name)}</span>` : ''}
      </div>
      ${o.customer_note ? `<div class="order-note">"${escHtml(o.customer_note)}"</div>` : ''}
      <div class="order-actions">
        <button class="btn-done" onclick="orderMarkDone('${escHtml(o.id)}')">✅ Selesai</button>
        <button class="btn-edit" onclick="oeditOpen('${escHtml(o.id)}')">✏️ Edit</button>
        ${canDel
          ? `<button class="btn-del" onclick="orderDelete('${escHtml(o.id)}')" title="Hapus">🗑️</button>`
          : `<button class="btn-del" disabled title="Moderator tidak bisa hapus" style="opacity:.3;cursor:not-allowed">🗑️</button>`
        }
      </div>
    </div>`;
  }).join('');

  await _loadTodayStats();
};

async function _loadTodayStats() {
  const sb = getSb();
  if (!sb) return;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  const [{ count: doneToday }, { data: revData }] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'selesai')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString()),
    sb.from('orders').select('total_price')
      .eq('status', 'selesai')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString()),
  ]);

  const rev = (revData || []).reduce((s, r) => s + (r.total_price || 0), 0);
  const doneTodayEl = document.getElementById('ostat-done-today');
  const revTodayEl  = document.getElementById('ostat-rev-today');
  if (doneTodayEl) doneTodayEl.textContent = doneToday || 0;
  if (revTodayEl)  revTodayEl.textContent  = 'Rp ' + rev.toLocaleString('id-ID');
}

/* ─────────────────────────────────────────────────────
   REALTIME SUBSCRIBE — deteksi INSERT untuk notifikasi
───────────────────────────────────────────────────── */
let _ordersChannel  = null;
let _prevOrderIds   = new Set();

window.ordersSubscribe = function () {
  const sb = getSb();
  if (!sb) return;

  if (_ordersChannel) {
    try { sb.removeChannel(_ordersChannel); } catch (e) { /* noop */ }
    _ordersChannel = null;
  }

  _ordersChannel = sb
    .channel('orders-realtime-v2')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      const newOrder = payload.new;
      if (newOrder && newOrder.status === 'pending') {
        _showOrderNotification(newOrder);
      }
      ordersLoad();
      _syncAllOrdersIfActive();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
      ordersLoad();
      _syncAllOrdersIfActive();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
      ordersLoad();
      _syncAllOrdersIfActive();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[Orders RT] Realtime terhubung');
    });
};

function _syncAllOrdersIfActive() {
  const allSec = document.getElementById('sec-all-orders');
  if (allSec && allSec.classList.contains('active') && typeof window.allOrdersLoad === 'function') {
    window.allOrdersLoad();
  }
}

/* ─────────────────────────────────────────────────────
   MARK DONE
───────────────────────────────────────────────────── */
window.orderMarkDone = async function (id) {
  const sb = getSb();
  if (!sb) return;

  const { data: o, error: fetchErr } = await sb.from('orders').select('*').eq('id', id).single();
  if (fetchErr || !o) { showToast('Gagal ambil data order.', 'error'); return; }

  const completedAt   = new Date().toISOString();
  const completedBy   = o.wa_admin_name || _getAdminName();
  const user          = window.currentUser;
  const displayName   = _getDisplayName();
  const adminEmail    = _getAdminEmail();
  const adminPhone    = _getAdminPhone();

  const { error } = await sb.from('orders').update({
    status:                      'selesai',
    completed_at:                completedAt,
    completed_by_user_id:        user?.id    || null,
    completed_by_name:           completedBy,
    completed_by_display_name:   displayName,
    completed_by_email:          adminEmail,
    wa_admin_number:             adminPhone || o.wa_admin_number || null,
  }).eq('id', id);

  if (error) { showToast('Gagal: ' + error.message, 'error'); return; }

  /* Finance + Activity Log */
  await _recordFinanceTx({ ...o, completed_at: completedAt, completed_by_name: completedBy });
  window.logAdminActivity?.('order_done', 'order', id, {
    item:          o.item_name || '?',
    user:          o.username  || '?',
    harga:         'Rp ' + Number(o.total_price || 0).toLocaleString('id-ID'),
    admin_email:   adminEmail  || '?',
    admin_wa:      adminPhone  || o.wa_admin_number || '?',
  });

  const card = document.getElementById(`ocard-${id}`);
  if (card) card.remove();
  showToast('✅ Order selesai & dicatat ke keuangan!', 'success');
  ordersLoad();
  _syncAllOrdersIfActive();
  _refreshFinanceIfActive();
};

/* ─────────────────────────────────────────────────────
   DELETE ORDER
───────────────────────────────────────────────────── */
window.orderDelete = async function (id) {
  if (!_canDelete()) {
    showToast('Moderator tidak memiliki akses untuk menghapus order.', 'error');
    return;
  }

  const sb = getSb();
  if (!sb) return;

  /* Ambil nama item untuk konfirmasi */
  const { data: o } = await sb.from('orders').select('item_name,username').eq('id', id).maybeSingle();
  const itemLabel   = escHtml(o?.item_name || 'order ini');
  const userLabel   = escHtml(o?.username  || '');

  _confirm({
    title:       'Hapus Pesanan?',
    message:     `Pesanan <strong>${itemLabel}</strong>${userLabel ? ` dari <strong>${userLabel}</strong>` : ''} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmText: '🗑️ Ya, Hapus Pesanan',
    danger:      true,
  }, async () => {
    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }

    window.logAdminActivity?.('order_delete', 'order', id, {
      item: o?.item_name || '?',
      user: o?.username  || '?',
    });

    const card = document.getElementById(`ocard-${id}`);
    if (card) {
      card.style.transition = 'opacity .25s,transform .25s';
      card.style.opacity = '0'; card.style.transform = 'translateX(16px)';
      setTimeout(() => card.remove(), 280);
    }
    showToast('🗑️ Pesanan dihapus', 'success');
    ordersLoad();
    _syncAllOrdersIfActive();
  });
};

/* ─────────────────────────────────────────────────────
   SAVE EDIT ORDER
───────────────────────────────────────────────────── */
window.oeditSave = async function () {
  const sb = getSb();
  if (!sb) return;

  const id           = document.getElementById('oedit-id').value;
  const itemName     = document.getElementById('oedit-item-name').value.trim();
  const username     = document.getElementById('oedit-username').value.trim();
  const qty          = parseInt(document.getElementById('oedit-qty').value)        || 1;
  const unit_price   = parseFloat(document.getElementById('oedit-unit-price').value) || 0;
  const total_price  = parseFloat(document.getElementById('oedit-total-price').value) || 0;
  const customer_note= document.getElementById('oedit-note').value.trim();
  const status       = _getOeditStatus();
  const refund_reason= document.getElementById('oedit-refund-reason')?.value?.trim() || null;
  const user         = window.currentUser;

  const { data: prevOrder } = await sb.from('orders').select('*').eq('id', id).single();
  const prevStatus = prevOrder?.status || '';

  const completedAt = new Date().toISOString();
  const completedBy = prevOrder?.wa_admin_name || _getAdminName();
  const adminEmail  = _getAdminEmail();
  const adminPhone  = _getAdminPhone();

  const updates = { item_name: itemName, username, qty, unit_price, total_price, customer_note, status };
  if (status === 'refund' || status === 'cancelled') updates.refund_reason = refund_reason;
  if (status === 'selesai') {
    updates.completed_at                 = completedAt;
    updates.completed_by_user_id         = user?.id || null;
    updates.completed_by_name            = completedBy;
    updates.completed_by_display_name    = _getDisplayName();
    updates.completed_by_email           = adminEmail;
    updates.wa_admin_number              = adminPhone || prevOrder?.wa_admin_number || null;
  }

  const btn = document.getElementById('oedit-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

  const { error } = await sb.from('orders').update(updates).eq('id', id);

  if (btn) { btn.disabled = false; btn.textContent = 'Simpan Perubahan'; }
  if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }

  /* Finance + Activity Log */
  if (status === 'selesai' && prevStatus !== 'selesai') {
    await _recordFinanceTx({ ...prevOrder, item_name: itemName, total_price, completed_at: completedAt, completed_by_name: completedBy });
  }

  window.logAdminActivity?.('order_edit', 'order', id, {
    item:        itemName,
    status:      `${prevStatus} → ${status}`,
    harga:       'Rp ' + total_price.toLocaleString('id-ID'),
    admin_email: adminEmail || '?',
    admin_wa:    adminPhone || prevOrder?.wa_admin_number || '?',
  });

  oeditClose();
  ordersLoad();
  _syncAllOrdersIfActive();
  if (status === 'selesai' && prevStatus !== 'selesai') _refreshFinanceIfActive();

  const label = { selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' }[status] || '✅ Tersimpan';
  showToast(`Order diupdate — ${label}`, 'success');
};

/* ─────────────────────────────────────────────────────
   SEMUA PESANAN
───────────────────────────────────────────────────── */
window.allOrdersLoad = async function () {
  const sb = getSb();
  if (!sb) return;

  const container = document.getElementById('all-orders-table');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat…</div>';

  const statusFilter = document.getElementById('ao-filter-status')?.value || '';
  const searchVal    = (document.getElementById('ao-search')?.value || '').toLowerCase().trim();

  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) {
    container.innerHTML = `<div class="empty-state" style="color:var(--red)">${escHtml(error.message)}</div>`;
    return;
  }

  let rows = data || [];
  if (searchVal) rows = rows.filter(o =>
    (o.item_name || '').toLowerCase().includes(searchVal) ||
    (o.username  || '').toLowerCase().includes(searchVal) ||
    (o.wa_admin_name || '').toLowerCase().includes(searchVal)
  );

  const STATUS_MAP = { pending:'⏳ Pending', selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' };
  const STATUS_CLS = { pending:'color:#f6ad55', selesai:'color:#4ade80', refund:'color:#fc8181', cancelled:'color:#a0aec0' };
  const canDel = _canDelete();

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">Tidak ada data ditemukan.</div>';
    return;
  }

  const rowsHtml = rows.map(o => `
    <tr>
      <td style="padding:8px 10px"><span class="order-id-badge">#${escHtml(String(o.id).slice(-4).toUpperCase())}</span></td>
      <td style="padding:8px 10px;font-size:11.5px;color:var(--text-muted)">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'}))}</td>
      <td style="padding:8px 10px;font-size:12.5px">${escHtml(o.item_name || '—')}</td>
      <td style="padding:8px 10px;text-align:center">${escHtml(String(o.qty || 1))}</td>
      <td style="padding:8px 10px">${escHtml(o.username || '—')}</td>
      <td style="padding:8px 10px">${escHtml(o.wa_admin_name || '—')}</td>
      <td style="padding:8px 10px;font-size:11.5px;color:var(--text-muted)">${escHtml(o.completed_by_email || '—')}</td>
      <td style="padding:8px 10px;font-size:11.5px;color:var(--text-muted)">${escHtml(o.wa_admin_number || '—')}</td>
      <td style="padding:8px 10px;font-weight:600;color:#4ade80">Rp ${Number(o.total_price || 0).toLocaleString('id-ID')}</td>
      <td style="padding:8px 10px;font-size:12px;${STATUS_CLS[o.status] || ''}">${STATUS_MAP[o.status] || escHtml(o.status || '—')}</td>
      <td style="padding:8px 10px;white-space:nowrap">
        <button class="btn-edit" onclick="oeditOpen('${escHtml(String(o.id))}')" title="Edit">✏️</button>
        ${canDel
          ? `<button class="btn-del" onclick="orderDelete('${escHtml(String(o.id))}')" title="Hapus">🗑️</button>`
          : `<button class="btn-del" disabled title="Moderator tidak bisa hapus" style="opacity:.3;cursor:not-allowed">🗑️</button>`
        }
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)">
      <span style="font-size:11.5px;color:var(--text-faint)">
        <strong style="color:var(--text)">${rows.length}</strong> pesanan ditemukan
      </span>
      <button class="btn-ghost" style="font-size:11.5px;padding:5px 11px;display:inline-flex;align-items:center;gap:5px"
        onclick="allOrdersExport()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export Excel
      </button>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:780px;">
        <thead style="background:var(--surface2)">
          <tr>
            ${['ID','WAKTU','ITEM','QTY','USERNAME','ADMIN WA','EMAIL ADMIN','NO WA ADMIN','TOTAL','STATUS','AKSI'].map(h =>
              `<th style="padding:9px 10px;text-align:left;font-size:10.5px;color:var(--text-faint);border-bottom:1px solid var(--border);font-weight:700;letter-spacing:.4px">${h}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
};

/* ─────────────────────────────────────────────────────
   5. EXPORT SEMUA PESANAN KE EXCEL
───────────────────────────────────────────────────── */
window.allOrdersExport = async function () {
  if (typeof ExcelJS === 'undefined') {
    showToast('Library ExcelJS belum dimuat.', 'error');
    return;
  }

  showToast('Menyiapkan file Excel…', 'success');

  const sb = getSb();
  if (!sb) { showToast('Supabase belum siap.', 'error'); return; }

  const statusFilter = document.getElementById('ao-filter-status')?.value || '';
  const searchVal    = (document.getElementById('ao-search')?.value || '').toLowerCase().trim();

  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error || !data) { showToast('Gagal ambil data: ' + (error?.message || ''), 'error'); return; }

  let rows = data;
  if (searchVal) rows = rows.filter(o =>
    (o.item_name || '').toLowerCase().includes(searchVal) ||
    (o.username  || '').toLowerCase().includes(searchVal) ||
    (o.wa_admin_name || '').toLowerCase().includes(searchVal)
  );

  const STATUS_LABEL = { pending:'Pending', selesai:'Selesai', refund:'Refund', cancelled:'Cancelled' };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Laughtale SMP Admin';
  wb.created = new Date();

  const ws = wb.addWorksheet('Semua Pesanan', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  ws.columns = [
    { header: 'No',             key: 'no',                 width: 5  },
    { header: 'ID Order',       key: 'id',                 width: 14 },
    { header: 'Waktu',          key: 'created_at',         width: 20 },
    { header: 'Item',           key: 'item',               width: 26 },
    { header: 'Qty',            key: 'qty',                width: 6  },
    { header: 'Username',       key: 'username',           width: 18 },
    { header: 'Admin WA',       key: 'wa_admin',           width: 18 },
    { header: 'Email Admin',    key: 'completed_by_email', width: 26 },
    { header: 'No WA Admin',    key: 'wa_admin_number',    width: 18 },
    { header: 'Harga Satuan',   key: 'unit_price',         width: 16 },
    { header: 'Total (Rp)',     key: 'total_price',        width: 16 },
    { header: 'Status',         key: 'status',             width: 12 },
    { header: 'Catatan',        key: 'note',               width: 28 },
    { header: 'Selesai Pada',   key: 'completed_at',       width: 20 },
  ];

  /* Style header */
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF4A8FFF' } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const fmtDate = iso => iso ? new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

  const STATUS_COLOR = {
    pending:   { fg: 'FFFFF9C4', font: 'FFB45309' },
    selesai:   { fg: 'FFD1FAE5', font: 'FF065F46' },
    refund:    { fg: 'FFDBEAFE', font: 'FF1E40AF' },
    cancelled: { fg: 'FFFEE2E2', font: 'FF991B1B' },
  };

  rows.forEach((o, i) => {
    const row = ws.addRow({
      no:                  i + 1,
      id:                  '#' + String(o.id).slice(-4).toUpperCase(),
      created_at:          fmtDate(o.created_at),
      item:                o.item_name || '—',
      qty:                 o.qty || 1,
      username:            o.username || '—',
      wa_admin:            o.wa_admin_name || '—',
      completed_by_email:  o.completed_by_email || '—',
      wa_admin_number:     o.wa_admin_number || '—',
      unit_price:          Number(o.unit_price || 0),
      total_price:         Number(o.total_price || 0),
      status:              STATUS_LABEL[o.status] || o.status || '—',
      note:                o.customer_note || '',
      completed_at:        fmtDate(o.completed_at),
    });

    row.height = 16;
    const sc = STATUS_COLOR[o.status] || {};
    const bgColor = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font   = { size: 10, color: { argb: 'FF1F2937' } };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      cell.alignment = { vertical: 'middle' };

      if (colNum === 12 && sc.fg) { /* Status column */
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.fg } };
        cell.font   = { bold: true, size: 10, color: { argb: sc.font } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (colNum === 10 || colNum === 11) {
        cell.numFmt    = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNum === 11) cell.font = { bold: true, size: 10, color: { argb: 'FF065F46' } };
      }
    });
  });

  /* Total row */
  const totalRev = rows.reduce((s, r) => s + Number(r.total_price || 0), 0);
  const totalRow = ws.addRow({
    no: '', id: '', created_at: '', item: 'TOTAL',
    qty: rows.length + ' order', username: '', wa_admin: '',
    completed_by_email: '', wa_admin_number: '',
    unit_price: '', total_price: totalRev, status: '', note: '', completed_at: '',
  });
  totalRow.height = 18;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font   = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF4A8FFF' } } };
    if (colNum === 11) {
      cell.numFmt    = '#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const buf     = await wb.xlsx.writeBuffer();
  const blob    = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a       = document.createElement('a');
  a.href        = URL.createObjectURL(blob);
  a.download    = `Pesanan-Laughtale-${dateTag}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Export selesai — ${rows.length} pesanan ✅`, 'success');
};

/* ─────────────────────────────────────────────────────
   EDIT ORDER MODAL (oedit)
───────────────────────────────────────────────────── */
window.oeditOpen = async function (id) {
  const sb = getSb();
  if (!sb) return;
  if (!document.getElementById('oedit-overlay')) _injectEditModal();

  const { data: o, error } = await sb.from('orders').select('*').eq('id', id).single();
  if (error || !o) { showToast('Gagal ambil data order', 'error'); return; }

  document.getElementById('oedit-id').value          = o.id;
  document.getElementById('oedit-item-name').value   = o.item_name || '';
  document.getElementById('oedit-username').value    = o.username   || '';
  document.getElementById('oedit-qty').value         = o.qty        || 1;
  document.getElementById('oedit-unit-price').value  = o.unit_price || 0;
  document.getElementById('oedit-total-price').value = o.total_price|| 0;
  document.getElementById('oedit-note').value        = o.customer_note || '';
  document.getElementById('oedit-wa-admin').value    = o.wa_admin_name || '';

  document.querySelectorAll('input[name="oedit-status"]')
    .forEach(r => { r.checked = (r.value === (o.status || 'pending')); });
  _oeditUpdateStatusUI(o.status || 'pending');

  const rrWrap = document.getElementById('oedit-refund-wrap');
  const rrIn   = document.getElementById('oedit-refund-reason');
  if (rrWrap) rrWrap.style.display = (o.status === 'refund' || o.status === 'cancelled') ? 'block' : 'none';
  if (rrIn)   rrIn.value = o.refund_reason || '';

  const ov = document.getElementById('oedit-overlay');
  if (ov) { ov.style.display = 'flex'; setTimeout(() => ov.classList.add('oedit-visible'), 10); }
};

window.oeditClose = function () {
  const ov = document.getElementById('oedit-overlay');
  if (!ov) return;
  ov.classList.remove('oedit-visible');
  setTimeout(() => { ov.style.display = 'none'; }, 220);
};

function _getOeditStatus() {
  const r = document.querySelector('input[name="oedit-status"]:checked');
  return r ? r.value : 'pending';
}

function _oeditUpdateStatusUI(status) {
  const rrWrap = document.getElementById('oedit-refund-wrap');
  if (rrWrap) rrWrap.style.display = (status === 'refund' || status === 'cancelled') ? 'block' : 'none';
}

window.oeditStatusChange = function (radio) { _oeditUpdateStatusUI(radio.value); };

window.oeditRecalc = function () {
  const qty   = parseFloat(document.getElementById('oedit-qty')?.value)        || 0;
  const price = parseFloat(document.getElementById('oedit-unit-price')?.value) || 0;
  const tot   = document.getElementById('oedit-total-price');
  if (tot) tot.value = (qty * price).toFixed(0);
};

/* ─────────────────────────────────────────────────────
   INJECT EDIT MODAL
───────────────────────────────────────────────────── */
function _injectEditModal() {
  if (document.getElementById('oedit-overlay')) return;
  const div = document.createElement('div');
  div.innerHTML = `
<div id="oedit-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;
     align-items:center;justify-content:center;" onclick="if(event.target===this)oeditClose()">
  <div class="oedit-modal" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
       padding:24px;width:min(480px,95vw);max-height:90vh;overflow-y:auto;animation:oeditIn .22s ease;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div style="font-size:14px;font-weight:700;color:var(--text);">✏️ Edit Pesanan</div>
      <button onclick="oeditClose()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;">×</button>
    </div>
    <input type="hidden" id="oedit-id">
    <div style="display:grid;gap:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Item</label>
        <input id="oedit-item-name" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box" placeholder="Nama item">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Username</label>
          <input id="oedit-username" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box" placeholder="Username">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Admin WA</label>
          <input id="oedit-wa-admin" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box" placeholder="Nama admin">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Qty</label>
          <input id="oedit-qty" type="number" min="1" oninput="oeditRecalc()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Harga Satuan</label>
          <input id="oedit-unit-price" type="number" min="0" oninput="oeditRecalc()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Total</label>
          <input id="oedit-total-price" type="number" min="0" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box">
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Catatan</label>
        <textarea id="oedit-note" rows="2" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;resize:vertical;box-sizing:border-box" placeholder="Catatan pembeli"></textarea>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:8px">Status</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <input type="radio" name="oedit-status" id="os-pending"    value="pending"    onchange="oeditStatusChange(this)" style="display:none">
          <label for="os-pending"    style="padding:6px 14px;border-radius:8px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:12px;font-weight:600;cursor:pointer">⏳ Pending</label>
          <input type="radio" name="oedit-status" id="os-selesai"   value="selesai"   onchange="oeditStatusChange(this)" style="display:none">
          <label for="os-selesai"   style="padding:6px 14px;border-radius:8px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);color:#4ade80;font-size:12px;font-weight:600;cursor:pointer">✅ Selesai</label>
          <input type="radio" name="oedit-status" id="os-refund"    value="refund"    onchange="oeditStatusChange(this)" style="display:none">
          <label for="os-refund"    style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);color:#60a5fa;font-size:12px;font-weight:600;cursor:pointer">💸 Refund</label>
          <input type="radio" name="oedit-status" id="os-cancelled" value="cancelled" onchange="oeditStatusChange(this)" style="display:none">
          <label for="os-cancelled" style="padding:6px 14px;border-radius:8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171;font-size:12px;font-weight:600;cursor:pointer">❌ Cancelled</label>
        </div>
      </div>
      <div id="oedit-refund-wrap" style="display:none">
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px">Alasan Refund/Cancel</label>
        <input id="oedit-refund-reason" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box" placeholder="Alasan…">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
      <button onclick="oeditClose()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text-muted);font-size:13px;cursor:pointer;font-family:inherit">Batal</button>
      <button id="oedit-save-btn" onclick="oeditSave()" style="background:var(--accent);border:none;border-radius:8px;padding:8px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Simpan Perubahan</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectEditModal);
} else {
  _injectEditModal();
}

/* ─────────────────────────────────────────────────────
   INTERNAL UTILS
───────────────────────────────────────────────────── */
function _refreshFinanceIfActive() {
  const finSec = document.getElementById('sec-finance-v2');
  if (finSec && finSec.classList.contains('active') && typeof window.financeV2Init === 'function') {
    window.financeV2Init();
  }
  const finLegacy = document.getElementById('sec-finance');
  if (finLegacy && finLegacy.classList.contains('active') && typeof window.financeLoad === 'function') {
    window.financeLoad();
  }
}
