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
// FIX v2.1:
//  - Hapus kolom 'item' dari semua query .select() — kolom tidak exist di tabel
//    sehingga menyebabkan 400 Bad Request. Fallback o.item_name || o.item
//    di JavaScript tetap aman karena hanya baca dari objek, bukan query DB.
//
// FIX v2.2:
//  - Sinkronisasi hapus order: saat order dihapus, finance_transactions
//    dengan reference 'order:{id}' juga otomatis dihapus.
//
// FIX v2.3:
//  - orderDelete: hapus kolom 'item' dari .select('item_name,item,username')
//    → .select('item_name,username') — kolom 'item' tidak exist di tabel orders.
//
// FIX v2.4:
//  - allOrdersExport headers: ganti key 'item' → 'item_name' agar konsisten.
//  - allOrdersLoad: perbaiki typo extra quote pada onclick orderDelete('')' → orderDelete('')

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
          <span class="order-time">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}))}</span>
        </div>
      </div>
      <div class="order-item-name">${escHtml(o.item_name || '—')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px">
        ${o.username    ? `<span class="order-tag">👤 ${escHtml(o.username)}</span>`  : ''}
        ${o.qty         ? `<span class="order-tag">🔢 x${escHtml(String(o.qty))}</span>` : ''}
        ${o.unit_price  ? `<span class="order-tag">💰 Rp ${Number(o.unit_price).toLocaleString('id-ID')}</span>` : ''}
        ${o.total_price ? `<span class="order-tag" style="background:rgba(52,211,153,.12);color:var(--green)">🧾 Rp ${Number(o.total_price).toLocaleString('id-ID')}</span>` : ''}
        ${o.wa_admin_name ? `<span class="order-tag">📱 ${escHtml(o.wa_admin_name)}</span>` : ''}
      </div>
      ${o.customer_note ? `<div style="background:rgba(255,255,255,.04);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text-muted);margin-bottom:8px;">💬 ${escHtml(o.customer_note)}</div>` : ''}
      <div class="order-card-actions">
        <button class="btn-done" onclick="orderMarkDone('${escHtml(o.id)}')">✅ Selesai</button>
        <button class="btn-wa"   onclick="orderOpenWA('${escHtml(o.id)}')">💬 WA</button>
        <button class="btn-edit" onclick="orderEdit('${escHtml(o.id)}')">✏️ Edit</button>
        ${canDel
          ? `<button class="btn-del" onclick="orderDelete('${escHtml(o.id)}')">🗑️</button>`
          : `<button class="btn-del" disabled title="Moderator tidak bisa hapus" style="opacity:.3;cursor:not-allowed">🗑️</button>`
        }
      </div>
    </div>`;
  }).join('');

  await _loadTodayStats();
};

/* ─────────────────────────────────────────────────────
   TODAY STATS
───────────────────────────────────────────────────── */
async function _loadTodayStats() {
  const sb = getSb();
  if (!sb) return;
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = new Date(); end.setHours(23,59,59,999);

  const [{ count: doneCount }, { data: revData }] = await Promise.all([
    sb.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'selesai')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString()),
    sb.from('orders')
      .select('total_price')
      .eq('status', 'selesai')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString()),
  ]);

  const doneEl = document.getElementById('ostat-done');
  const revEl  = document.getElementById('ostat-revenue');
  if (doneEl) doneEl.textContent = doneCount || 0;
  if (revEl) {
    const total = (revData || []).reduce((s, r) => s + Number(r.total_price || 0), 0);
    revEl.textContent = 'Rp ' + total.toLocaleString('id-ID');
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

  const completedAt  = new Date().toISOString();
  const completedBy  = o.wa_admin_name || _getAdminName();
  const { data: { user } = {} } = await sb.auth.getUser().catch(() => ({}));

  const { error } = await sb.from('orders').update({
    status:               'selesai',
    completed_at:         completedAt,
    completed_by_user_id: user?.id    || null,
    completed_by_name:    completedBy,
  }).eq('id', id);

  if (error) { showToast('Gagal update: ' + error.message, 'error'); return; }

  await _recordFinanceTx({ ...o, completed_at: completedAt, completed_by_name: completedBy });

  window.logAdminActivity?.('order_complete', 'order', id, {
    item:  o.item_name || '?',
    user:  o.username  || '?',
    total: o.total_price,
  });

  const card = document.getElementById(`ocard-${id}`);
  if (card) {
    card.style.transition = 'opacity .25s,transform .25s';
    card.style.opacity = '0'; card.style.transform = 'translateX(16px)';
    setTimeout(() => card.remove(), 280);
  }
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

  /* Cek apakah order ini sudah tercatat di finance_transactions */
  const ref = 'order:' + id;
  const [{ data: o }, { data: finTx }] = await Promise.all([
    // FIX v2.3: hapus kolom 'item' — tidak exist di tabel orders
    sb.from('orders').select('item_name,username').eq('id', id).maybeSingle(),
    sb.from('finance_transactions').select('id,amount').eq('reference', ref).maybeSingle(),
  ]);

  const itemLabel  = escHtml(o?.item_name || 'order ini');
  const userLabel  = escHtml(o?.username  || '');
  const financeMsg = finTx
    ? `<br><br><span style="color:#f6ad55;font-size:12px">⚠️ Transaksi keuangan terkait (Rp ${Number(finTx.amount).toLocaleString('id-ID')}) juga akan dihapus otomatis.</span>`
    : '';

  _confirm({
    title:       'Hapus Pesanan?',
    message:     `Pesanan <strong>${itemLabel}</strong>${userLabel ? ` dari <strong>${userLabel}</strong>` : ''} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.${financeMsg}`,
    confirmText: '🗑️ Ya, Hapus Pesanan',
    danger:      true,
  }, async () => {
    /* Hapus finance_transactions terkait dulu (jika ada) */
    if (finTx) {
      const { error: finErr } = await sb
        .from('finance_transactions')
        .delete()
        .eq('reference', ref);
      if (finErr) {
        showToast('Gagal hapus data keuangan: ' + finErr.message, 'error');
        return;
      }
    }

    /* Hapus order */
    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }

    window.logAdminActivity?.('order_delete', 'order', id, {
      item:            o?.item_name || '?',
      user:            o?.username  || '?',
      finance_deleted: finTx ? true : false,
    });

    const card = document.getElementById(`ocard-${id}`);
    if (card) {
      card.style.transition = 'opacity .25s,transform .25s';
      card.style.opacity = '0'; card.style.transform = 'translateX(16px)';
      setTimeout(() => card.remove(), 280);
    }

    const msg = finTx
      ? '🗑️ Pesanan & data keuangan terkait dihapus'
      : '🗑️ Pesanan dihapus';
    showToast(msg, 'success');
    ordersLoad();
    _syncAllOrdersIfActive();
    _refreshFinanceIfActive();
  });
};

/* ─────────────────────────────────────────────────────
   OPEN WA
───────────────────────────────────────────────────── */
window.orderOpenWA = async function (id) {
  const sb = getSb();
  if (!sb) return;
  const { data: o } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
  if (!o) { showToast('Data order tidak ditemukan.', 'error'); return; }

  /* Gunakan template dari shop_config jika ada */
  let tpl = 'Halo Admin, pesanan saya:\n\nItem: {item}\nUsername: {username}\nJumlah: {qty}\nTotal: Rp {total}';
  try {
    const { data: cfg } = await sb.from('shop_config').select('value').eq('key','wa_template').maybeSingle();
    if (cfg?.value) {
      const parsed = JSON.parse(cfg.value);
      if (parsed.template) tpl = parsed.template;
    }
  } catch { /* pakai default */ }

  const msg = tpl
    .replace('{item}',     o.item_name  || '?')
    .replace('{username}', o.username   || '?')
    .replace('{qty}',      o.qty        || '1')
    .replace('{total}',    Number(o.total_price || 0).toLocaleString('id-ID'))
    .replace('{note}',     o.customer_note || '-');

  const waNum = o.wa_admin || '';
  const url   = waNum
    ? `https://wa.me/${waNum.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
};

