/* ══════════════════════════════════════════════════════
   admin-orders.js — Pesanan Masuk + Semua Pesanan + Laporan Keuangan
   Requires: window._adminSb (dari admin-init.js)
══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────
   TOAST HELPER (local)
───────────────────────────────────────────────────── */
function showToast(msg, type) {
  type = type || 'success';
  if (typeof window.showAdminToast === 'function') {
    window.showAdminToast(msg, type);
    return;
  }
  let container = document.getElementById('toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.style.cssText = [
    'padding:10px 16px',
    'border-radius:10px',
    'font-size:13px',
    'font-weight:500',
    'color:#fff',
    'box-shadow:0 4px 16px rgba(0,0,0,.35)',
    'opacity:0',
    'transform:translateY(8px)',
    'transition:opacity .22s,transform .22s',
    'pointer-events:none',
    type === 'error'
      ? 'background:rgba(239,68,68,.92)'
      : 'background:rgba(34,197,94,.88)',
  ].join(';');
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

/* ─────────────────────────────────────────────────────
   CUSTOM CONFIRM DIALOG
   Pemakaian: showConfirm({ title, message, confirmText, onConfirm })
───────────────────────────────────────────────────── */
function showConfirm({ title, message, confirmText, onConfirm }) {
  const old = document.getElementById('custom-confirm-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'custom-confirm-overlay';

  /* Semua centering pakai inline style langsung — tidak bisa di-override CSS halaman */
  Object.assign(overlay.style, {
    position:        'fixed',
    inset:           '0',
    top:             '0',
    left:            '0',
    right:           '0',
    bottom:          '0',
    width:           '100vw',
    height:          '100vh',
    minHeight:       '100dvh',
    zIndex:          '99999',
    background:      'rgba(0,0,0,0.65)',
    backdropFilter:  'blur(4px)',
    display:         'grid',          /* grid + placeItems = centering paling kuat */
    placeItems:      'center',
    padding:         '16px',
    boxSizing:       'border-box',
    margin:          '0',
    opacity:         '0',
    transition:      'opacity 0.18s ease',
    overflow:        'auto',
  });

  const box = document.createElement('div');
  box.id = 'custom-confirm-box';
  Object.assign(box.style, {
    background:    'var(--surface1, #1a1a2e)',
    border:        '1px solid rgba(255,255,255,0.1)',
    borderRadius:  '14px',
    width:         '100%',
    maxWidth:      '360px',
    padding:       '24px',
    boxShadow:     '0 20px 60px rgba(0,0,0,0.5)',
    transform:     'scale(0.94) translateY(12px)',
    opacity:       '0',
    transition:    'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease',
    flexShrink:    '0',
  });

  box.innerHTML = `
    <!-- Icon -->
    <div style="
      width:44px;height:44px;border-radius:12px;
      background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:20px;margin-bottom:16px;
    ">🗑️</div>

    <!-- Title -->
    <div style="font-size:15px;font-weight:700;color:var(--text-main,#fff);margin-bottom:6px;">
      ${title || 'Hapus Pesanan?'}
    </div>

    <!-- Message -->
    <div style="font-size:13px;color:var(--text-faint,#888);line-height:1.5;margin-bottom:20px;">
      ${message || 'Tindakan ini tidak bisa dibatalkan.'}
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="cc-cancel" style="
        padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;
        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
        color:var(--text-main,#ccc);cursor:pointer;font-family:inherit;
        transition:background 0.15s;
      ">Batal</button>
      <button id="cc-confirm" style="
        padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;
        background:rgba(239,68,68,0.85);border:1px solid rgba(239,68,68,0.4);
        color:#fff;cursor:pointer;font-family:inherit;
        transition:background 0.15s;
      ">${confirmText || 'Ya, Hapus'}</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  /* Animasi masuk — tunggu browser render overlay dulu */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      box.style.opacity = '1';
      box.style.transform = 'scale(1) translateY(0)';
    });
  });

  const cancelBtn  = document.getElementById('cc-cancel');
  const confirmBtn = document.getElementById('cc-confirm');

  cancelBtn.addEventListener('mouseenter',  () => cancelBtn.style.background  = 'rgba(255,255,255,0.12)');
  cancelBtn.addEventListener('mouseleave',  () => cancelBtn.style.background  = 'rgba(255,255,255,0.06)');
  confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = 'rgba(239,68,68,1)');
  confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = 'rgba(239,68,68,0.85)');

  function closeDialog() {
    box.style.opacity   = '0';
    box.style.transform = 'scale(0.94) translateY(12px)';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  }

  cancelBtn.addEventListener('click', closeDialog);
  confirmBtn.addEventListener('click', () => { closeDialog(); onConfirm && onConfirm(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

  function onKeyDown(e) {
    if (e.key === 'Escape') { closeDialog(); document.removeEventListener('keydown', onKeyDown); }
  }
  document.addEventListener('keydown', onKeyDown);
}

/* ─────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────── */
function fmtRp(n) {
  if (n == null || isNaN(n)) return '—';
  return 'Rp\u00a0' + Number(n).toLocaleString('id-ID');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function shortId(uuid) {
  if (!uuid) return '—';
  return '#' + String(uuid).replace(/-/g, '').slice(0, 8).toUpperCase();
}

/* ─────────────────────────────────────────────────────
   RADIO STATUS HELPERS
───────────────────────────────────────────────────── */
function _getOeditStatus() {
  const checked = document.querySelector('input[name="oedit-status"]:checked');
  return checked ? checked.value : 'pending';
}

function _setOeditStatus(v) {
  const radio = document.querySelector(`input[name="oedit-status"][value="${v}"]`);
  if (radio) radio.checked = true;
}

/* ─────────────────────────────────────────────────────
   SHARED: get Supabase client
───────────────────────────────────────────────────── */
function getSb() {
  return window._adminSb;
}

/* ─────────────────────────────────────────────────────
   BADGE ONLY — fetch count pending & update badge
   Dipanggil saat halaman pertama load (tanpa perlu buka section orders)
───────────────────────────────────────────────────── */
async function _ordersFetchBadge() {
  const sb = getSb();
  if (!sb) return;
  const { count, error } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (!error) ordersUpdateBadge(count || 0);
}

/* ─────────────────────────────────────────────────────
   REALTIME BADGE SUBSCRIPTION
   Hanya untuk update badge — subscribe sekali saat login
───────────────────────────────────────────────────── */
let _ordersBadgeChannel = null;

function _ordersBadgeSubscribe() {
  const sb = getSb();
  if (!sb || _ordersBadgeChannel) return;
  _ordersBadgeChannel = sb
    .channel('orders-badge-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      _ordersFetchBadge();
      /* Kalau section orders sedang terbuka, refresh list-nya juga */
      const sec = document.getElementById('sec-orders');
      if (sec && sec.classList.contains('active')) ordersLoad();
    })
    .subscribe();
}

/**
 * ordersInitBadge() — panggil ini setelah login berhasil.
 * Langsung fetch count + subscribe realtime tanpa membuka section orders.
 */
window.ordersInitBadge = function () {
  _ordersFetchBadge();
  _ordersBadgeSubscribe();
};

/* ─────────────────────────────────────────────────────
   PESANAN MASUK — load & render
───────────────────────────────────────────────────── */
let _ordersChannel = null;

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
   MARK AS DONE
───────────────────────────────────────────────────── */
window.orderMarkDone = async function (id) {
  const sb = getSb();
  if (!sb) return;

  const btn = document.querySelector(`#ocard-${id} .btn-done`);
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  const user = window.currentUser;
  const { error } = await sb
    .from('orders')
    .update({
      status:              'selesai',
      completed_at:        new Date().toISOString(),
      completed_by_user_id: user ? user.id   : null,
      completed_by_name:   user ? (user.user_metadata?.full_name || user.email || 'admin') : 'admin',
    })
    .eq('id', id);

  if (error) {
    showToast('Gagal update: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Selesai'; }
    return;
  }

  const card = document.getElementById('ocard-' + id);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(() => { card.remove(); ordersLoad(); }, 320);
  }
  showToast('Order ditandai selesai ✅', 'success');
};

/* ─────────────────────────────────────────────────────
   DELETE ORDER
   context: 'orders' | 'all-orders'
───────────────────────────────────────────────────── */
window.orderDelete = function (id, context) {
  showConfirm({
    title:       'Hapus Pesanan?',
    message:     `Pesanan <strong>${shortId(id)}</strong> akan dihapus permanen dari database. Tindakan ini tidak bisa dibatalkan.`,
    confirmText: '🗑️ Ya, Hapus',
    onConfirm:   async () => {
      const sb = getSb();
      if (!sb) { showToast('Supabase belum siap.', 'error'); return; }

      const { error } = await sb.from('orders').delete().eq('id', id);
      if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }

      const card = document.getElementById('ocard-' + id);
      if (card) card.remove();

      if (context === 'all-orders') {
        window.allOrdersLoad();
      } else {
        ordersLoad();
      }

      showToast('Order dihapus.', 'success');
    },
  });
};

