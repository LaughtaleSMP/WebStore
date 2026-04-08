/* ══════════════════════════════════════════════════════
   tebex-store.js — Realtime store via Tebex Headless API
   ══════════════════════════════════════════════════════ */

// ⚙ Ganti dengan Public Token dari Tebex Dashboard
//   Dashboard → Webstore → API Keys → PUBLIC token (bukan Server API Key)
const TEBEX_PUBLIC_TOKEN = 'GANTI_DENGAN_PUBLIC_TOKEN_KAMU';
const BASE_URL = `https://headless.tebex.io/api/accounts/${TEBEX_PUBLIC_TOKEN}`;

/* ─────────────────────────────────────────────────────
   FETCH: Kategori & Paket
───────────────────────────────────────────────────── */
async function fetchStoreData() {
  const btn = document.getElementById('store-refresh-btn');
  if (btn) {
    btn.textContent = '↻ MEMUAT...';
    btn.style.pointerEvents = 'none';
  }

  const startTime = Date.now();

  try {
    // Ambil semua kategori + paket sekaligus
    const [catRes, infoRes] = await Promise.all([
      fetch(`${BASE_URL}/categories?includePackages=1`),
      fetch(`${BASE_URL}/webstore`),
    ]);

    const latency = Date.now() - startTime;
    const categories = await catRes.json();
    const info       = await infoRes.json();

    // ── Latency
    const latEl = document.getElementById('store-latency');
    if (latEl) latEl.textContent = latency;

    // ── Info toko
    const nameEl = document.getElementById('store-name');
    if (nameEl && info?.data?.name) nameEl.textContent = info.data.name;

    const currEl = document.getElementById('store-currency');
    if (currEl && info?.data?.currency) currEl.textContent = info.data.currency;

    // ── Render kategori & paket
    renderCategories(categories?.data ?? []);

    // ── Timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID');

    const lastEl = document.getElementById('store-last-updated');
    if (lastEl) lastEl.textContent =
      `Terakhir diperbarui: ${timeStr} WIB • Auto-refresh setiap 60 detik`;

  } catch (err) {
    console.error('[Tebex] Gagal mengambil data:', err);

    const errEl = document.getElementById('store-last-updated');
    if (errEl) errEl.textContent = '⚠ Gagal mengambil data toko — coba refresh manual';

    const listEl = document.getElementById('store-packages-list');
    if (listEl) listEl.innerHTML =
      `<p style="color:var(--redstone);text-align:center;">Tidak dapat terhubung ke Tebex API</p>`;
  }

  if (btn) {
    btn.textContent = '↻ REFRESH TOKO';
    btn.style.pointerEvents = 'auto';
  }
}

/* ─────────────────────────────────────────────────────
   RENDER: Kartu paket per kategori
───────────────────────────────────────────────────── */
function renderCategories(categories) {
  const container = document.getElementById('store-packages-list');
  if (!container) return;

  if (!categories.length) {
    container.innerHTML = `<p style="text-align:center;color:var(--muted);">Tidak ada paket tersedia.</p>`;
    return;
  }

  container.innerHTML = categories.map(cat => {
    const packages = cat.packages ?? [];

    const cards = packages.map(pkg => {
      const price     = pkg.total_price ?? pkg.base_price ?? '?';
      const currency  = pkg.currency ?? '';
      const imgUrl    = pkg.image ?? '';
      const buyUrl    = `https://store.laughtale.my.id/package/${pkg.id}`; // sesuaikan domain toko kamu

      return `
        <div class="store-card" style="
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: transform 0.2s, box-shadow 0.2s;
        "
        onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">

          ${imgUrl ? `<img src="${imgUrl}" alt="${pkg.name}" style="width:100%;border-radius:8px;object-fit:cover;max-height:120px;">` : ''}

          <div style="font-weight:700;font-size:1rem;">${pkg.name}</div>

          ${pkg.description
            ? `<div style="font-size:0.8rem;color:var(--muted);line-height:1.4;">${pkg.description.replace(/<[^>]*>/g,'').slice(0,100)}...</div>`
            : ''}

          <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span style="
              color: var(--emerald);
              font-size: 1.1rem;
              font-weight: 800;
            ">
              ${currency} ${parseFloat(price).toLocaleString('id-ID')}
            </span>
            <a href="${buyUrl}" target="_blank" style="
              background: var(--emerald);
              color: #000;
              padding: 6px 14px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 0.82rem;
              text-decoration: none;
              transition: opacity 0.2s;
            "
            onmouseover="this.style.opacity='0.85'"
            onmouseout="this.style.opacity='1'">
              🛒 BELI
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="store-category" style="margin-bottom: 32px;">
        <h3 style="
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border);
          text-transform: uppercase;
        ">📦 ${cat.name}</h3>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        ">
          ${cards || `<p style="color:var(--muted);">Tidak ada paket di kategori ini.</p>`}
        </div>
      </div>
    `;
  }).join('');
}

// Auto-fetch saat halaman dimuat & setiap 60 detik
fetchStoreData();
setInterval(fetchStoreData, 60000);
