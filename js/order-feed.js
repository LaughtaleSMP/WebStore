/* ══════════════════════════════════════════════════
   order-feed.js — Riwayat Pesanan Live di halaman utama
   Layout tabel compact: id | nama | item | harga | status | waktu
══════════════════════════════════════════════════ */
(function () {

  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const LIMIT = 5;
  const REFRESH_MS = 30000;

  function timeAgo(dateStr) {
    if (!dateStr) return '-';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return `${diff}d`;
    if (diff < 3600)  return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}j`;
    return `${Math.floor(diff/86400)}h`;
  }

  function fmtPrice(num) {
    if (!num && num !== 0) return '-';
    if (num >= 1000000) return 'Rp' + (num/1000000).toFixed(num%1000000===0?0:1) + 'jt';
    if (num >= 1000)    return 'Rp' + (num/1000).toFixed(num%1000===0?0:1) + 'rb';
    return 'Rp' + num;
  }

  function maskUser(name) {
    if (!name || name.length <= 2) return name || '???';
    if (name.length <= 4) return name[0] + '*'.repeat(name.length-2) + name[name.length-1];
    return name.slice(0, 2) + '***' + name.slice(-1);
  }

  function shortId(id) {
    return id ? '#' + id.slice(-4).toUpperCase() : '-';
  }

  function statusBadge(status) {
    if (status === 'selesai') return '<span class="of-badge of-badge--selesai">selesai</span>';
    if (status === 'pending') return '<span class="of-badge of-badge--pending">pending</span>';
    return `<span class="of-badge">${status}</span>`;
  }

  async function fetchOrders() {
    const url = `${SUPABASE_URL}/rest/v1/orders?or=(status.eq.selesai,status.eq.pending)&order=created_at.desc&limit=${LIMIT}&select=id,username,item_name,qty,total_price,status,created_at,completed_at`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('Gagal fetch orders');
    return res.json();
  }

  function renderRow(order, isNew) {
    const timeRef = order.status === 'selesai' ? order.completed_at : order.created_at;
    const qty = order.qty > 1 ? ` x${order.qty}` : '';
    const tr = document.createElement('tr');
    tr.className = 'of-row of-row--' + order.status + (isNew ? ' of-row--new' : '');
    tr.setAttribute('data-id', order.id);
    tr.innerHTML = `
      <td class="of-col-id">${shortId(order.id)}</td>
      <td class="of-col-user">${maskUser(order.username)}</td>
      <td class="of-col-item">${order.item_name}${qty}</td>
      <td class="of-col-price">${fmtPrice(order.total_price)}</td>
      <td class="of-col-status">${statusBadge(order.status)}</td>
      <td class="of-col-time">${timeAgo(timeRef)}</td>
    `;
    return tr;
  }

  function renderSkeletons(tbody, count = 5) {
    tbody.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const tr = document.createElement('tr');
      tr.className = 'of-row of-skeleton';
      tr.innerHTML = `
        <td><div class="of-skel-line" style="width:32px"></div></td>
        <td><div class="of-skel-line" style="width:60px"></div></td>
        <td><div class="of-skel-line" style="width:100px"></div></td>
        <td><div class="of-skel-line" style="width:48px"></div></td>
        <td><div class="of-skel-line" style="width:44px"></div></td>
        <td><div class="of-skel-line" style="width:24px"></div></td>
      `;
      tbody.appendChild(tr);
    }
  }

  let lastIds = new Set();

  function renderFeed(orders) {
    const tbody   = document.getElementById('of-feed-list');
    const empty   = document.getElementById('of-empty');
    const counter = document.getElementById('of-counter');
    if (!tbody) return;
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (counter) counter.textContent = `${orders.length} transaksi`;
    const newIds = new Set(orders.map(o => o.id));
    tbody.innerHTML = '';
    orders.forEach(order => {
      const isNew = !lastIds.has(order.id) && lastIds.size > 0;
      tbody.appendChild(renderRow(order, isNew));
    });
    lastIds = newIds;
    requestAnimationFrame(() => {
      tbody.querySelectorAll('.of-row').forEach((r, i) => {
        r.style.animationDelay = `${i * 0.03}s`;
        r.classList.add('of-row--visible');
      });
    });
  }

  function updateTimestamp() {
    const el = document.getElementById('of-last-updated');
    if (!el) return;
    const now = new Date();
    el.textContent = `${now.getHours().toString().padStart(2,'0')}.${now.getMinutes().toString().padStart(2,'0')} WIB`;
  }

  async function loadFeed(showSkeleton = false) {
    const tbody = document.getElementById('of-feed-list');
    if (!tbody) return;
    if (showSkeleton) renderSkeletons(tbody);
    try {
      const orders = await fetchOrders();
      renderFeed(orders);
      updateTimestamp();
    } catch (err) {
      console.warn('[order-feed] Gagal load:', err.message);
      const empty = document.getElementById('of-empty');
      if (empty) { empty.style.display = 'block'; empty.textContent = 'Gagal memuat data. Coba refresh.'; }
      if (tbody) tbody.innerHTML = '';
    }
  }

  function init() {
    loadFeed(true);
    setInterval(() => loadFeed(false), REFRESH_MS);
    const btn = document.getElementById('of-refresh-btn');
    if (btn) btn.addEventListener('click', () => loadFeed(false));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
