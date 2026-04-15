// admin-orders.js — Pesanan Masuk + Semua Pesanan
//
//   Requires: window._adminSb (dari admin-init.js)
//

/* ─────────────────────────────────────────────────────
   TOAST helper (lokal, fallback ke console)
───────────────────────────────────────────────────── */
function showToast(msg, type) {
  if (typeof window.showAdminToast === 'function') {
    window.showAdminToast(msg, type);
  } else {
    console[type === 'error' ? 'error' : 'log']('[Orders]', msg);
  }
}

/* ─────────────────────────────────────────────────────
   CONFIRM DIALOG
───────────────────────────────────────────────────── */
function showConfirm({ title, message, confirmText, onConfirm }) {
  const existing = document.getElementById('orders-confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'orders-confirm-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="background:var(--card-bg,#1a1a1a);border:1px solid var(--border,#2a2a2a);border-radius:12px;
                padding:28px 32px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);">
      <div style="font-size:16px;font-weight:700;color:var(--text,#eee);margin-bottom:8px;">${title||'Konfirmasi'}</div>
      <div style="font-size:13px;color:var(--text-muted,#888);margin-bottom:22px;line-height:1.5;">${message||''}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="oc-cancel" style="padding:8px 18px;border-radius:7px;border:1px solid var(--border,#333);
                background:transparent;color:var(--text,#eee);font-size:13px;cursor:pointer;">Batal</button>
        <button id="oc-confirm" style="padding:8px 18px;border-radius:7px;border:none;
                background:#e53e3e;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">${confirmText||'Ya'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#oc-cancel').onclick  = () => modal.remove();
  modal.querySelector('#oc-confirm').onclick = () => { modal.remove(); onConfirm && onConfirm(); };
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/* ─────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtRp(n) {
  if (!n && n !== 0) return '—';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function shortId(uuid) {
  if (!uuid) return '????';
  return uuid.replace(/-/g,'').slice(-4).toUpperCase();
}

function getSb() {
  return window._adminSb || null;
}

/* ─────────────────────────────────────────────────────
   BADGE (notif pesanan pending di nav)
───────────────────────────────────────────────────── */
async function _ordersFetchBadge() {
  const sb = getSb();
  if (!sb) return 0;
  const { count } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count || 0;
}

function _ordersBadgeSubscribe() {
  const sb = getSb();
  if (!sb) return;
  sb.channel('orders-badge-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      const n = await _ordersFetchBadge();
      ordersUpdateBadge(n);
    })
    .subscribe();
}

window.ordersInitBadge = function () {
  _ordersFetchBadge().then(n => ordersUpdateBadge(n));
  _ordersBadgeSubscribe();
};

/* ─────────────────────────────────────────────────────
   ORDERS LOAD (Pesanan Masuk — pending saja)
───────────────────────────────────────────────────── */
async function ordersLoad() {
  const sb = getSb();
  if (!sb) return;
  const list = document.getElementById('orders-list');
  if (!list) return;

  list.innerHTML = '<div class="empty-state">Memuat...</div>';

  const { data, error } = await sb
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = `<div class="empty-state" style="color:#ff5a5a">Gagal memuat: ${error.message}</div>`;
    return;
  }

  ordersRenderList(data || []);
  ordersUpdateBadge(data ? data.length : 0);
  ordersLoadStats();
}

