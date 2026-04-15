// admin-orders.js — Pesanan Masuk + Semua Pesanan
//
//   Requires: window._adminSb (dari admin-init.js)
//

/* ─────────────────────────────────────────────────────
   TOAST helper (lokal, fallback jika showToast global belum ada)
───────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  if (typeof window.showToast === 'function' && showToast !== arguments.callee) {
    return window.showToast(msg, type);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

function getSb() { return window._adminSb || null; }
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─────────────────────────────────────────────────────
   PESANAN MASUK
───────────────────────────────────────────────────── */
window.ordersLoad = async function () {
  const sb = getSb();
  if (!sb) return;
  const container = document.getElementById('orders-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:10px 0;">Memuat pesanan...</p>';

  const { data, error } = await sb
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const badge = document.getElementById('orders-badge');
  if (error) {
    container.innerHTML = `<p style="color:var(--error)">Gagal: ${escHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:10px 0;">Tidak ada pesanan masuk saat ini.</p>';
    if (badge) badge.style.display = 'none';
    return;
  }

  if (badge) { badge.textContent = data.length; badge.style.display = 'inline-flex'; }

  container.innerHTML = data.map(o => `
    <div class="order-card" id="ocard-${escHtml(o.id)}">
      <div class="order-card-head">
        <span class="order-id-badge">#${escHtml(String(o.id).slice(-4).toUpperCase())}</span>
        <span class="order-time">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}))}</span>
      </div>
      <div class="order-item-name">${escHtml(o.item_name || '—')}</div>
      <div class="order-tags">
        ${o.username ? `<span class="order-tag">👤 ${escHtml(o.username)}</span>` : ''}
        ${o.qty ? `<span class="order-tag">×${escHtml(String(o.qty))}</span>` : ''}
        ${o.total_price ? `<span class="order-tag price-tag">Rp ${Number(o.total_price).toLocaleString('id-ID')}</span>` : ''}
        ${o.wa_admin_name ? `<span class="order-tag">💬 Admin: ${escHtml(o.wa_admin_name)}</span>` : ''}
      </div>
      ${o.customer_note ? `<div class="order-note">"${escHtml(o.customer_note)}"</div>` : ''}
      <div class="order-actions">
        <button class="btn-done" onclick="orderMarkDone('${o.id}')">✅ Selesai</button>
        <button class="btn-edit-order" onclick="oeditOpen('${escHtml(o.id)}')">✏️ Edit</button>
        <button class="btn-delete-order" onclick="orderDelete('${escHtml(o.id)}')">🗑️</button>
      </div>
    </div>
  `).join('');

  /* stats bar */
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = new Date(); end.setHours(23,59,59,999);
  const { count: doneToday }    = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'selesai').gte('completed_at', start).lt('completed_at', end);
  const { data: revData }       = await sb.from('orders').select('total_price').eq('status', 'selesai').gte('completed_at', start).lt('completed_at', end);
  const rev = (revData || []).reduce((s, r) => s + (r.total_price || 0), 0);
  const stEl = document.getElementById('orders-stats');
  if (stEl) stEl.innerHTML = `
    <span>📦 Pending: <strong>${data.length}</strong></span>
    <span>✅ Selesai hari ini: <strong>${doneToday||0}</strong></span>
    <span>💰 Pendapatan hari ini: <strong>Rp ${rev.toLocaleString('id-ID')}</strong></span>
  `;
};

/* ─────────────────────────────────────────────────────
   REALTIME SUBSCRIBE — auto-refresh pesanan masuk
───────────────────────────────────────────────────── */
let _ordersChannel = null;

window.ordersSubscribe = function () {
  const sb = getSb();
  if (!sb) return;

  // Hindari duplicate channel
  if (_ordersChannel) {
    try { sb.removeChannel(_ordersChannel); } catch(e) {}
    _ordersChannel = null;
  }

  _ordersChannel = sb
    .channel('orders-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
    }, () => {
      ordersLoad();
      // Refresh all-orders jika sedang aktif
      const allSec = document.getElementById('sec-all-orders');
      if (allSec && allSec.classList.contains('active')) {
        if (typeof window.allOrdersLoad === 'function') window.allOrdersLoad();
      }
    })
    .subscribe();
};

/* ─────────────────────────────────────────────────────
   MARK DONE
───────────────────────────────────────────────────── */
window.orderMarkDone = async function (id) {
  const sb = getSb();
  if (!sb) return;
  const user = window.currentUser;

  const { data: existingOrder } = await sb.from('orders').select('wa_admin_name').eq('id', id).single();

  const { error } = await sb.from('orders').update({
    status: 'selesai',
    completed_at: new Date().toISOString(),
    completed_by_user_id: user ? user.id : null,
    // Gunakan wa_admin_name supaya performa admin sinkron dengan kolom Admin di tabel pesanan
    completed_by_name: existingOrder?.wa_admin_name
      || (user ? (user.user_metadata?.full_name || user.email || 'admin') : 'admin'),
  }).eq('id', id);

  if (error) { showToast('Gagal: ' + error.message, 'error'); return; }

  const card = document.getElementById(`ocard-${id}`);
  if (card) card.remove();
  showToast('✅ Order selesai!', 'success');
  ordersLoad();
  const allSec = document.getElementById('sec-all-orders');
  if (allSec && allSec.classList.contains('active')) window.allOrdersLoad();
  const finSec = document.getElementById('sec-finance');
  if (finSec && finSec.classList.contains('active') && typeof window.financeLoad === 'function') window.financeLoad();
};

/* ─────────────────────────────────────────────────────
   DELETE ORDER
───────────────────────────────────────────────────── */
window.orderDelete = async function (id) {
  if (!confirm('Hapus pesanan ini?')) return;
  const sb = getSb();
  if (!sb) return;
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
  showToast('🗑️ Pesanan dihapus', 'info');
  ordersLoad();
  const allSec = document.getElementById('sec-all-orders');
  if (allSec && allSec.classList.contains('active')) window.allOrdersLoad();
};

/* ─────────────────────────────────────────────────────
   SAVE EDIT ORDER (dari modal oedit)
───────────────────────────────────────────────────── */
window.oeditSave = async function () {
  const sb = getSb();
  if (!sb) return;
  const id            = document.getElementById('oedit-id').value;
  const item_name     = document.getElementById('oedit-item-name').value.trim();
  const username      = document.getElementById('oedit-username').value.trim();
  const qty           = parseInt(document.getElementById('oedit-qty').value) || 1;
  const unit_price    = parseFloat(document.getElementById('oedit-unit-price').value) || 0;
  const total_price   = parseFloat(document.getElementById('oedit-total-price').value) || 0;
  const customer_note = document.getElementById('oedit-note').value.trim();
  const status        = _getOeditStatus();
  const refund_reason = document.getElementById('oedit-refund-reason')?.value?.trim() || null;
  const user          = window.currentUser;
  const updates = { item_name, username, qty, unit_price, total_price, customer_note, status };
  if (status === 'refund' || status === 'cancelled') updates.refund_reason = refund_reason;
  if (status === 'selesai') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by_user_id = user ? user.id : null;
    // Ambil wa_admin_name dari DB supaya performa sinkron dengan kolom Admin
    const { data: existingOrder } = await sb.from('orders').select('wa_admin_name').eq('id', id).single();
    updates.completed_by_name = existingOrder?.wa_admin_name
      || (user ? (user.user_metadata?.full_name || user.email || 'admin') : 'admin');
  }
  const btn = document.getElementById('oedit-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  const { error } = await sb.from('orders').update(updates).eq('id', id);
  if (btn) { btn.disabled = false; btn.textContent = 'Simpan Perubahan'; }
  if (error) { showToast('Gagal simpan: ' + error.message, 'error'); return; }
  oeditClose();
  ordersLoad();
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
  const tbody = document.getElementById('all-orders-tbody');
  const totalEl = document.getElementById('all-orders-total');
  if (!tbody) return;

  const statusFilter = document.getElementById('ao-filter-status')?.value || '';
  const adminFilter  = document.getElementById('ao-filter-admin')?.value  || '';
  const searchVal    = (document.getElementById('ao-search')?.value || '').toLowerCase().trim();
  const dateFrom     = document.getElementById('ao-date-from')?.value || '';
  const dateTo       = document.getElementById('ao-date-to')?.value   || '';

  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">Memuat...</td></tr>';

  let q = sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) { tbody.innerHTML = `<tr><td colspan="9" style="color:var(--error);padding:10px">${escHtml(error.message)}</td></tr>`; return; }

  let rows = data || [];

  /* client-side filters */
  if (adminFilter) rows = rows.filter(o => (o.wa_admin_name || '').toLowerCase() === adminFilter.toLowerCase());
  if (searchVal)   rows = rows.filter(o =>
    (o.item_name   || '').toLowerCase().includes(searchVal) ||
    (o.username    || '').toLowerCase().includes(searchVal) ||
    (o.wa_admin_name || '').toLowerCase().includes(searchVal)
  );
  if (dateFrom) rows = rows.filter(o => new Date(o.created_at) >= new Date(dateFrom));
  if (dateTo)   rows = rows.filter(o => new Date(o.created_at) <= new Date(dateTo + 'T23:59:59'));

  const map = { pending:'⏳ Pending', selesai:'✅ Selesai', refund:'💸 Refund', cancelled:'❌ Cancelled' };
  const cls = { pending:'color:#f6ad55', selesai:'color:#4ade80', refund:'color:#fc8181', cancelled:'color:#a0aec0' };

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">Tidak ada data</td></tr>';
    if (totalEl) totalEl.textContent = 'Total: 0 pesanan';
    return;
  }

  tbody.innerHTML = rows.map(o => `
    <tr>
      <td style="padding:8px 10px;"><span class="order-id-badge">#${escHtml(String(o.id).slice(-4).toUpperCase())}</span></td>
      <td style="padding:8px 10px;font-size:11.5px;color:var(--text-muted)">${escHtml(new Date(o.created_at).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'}))}</td>
      <td style="padding:8px 10px;font-size:12.5px;">${escHtml(o.item_name||'—')}</td>
      <td style="padding:8px 10px;text-align:center;">${escHtml(String(o.qty||1))}</td>
      <td style="padding:8px 10px;">${escHtml(o.username||'—')}</td>
      <td style="padding:8px 10px;">${escHtml(o.wa_admin_name||'—')}</td>
      <td style="padding:8px 10px;font-weight:600;color:#4ade80;">Rp ${Number(o.total_price||0).toLocaleString('id-ID')}</td>
      <td style="padding:8px 10px;font-size:12px;${cls[o.status]||''}">${map[o.status]||escHtml(o.status||'—')}</td>
      <td style="padding:8px 10px;">
        <button class="btn-icon" onclick="oeditOpen('${escHtml(o.id)}')" title="Edit">✏️ Edit</button>
        <button class="btn-icon btn-icon-danger" onclick="orderDelete('${escHtml(o.id)}')" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');

  if (totalEl) totalEl.textContent = `Total: ${rows.length} pesanan`;

  /* populate admin filter dropdown */
  const adminSel = document.getElementById('ao-filter-admin');
  if (adminSel && adminSel.options.length <= 1) {
    const admins = [...new Set((data||[]).map(o => o.wa_admin_name).filter(Boolean))].sort();
    admins.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      adminSel.appendChild(opt);
    });
  }
};

