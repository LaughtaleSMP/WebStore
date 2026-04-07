/* ════════════════════════════════════════════════════════════════
   shop.js — Laughtale SMP Store
   Dibuat otomatis dari shop-config.js. Jangan edit file ini.
   Untuk mengubah isi toko, edit  js/shop-config.js  saja.
   ════════════════════════════════════════════════════════════════ */

(function () {

  /* ── warna badge ── */
  const BADGE_CLASSES = {
    gold:    { bg: 'rgba(244,196,48,0.15)',  border: 'rgba(244,196,48,0.4)',  color: 'var(--gold)' },
    green:   { bg: 'rgba(23,221,98,0.13)',   border: 'rgba(23,221,98,0.4)',   color: 'var(--emerald)' },
    diamond: { bg: 'rgba(78,227,227,0.12)',  border: 'rgba(78,227,227,0.35)', color: 'var(--diamond)' },
    red:     { bg: 'rgba(255,58,58,0.13)',   border: 'rgba(255,58,58,0.35)',  color: 'var(--redstone)' },
    '':      { bg: 'rgba(139,148,158,0.1)',  border: 'rgba(139,148,158,0.3)', color: 'var(--text-muted)' },
  };

  /* ── format harga ── */
  function formatPrice(p) {
    if (p === 0) return '<span style="color:var(--emerald);font-size:1rem;">GRATIS</span>';
    return 'Rp ' + p.toLocaleString('id-ID');
  }

  /* ── buat HTML satu kartu item ── */
  function buildCard(item) {
    const bc   = BADGE_CLASSES[item.badgeColor] || BADGE_CLASSES[''];
    const sold = item.stock === 'Habis';

    const badgeHtml = item.badge
      ? `<span class="shop-badge" style="background:${bc.bg};border:1px solid ${bc.border};color:${bc.color};">${item.badge}</span>`
      : '';

    const featuresHtml = item.features && item.features.length
      ? `<ul class="shop-feat-list">${item.features.map(f => `<li>✔ ${f}</li>`).join('')}</ul>`
      : '';

    return `
      <div class="shop-card fade-up ${sold ? 'shop-sold-out' : ''}" data-category="${item.category}">
        ${badgeHtml}
        <div class="shop-card-emoji">${item.emoji}</div>
        <div class="shop-card-name">${item.name}</div>
        <div class="shop-card-cat">${item.category}</div>
        <div class="shop-card-desc">${item.description}</div>
        ${featuresHtml}
        <div class="shop-card-footer">
          <div class="shop-card-price">${formatPrice(item.price)}</div>
          ${sold
            ? `<button class="shop-btn shop-btn-sold" disabled>HABIS</button>`
            : `<button class="shop-btn shop-btn-buy" onclick="shopOpenModal(${item.id})">🛒 Beli</button>`
          }
        </div>
      </div>`;
  }

  /* ── buat HTML modal ── */
  function buildModal(item) {
    const cfg = SHOP_CONFIG;
    const sold = item.stock === 'Habis';
    const bc   = BADGE_CLASSES[item.badgeColor] || BADGE_CLASSES[''];

    const badgeHtml = item.badge
      ? `<span class="shop-badge" style="background:${bc.bg};border:1px solid ${bc.border};color:${bc.color};margin-bottom:.5rem;">${item.badge}</span>`
      : '';

    const featuresHtml = item.features && item.features.length
      ? `<ul class="shop-feat-list modal-feat">${item.features.map(f => `<li>✔ ${f}</li>`).join('')}</ul>`
      : '';

    return `
      <div id="shop-modal-overlay" class="shop-modal-overlay" onclick="shopCloseModal()">
        <div class="shop-modal-box" onclick="event.stopPropagation()">
          <button class="shop-modal-close" onclick="shopCloseModal()">✕</button>

          <div style="text-align:center;margin-bottom:1.2rem;">
            <div class="shop-modal-emoji">${item.emoji}</div>
            ${badgeHtml}
            <div class="shop-modal-name">${item.name}</div>
            <div class="shop-card-cat" style="margin-top:4px;">${item.category}</div>
          </div>

          <div class="shop-modal-section">
            <div class="shop-modal-label">📄 DESKRIPSI</div>
            <div class="shop-modal-text">${item.description}</div>
          </div>

          ${item.features && item.features.length ? `
          <div class="shop-modal-section">
            <div class="shop-modal-label">🎁 KEUNTUNGAN</div>
            ${featuresHtml}
          </div>` : ''}

          <div class="shop-modal-section" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
            <div>
              <div class="shop-modal-label">💰 HARGA</div>
              <div class="shop-card-price">${formatPrice(item.price)}</div>
            </div>
            <div>
              <div class="shop-modal-label">📦 STOK</div>
              <div style="font-weight:700;color:${sold ? 'var(--redstone)' : 'var(--emerald)'};">
                ${sold ? '❌ Habis' : '✅ Tersedia'}
              </div>
            </div>
          </div>

          ${!sold ? `
          <div class="shop-modal-section shop-payment-box">
            <div class="shop-modal-label" style="margin-bottom:.8rem;">💳 CARA BAYAR</div>
            <div class="qris-steps" style="margin:0;">
              <div class="qris-step"><div class="qris-step-num">1</div>
                <div class="qris-step-text">Scan QRIS di bawah atau hubungi admin untuk konfirmasi item <strong>${item.name}</strong></div>
              </div>
              <div class="qris-step"><div class="qris-step-num">2</div>
                <div class="qris-step-text">Transfer <strong>${formatPrice(item.price)}</strong> via aplikasi e-wallet berlogo QRIS (GoPay, OVO, Dana, BCA, dll)</div>
              </div>
              <div class="qris-step"><div class="qris-step-num">3</div>
                <div class="qris-step-text">Screenshot bukti bayar, lalu kirim ke admin beserta nama item yang dibeli</div>
              </div>
            </div>
            <div style="text-align:center;margin-top:1rem;">
              <img src="${cfg.payment.qrisImage}" alt="QRIS" class="shop-qris-img"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
              <div style="display:none;padding:1rem;background:var(--bg3);border-radius:8px;font-size:.8rem;color:var(--text-muted);">
                📱 ${cfg.payment.qrisNmid}
              </div>
            </div>
            <a href="${cfg.payment.contactLink}" target="_blank" rel="noopener" class="shop-contact-btn">
              ${cfg.payment.contactLabel}
            </a>
          </div>` : ''}

        </div>
      </div>`;
  }

  /* ── RENDER SEMUA ── */
  function renderShop() {
    const cfg = SHOP_CONFIG;

    // Section title
    document.getElementById('shop-section-title').textContent = cfg.title;
    document.getElementById('shop-section-subtitle').textContent = cfg.subtitle;

    // Tab filter
    const tabsEl = document.getElementById('shop-tabs');
    tabsEl.innerHTML = cfg.categories.map((cat, i) =>
      `<button class="shop-tab ${i === 0 ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');

    // Kartu item
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = cfg.items.map(buildCard).join('');

    // Event klik tab filter
    tabsEl.addEventListener('click', e => {
      const btn = e.target.closest('.shop-tab');
      if (!btn) return;
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('.shop-card').forEach(card => {
        const show = cat === 'Semua' || card.dataset.category === cat;
        card.style.display = show ? '' : 'none';
      });
    });
  }

  /* ── MODAL ── */
  window.shopOpenModal = function (id) {
    const item = SHOP_CONFIG.items.find(i => i.id === id);
    if (!item) return;
    const existing = document.getElementById('shop-modal-overlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', buildModal(item));
    requestAnimationFrame(() => {
      const overlay = document.getElementById('shop-modal-overlay');
      if (overlay) overlay.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
  };

  window.shopCloseModal = function () {
    const overlay = document.getElementById('shop-modal-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 250);
    }
    document.body.style.overflow = '';
  };

  // ESC untuk tutup modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.shopCloseModal();
  });

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', renderShop);
})();