/* ─────────────────────────────────────────────────────
   EDIT ORDER
───────────────────────────────────────────────────── */
window.orderEdit = async function (id) {
  const sb = getSb();
  if (!sb) return;
  const { data: o, error } = await sb.from('orders').select('*').eq('id', id).single();
  if (error || !o) { showToast('Data tidak ditemukan.', 'error'); return; }

  document.getElementById('oedit-item-name').value   = o.item_name || '';
  document.getElementById('oedit-username').value    = o.username   || '';
  document.getElementById('oedit-qty').value         = o.qty        || 1;
  document.getElementById('oedit-unit-price').value  = o.unit_price || '';
  document.getElementById('oedit-total-price').value = o.total_price || '';
  document.getElementById('oedit-note').value        = o.customer_note || '';
  document.getElementById('oedit-status').value      = o.status || 'pending';

  /* Tampilkan modal */
  const modal = document.getElementById('oedit-modal');
  if (modal) {
    modal.dataset.orderId = id;
    modal.style.display   = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));
  }
};

window.orderEditClose = function () {
  const modal = document.getElementById('oedit-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
};

window.orderEditSave = async function () {
  const modal = document.getElementById('oedit-modal');
  if (!modal) return;
  const id = modal.dataset.orderId;
  if (!id) return;

  const sb = getSb();
  if (!sb) return;

  const itemName     = document.getElementById('oedit-item-name').value.trim();
  const username     = document.getElementById('oedit-username').value.trim();
  const qty          = Number(document.getElementById('oedit-qty').value) || 1;
  const unit_price   = Number(document.getElementById('oedit-unit-price').value) || 0;
  const total_price  = Number(document.getElementById('oedit-total-price').value) || 0;
  const customer_note = document.getElementById('oedit-note').value.trim();
  const status       = document.getElementById('oedit-status').value;

  const { data: prevOrder } = await sb.from('orders').select('*').eq('id', id).single();
  const prevStatus = prevOrder?.status;

  let completedAt, completedBy;
  if (status === 'selesai') {
    completedAt = new Date().toISOString();
    completedBy = prevOrder?.wa_admin_name || _getAdminName();
  }

  const updates = { item_name: itemName, username, qty, unit_price, total_price, customer_note, status };
  if (status === 'selesai') {
    updates.completed_at         = completedAt;
    const { data: { user } = {} } = await sb.auth.getUser().catch(() => ({}));
    updates.completed_by_user_id = user?.id || null;
    updates.completed_by_name    = completedBy;
  }

  const { error } = await sb.from('orders').update(updates).eq('id', id);
  if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }

  if (status === 'selesai' && prevStatus !== 'selesai') {
    await _recordFinanceTx({ ...prevOrder, item_name: itemName, total_price, completed_at: completedAt, completed_by_name: completedBy });
  }

  window.logAdminActivity?.('order_edit', 'order', id, {
    item: itemName, user: username, status,
  });

  orderEditClose();
  if (status === 'selesai' && prevStatus !== 'selesai') _refreshFinanceIfActive();

  const label = { selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' }[status] || '✅ Tersimpan';
  showToast(`${label} — Order berhasil diperbarui`, 'success');
  ordersLoad();
  _syncAllOrdersIfActive();
};

/* ─────────────────────────────────────────────────────
   SYNC HELPER — refresh "Semua Pesanan" jika aktif
───────────────────────────────────────────────────── */
function _syncAllOrdersIfActive() {
  const el = document.getElementById('all-orders-section');
  if (el && el.style.display !== 'none' && typeof window.allOrdersLoad === 'function') {
    window.allOrdersLoad();
  }
}

/* ─────────────────────────────────────────────────────
   SEMUA PESANAN
───────────────────────────────────────────────────── */
window.allOrdersLoad = async function () {
  const sb = getSb();
  if (!sb) return;
  const container = document.getElementById('all-orders-table-body');
  const statsEl   = document.getElementById('all-orders-stats');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" style="padding:16px;color:var(--text-muted);text-align:center">Memuat…</td></tr>';

  const searchVal = (document.getElementById('all-orders-search')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('all-orders-filter-status')?.value || '';
  const filterDate   = document.getElementById('all-orders-filter-date')?.value   || '';

  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (filterStatus) q = q.eq('status', filterStatus);
  if (filterDate)   q = q.gte('created_at', filterDate + 'T00:00:00').lte('created_at', filterDate + 'T23:59:59');

  const { data, error } = await q;
  if (error) { container.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:12px">${escHtml(error.message)}</td></tr>`; return; }

  const rows = searchVal
    ? (data || []).filter(o =>
        (o.item_name || '').toLowerCase().includes(searchVal) ||
        (o.username  || '').toLowerCase().includes(searchVal) ||
        String(o.id || '').toLowerCase().includes(searchVal))
    : (data || []);

  if (statsEl) {
    const total = rows.reduce((s,o) => s + Number(o.total_price||0), 0);
    statsEl.textContent = `${rows.length} pesanan • Total: Rp ${total.toLocaleString('id-ID')}`;
  }

  if (!rows.length) {
    container.innerHTML = '<tr><td colspan="7" style="padding:16px;color:var(--text-muted);text-align:center">Tidak ada data.</td></tr>';
    return;
  }

  const STATUS_MAP = { pending:'⏳ Pending', selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' };
  const STATUS_CLS = { pending:'color:#f6ad55', selesai:'color:#4ade80', refund:'color:#fc8181', cancelled:'color:#a0aec0' };

  container.innerHTML = rows.map(o => `
    <tr>
      <td style="padding:8px 10px;font-size:11px;color:var(--text-muted)">#${escHtml(String(o.id).slice(-6).toUpperCase())}</td>
      <td style="padding:8px 10px;font-size:12.5px">${escHtml(o.item_name || '—')}</td>
      <td style="padding:8px 10px">${escHtml(o.username || '—')}</td>
      <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">Rp ${Number(o.total_price||0).toLocaleString('id-ID')}</td>
      <td style="padding:8px 10px;${STATUS_CLS[o.status]||''}">${STATUS_MAP[o.status]||escHtml(o.status||'—')}</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--text-muted)">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}))}</td>
      <td style="padding:8px 10px">
        <div style="display:flex;gap:5px">
          <button onclick="orderEdit('${escHtml(o.id)}')" style="padding:3px 8px;font-size:11px;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:5px;cursor:pointer;color:var(--text)">✏️</button>
          ${_canDelete()
            ? `<button onclick="orderDelete('${escHtml(String(o.id))}')" style="padding:3px 8px;font-size:11px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:5px;cursor:pointer;color:#f87171">🗑️</button>`
            : ''}
        </div>
      </td>
    </tr>`).join('');
};

/* ─────────────────────────────────────────────────────
   EXPORT EXCEL — SEMUA PESANAN
───────────────────────────────────────────────────── */
window.allOrdersExport = async function () {
  const sb = getSb();
  if (!sb) { showToast('Supabase belum siap.', 'error'); return; }

  const filterStatus = document.getElementById('all-orders-filter-status')?.value || '';
  const filterDate   = document.getElementById('all-orders-filter-date')?.value   || '';
  const searchVal    = (document.getElementById('all-orders-search')?.value || '').toLowerCase().trim();

  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);
  if (filterStatus) q = q.eq('status', filterStatus);
  if (filterDate)   q = q.gte('created_at', filterDate + 'T00:00:00').lte('created_at', filterDate + 'T23:59:59');

  const { data, error } = await q;
  if (error) { showToast('Gagal ambil data: ' + error.message, 'error'); return; }

  const rows = searchVal
    ? (data||[]).filter(o =>
        (o.item_name||'').toLowerCase().includes(searchVal) ||
        (o.username ||'').toLowerCase().includes(searchVal))
    : (data||[]);

  if (!rows.length) { showToast('Tidak ada data untuk diekspor.', 'error'); return; }

  const STATUS_MAP = { pending:'Pending', selesai:'Selesai', refund:'Refund', cancelled:'Cancelled' };

  // FIX v2.4: ganti key 'item' → 'item_name' agar konsisten dengan kolom DB
  const headers = [
    { header: 'ID',           key: 'id',           width: 10 },
    { header: 'Item',         key: 'item_name',    width: 26 },
    { header: 'Username',     key: 'username',     width: 18 },
    { header: 'Qty',          key: 'qty',          width: 6  },
    { header: 'Harga Satuan', key: 'unit_price',   width: 16 },
    { header: 'Total',        key: 'total_price',  width: 16 },
    { header: 'Status',       key: 'status',       width: 12 },
    { header: 'Catatan',      key: 'note',         width: 28 },
    { header: 'Admin WA',     key: 'wa_admin',     width: 18 },
    { header: 'Tanggal',      key: 'created_at',   width: 20 },
    { header: 'Selesai Oleh', key: 'completed_by', width: 18 },
  ];

  const csvRows = [
    headers.map(h => `"${h.header}"`).join(','),
    ...rows.map(o => [
      `"${String(o.id||'').slice(-6).toUpperCase()}"`,
      `"${(o.item_name||'').replace(/"/g,'""')}"`,
      `"${(o.username||'').replace(/"/g,'""')}"`,
      o.qty || 1,
      o.unit_price  || 0,
      o.total_price || 0,
      `"${STATUS_MAP[o.status] || o.status || ''}"`,
      `"${(o.customer_note||'').replace(/"/g,'""')}"`,
      `"${(o.wa_admin_name||'').replace(/"/g,'""')}"`,
      `"${new Date(o.created_at).toLocaleString('id-ID')}"`,
      `"${(o.completed_by_name||'').replace(/"/g,'""')}"`,
    ].join(','))
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pesanan_${filterDate || new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Export berhasil!', 'success');
};

/* ─────────────────────────────────────────────────────
   REALTIME LISTENER
───────────────────────────────────────────────────── */
let _realtimeChannel = null;
let _lastOrderIds    = new Set();

window.ordersStartRealtime = function () {
  const sb = getSb();
  if (!sb || _realtimeChannel) return;

  _realtimeChannel = sb
    .channel('orders-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      const o = payload.new;
      if (!o || _lastOrderIds.has(o.id)) return;
      _lastOrderIds.add(o.id);
      _showOrderNotification(o);
      ordersLoad();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
      ordersLoad();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
      ordersLoad();
    })
    .subscribe();
};

window.ordersStopRealtime = function () {
  const sb = getSb();
  if (!sb || !_realtimeChannel) return;
  sb.removeChannel(_realtimeChannel);
  _realtimeChannel = null;
};

/* ─────────────────────────────────────────────────────
   FINANCE REFRESH HELPER
───────────────────────────────────────────────────── */
function _refreshFinanceIfActive() {
  if (typeof window.financeLoad === 'function') {
    const el = document.getElementById('finance-section') || document.getElementById('finance-v2-section');
    if (el && el.style.display !== 'none') window.financeLoad();
  }
  if (typeof window.financeV2Load === 'function') {
    const el = document.getElementById('finance-v2-section');
    if (el && el.style.display !== 'none') window.financeV2Load();
  }
}