function ordersRenderList(orders) {
  const list = document.getElementById('orders-list');
  if (!list) return;

  if (!orders.length) {
    list.innerHTML = '<div class="empty-state">🎉 Tidak ada pesanan pending saat ini.</div>';
    return;
  }

  list.innerHTML = orders.map(o => `
    <div class="order-card" id="ocard-${o.id}">
      <div class="order-card-head">
        <div class="order-card-left">
          <span class="order-emoji">${o.item_emoji || '🛒'}</span>
          <div>
            <div class="order-item-name">${escHtml(o.item_name)}</div>
            <div class="order-meta">
              <span class="order-id-badge">${shortId(o.id)}</span>
              &nbsp;·&nbsp;${escHtml(o.item_category || '')} &nbsp;·&nbsp; ${fmtDate(o.created_at)}
            </div>
          </div>
        </div>
        <div class="order-price">${fmtRp(o.total_price)}</div>
      </div>
      <div class="order-details">
        ${o.qty > 1 ? `<span class="order-tag">📦 ${o.qty}x @ ${fmtRp(o.unit_price)}</span>` : ''}
        ${o.username ? `<span class="order-tag">👤 ${escHtml(o.username)}</span>` : ''}
        ${o.wa_admin_name ? `<span class="order-tag">💬 Admin: ${escHtml(o.wa_admin_name)}</span>` : ''}
        ${o.customer_note ? `<span class="order-tag" title="${escHtml(o.customer_note)}">📝 Ada catatan</span>` : ''}
      </div>
      ${o.customer_note ? `<div class="order-note">"${escHtml(o.customer_note)}"</div>` : ''}
      <div class="order-actions">
        <button class="btn-done" onclick="orderMarkDone('${o.id}')">✅ Selesai</button>
        <button class="btn-edit-order" onclick="orderEdit('${o.id}')">✏️ Edit</button>
        <button class="btn-ghost" style="font-size:12px;padding:6px 14px;" onclick="orderDelete('${o.id}','orders')">🗑 Hapus</button>
      </div>
    </div>
  `).join('');
}

async function ordersLoadStats() {
  const sb = getSb();
  if (!sb) return;
  const { start, end } = todayRange();

  const { count: pendingCount } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: doneToday } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'selesai')
    .gte('completed_at', start)
    .lt('completed_at', end);

  const { data: revData } = await sb
    .from('orders')
    .select('total_price')
    .eq('status', 'selesai')
    .gte('completed_at', start)
    .lt('completed_at', end);

  const revToday = (revData || []).reduce((s, r) => s + (r.total_price || 0), 0);

  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('ostat-pending',    pendingCount ?? '—');
  el('ostat-done-today', doneToday ?? '—');
  el('ostat-rev-today',  fmtRp(revToday));
}

