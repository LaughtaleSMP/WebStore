/* ══════════════════════════════════════════════════════════════
   shop-page.js — Dedicated Shop Page (reads from Supabase)
   Renders items with photo/GIF gallery, search, category filter,
   and WhatsApp order modal.
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SB_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  const CACHE_KEY = 'sp_shop_data';
  const CACHE_TTL = 90_000; // 90s

  // ── Supabase singleton — satu client, dipakai semua fungsi ──
  let _sb = null;
  function _getSb() {
    if (!_sb) _sb = supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return _sb;
  }

  let allItems = [];
  let shopMeta = {};
  let waAdmins = { main: [], gem: [] };
  let currentCat = 'Semua';

  /* ── Helpers ── */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtPrice(p) {
    if (p === 0) return '<span style="color:#17dd62">GRATIS</span>';
    return 'Rp\u00a0' + p.toLocaleString('id-ID');
  }

  const BC = {
    gold:    { bg:'rgba(244,196,48,0.14)',  bd:'rgba(244,196,48,0.4)',  cl:'#f4c430' },
    green:   { bg:'rgba(23,221,98,0.12)',   bd:'rgba(23,221,98,0.4)',   cl:'#17dd62' },
    diamond: { bg:'rgba(168,85,247,0.14)',  bd:'rgba(168,85,247,0.4)',  cl:'#c084fc' },
    red:     { bg:'rgba(255,58,58,0.13)',   bd:'rgba(255,58,58,0.35)',  cl:'#ff3a3a' },
    '':      { bg:'rgba(139,148,158,0.1)',  bd:'rgba(139,148,158,0.3)', cl:'#8892a4' },
  };

  /* ══════════════════════════════════════════
     INIT — fetch from Supabase
  ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Try cache first
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.t && Date.now() - c.t < CACHE_TTL && c.items) {
        allItems = c.items; shopMeta = c.meta || {}; waAdmins = c.wa || { main:[], gem:[] };
        render();
        fetchFresh(); // background refresh
        return;
      }
    } catch(e) {}
    await fetchFresh();
  }

  async function fetchFresh() {
    // Wait for supabase SDK
    let tries = 0;
    while (typeof supabase === 'undefined' && tries < 30) {
      await new Promise(r => setTimeout(r, 100));
      tries++;
    }
    if (typeof supabase === 'undefined') {
      showError('Supabase SDK tidak termuat.'); return;
    }

    const sb = _getSb();

    try {
      const [itemRes, cfgRes, siteRes] = await Promise.all([
        sb.from('shop_items').select('*').eq('active', true).order('sort_order', { ascending: true }),
        sb.from('shop_config').select('value').eq('key', 'main').single(),
        sb.from('site_config').select('value,key').in('key', ['whatsapp_admins','whatsapp_gem_admins']),
      ]);

      if (itemRes.error || !itemRes.data?.length) {
        if (!allItems.length) showError('Belum ada item di toko.');
        return;
      }

      allItems = itemRes.data.map(r => ({
        id: r.id, name: r.name, emoji: r.emoji || '🛒',
        category: r.category || 'Lainnya',
        price: r.price || 0, originalPrice: r.original_price || 0,
        description: r.description || '', features: r.features || [],
        badge: r.badge || '', badgeColor: r.badge_color || '',
        stock: r.stock, requiresDesign: r.requires_design,
        needsUsername: r.needs_username !== false,
        canBuyMultiple: r.can_buy_multiple !== false,
        maxQuantity: r.max_quantity || 99,
        images: r.images || [],
        assignedAdmins: r.assigned_admins || [],
      }));

      try { shopMeta = cfgRes.data?.value ? JSON.parse(cfgRes.data.value) : {}; } catch(e) { shopMeta = {}; }

      // WA admins from shop_config or site_config
      waAdmins = {
        main: shopMeta.admins || [],
        gem: shopMeta.gemAdmins || [],
      };
      if (siteRes.data) {
        siteRes.data.forEach(row => {
          try {
            if (row.key === 'whatsapp_admins') waAdmins.main = JSON.parse(row.value);
            if (row.key === 'whatsapp_gem_admins') waAdmins.gem = JSON.parse(row.value);
          } catch(e) {}
        });
      }

      // Cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: allItems, meta: shopMeta, wa: waAdmins }));
      } catch(e) {}

      render();
    } catch(e) {
      console.error('[ShopPage]', e);
      if (!allItems.length) showError('Gagal memuat toko. Coba refresh.');
    }
  }

  function showError(msg) {
    document.getElementById('sp-grid').innerHTML = `<div class="sp-empty">${esc(msg)}</div>`;
  }

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  function render() {
    // Title/subtitle
    if (shopMeta.title) document.getElementById('sp-title').textContent = shopMeta.title;
    if (shopMeta.subtitle) document.getElementById('sp-subtitle').textContent = shopMeta.subtitle;

    // Tabs
    const cats = ['Semua', ...new Set(allItems.map(i => i.category))];
    const tabsEl = document.getElementById('sp-tabs');
    tabsEl.innerHTML = cats.map(c =>
      `<button class="sp-tab${c === currentCat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
    tabsEl.onclick = e => {
      const btn = e.target.closest('.sp-tab');
      if (!btn) return;
      currentCat = btn.dataset.cat;
      tabsEl.querySelectorAll('.sp-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === currentCat));
      filterGrid();
    };

    // Grid
    renderGrid(allItems);

    // Search
    const searchEl = document.getElementById('sp-search');
    let timer;
    searchEl.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(filterGrid, 150);
    };
  }

  function renderGrid(items) {
    const grid = document.getElementById('sp-grid');
    if (!items.length) { grid.innerHTML = '<div class="sp-empty">Tidak ada item ditemukan.</div>'; return; }

    grid.innerHTML = items.map(item => {
      const sold = item.stock === 'Habis';
      const imgSrc = item.images?.[0];
      const bc = BC[item.badgeColor] || BC[''];
      const badgeHtml = item.badge
        ? `<span class="sp-card-badge" style="background:${bc.bg};border:1px solid ${bc.bd};color:${bc.cl}">${esc(item.badge)}</span>`
        : '';
      const origHtml = (item.originalPrice > 0 && item.originalPrice > item.price)
        ? `<span class="sp-card-price-orig">Rp\u00a0${item.originalPrice.toLocaleString('id-ID')}</span>` : '';

      return `<div class="sp-card${sold?' sold':''}" data-cat="${esc(item.category)}" data-name="${esc(item.name.toLowerCase())}" data-id="${item.id}">
        ${badgeHtml}
        ${imgSrc
          ? `<img class="sp-card-img" src="${esc(imgSrc)}" alt="${esc(item.name)}" loading="lazy">`
          : `<div class="sp-card-img-placeholder">${item.emoji}</div>`}
        <div class="sp-card-body">
          <div class="sp-card-name">${esc(item.name)}</div>
          <div class="sp-card-cat">${esc(item.category)}</div>
          <div class="sp-card-desc">${esc(item.description)}</div>
        </div>
        <div class="sp-card-footer">
          <div class="sp-card-price">${fmtPrice(item.price)}${origHtml}</div>
          ${sold
            ? '<button class="sp-card-btn" disabled style="opacity:.4;cursor:not-allowed">HABIS</button>'
            : `<button class="sp-card-btn" onclick="window._spOpen(${item.id})">Pesan</button>`}
        </div>
      </div>`;
    }).join('');
  }

  function filterGrid() {
    const q = document.getElementById('sp-search').value.trim().toLowerCase();
    let filtered = allItems;
    if (currentCat !== 'Semua') filtered = filtered.filter(i => i.category === currentCat);
    if (q.length >= 2) filtered = filtered.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    renderGrid(filtered);
  }

  /* ══════════════════════════════════════════
     MODAL — Detail + Gallery + Order
  ══════════════════════════════════════════ */
  let modalSlide = 0;

  window._spOpen = function(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    modalSlide = 0;
    _proofUrl = '';
    _selectedPayMethod = '';

    const imgs = item.images || [];
    const hasGallery = imgs.length > 0;

    const modal = document.getElementById('sp-modal');
    modal.innerHTML = `
      <button class="sp-modal-close" onclick="window._spClose()">✕</button>
      ${hasGallery ? buildGallery(imgs) : ''}
      <div class="sp-modal-body">
        ${hasGallery ? '' : `<div class="sp-modal-emoji">${item.emoji}</div>`}
        <div class="sp-modal-name">${esc(item.name)}</div>
        ${item.badge ? `<div style="margin-bottom:8px">${badgeSpan(item)}</div>` : ''}

        ${item.description ? `
        <div class="sp-modal-sec">
          <div class="sp-modal-label">DESKRIPSI</div>
          <div class="sp-modal-text">${esc(item.description)}</div>
        </div>` : ''}

        ${item.features?.length ? `
        <div class="sp-modal-sec">
          <div class="sp-modal-label">FITUR</div>
          <ul class="sp-modal-feat">${item.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="sp-modal-sec" style="background:rgba(168,85,247,0.05);border-color:rgba(168,85,247,0.2)">
          <div class="sp-modal-label">HARGA</div>
          <div style="font-family:'Nunito',sans-serif;font-weight:800;font-size:1.1rem;color:var(--sp-gold);font-variant-numeric:tabular-nums">${fmtPrice(item.price)}</div>
          ${item.originalPrice > item.price ? `<div style="font-size:.88rem;color:#ff5a5a;text-decoration:line-through;margin-top:4px;opacity:.75;font-weight:600">Rp\u00a0${item.originalPrice.toLocaleString('id-ID')}</div>` : ''}
        </div>

        ${item.needsUsername ? `
        <div class="sp-modal-sec">
          <div class="sp-modal-label">USERNAME MINECRAFT</div>
          <input class="sp-input" id="sp-username" placeholder="Masukkan username kamu…">
        </div>` : ''}

        ${item.canBuyMultiple ? `
        <div class="sp-modal-sec">
          <div class="sp-modal-label">JUMLAH</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
            <button onclick="window._spQty(-1)" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--sp-border);background:var(--sp-bg3);color:var(--sp-text);font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
            <input class="sp-input" id="sp-qty" type="number" min="1" max="${item.maxQuantity}" value="1" style="width:64px;text-align:center;margin:0">
            <button onclick="window._spQty(1)" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--sp-border);background:var(--sp-bg3);color:var(--sp-text);font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
          </div>
        </div>` : ''}
        <!-- Payment Method -->
        <div class="sp-modal-sec" style="background:rgba(168,85,247,0.04);border-color:rgba(168,85,247,0.18)">
          <div class="sp-modal-label">METODE PEMBAYARAN</div>
          <div style="font-size:.78rem;color:var(--sp-muted);margin-bottom:10px">Pilih metode, lalu transfer ke nomor rekening yang muncul.</div>
          <div id="sp-pay-methods" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button class="sp-pay-opt" data-method="DANA" data-acc="08972282321" data-holder="M WAHYU IBRAHIM" onclick="window._spPayPick(this)">
              <img src="assets/logo-dana.svg" alt="DANA" style="height:18px">
            </button>
            <button class="sp-pay-opt" data-method="GoPay" data-acc="08972282321" data-holder="M WAHYU IBRAHIM" onclick="window._spPayPick(this)">
              <img src="assets/logo-gopay.svg" alt="GoPay" style="height:18px">
            </button>
            <button class="sp-pay-opt" data-method="BCA" data-acc="1150860420" data-holder="M WAHYU IBRAHIM" onclick="window._spPayPick(this)">
              <img src="assets/logo-bca.svg" alt="BCA" style="height:18px">
            </button>
            <button class="sp-pay-opt" data-method="QRIS" data-acc="Scan QR" data-holder="" onclick="window._spPayPick(this)">
              <img src="assets/logo-qris.svg" alt="QRIS" style="height:18px">
            </button>
          </div>
          <div id="sp-pay-info" style="display:none;margin-top:10px;background:var(--sp-bg);border:1px solid var(--sp-border);border-radius:8px;padding:10px 14px">
            <div style="font-size:.72rem;color:var(--sp-muted);margin-bottom:4px">Transfer ke:</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <span id="sp-pay-acc" style="font-family:'Nunito',sans-serif;font-weight:800;font-size:1rem;color:var(--sp-text);letter-spacing:1px"></span>
              <button id="sp-pay-copy" onclick="window._spPayCopy()" style="padding:5px 10px;border-radius:6px;border:1px solid var(--sp-border);background:var(--sp-bg3);color:var(--sp-muted);font-size:.7rem;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .15s">Salin</button>
            </div>
            <div id="sp-pay-holder" style="font-size:.75rem;color:var(--sp-green);margin-top:5px;font-weight:700"></div>
            <div id="sp-pay-name" style="font-size:.72rem;color:var(--sp-purple-l);margin-top:2px;font-weight:600"></div>
            <div id="sp-qris-wrap" style="display:none;margin-top:10px;text-align:center;width:100%">
              <img src="assets/Laughtale-Qris-Payment.jpeg" alt="QRIS Laughtale SMP" style="width:100%;max-width:280px;margin:0 auto;display:block;border-radius:10px;border:1px solid var(--sp-border)">
              <div style="font-size:.68rem;color:var(--sp-muted);margin-top:6px;text-align:center">Screenshot QR lalu scan di aplikasi e-wallet / m-banking kamu</div>
            </div>
          </div>
        </div>

        <!-- Payment Proof Upload -->
        <div class="sp-modal-sec" style="background:rgba(23,221,98,0.04);border-color:rgba(23,221,98,0.2)">
          <div class="sp-modal-label">BUKTI PEMBAYARAN</div>
          <div style="font-size:.78rem;color:var(--sp-muted);line-height:1.5;margin-bottom:8px">
            Upload bukti transfer sebelum menghubungi admin.
          </div>
          <label id="sp-proof-label" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border:2px dashed rgba(23,221,98,0.25);border-radius:10px;cursor:pointer;transition:all .15s;color:var(--sp-muted);font-size:.82rem;text-align:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span id="sp-proof-text">Pilih gambar bukti transfer…</span>
            <input type="file" id="sp-proof-file" accept="image/*" style="display:none" onchange="window._spProofChanged(this)">
          </label>
          <div id="sp-proof-preview" style="display:none;margin-top:10px;position:relative">
            <img id="sp-proof-img" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;background:#080c12">
            <button onclick="window._spProofClear()" style="position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:6px;border:none;background:rgba(255,58,58,0.8);color:#fff;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center">✕</button>
          </div>
          <div id="sp-proof-progress" style="display:none;margin-top:8px">
            <div style="height:4px;background:var(--sp-bg3);border-radius:2px;overflow:hidden">
              <div id="sp-proof-bar" style="height:100%;width:0%;background:var(--sp-green);border-radius:2px;transition:width .3s"></div>
            </div>
            <div id="sp-proof-status" style="font-size:.7rem;color:var(--sp-muted);margin-top:4px;text-align:center">Mengupload…</div>
          </div>
        </div>

        <button class="sp-wa-btn" id="sp-wa-btn" onclick="window._spOrder(${item.id})">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.584-.826-6.32-2.207l-.155-.124-3.236 1.085 1.085-3.236-.124-.155A9.963 9.963 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
          PESAN VIA WHATSAPP
        </button>
      </div>
    `;

    if (hasGallery) setupGallery(imgs);

    const overlay = document.getElementById('sp-overlay');
    overlay.classList.add('open');
    overlay.onclick = e => { if (e.target === overlay) window._spClose(); };
  };

  window._spClose = function() {
    _proofUrl = '';
    _selectedPayMethod = '';
    document.getElementById('sp-overlay').classList.remove('open');
  };

  window._spQty = function(dir) {
    const el = document.getElementById('sp-qty');
    if (!el) return;
    let v = parseInt(el.value) || 1;
    v = Math.max(1, Math.min(parseInt(el.max) || 99, v + dir));
    el.value = v;
  };
  /* ── Payment method picker ── */
  let _selectedPayMethod = '';

  window._spPayPick = function(btn) {
    _selectedPayMethod = btn.dataset.method;
    document.querySelectorAll('.sp-pay-opt').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    const info = document.getElementById('sp-pay-info');
    const acc = document.getElementById('sp-pay-acc');
    const name = document.getElementById('sp-pay-name');
    const holder = document.getElementById('sp-pay-holder');
    const copyBtn = document.getElementById('sp-pay-copy');
    const qrWrap = document.getElementById('sp-qris-wrap');
    if (info) info.style.display = 'block';

    if (btn.dataset.method === 'QRIS') {
      if (acc) acc.textContent = '';
      if (holder) holder.textContent = '';
      if (copyBtn) copyBtn.style.display = 'none';
      if (name) name.textContent = 'Scan QRIS di bawah ini';
      if (qrWrap) qrWrap.style.display = 'block';
    } else {
      if (acc) acc.textContent = btn.dataset.acc;
      if (holder) holder.textContent = btn.dataset.holder ? 'a.n. ' + btn.dataset.holder : '';
      if (copyBtn) copyBtn.style.display = '';
      if (name) name.textContent = btn.dataset.method;
      if (qrWrap) qrWrap.style.display = 'none';
    }
  };

  window._spPayCopy = function() {
    const acc = document.getElementById('sp-pay-acc')?.textContent;
    if (!acc) return;
    navigator.clipboard.writeText(acc).then(() => {
      const btn = document.getElementById('sp-pay-copy');
      if (btn) { btn.textContent = '✓ Disalin!'; btn.style.color = 'var(--sp-green)'; setTimeout(() => { btn.textContent = 'Salin'; btn.style.color = ''; }, 2000); }
    }).catch(() => {});
  };

  /* ── Payment proof upload — via Supabase Storage ── */
  let _proofUrl = '';

  window._spProofChanged = function(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Hanya file gambar yang diperbolehkan.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Ukuran maksimal 10MB.'); return; }

    // Preview
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('sp-proof-preview');
      const img = document.getElementById('sp-proof-img');
      const text = document.getElementById('sp-proof-text');
      if (preview) { preview.style.display = 'block'; }
      if (img) { img.src = e.target.result; }
      if (text) { text.textContent = file.name; }
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    _uploadProof(file);
  };

  window._spProofClear = function() {
    _proofUrl = '';
    const preview = document.getElementById('sp-proof-preview');
    const text = document.getElementById('sp-proof-text');
    const fileInput = document.getElementById('sp-proof-file');
    const progress = document.getElementById('sp-proof-progress');
    if (preview) preview.style.display = 'none';
    if (text) text.textContent = 'Pilih gambar bukti transfer…';
    if (fileInput) fileInput.value = '';
    if (progress) progress.style.display = 'none';
  };

  async function _uploadProof(file) {
    const progress = document.getElementById('sp-proof-progress');
    const bar      = document.getElementById('sp-proof-bar');
    const status   = document.getElementById('sp-proof-status');
    const waBtn    = document.getElementById('sp-wa-btn');

    if (progress) progress.style.display = 'block';
    if (bar)      bar.style.width = '20%';
    if (status)   status.textContent = 'Mengupload bukti…';
    if (waBtn)  { waBtn.disabled = true; waBtn.style.opacity = '.5'; }

    try {
      const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const filename = `proof-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;

      if (bar) bar.style.width = '50%';

      const sb = _getSb();
      const { data, error } = await sb.storage
        .from('proofs')
        .upload(filename, file, { contentType: file.type, upsert: true });

      if (error) throw error;

      // Ambil public URL
      const { data: urlData } = sb.storage.from('proofs').getPublicUrl(filename);
      _proofUrl = urlData?.publicUrl || '';

      if (!_proofUrl) throw new Error('Gagal mendapat URL publik');

      if (bar)    bar.style.width = '100%';
      if (status) { status.textContent = '✓ Bukti berhasil diupload!'; status.style.color = 'var(--sp-green)'; }
    } catch (e) {
      console.warn('[ShopPage] Proof upload failed:', e);
      // Coba tunjukkan pesan yang lebih spesifik
      const msg = e?.message || '';
      const hint = msg.includes('Bucket not found') || msg.includes('bucket')
        ? '✗ Bucket "proofs" belum dibuat di Supabase Storage. Hubungi admin.'
        : '✗ Gagal upload. Coba lagi.';
      if (status) { status.textContent = hint; status.style.color = 'var(--sp-red)'; }
      _proofUrl = '';
    } finally {
      if (waBtn) { waBtn.disabled = false; waBtn.style.opacity = '1'; }
    }
  }

  /* ── Order ID: UUID untuk DB, kode pendek untuk display ── */
  function _genOrderUUID() {
    return crypto.randomUUID();
  }
  function _shortCode(uuid) {
    return 'LT-' + uuid.replace(/-/g, '').slice(-6).toUpperCase();
  }

  function _fmtDateTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
  }

  window._spOrder = async function(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    const username = document.getElementById('sp-username')?.value.trim() || '';
    if (item.needsUsername && !username) {
      alert('Username Minecraft wajib diisi.'); return;
    }

    if (!_proofUrl) {
      alert('Silakan upload bukti pembayaran terlebih dahulu.'); return;
    }

    if (!_selectedPayMethod) {
      alert('Silakan pilih metode pembayaran.'); return;
    }

    const qty = parseInt(document.getElementById('sp-qty')?.value) || 1;
    const total = item.price * qty;
    const orderUUID = _genOrderUUID();
    const orderCode = _shortCode(orderUUID);
    const orderTime = _fmtDateTime();

    // Pick WA admin — per-item assignment has priority, fallback to global
    let admList;
    if (item.assignedAdmins && item.assignedAdmins.length) {
      // Item punya admin khusus → pakai itu (random jika >1)
      admList = item.assignedAdmins;
    } else {
      // Fallback: global admin berdasarkan kategori
      const isGem = (item.category || '').toLowerCase().includes('gem') || (item.category || '').toLowerCase().includes('coin');
      admList = isGem ? (waAdmins.gem.length ? waAdmins.gem : waAdmins.main) : waAdmins.main;
    }
    if (!admList.length) { alert('Belum ada admin WA. Hubungi admin server.'); return; }
    const admin = admList[Math.floor(Math.random() * admList.length)];
    const phone = (admin.number || admin.phone || '').replace(/\D/g,'');
    if (!phone) { alert('Nomor admin tidak valid.'); return; }

    // Save order to Supabase — await so errors are visible
    let insertOk = false;
    try {
      const sb = _getSb();
      const orderPayload = {
        id: orderUUID,
        username: username || 'Anonim',
        item_name: item.name,
        qty: qty,
        total_price: total,
        status: 'pending',
        customer_note: `Bayar: ${_selectedPayMethod}${_proofUrl ? ' | Bukti: ' + _proofUrl : ''}`,
        wa_admin_number: phone,
        wa_admin_name: admin.name || 'Admin',
      };

      const { error: insertErr } = await sb.from('orders').insert(orderPayload);

      if (insertErr) {
        console.warn('[ShopPage] SDK insert failed:', insertErr.message, '— trying REST fallback');
        // Fallback: raw REST API
        const restRes = await fetch(`${SB_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(orderPayload),
        });
        if (!restRes.ok) {
          const errBody = await restRes.text();
          throw new Error(`${restRes.status}: ${errBody}`);
        }
        insertOk = true;
        console.log('[ShopPage] Order saved via REST fallback');
      } else {
        insertOk = true;
        // Auto-decrement stock
        if (item.id) {
          sb.from('shop_items').select('stock').eq('id', item.id).single().then(({ data: row }) => {
            if (row && row.stock !== null && row.stock !== undefined) {
              const newStock = Math.max(0, (row.stock || 0) - qty);
              sb.from('shop_items').update({ stock: newStock }).eq('id', item.id).then(() => {});
            }
          });
        }
      }
    } catch(e) {
      console.error('[ShopPage] Order save error:', e);
      alert(`⚠️ Order gagal disimpan:\n${e.message}\n\nKirim WA ke admin dengan Order ID: ${orderCode}`);
    }

    // Build WA message
    let msg = `🛒 *PESANAN BARU*\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `🆔 Order: *${orderCode}*\n`;
    msg += `📅 Waktu: ${orderTime}\n\n`;
    msg += `📦 *${item.name}*\n`;
    if (qty > 1) msg += `📊 Jumlah: ${qty}x\n`;
    msg += `💰 Total: *Rp ${total.toLocaleString('id-ID')}*\n`;
    if (username) msg += `🎮 IGN: *${username}*\n`;
    msg += `💳 Bayar via: *${_selectedPayMethod}*\n`;
    msg += `\n🧾 *Bukti Pembayaran:*\n${_proofUrl}\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `Mohon diproses ya kak. Terima kasih! 🙏`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    // Save to localStorage for order history
    try {
      const history = JSON.parse(localStorage.getItem('lt_orders') || '[]');
      history.unshift({ id: orderUUID, code: orderCode, item: item.name, total, qty, method: _selectedPayMethod, time: orderTime, username });
      if (history.length > 20) history.length = 20;
      localStorage.setItem('lt_orders', JSON.stringify(history));
    } catch(e) {}

    // Close purchase modal
    window._spClose();

    // Show confirmation overlay
    _showConfirmation({ orderId: orderCode, itemName: item.name, qty, total, method: _selectedPayMethod, username, time: orderTime });
  };

  /* ── Order Confirmation Overlay ── */
  /* ── SVG icon helper (14px inline) ── */
  const _ic = (d, color='currentColor') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;flex-shrink:0">${d}</svg>`;
  const IC = {
    box:    _ic('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    coin:   _ic('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    user:   _ic('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    card:   _ic('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
    clock:  _ic('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    hash:   _ic('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'),
    search: _ic('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>'),
  };

  function _showConfirmation({ orderId, itemName, qty, total, method, username, time }) {
    // Remove any existing
    const old = document.getElementById('sp-confirm');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'sp-confirm-overlay';
    overlay.id = 'sp-confirm';
    overlay.innerHTML = `
      <div class="sp-confirm-box">
        <div class="sp-confirm-check">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#17dd62" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--sp-text);margin-bottom:4px">Pesanan Terkirim!</div>
        <div style="font-size:.78rem;color:var(--sp-muted);margin-bottom:12px">Pesan WhatsApp sudah dibuat. Pastikan terkirim ke admin.</div>

        <div style="font-size:.68rem;color:var(--sp-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:6px">ORDER ID</div>
        <div class="sp-confirm-id">
          <span id="sp-confirm-oid">${esc(orderId)}</span>
          <button onclick="window._spCopyOid()">Salin</button>
        </div>

        <div class="sp-confirm-detail" style="text-align:left">
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0">${IC.box} <span>Item: <strong>${esc(itemName)}</strong>${qty > 1 ? ' × ' + qty : ''}</span></div>
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0">${IC.coin} <span>Total: <strong>Rp ${total.toLocaleString('id-ID')}</strong></span></div>
          ${username ? `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">${IC.user} <span>IGN: <strong>${esc(username)}</strong></span></div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0">${IC.card} <span>Bayar: <strong>${esc(method)}</strong></span></div>
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0">${IC.clock} <span>Waktu: <strong>${esc(time)}</strong></span></div>
        </div>

        <div style="font-size:.72rem;color:var(--sp-muted);margin-bottom:8px;line-height:1.5">
          Simpan Order ID ini untuk melacak status pesananmu nanti.
        </div>

        <button class="sp-confirm-close" onclick="window._spConfirmClose()">Tutup</button>
      </div>
    `;
    document.body.appendChild(overlay);
    // Animate in
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
    // Click outside to close
    overlay.addEventListener('click', e => { if (e.target === overlay) window._spConfirmClose(); });
  }

  window._spConfirmClose = function() {
    const el = document.getElementById('sp-confirm');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  };

  window._spCopyOid = function() {
    const oid = document.getElementById('sp-confirm-oid')?.textContent;
    if (!oid) return;
    navigator.clipboard.writeText(oid).then(() => {
      const btn = document.querySelector('.sp-confirm-id button');
      if (btn) { btn.textContent = '✓ Disalin!'; setTimeout(() => btn.textContent = 'Salin', 2000); }
    }).catch(() => {});
  };

  /* ── Order Status Tracker ── */
  window._spTrackOpen = function() {
    document.getElementById('sp-track-overlay').classList.add('open');
    const input = document.getElementById('sp-track-id');
    if (input) { input.value = ''; input.focus(); }
    const result = document.getElementById('sp-track-result');
    if (result) result.style.display = 'none';
  };

  window._spTrackClose = function() {
    document.getElementById('sp-track-overlay').classList.remove('open');
  };

  window._spTrackSearch = async function() {
    const input = document.getElementById('sp-track-id');
    const btn = document.getElementById('sp-track-btn-search');
    const result = document.getElementById('sp-track-result');
    const raw = (input?.value || '').trim().toUpperCase();

    if (!raw) { input.style.borderColor = 'var(--sp-red)'; setTimeout(() => input.style.borderColor = '', 1500); return; }

    btn.disabled = true; btn.textContent = 'Mencari…';

    try {
      const sb = _getSb();

      let data = null;

      // Jika input LT-XXXXXX → suffix 6 char terakhir dari UUID (tanpa dash)
      const ltMatch = raw.match(/^LT-([A-Z0-9]{6})$/);
      if (ltMatch) {
        const wantSuffix = ltMatch[1].toUpperCase();
        // Ambil orders terbaru (30 hari), cocokkan suffix di client — lebih reliable dari ilike
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const { data: rows, error } = await sb.from('orders').select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        data = (rows || []).find(o => o.id && o.id.replace(/-/g, '').slice(-6).toUpperCase() === wantSuffix) || null;
      } else {
        // Input UUID penuh
        const { data: d, error } = await sb.from('orders').select('*').eq('id', raw.toLowerCase()).maybeSingle();
        if (error) throw error;
        data = d;
      }

      if (!data) {
        result.style.display = 'block';
        result.innerHTML = `
          <div style="text-align:center;padding:10px">
            <div style="margin-bottom:8px">${_ic('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>', 'var(--sp-muted)')}</div>
            <div style="font-size:.85rem;font-weight:700;color:var(--sp-text);margin-bottom:4px">Order Tidak Ditemukan</div>
            <div style="font-size:.75rem;color:var(--sp-muted)">Pastikan Order ID benar (contoh: LT-A1B2C3)</div>
          </div>
        `;
        return;
      }

      // Derive friendly code
      const friendlyCode = 'LT-' + data.id.replace(/-/g, '').slice(-6).toUpperCase();

      // Render result
      const statusMap = {
        pending:    { label: 'Menunggu', idx: 0 },
        processing: { label: 'Diproses', idx: 1 },
        selesai:    { label: 'Selesai',  idx: 2 },
        refund:     { label: 'Refund',   idx: -1 },
        cancelled:  { label: 'Dibatalkan', idx: -1 },
      };
      const st = statusMap[data.status] || { label: data.status, idx: 0 };
      const steps = ['Menunggu', 'Diproses', 'Selesai'];
      const icons = [
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
      ];

      let timelineHtml = '';
      if (st.idx >= 0) {
        steps.forEach((label, i) => {
          const cls = i < st.idx ? 'done' : i === st.idx ? 'current' : '';
          timelineHtml += `<div class="sp-track-step"><div class="sp-track-dot ${cls}">${icons[i]}</div><div class="sp-track-label">${label}</div></div>`;
          if (i < steps.length - 1) {
            timelineHtml += `<div class="sp-track-line ${i < st.idx ? 'done' : ''}"></div>`;
          }
        });
      }

      const createdAt = data.created_at ? new Date(data.created_at).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

      result.style.display = 'block';
      result.innerHTML = `
        <div style="text-align:center;margin-bottom:10px">
          <div style="font-size:.68rem;color:var(--sp-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Status</div>
          ${st.idx >= 0 ? `
            <div class="sp-track-timeline">${timelineHtml}</div>
          ` : `
            <div style="margin:12px 0;padding:8px 14px;border-radius:8px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-size:.82rem;font-weight:700">${esc(st.label)}</div>
          `}
        </div>
        <div style="font-size:.78rem;color:var(--sp-muted);line-height:1.9;border-top:1px solid var(--sp-border);padding-top:10px">
          <div style="display:flex;align-items:center;gap:8px">${IC.hash} <span>Order: <strong style="color:var(--sp-purple-l)">${esc(friendlyCode)}</strong></span></div>
          <div style="display:flex;align-items:center;gap:8px">${IC.box} <span>Item: <strong style="color:var(--sp-text)">${esc(data.item_name)}</strong>${data.qty > 1 ? ' × ' + data.qty : ''}</span></div>
          <div style="display:flex;align-items:center;gap:8px">${IC.coin} <span>Total: <strong style="color:var(--sp-text)">Rp ${(data.total_price||0).toLocaleString('id-ID')}</strong></span></div>
          ${data.username && data.username !== 'Anonim' ? `<div style="display:flex;align-items:center;gap:8px">${IC.user} <span>IGN: <strong style="color:var(--sp-text)">${esc(data.username)}</strong></span></div>` : ''}
          <div style="display:flex;align-items:center;gap:8px">${IC.card} <span>Bayar: <strong style="color:var(--sp-text)">${esc(data.payment_method||'—')}</strong></span></div>
          <div style="display:flex;align-items:center;gap:8px">${IC.clock} <span>Dibuat: <strong style="color:var(--sp-text)">${createdAt}</strong></span></div>
        </div>
      `;
    } catch(e) {
      result.style.display = 'block';
      result.innerHTML = `<div style="text-align:center;color:#f87171;font-size:.82rem;padding:10px">Gagal memuat data. Coba lagi.</div>`;
      console.warn('[ShopTrack]', e);
    } finally {
      btn.disabled = false; btn.textContent = 'Cek Sekarang';
    }
  };

  /* ── Gallery ── */
  function buildGallery(imgs) {
    return `<div class="sp-gallery" id="sp-gallery">
      ${imgs.map((url, i) => {
        const isGif = url.toLowerCase().endsWith('.gif');
        return `<img src="${esc(url)}" alt="Foto ${i+1}" style="display:${i===0?'block':'none'}" data-idx="${i}" ${isGif ? '' : 'loading="lazy"'}>`;
      }).join('')}
      ${imgs.length > 1 ? `
        <button class="sp-gallery-arrow left" onclick="window._spSlide(-1)">‹</button>
        <button class="sp-gallery-arrow right" onclick="window._spSlide(1)">›</button>
        <div class="sp-gallery-nav">
          ${imgs.map((_, i) => `<button class="sp-gallery-dot${i===0?' active':''}" data-idx="${i}" onclick="window._spGo(${i})"></button>`).join('')}
        </div>
      ` : ''}
    </div>`;
  }

  function setupGallery(imgs) {
    modalSlide = 0;
  }

  window._spSlide = function(dir) {
    const gallery = document.getElementById('sp-gallery');
    if (!gallery) return;
    const imgs = gallery.querySelectorAll('img');
    if (!imgs.length) return;
    modalSlide = (modalSlide + dir + imgs.length) % imgs.length;
    showSlide(gallery, imgs);
  };

  window._spGo = function(idx) {
    const gallery = document.getElementById('sp-gallery');
    if (!gallery) return;
    modalSlide = idx;
    showSlide(gallery, gallery.querySelectorAll('img'));
  };

  function showSlide(gallery, imgs) {
    imgs.forEach((img, i) => img.style.display = i === modalSlide ? 'block' : 'none');
    gallery.querySelectorAll('.sp-gallery-dot').forEach((d, i) => d.classList.toggle('active', i === modalSlide));
  }

  function badgeSpan(item) {
    const c = BC[item.badgeColor] || BC[''];
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:0.5rem;font-family:'Press Start 2P',monospace;background:${c.bg};border:1px solid ${c.bd};color:${c.cl}">${esc(item.badge)}</span>`;
  }

})();
