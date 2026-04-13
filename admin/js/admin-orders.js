/* ══════════════════════════════════════════════════════
   admin-orders.js — Pesanan Masuk + Laporan Keuangan
   Requires: window._adminSb (dari admin-init.js)
══════════════════════════════════════════════════════ */

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

/* ─────────────────────────────────────────────────────
   SHARED: get Supabase client (wait until ready)
───────────────────────────────────────────────────── */
function getSb() {
  return window._adminSb;
}

/* ─────────────────────────────────────────────────────
   PESANAN MASUK — load & render
───────────────────────────────────────────────────── */
let _ordersChannel = null; // Realtime subscription

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
            <div class="order-meta">${escHtml(o.item_category || '')} &nbsp;·&nbsp; ${fmtDate(o.created_at)}</div>
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
        <button class="btn-ghost" style="font-size:12px;padding:6px 14px;" onclick="orderDelete('${o.id}')">🗑 Hapus</button>
      </div>
    </div>
  `).join('');
}

async function ordersLoadStats() {
  const sb = getSb();
  if (!sb) return;
  const { start, end } = todayRange();

  /* pending count */
  const { count: pendingCount } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  /* selesai hari ini */
  const { count: doneToday } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'selesai')
    .gte('completed_at', start)
    .lt('completed_at', end);

  /* revenue hari ini */
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

  /* animasi hilang */
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
───────────────────────────────────────────────────── */
window.orderDelete = async function (id) {
  if (!confirm('Hapus pesanan ini dari database?')) return;
  const sb = getSb();
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return; }
  const card = document.getElementById('ocard-' + id);
  if (card) card.remove();
  ordersLoad();
  showToast('Order dihapus.', 'success');
};

/* ─────────────────────────────────────────────────────
   REALTIME SUBSCRIPTION
───────────────────────────────────────────────────── */
function ordersSubscribe() {
  const sb = getSb();
  if (!sb || _ordersChannel) return;

  _ordersChannel = sb
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      /* Reload saat ada INSERT, UPDATE, DELETE di tabel orders */
      ordersLoad();
    })
    .subscribe();
}

/* ─────────────────────────────────────────────────────
   REFRESH BUTTON
───────────────────────────────────────────────────── */
window.ordersRefresh = function () { ordersLoad(); };

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

  /* Show loading */
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
  if (error) {
    showToast('Gagal load laporan: ' + error.message, 'error');
    return;
  }

  const orders = data || [];

  /* ── Summary ── */
  const totalRev    = orders.reduce((s, o) => s + (o.total_price || 0), 0);
  const totalOrders = orders.length;
  const avgOrder    = totalOrders ? Math.round(totalRev / totalOrders) : 0;

  document.getElementById('fin-total-rev').textContent    = fmtRp(totalRev);
  document.getElementById('fin-total-orders').textContent = totalOrders;
  document.getElementById('fin-avg-order').textContent    = fmtRp(avgOrder);

  /* ── Per-admin ── */
  const adminMap = {};
  orders.forEach(o => {
    const k = o.completed_by_name || o.wa_admin_name || 'Unknown';
    if (!adminMap[k]) adminMap[k] = { count: 0, rev: 0 };
    adminMap[k].count++;
    adminMap[k].rev += o.total_price || 0;
  });

  const adminRows = Object.entries(adminMap)
    .sort((a, b) => b[1].rev - a[1].rev)
    .map(([name, d], i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:600">${escHtml(name)}</td>
        <td>${d.count}</td>
        <td style="color:#4ade80;font-weight:600">${fmtRp(d.rev)}</td>
      </tr>`).join('');

  document.getElementById('finance-admin-table').innerHTML = adminRows
    ? `<table class="fin-table">
        <thead><tr><th>#</th><th>Admin</th><th>Order</th><th>Pendapatan</th></tr></thead>
        <tbody>${adminRows}</tbody>
       </table>`
    : '<div class="empty-state">Belum ada data.</div>';

  /* ── Item breakdown ── */
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
    .map(([name, d], i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${d.emoji} <strong>${escHtml(name)}</strong></td>
        <td>${d.qty}</td>
        <td style="color:#4ade80;font-weight:600">${fmtRp(d.rev)}</td>
      </tr>`).join('');

  document.getElementById('finance-items-table').innerHTML = itemRows
    ? `<table class="fin-table">
        <thead><tr><th>#</th><th>Item</th><th>Qty Terjual</th><th>Pendapatan</th></tr></thead>
        <tbody>${itemRows}</tbody>
       </table>`
    : '<div class="empty-state">Belum ada data.</div>';

  /* ── Detail orders table ── */
  const detailRows = orders.map(o => `
    <tr>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-faint)">${fmtDate(o.completed_at)}</td>
      <td>${o.item_emoji || '🛒'} ${escHtml(o.item_name)}</td>
      <td style="text-align:center">${o.qty || 1}</td>
      <td>${o.username ? escHtml(o.username) : '—'}</td>
      <td>${escHtml(o.completed_by_name || o.wa_admin_name || '—')}</td>
      <td style="color:#4ade80;font-weight:600;white-space:nowrap">${fmtRp(o.total_price)}</td>
    </tr>`).join('');

  document.getElementById('finance-orders-table').innerHTML = detailRows
    ? `<table class="fin-table" style="min-width:600px">
        <thead><tr><th>Waktu</th><th>Item</th><th>Qty</th><th>Username</th><th>Admin</th><th>Total</th></tr></thead>
        <tbody>${detailRows}</tbody>
       </table>`
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
   INIT — hook ke showSection agar load saat tab dibuka
───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* Default finance month = bulan ini */
  const monthEl = document.getElementById('finance-month');
  if (monthEl) {
    const now  = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    monthEl.value = `${yyyy}-${mm}`;
  }

  /* Patch showSection untuk auto-load */
  const _origShowSection = window.showSection;
  window.showSection = function (name, el) {
    _origShowSection && _origShowSection(name, el);
    if (name === 'orders')  { ordersLoad(); ordersSubscribe(); }
    if (name === 'finance') { /* user klik Tampilkan sendiri */ }
  };

  /* Auto-subscribe jika user sudah di halaman orders */
  const secOrders = document.getElementById('sec-orders');
  if (secOrders && secOrders.classList.contains('active')) {
    ordersLoad();
    ordersSubscribe();
  }

  /* Juga load badge count setiap kali admin buka panel */
  setTimeout(async () => {
    const sb = getSb();
    if (!sb) return;
    const { count } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    ordersUpdateBadge(count || 0);
    /* Auto subscribe untuk update badge */
    ordersSubscribe();
  }, 1500);
});
