/* ══════════════════════════════════════════════════
   order-feed.js — Riwayat Pesanan Live di halaman utama
   Mengambil pesanan dengan status 'selesai' dari Supabase
   dan menampilkannya sebagai live feed yang auto-refresh.
══════════════════════════════════════════════════ */
(function () {

  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const LIMIT = 12;
  const REFRESH_MS = 30000; // auto-refresh tiap 30 detik

  // ── Emoji item berdasar kategori / nama (opsional fallback) ─────────────
  function getItemEmoji(item) {
    if (item && item.emoji) return item.emoji;
    const name = (item && item.name) ? item.name.toLowerCase() : '';
    if (name.includes('rank'))    return '👑';
    if (name.includes('title'))   return '🏷️';
    if (name.includes('particle')) return '✨';
    if (name.includes('bundle'))  return '📦';
    if (name.includes('key'))     return '🔑';
    if (name.includes('crate'))   return '🎁';
    return '🛒';
  }

  // ── Format waktu relatif ────────────────────────────────────────────────
  function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)   return `${diff}d lalu`;
    if (diff < 3600) return `${Math.floor(diff/60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff/3600)}j lalu`;
    return `${Math.floor(diff/86400)} hari lalu`;
  }

  // ── Format harga ke IDR singkat ─────────────────────────────────────────
  function fmtPrice(num) {
    if (!num && num !== 0) return '';
    if (num >= 1000000) return 'Rp' + (num/1000000).toFixed(num%1000000===0?0:1) + 'jt';
    if (num >= 1000)    return 'Rp' + (num/1000).toFixed(num%1000===0?0:1) + 'rb';
    return 'Rp' + num;
  }

  // ── Sensor username: ganti tengah dengan * ──────────────────────────────
  function maskUser(name) {
    if (!name || name.length <= 2) return name || '???';
    if (name.length <= 4) return name[0] + '*'.repeat(name.length-2) + name[name.length-1];
    const show = 2;
    return name.slice(0, show) + '***' + name.slice(-1);
  }

  // ── Fetch pesanan selesai ───────────────────────────────────────────────
  async function fetchOrders() {
    const url = `${SUPABASE_URL}/rest/v1/orders?status=eq.selesai&order=updated_at.desc&limit=${LIMIT}&select=id,username,item_name,item_emoji,quantity,total_price,updated_at`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('Gagal fetch orders');
    return res.json();
  }

  // ── Render satu card pesanan ─────────────────────────────────────────────
  function renderCard(order, isNew) {
    const emoji = order.item_emoji || getItemEmoji({ name: order.item_name });
    const user  = maskUser(order.username);
    const price = fmtPrice(order.total_price);
    const qty   = order.quantity > 1 ? ` ×${order.quantity}` : '';
    const time  = timeAgo(order.updated_at);

    const card = document.createElement('div');
    card.className = 'of-card' + (isNew ? ' of-card--new' : '');
    card.setAttribute('data-id', order.id);
    card.innerHTML = `
      <div class="of-card-emoji">${emoji}</div>
      <div class="of-card-body">
        <div class="of-card-user">🎮 <strong>${user}</strong> membeli</div>
        <div class="of-card-item">${order.item_name}${qty}</div>
      </div>
      <div class="of-card-meta">
        ${price ? `<span class="of-card-price">${price}</span>` : ''}
        <span class="of-card-time">${time}</span>
        <span class="of-card-badge">✓ SELESAI</span>
      </div>
    `;
    return card;
  }

  // ── Skeleton loading cards ───────────────────────────────────────────────
  function renderSkeletons(container, count = 6) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'of-card of-skeleton';
      s.innerHTML = `
        <div class="of-card-emoji of-skel-circle"></div>
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

  // ── Render semua cards ───────────────────────────────────────────────────
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
      const card  = renderCard(order, isNew);
      container.appendChild(card);
    });

    lastIds = newIds;

    // Animasi masuk
    requestAnimationFrame(() => {
      container.querySelectorAll('.of-card').forEach((c, i) => {
        c.style.animationDelay = `${i * 0.04}s`;
        c.classList.add('of-card--visible');
      });
    });
  }

  // ── Ticker auto-scroll (marquee vertikal kanan) ──────────────────────────
  function updateTicker(orders) {
    const ticker = document.getElementById('of-ticker-list');
    if (!ticker || !orders || orders.length === 0) return;
    ticker.innerHTML = '';
    orders.forEach(order => {
      const emoji = order.item_emoji || getItemEmoji({ name: order.item_name });
      const li = document.createElement('li');
      li.className = 'of-ticker-item';
      li.innerHTML = `${emoji} <strong>${maskUser(order.username)}</strong> beli <em>${order.item_name}</em>`;
      ticker.appendChild(li);
    });
    // Duplikat agar looping mulus
    orders.forEach(order => {
      const emoji = order.item_emoji || getItemEmoji({ name: order.item_name });
      const li = document.createElement('li');
      li.className = 'of-ticker-item';
      li.innerHTML = `${emoji} <strong>${maskUser(order.username)}</strong> beli <em>${order.item_name}</em>`;
      ticker.appendChild(li);
    });
  }

  // ── Update timestamp terakhir ─────────────────────────────────────────────
  function updateTimestamp() {
    const el = document.getElementById('of-last-updated');
    if (!el) return;
    const now = new Date();
    el.textContent = `Diperbarui: ${now.getHours().toString().padStart(2,'0')}.${now.getMinutes().toString().padStart(2,'0')} WIB`;
  }

  // ── Main load ──────────────────────────────────────────────────────────────
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

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    loadFeed(true);
    setInterval(() => loadFeed(false), REFRESH_MS);

    // Tombol refresh manual
    const btn = document.getElementById('of-refresh-btn');
    if (btn) btn.addEventListener('click', () => loadFeed(false));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