/* ─────────────────────────────────────────────────────
   EDIT ORDER — modal buka
───────────────────────────────────────────────────── */
window.orderEdit = async function (id) {
  const sb = getSb();
  if (!sb) return;

  const { data: o, error } = await sb.from('orders').select('*').eq('id', id).single();
  if (error || !o) { showToast('Gagal ambil data pesanan.', 'error'); return; }

  document.getElementById('oedit-id').value            = o.id;
  document.getElementById('oedit-item-name').value     = o.item_name || '';
  document.getElementById('oedit-username').value      = o.username || '';
  document.getElementById('oedit-qty').value           = o.qty || 1;
  document.getElementById('oedit-unit-price').value    = o.unit_price || 0;
  document.getElementById('oedit-total-price').value   = o.total_price || 0;
  document.getElementById('oedit-note').value          = o.customer_note || '';
  document.getElementById('oedit-refund-reason').value = o.refund_reason || '';

  const oeditIdLabel = document.getElementById('oedit-order-id-label');
  if (oeditIdLabel) oeditIdLabel.textContent = shortId(o.id);

  _setOeditStatus(o.status || 'pending');
  _oeditToggleReason(o.status);

  document.getElementById('order-edit-modal').style.display = 'flex';
};

function _oeditToggleReason(status) {
  const wrap = document.getElementById('oedit-reason-wrap');
  if (!wrap) return;
  wrap.style.display = (status === 'refund' || status === 'cancelled') ? 'block' : 'none';
}

