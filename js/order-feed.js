/* ══════════════════════════════════════════════════
   order-feed.js — Riwayat Pesanan Live di halaman utama
   Mengambil pesanan dengan status 'pending' & 'selesai'
   dan menampilkannya sebagai live feed yang auto-refresh.
══════════════════════════════════════════════════ */
(function () {

  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const LIMIT = 10;
  const REFRESH_MS = 30000;

  // ── Format waktu relatif ────────────────────────────────────────────
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return `${diff}d lalu`;
    if (diff < 3600)  return `${Math.floor(diff/60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff/3600)}j lalu`;
    return `${Math.floor(diff/86400)} hari lalu`;
  }

  // ── Format harga ke IDR singkat ─────────────────────────────────────
  function fmtPrice(num) {
    if (!num && num !== 0) return '';
    if (num >= 1000000) return 'Rp' + (num/1000000).toFixed(num%1000000===0?0:1) + 'jt';
    if (num >= 1000)    return 'Rp' + (num/1000).toFixed(num%1000===0?0:1) + 'rb';
    return 'Rp' + num;
  }

  // ── Sensor username: ganti tengah dengan * ──────────────────────────
  function maskUser(name) {
    if (!name || name.length <= 2) return name || '???';
    if (name.length <= 4) return name[0] + '*'.repeat(name.length-2) + name[name.length-1];
    return name.slice(0, 2) + '***' + name.slice(-1);
  }

  // ── Badge per status ─────────────────────────────────────────────────
  function statusBadge(status) {
    if (status === 'selesai') return '<span class="of-card-badge of-badge--selesai">✓ SELESAI</span>';
    if (status === 'pending') return '<span class="of-card-badge of-badge--pending">⏳ PENDING</span>';
    return `<span class="of-card-badge">${status.toUpperCase()}</span>`;
  }

  // ── Fetch pesanan pending & selesai ─────────────────────────────────
  async function fetchOrders() {
    const url = `${SUPABASE_URL}/rest/v1/orders?or=(status.eq.selesai,status.eq.pending)&order=created_at.desc&limit=${LIMIT}&select=id,username,item_name,qty,total_price,status,created_at,completed_at`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('Gagal fetch orders');
    return res.json();
  }

  // ── Render satu card pesanan ───────────────────────────────────────────
  function renderCard(order, isNew) {
    const user  = maskUser(order.username);
    const price = fmtPrice(order.total_price);
    const qty   = order.qty > 1 ? ` ×${order.qty}` : '';
    const timeRef = order.status === 'selesai' ? order.completed_at : order.created_at;
    const time  = timeAgo(timeRef);

    const card = document.createElement('div');
    card.className = 'of-card of-card--' + order.status + (isNew ? ' of-card--new' : '');
    card.setAttribute('data-id', order.id);
    card.innerHTML = `
      <div class="of-card-body">
        <div class="of-card-user">🎮 <strong>${user}</strong> membeli</div>
        <div class="of-card-item">${order.item_name}${qty}</div>
      </div>
      <div class="of-card-meta">
        ${price ? `<span class="of-card-price">${price}</span>` : ''}
        ${time  ? `<span class="of-card-time">${time}</span>`   : ''}
        ${statusBadge(order.status)}
      </div>
    `;
    return card;
  }

  // ── Skeleton loading cards ────────────────────────────────────────────
  function renderSkeletons(container, count = 6) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'of-card of-skeleton';
      s.innerHTML = `
        <div class="of-card-body">
          <div class="of-skel-line" style="width:55%"></div>
          <div class="of-skel-line" style="width:80%;margin-top:6px"></div>
        </div>
        <div class="of-card-meta">
          <div class="of-skel-line" style="width:40px"></div>
        </div>
      `;
      container.appendChild(s);
    }
  }

  // ── Render semua cards ───────────────────────────────────────────────
  let lastIds = new Set();

  function renderFeed(orders) {
    const container = document.getElementById('of-feed-list');
    const empty     = document.getElementById('of-empty');
    const counter   = document.getElementById('of-counter');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (counter) counter.textContent = `${orders.length} transaksi terbaru`;

    const newIds = new Set(orders.map(o => o.id));
    container.innerHTML = '';

    orders.forEach(order => {
      const isNew = !lastIds.has(order.id) && lastIds.size > 0;
      container.appendChild(renderCard(order, isNew));
    });

    lastIds = newIds;

    requestAnimationFrame(() => {
      container.querySelectorAll('.of-card').forEach((c, i) => {
        c.style.animationDelay = `${i * 0.04}s`;
        c.classList.add('of-card--visible');
      });
    });
  }

  // ── Ticker auto-scroll ────────────────────────────────────────────────
  function updateTicker(orders) {
    const ticker = document.getElementById('of-ticker-list');
    if (!ticker || !orders || orders.length === 0) return;
    ticker.innerHTML = '';
    const allItems = [...orders, ...orders];
    allItems.forEach(order => {
      const li = document.createElement('li');
      li.className = 'of-ticker-item';
      li.innerHTML = `🎮 <strong>${maskUser(order.username)}</strong> beli <em>${order.item_name}</em>`;
      ticker.appendChild(li);
    });
  }

  // ── Update timestamp terakhir ──────────────────────────────────────────
  function updateTimestamp() {
    const el = document.getElementById('of-last-updated');
    if (!el) return;
    const now = new Date();
    el.textContent = `Diperbarui: ${now.getHours().toString().padStart(2,'0')}.${now.getMinutes().toString().padStart(2,'0')} WIB`;
  }

  // ── Main load ──────────────────────────────────────────────────────
  async function loadFeed(showSkeleton = false) {
    const container = document.getElementById('of-feed-list');
    if (!container) return;
    if (showSkeleton) renderSkeletons(container);
    try {
      const orders = await fetchOrders();
      renderFeed(orders);
      updateTicker(orders);
      updateTimestamp();
    } catch (err) {
      console.warn('[order-feed] Gagal load:', err.message);
      const empty = document.getElementById('of-empty');
      if (empty) {
        empty.style.display = 'block';
        empty.textContent = 'Gagal memuat data. Coba refresh.';
      }
      if (container) container.innerHTML = '';
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
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