/* ─────────────────────────────────────────────────────
   EDIT ORDER MODAL (oedit)
───────────────────────────────────────────────────── */
window.oeditOpen = async function (id) {
  const sb = getSb();
  if (!sb) return;
  const overlay = document.getElementById('oedit-overlay');
  if (!overlay) { _injectEditModal(); }

  const { data: o, error } = await sb.from('orders').select('*').eq('id', id).single();
  if (error || !o) { showToast('Gagal ambil data order', 'error'); return; }

  document.getElementById('oedit-id').value           = o.id;
  document.getElementById('oedit-item-name').value    = o.item_name  || '';
  document.getElementById('oedit-username').value     = o.username   || '';
  document.getElementById('oedit-qty').value          = o.qty        || 1;
  document.getElementById('oedit-unit-price').value   = o.unit_price || 0;
  document.getElementById('oedit-total-price').value  = o.total_price|| 0;
  document.getElementById('oedit-note').value         = o.customer_note || '';
  document.getElementById('oedit-wa-admin').value     = o.wa_admin_name || '';

  /* set status radio */
  const radios = document.querySelectorAll('input[name="oedit-status"]');
  radios.forEach(r => { r.checked = (r.value === (o.status||'pending')); });
  _oeditUpdateStatusUI(o.status||'pending');

  /* refund reason */
  const rrWrap = document.getElementById('oedit-refund-wrap');
  const rrIn   = document.getElementById('oedit-refund-reason');
  if (rrWrap) rrWrap.style.display = (o.status==='refund'||o.status==='cancelled') ? 'block' : 'none';
  if (rrIn)   rrIn.value = o.refund_reason || '';

  const ov = document.getElementById('oedit-overlay');
  if (ov) { ov.style.display='flex'; setTimeout(()=>ov.classList.add('oedit-visible'),10); }
};