function ordersUpdateBadge(n) {
  const badge = document.getElementById('orders-badge');
  if (!badge) return;
  if (n > 0) {
    badge.textContent = n > 99 ? '99+' : n;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ─────────────────────────────────────────────────────
   ORDER MARK DONE
───────────────────────────────────────────────────── */
window.orderMarkDone = async function (id) {
  const sb = getSb();
  if (!sb) return;

  const user = window.currentUser;

  // Ambil wa_admin_name dari order yang ada
  const { data: existingOrder } = await sb
    .from('orders')
    .select('wa_admin_name')
    .eq('id', id)
    .single();

  const { error } = await sb
    .from('orders')
    .update({
      status: 'selesai',
      completed_at: new Date().toISOString(),
      completed_by_user_id: user ? user.id : null,
      // Pakai wa_admin_name agar performa sinkron dengan kolom Admin
      completed_by_name: existingOrder?.wa_admin_name
        || (user ? (user.user_metadata?.full_name || user.email || 'admin') : 'admin'),
    })
    .eq('id', id);

  if (error) {
    showToast('Gagal update order: ' + error.message, 'error');
    return;
  }

  // Animasi hilang dari list pending
  const card = document.getElementById('ocard-' + id);
  if (card) {
    card.style.transition = 'opacity .3s, transform .3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(() => card.remove(), 320);
  }

  showToast('✅ Order selesai!', 'success');
  ordersLoadStats();

  // Refresh all-orders kalau sedang terbuka
  const allSec = document.getElementById('sec-all-orders');
  if (allSec && allSec.classList.contains('active')) {
    window.allOrdersLoad();
  }
};

/* ─────────────────────────────────────────────────────
   ORDER DELETE
───────────────────────────────────────────────────── */
window.orderDelete = function (id, context) {
  showConfirm({
    title: 'Hapus Order?',
    message: 'Order ini akan dihapus permanen dan tidak bisa dikembalikan.',
    confirmText: 'Hapus',
    onConfirm: async () => {
      const sb = getSb();
      if (!sb) return;
      const { error } = await sb.from('orders').delete().eq('id', id);
      if (error) {
        showToast('Gagal hapus: ' + error.message, 'error');
        return;
      }
      showToast('🗑 Order dihapus', 'success');
      if (context === 'all-orders') {
        window.allOrdersLoad();
      } else {
        ordersLoad();
      }
    }
  });
};

/* ─────────────────────────────────────────────────────
   ORDER EDIT
───────────────────────────────────────────────────── */
window.orderEdit = async function (id) {
  const sb = getSb();
  if (!sb) return;

  const { data: o, error } = await sb.from('orders').select('*').eq('id', id).single();
  if (error || !o) { showToast('Gagal memuat order', 'error'); return; }

  const modal = document.getElementById('order-edit-modal');
  if (!modal) { _injectEditModal(); }

  document.getElementById('oedit-id').value         = o.id;
  document.getElementById('oedit-item-name').value  = o.item_name  || '';
  document.getElementById('oedit-username').value   = o.username   || '';
  document.getElementById('oedit-qty').value        = o.qty        || 1;
  document.getElementById('oedit-unit-price').value = o.unit_price || 0;
  document.getElementById('oedit-total-price').value= o.total_price|| 0;
  document.getElementById('oedit-note').value       = o.customer_note || '';

  _setOeditStatus(o.status || 'pending');
  _oeditToggleReason(o.status);
  if (o.refund_reason) document.getElementById('oedit-refund-reason').value = o.refund_reason;

  document.getElementById('order-edit-modal').style.display = 'flex';
};

function _oeditToggleReason(status) {
  const wrap = document.getElementById('oedit-reason-wrap');
  if (wrap) wrap.style.display = (status === 'refund' || status === 'cancelled') ? '' : 'none';
}

window.oeditStatusChange = function (radio) {
  _oeditToggleReason(radio.value);
};

window.oeditClose = function () {
  const m = document.getElementById('order-edit-modal');
  if (m) m.style.display = 'none';
};

window.oeditSave = async function () {
  const sb = getSb();
  if (!sb) return;

  const id          = document.getElementById('oedit-id').value;
  const item_name   = document.getElementById('oedit-item-name').value.trim();
  const username    = document.getElementById('oedit-username').value.trim();
  const qty         = parseInt(document.getElementById('oedit-qty').value) || 1;
  const unit_price  = parseFloat(document.getElementById('oedit-unit-price').value) || 0;
  const total_price = parseFloat(document.getElementById('oedit-total-price').value) || 0;
  const customer_note = document.getElementById('oedit-note').value.trim();
  const status      = _getOeditStatus();
  const refund_reason = document.getElementById('oedit-refund-reason')?.value?.trim() || null;

  const user = window.currentUser;

  const updates = { item_name, username, qty, unit_price, total_price, customer_note, status };
  if (status === 'refund' || status === 'cancelled') updates.refund_reason = refund_reason;
  if (status === 'selesai') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by_user_id = user ? user.id : null;
    updates.completed_by_name = user
      ? (user.user_metadata?.full_name || user.email || 'admin')
      : 'admin';
  }

  const btn = document.getElementById('oedit-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  const { error } = await sb.from('orders').update(updates).eq('id', id);

  if (btn) { btn.disabled = false; btn.textContent = 'Simpan Perubahan'; }

  if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }

  oeditClose();
  ordersLoad();

  // Refresh all-orders kalau sedang terbuka
  const allSec = document.getElementById('sec-all-orders');
  if (allSec && allSec.classList.contains('active')) window.allOrdersLoad();

  const label = status === 'refund' ? '💸 Refund' : status === 'cancelled' ? '❌ Cancelled' : '✅ Tersimpan';
  showToast(`Order diupdate — ${label}`, 'success');
};

/* ─────────────────────────────────────────────────────
   ALL ORDERS — Semua Pesanan (filter & search)
───────────────────────────────────────────────────── */
window.allOrdersLoad = async function () {
  const sb = getSb();
  if (!sb) return;

  const wrap = document.getElementById('all-orders-table');
  if (!wrap) return;
  wrap.innerHTML = '<div class="empty-state">Memuat...</div>';

  const statusFilter = (document.getElementById('ao-filter-status') || {}).value || '';
  const searchVal    = ((document.getElementById('ao-search') || {}).value || '').trim().toLowerCase();

  let query = sb.from('orders').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) {
    wrap.innerHTML = `<div class="empty-state" style="color:#ff5a5a">Gagal memuat: ${error.message}</div>`;
    return;
  }

  let rows = data || [];
  if (searchVal) {
    rows = rows.filter(o =>
      (o.username      || '').toLowerCase().includes(searchVal) ||
      (o.item_name     || '').toLowerCase().includes(searchVal) ||
      (o.wa_admin_name || '').toLowerCase().includes(searchVal)
    );
  }

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty-state">Tidak ada data pesanan.</div>';
    return;
  }

  const statusBadge = s => {
    const map = { pending:'⏳ Pending', selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' };
    const cls = { pending:'color:#f6ad55', selesai:'color:#4ade80', refund:'color:#fc8181', cancelled:'color:#a0aec0' };
    return `<span style="font-size:11px;font-weight:600;${cls[s]||''}">${map[s]||s}</span>`;
  };

  wrap.innerHTML = `
    <p style="font-size:12px;color:var(--text-muted,#888);margin-bottom:8px;">Total: ${rows.length} pesanan</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border,#2a2a2a);color:var(--text-muted,#888);text-align:left;">
          <th style="padding:8px 10px;">ID</th>
          <th style="padding:8px 10px;">Waktu</th>
          <th style="padding:8px 10px;">Item</th>
          <th style="padding:8px 10px;">Qty</th>
          <th style="padding:8px 10px;">Username</th>
          <th style="padding:8px 10px;">Admin</th>
          <th style="padding:8px 10px;">Total</th>
          <th style="padding:8px 10px;">Status</th>
          <th style="padding:8px 10px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(o => `
          <tr style="border-bottom:1px solid var(--border,#1e1e1e);">
            <td style="padding:8px 10px;"><span class="order-id-badge">#${shortId(o.id)}</span></td>
            <td style="padding:8px 10px;color:var(--text-muted,#888);white-space:nowrap;">${fmtDate(o.created_at)}</td>
            <td style="padding:8px 10px;">${o.item_emoji||'🛒'} ${escHtml(o.item_name||'')}</td>
            <td style="padding:8px 10px;text-align:center;">${o.qty||1}</td>
            <td style="padding:8px 10px;">${escHtml(o.username||'—')}</td>
            <td style="padding:8px 10px;">${escHtml(o.wa_admin_name||'—')}</td>
            <td style="padding:8px 10px;color:#4ade80;font-weight:600;">${fmtRp(o.total_price)}</td>
            <td style="padding:8px 10px;">${statusBadge(o.status)}</td>
            <td style="padding:8px 10px;">
              <div style="display:flex;gap:6px;">
                <button class="btn-edit-order" style="font-size:11px;padding:4px 10px;" onclick="orderEdit('${o.id}')">✏️ Edit</button>
                <button class="btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="orderDelete('${o.id}','all-orders')">🗑</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

/* ─────────────────────────────────────────────────────
   OEDIT STATUS helpers
───────────────────────────────────────────────────── */
function _getOeditStatus() {
  const radios = document.querySelectorAll('input[name="oedit-status"]');
  for (const r of radios) { if (r.checked) return r.value; }
  return 'pending';
}

function _setOeditStatus(v) {
  const radios = document.querySelectorAll('input[name="oedit-status"]');
  radios.forEach(r => { r.checked = (r.value === v); });
}

/* ─────────────────────────────────────────────────────
   INJECT MODAL & CSS ke DOM (sekali saja)
───────────────────────────────────────────────────── */
function _injectEditModal() {
  if (document.getElementById('order-edit-modal')) return;

  const style = document.createElement('style');
  style.textContent = `
    .order-id-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      color: var(--accent, #4f7df0);
      background: rgba(79,125,240,0.12);
      border: 1px solid rgba(79,125,240,0.25);
      border-radius: 5px;
      padding: 1px 6px;
    }
    #order-edit-modal {
      position: fixed; inset: 0; z-index: 9998;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    }
    .oedit-box {
      background: var(--card-bg, #1a1a1a);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 14px;
      padding: 28px 30px;
      width: 90%; max-width: 480px;
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,.6);
    }
    .oedit-title { font-size: 16px; font-weight: 700; margin-bottom: 18px; }
    .oedit-field { margin-bottom: 14px; }
    .oedit-field label { display: block; font-size: 12px; color: var(--text-muted,#888); margin-bottom: 5px; }
    .oedit-field input, .oedit-field textarea {
      width: 100%; padding: 8px 12px; border-radius: 8px;
      border: 1px solid var(--border,#2a2a2a);
      background: var(--input-bg, #111); color: var(--text,#eee);
      font-size: 13px;
    }
    .oedit-field textarea { resize: vertical; min-height: 72px; }
    .oedit-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .oedit-status-badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .oedit-status-opt { display: none; }
    .oedit-status-label {
      padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      border: 1px solid transparent; cursor: pointer; transition: all .15s;
    }
    .oedit-status-opt:checked + .oedit-status-label { border-color: currentColor; }
    .oedit-status-label-pending   { color: #f6ad55; background: rgba(246,173,85,.1); }
    .oedit-status-label-selesai   { color: #4ade80; background: rgba(74,222,128,.1); }
    .oedit-status-label-refund    { color: #fc8181; background: rgba(252,129,129,.1); }
    .oedit-status-label-cancelled { color: #a0aec0; background: rgba(160,174,192,.1); }
    .oedit-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .oedit-cancel-btn {
      padding: 9px 20px; border-radius: 8px; border: 1px solid var(--border,#333);
      background: transparent; color: var(--text,#eee); font-size: 13px; cursor: pointer;
    }
    .oedit-save-btn {
      padding: 9px 22px; border-radius: 8px; border: none;
      background: var(--accent, #4f7df0); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .oedit-save-btn:disabled { opacity: .6; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'order-edit-modal';
  modal.innerHTML = `
    <div class="oedit-box">
      <div class="oedit-title">✏️ Edit Order</div>
      <input type="hidden" id="oedit-id">
      <div class="oedit-field">
        <label>Nama Item</label>
        <input type="text" id="oedit-item-name" placeholder="Nama produk...">
      </div>
      <div class="oedit-field">
        <label>Username</label>
        <input type="text" id="oedit-username" placeholder="Username pembeli...">
      </div>
      <div class="oedit-row-2">
        <div class="oedit-field">
          <label>Qty</label>
          <input type="number" id="oedit-qty" min="1" value="1">
        </div>
        <div class="oedit-field">
          <label>Harga Satuan</label>
          <input type="number" id="oedit-unit-price" min="0" value="0">
        </div>
      </div>
      <div class="oedit-field">
        <label>Total Harga</label>
        <input type="number" id="oedit-total-price" min="0" value="0">
      </div>
      <div class="oedit-field">
        <label>Catatan</label>
        <textarea id="oedit-note" placeholder="Catatan pembeli..."></textarea>
      </div>
      <div class="oedit-field">
        <label>Status</label>
        <div class="oedit-status-badges">
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-pending"   value="pending"   onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-pending"   for="os-pending">⏳ Pending</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-selesai"   value="selesai"   onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-selesai"   for="os-selesai">✅ Selesai</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-refund"    value="refund"    onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-refund"    for="os-refund">💸 Refund</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-cancelled" value="cancelled" onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-cancelled" for="os-cancelled">❌ Cancelled</label>
        </div>
      </div>
      <div class="oedit-field" id="oedit-reason-wrap" style="display:none;">
        <label>Alasan Refund / Batal</label>
        <textarea id="oedit-refund-reason" placeholder="Tulis alasan..."></textarea>
      </div>
      <div class="oedit-footer">
        <button class="oedit-cancel-btn" onclick="oeditClose()">Batal</button>
        <button class="oedit-save-btn" id="oedit-save-btn" onclick="oeditSave()">Simpan Perubahan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

/* ─────────────────────────────────────────────────────
   INIT — inject modal on DOM ready
───────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectEditModal);
} else {
  _injectEditModal();
}