window.oeditStatusChange = function (radio) {
  _oeditToggleReason(radio.value);
};

window.oeditClose = function () {
  document.getElementById('order-edit-modal').style.display = 'none';
};

window.oeditSave = async function () {
  const sb = getSb();
  if (!sb) return;

  const id         = document.getElementById('oedit-id').value;
  const status     = _getOeditStatus();
  const itemName   = document.getElementById('oedit-item-name').value.trim();
  const username   = document.getElementById('oedit-username').value.trim();
  const qty        = parseInt(document.getElementById('oedit-qty').value) || 1;
  const unitPrice  = parseFloat(document.getElementById('oedit-unit-price').value) || 0;
  const totalPrice = parseFloat(document.getElementById('oedit-total-price').value) || 0;
  const note       = document.getElementById('oedit-note').value.trim();
  const reason     = document.getElementById('oedit-refund-reason').value.trim();

  const user = window.currentUser;
  const adminName = user ? (user.user_metadata?.full_name || user.email || 'admin') : 'admin';

  const payload = {
    item_name:      itemName,
    username:       username,
    qty:            qty,
    unit_price:     unitPrice,
    total_price:    totalPrice,
    customer_note:  note,
    status:         status,
    refund_reason:  (status === 'refund' || status === 'cancelled') ? reason : null,
  };

  if (status === 'selesai') {
    payload.completed_at         = new Date().toISOString();
    payload.completed_by_name    = adminName;
    payload.completed_by_user_id = user ? user.id : null;
  }

  if (status === 'refund' || status === 'cancelled') {
    payload.refunded_by_name    = adminName;
    payload.refunded_by_user_id = user ? user.id : null;
    payload.refunded_at         = new Date().toISOString();
  }

  const saveBtn = document.getElementById('oedit-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan...';

  const { error } = await sb.from('orders').update(payload).eq('id', id);

  saveBtn.disabled = false;
  saveBtn.textContent = 'Simpan Perubahan';

  if (error) {
    showToast('Gagal simpan: ' + error.message, 'error');
    return;
  }

  oeditClose();
  ordersLoad();

  const label = status === 'refund' ? '💸 Refund' : status === 'cancelled' ? '❌ Cancelled' : '✅ Tersimpan';
  showToast(`Order diupdate — ${label}`, 'success');
};

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
      vertical-align: middle;
      user-select: all;
    }
    #order-edit-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .oedit-box {
      background: var(--surface1, #1a1a2e);
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      padding: 24px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      animation: oeditIn 0.22s ease;
    }
    @keyframes oeditIn {
      from { opacity:0; transform:translateY(16px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    .oedit-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .oedit-title  { font-size:15px; font-weight:700; color:var(--text-main,#fff); display:flex; align-items:center; gap:8px; }
    .oedit-close-btn {
      background:none; border:none; color:var(--text-faint,#888); cursor:pointer;
      font-size:18px; line-height:1; padding:4px; border-radius:6px;
      transition:color 0.15s,background 0.15s;
    }
    .oedit-close-btn:hover { color:#fff; background:rgba(255,255,255,0.08); }
    .oedit-field { margin-bottom:14px; }
    .oedit-field label {
      display:block; font-size:11px; font-weight:600; letter-spacing:0.4px;
      text-transform:uppercase; color:var(--text-faint,#888); margin-bottom:5px;
    }
    .oedit-field input, .oedit-field select, .oedit-field textarea {
      width:100%; box-sizing:border-box;
      background:var(--surface2,#252535); border:1px solid var(--border,rgba(255,255,255,0.1));
      border-radius:8px; color:var(--text-main,#fff); font-size:13px;
      padding:8px 12px; outline:none; transition:border-color 0.15s; font-family:inherit;
    }
    .oedit-field input:focus, .oedit-field select:focus, .oedit-field textarea:focus {
      border-color: var(--accent, #4f7df0);
    }
    .oedit-field textarea { resize:vertical; min-height:64px; }
    .oedit-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .oedit-status-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .oedit-status-opt { display:none; }
    .oedit-status-label {
      padding:5px 12px; border-radius:20px; font-size:11.5px; font-weight:600;
      cursor:pointer; border:1.5px solid transparent; transition:all 0.15s; user-select:none;
    }
    .oedit-status-opt:checked + .oedit-status-label { border-color:currentColor; }
    .oedit-status-label-pending   { background:rgba(250,204,21,0.12);  color:#facc15; }
    .oedit-status-label-selesai   { background:rgba(74,222,128,0.12);  color:#4ade80; }
    .oedit-status-label-refund    { background:rgba(251,146,60,0.12);  color:#fb923c; }
    .oedit-status-label-cancelled { background:rgba(248,113,113,0.12); color:#f87171; }
    .oedit-status-opt:checked + .oedit-status-label-pending   { background:rgba(250,204,21,0.22); }
    .oedit-status-opt:checked + .oedit-status-label-selesai   { background:rgba(74,222,128,0.22); }
    .oedit-status-opt:checked + .oedit-status-label-refund    { background:rgba(251,146,60,0.22); }
    .oedit-status-opt:checked + .oedit-status-label-cancelled { background:rgba(248,113,113,0.22); }
    .oedit-footer { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
    .btn-edit-order {
      background:rgba(79,125,240,0.12); border:1px solid rgba(79,125,240,0.3);
      color:#4f7df0; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600;
      cursor:pointer; transition:background 0.15s; font-family:inherit;
    }
    .btn-edit-order:hover { background:rgba(79,125,240,0.22); }
    .oedit-divider { border:none; border-top:1px solid var(--border,rgba(255,255,255,0.08)); margin:16px 0; }
    .ao-status-badge {
      display:inline-flex; align-items:center; gap:4px; padding:3px 9px;
      border-radius:20px; font-size:11px; font-weight:600; white-space:nowrap;
    }
    .ao-status-pending   { background:rgba(250,204,21,0.12); color:#facc15; }
    .ao-status-selesai   { background:rgba(74,222,128,0.12); color:#4ade80; }
    .ao-status-refund    { background:rgba(251,146,60,0.12);  color:#fb923c; }
    .ao-status-cancelled { background:rgba(248,113,113,0.12); color:#f87171; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'order-edit-modal';
  modal.innerHTML = `
    <div class="oedit-box">
      <div class="oedit-header">
        <div class="oedit-title">
          ✏️ Edit Pesanan
          <span class="order-id-badge" id="oedit-order-id-label"></span>
        </div>
        <button class="oedit-close-btn" onclick="oeditClose()">✕</button>
      </div>
      <input type="hidden" id="oedit-id">
      <div class="oedit-field">
        <label>Status Pesanan</label>
        <div class="oedit-status-badges">
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="oedit-s-pending"   value="pending"   onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-pending"   for="oedit-s-pending">⏳ Pending</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="oedit-s-selesai"   value="selesai"   onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-selesai"   for="oedit-s-selesai">✅ Selesai</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="oedit-s-refund"    value="refund"    onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-refund"    for="oedit-s-refund">💸 Refund</label>
          <input class="oedit-status-opt" type="radio" name="oedit-status" id="oedit-s-cancelled" value="cancelled" onchange="oeditStatusChange(this)">
          <label class="oedit-status-label oedit-status-label-cancelled" for="oedit-s-cancelled">❌ Cancelled</label>
        </div>
      </div>
      <div class="oedit-field" id="oedit-reason-wrap" style="display:none">
        <label>Alasan Refund / Pembatalan</label>
        <textarea id="oedit-refund-reason" placeholder="Contoh: pembeli meminta cancel, item habis, dll..."></textarea>
      </div>
      <hr class="oedit-divider">
      <div class="oedit-field">
        <label>Nama Item</label>
        <input id="oedit-item-name" type="text" placeholder="Nama item...">
      </div>
      <div class="oedit-row-2">
        <div class="oedit-field">
          <label>Username Pembeli</label>
          <input id="oedit-username" type="text" placeholder="username">
        </div>
        <div class="oedit-field">
          <label>Qty</label>
          <input id="oedit-qty" type="number" min="1" placeholder="1">
        </div>
      </div>
      <div class="oedit-row-2">
        <div class="oedit-field">
          <label>Harga Satuan (Rp)</label>
          <input id="oedit-unit-price" type="number" min="0" placeholder="0">
        </div>
        <div class="oedit-field">
          <label>Total Harga (Rp)</label>
          <input id="oedit-total-price" type="number" min="0" placeholder="0">
        </div>
      </div>
      <div class="oedit-field">
        <label>Catatan Pembeli</label>
        <textarea id="oedit-note" placeholder="Catatan dari pembeli..."></textarea>
      </div>
      <div class="oedit-footer">
        <button class="btn-ghost" onclick="oeditClose()" style="padding:8px 18px;font-size:13px;">Batal</button>
        <button class="save-btn" id="oedit-save-btn" onclick="oeditSave()" style="padding:8px 20px;font-size:13px;">Simpan Perubahan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) oeditClose();
  });
}

/* ─────────────────────────────────────────────────────
   REALTIME SUBSCRIPTION (untuk section orders)
───────────────────────────────────────────────────── */
function ordersSubscribe() {
  const sb = getSb();
  if (!sb || _ordersChannel) return;
  _ordersChannel = sb
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => ordersLoad())
    .subscribe();
}

window.ordersRefresh = function () { ordersLoad(); };

/* ─────────────────────────────────────────────────────
   SEMUA PESANAN — load & render
───────────────────────────────────────────────────── */
window.allOrdersLoad = async function () {
  const sb = getSb();
  if (!sb) return;

  const container = document.getElementById('all-orders-table');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat...</div>';

  const statusFilter = document.getElementById('ao-filter-status')?.value || '';
  const searchVal    = (document.getElementById('ao-search')?.value || '').trim().toLowerCase();

  let q = sb.from('orders').select('*').order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) {
    container.innerHTML = `<div class="empty-state" style="color:#ff5a5a">Gagal memuat: ${error.message}</div>`;
    return;
  }

  let orders = data || [];
  if (searchVal) {
    orders = orders.filter(o =>
      (o.username  || '').toLowerCase().includes(searchVal) ||
      (o.item_name || '').toLowerCase().includes(searchVal) ||
      shortId(o.id).toLowerCase().includes(searchVal)
    );
  }

  if (!orders.length) {
    container.innerHTML = '<div class="empty-state">Tidak ada pesanan ditemukan.</div>';
    return;
  }

  const statusBadge = (s) => {
    const map = {
      pending:   ['ao-status-pending',   '⏳ Pending'],
      selesai:   ['ao-status-selesai',   '✅ Selesai'],
      refund:    ['ao-status-refund',    '💸 Refund'],
      cancelled: ['ao-status-cancelled', '❌ Cancelled'],
    };
    const [cls, label] = map[s] || ['', s];
    return `<span class="ao-status-badge ${cls}">${label}</span>`;
  };

  const rows = orders.map(o => `
    <tr>
      <td style="white-space:nowrap;font-size:11px;"><span class="order-id-badge">${shortId(o.id)}</span></td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-faint)">${fmtDate(o.created_at)}</td>
      <td>${o.item_emoji || '🛒'} <strong>${escHtml(o.item_name)}</strong></td>
      <td style="text-align:center">${o.qty || 1}</td>
      <td>${o.username ? escHtml(o.username) : '—'}</td>
      <td>${escHtml(o.wa_admin_name || '—')}</td>
      <td style="color:#4ade80;font-weight:600;white-space:nowrap">${fmtRp(o.total_price)}</td>
      <td>${statusBadge(o.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn-edit-order" style="font-size:11px;padding:4px 10px;" onclick="orderEdit('${o.id}')">✏️ Edit</button>
        <button class="btn-ghost" style="font-size:11px;padding:4px 10px;margin-left:4px;" onclick="orderDelete('${o.id}','all-orders')">🗑</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="fin-table" style="min-width:760px">
      <thead><tr><th>ID</th><th>Waktu</th><th>Item</th><th>Qty</th><th>Username</th><th>Admin</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="font-size:11px;color:var(--text-faint);padding:10px 4px 4px;">Total: ${orders.length} pesanan</div>
  `;
};

/* ─────────────────────────────────────────────────────
   LAPORAN KEUANGAN
───────────────────────────────────────────────────── */
window.financeLoad = async function () {
  const monthEl = document.getElementById('finance-month');
  const month   = monthEl ? monthEl.value : '';
  if (!month) { showToast('Pilih bulan terlebih dahulu.', 'error'); return; }
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1).toISOString();
  const end   = new Date(year, mon, 1).toISOString();
  await financeQuery(start, end, `Bulan ${monthEl.value}`);
};

window.financeLoadAll = async function () {
  await financeQuery(null, null, 'Semua Waktu');
};

async function financeQuery(start, end, label) {
  const sb = getSb();
  if (!sb) return;

  ['finance-admin-table','finance-items-table','finance-orders-table'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="empty-state">Memuat...</div>';
  });
  ['fin-total-rev','fin-total-orders','fin-avg-order'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '...';
  });

  let q = sb.from('orders').select('*').eq('status', 'selesai');
  if (start) q = q.gte('completed_at', start);
  if (end)   q = q.lt('completed_at', end);
  q = q.order('completed_at', { ascending: false });

  const { data, error } = await q;
  if (error) { showToast('Gagal load laporan: ' + error.message, 'error'); return; }

  const orders = data || [];
  const totalRev    = orders.reduce((s, o) => s + (o.total_price || 0), 0);
  const totalOrders = orders.length;
  const avgOrder    = totalOrders ? Math.round(totalRev / totalOrders) : 0;

  document.getElementById('fin-total-rev').textContent    = fmtRp(totalRev);
  document.getElementById('fin-total-orders').textContent = totalOrders;
  document.getElementById('fin-avg-order').textContent    = fmtRp(avgOrder);

  const adminMap = {};
  orders.forEach(o => {
    const k = o.completed_by_name || o.wa_admin_name || 'Unknown';
    if (!adminMap[k]) adminMap[k] = { count: 0, rev: 0 };
    adminMap[k].count++;
    adminMap[k].rev += o.total_price || 0;
  });

  const adminRows = Object.entries(adminMap)
    .sort((a, b) => b[1].rev - a[1].rev)
    .map(([name, d], i) => `<tr><td>${i+1}</td><td style="font-weight:600">${escHtml(name)}</td><td>${d.count}</td><td style="color:#4ade80;font-weight:600">${fmtRp(d.rev)}</td></tr>`)
    .join('');

  document.getElementById('finance-admin-table').innerHTML = adminRows
    ? `<table class="fin-table"><thead><tr><th>#</th><th>Admin</th><th>Order</th><th>Pendapatan</th></tr></thead><tbody>${adminRows}</tbody></table>`
    : '<div class="empty-state">Belum ada data.</div>';

  const itemMap = {};
  orders.forEach(o => {
    const k = o.item_name || 'Unknown';
    if (!itemMap[k]) itemMap[k] = { emoji: o.item_emoji || '🛒', count: 0, qty: 0, rev: 0 };
    itemMap[k].count++;
    itemMap[k].qty += o.qty || 1;
    itemMap[k].rev  += o.total_price || 0;
  });

  const itemRows = Object.entries(itemMap)
    .sort((a, b) => b[1].rev - a[1].rev)
    .map(([name, d], i) => `<tr><td>${i+1}</td><td>${d.emoji} <strong>${escHtml(name)}</strong></td><td>${d.qty}</td><td style="color:#4ade80;font-weight:600">${fmtRp(d.rev)}</td></tr>`)
    .join('');

  document.getElementById('finance-items-table').innerHTML = itemRows
    ? `<table class="fin-table"><thead><tr><th>#</th><th>Item</th><th>Qty Terjual</th><th>Pendapatan</th></tr></thead><tbody>${itemRows}</tbody></table>`
    : '<div class="empty-state">Belum ada data.</div>';

  const detailRows = orders.map(o => `
    <tr>
      <td style="white-space:nowrap;font-size:11px;"><span class="order-id-badge">${shortId(o.id)}</span></td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-faint)">${fmtDate(o.completed_at)}</td>
      <td>${o.item_emoji || '🛒'} ${escHtml(o.item_name)}</td>
      <td style="text-align:center">${o.qty || 1}</td>
      <td>${o.username ? escHtml(o.username) : '—'}</td>
      <td>${escHtml(o.completed_by_name || o.wa_admin_name || '—')}</td>
      <td style="color:#4ade80;font-weight:600;white-space:nowrap">${fmtRp(o.total_price)}</td>
    </tr>`).join('');

  document.getElementById('finance-orders-table').innerHTML = detailRows
    ? `<table class="fin-table" style="min-width:640px"><thead><tr><th>ID</th><th>Waktu</th><th>Item</th><th>Qty</th><th>Username</th><th>Admin</th><th>Total</th></tr></thead><tbody>${detailRows}</tbody></table>`
    : '<div class="empty-state">Tidak ada order selesai pada periode ini.</div>';
}

/* ─────────────────────────────────────────────────────
   HTML ESCAPE
───────────────────────────────────────────────────── */
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  _injectEditModal();

  const monthEl = document.getElementById('finance-month');
  if (monthEl) {
    const now  = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    monthEl.value = `${yyyy}-${mm}`;
  }

  const _origShowSection = window.showSection;
  window.showSection = function (name, el) {
    _origShowSection && _origShowSection(name, el);
    if (name === 'orders')     { ordersLoad(); ordersSubscribe(); }
    if (name === 'all-orders') { window.allOrdersLoad(); }
  };
});