window.oeditClose = function () {
  const ov = document.getElementById('oedit-overlay');
  if (!ov) return;
  ov.classList.remove('oedit-visible');
  setTimeout(() => { ov.style.display='none'; }, 220);
};

function _getOeditStatus() {
  const r = document.querySelector('input[name="oedit-status"]:checked');
  return r ? r.value : 'pending';
}

function _oeditUpdateStatusUI(status) {
  const rrWrap = document.getElementById('oedit-refund-wrap');
  if (rrWrap) rrWrap.style.display = (status==='refund'||status==='cancelled') ? 'block' : 'none';
}

window.oeditStatusChange = function (radio) {
  _oeditUpdateStatusUI(radio.value);
};

window.oeditRecalc = function () {
  const qty   = parseFloat(document.getElementById('oedit-qty')?.value)        || 0;
  const price = parseFloat(document.getElementById('oedit-unit-price')?.value) || 0;
  const totEl = document.getElementById('oedit-total-price');
  if (totEl) totEl.value = (qty * price).toFixed(0);
};

/* ─────────────────────────────────────────────────────
   INJECT EDIT MODAL (kalau belum ada di DOM)
───────────────────────────────────────────────────── */
function _injectEditModal() {
  if (document.getElementById('oedit-overlay')) return;
  const div = document.createElement('div');
  div.innerHTML = `
<div id="oedit-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;" onclick="if(event.target===this)oeditClose()">
  <div class="oedit-modal" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(480px,95vw);max-height:90vh;overflow-y:auto;animation:oeditIn .22s ease;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div style="font-size:14px;font-weight:700;color:var(--text);">✏️ Edit Pesanan</div>
      <button onclick="oeditClose()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;line-height:1;">×</button>
    </div>
    <input type="hidden" id="oedit-id">

    <div style="display:grid;gap:12px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Item</label>
        <input id="oedit-item-name" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;" placeholder="Nama item">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Username</label>
          <input id="oedit-username" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;" placeholder="Username">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Admin WA</label>
          <input id="oedit-wa-admin" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;" placeholder="Nama admin">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Qty</label>
          <input id="oedit-qty" type="number" min="1" oninput="oeditRecalc()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Harga Satuan</label>
          <input id="oedit-unit-price" type="number" min="0" oninput="oeditRecalc()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Total</label>
          <input id="oedit-total-price" type="number" min="0" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;">
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Catatan</label>
        <textarea id="oedit-note" rows="2" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;resize:vertical;" placeholder="Catatan pembeli"></textarea>
      </div>

      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:8px;">Status</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-pending"    value="pending"    onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-pending"    for="os-pending">⏳ Pending</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-selesai"   value="selesai"   onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-selesai"   for="os-selesai">✅ Selesai</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-refund"    value="refund"    onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-refund"    for="os-refund">💸 Refund</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="os-cancelled" value="cancelled" onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-cancelled" for="os-cancelled">❌ Cancelled</label>
        </div>
      </div>

      <div id="oedit-refund-wrap" style="display:none;">
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px;">Alasan Refund/Cancel</label>
        <input id="oedit-refund-reason" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;outline:none;" placeholder="Alasan...">
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end;">
      <button onclick="oeditClose()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 16px;color:var(--text-muted);font-size:13px;cursor:pointer;">Batal</button>
      <button id="oedit-save-btn" onclick="oeditSave()" style="background:var(--accent);border:none;border-radius:8px;padding:8px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Simpan Perubahan</button>
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
