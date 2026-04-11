/* ════════════════════════════════════════════════════════
   admin-shop.js — Shop Items Manager for Laughtale Admin Panel
   ════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BADGE_COLORS = ['', 'gold', 'green', 'diamond', 'red'];
  const CATEGORIES   = ['mount', 'pet', 'cosmetic', 'resource', 'tool', 'other'];

  /* ── State ── */
  let shopItems   = [];
  let editingId   = null;
  let filterCat   = 'all';
  let searchQuery = '';

  /* ── Supabase ref (shared from main script) ── */
  function getSb() { return window._adminSb; }

  /* ════════════════════════════════════════════
     INIT — inject UI when DOM + auth are ready
  ════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectSection();
  });

  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    /* nav-group label */
    const grp = document.createElement('div');
    grp.className = 'nav-group-label';
    grp.textContent = 'Toko';
    sidebar.appendChild(grp);

    /* nav item */
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-shop';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      Shop Items`;
    item.onclick = () => showShopSection(item);
    sidebar.appendChild(item);
  }

  function showShopSection(el) {
    /* reuse global showSection helper if available */
    if (typeof showSection === 'function') {
      showSection('shop', el);
    } else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-shop');
      if (sec) sec.classList.add('active');
      if (el)  el.classList.add('active');
      const bc = document.getElementById('topbar-section');
      if (bc) bc.textContent = 'Shop Items';
    }
    loadShopItems();
  }

  /* ════════════════════════════════════════════
     INJECT SECTION HTML
  ════════════════════════════════════════════ */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-shop';
    sec.innerHTML = `
      <div class="page-header">
        <div class="page-title">Shop Items</div>
        <div class="page-sub">Kelola item yang dijual di toko Laughtale SMP</div>
      </div>

      <!-- Toolbar -->
      <div class="shop-toolbar">
        <div class="shop-search-wrap">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="shop-search" placeholder="Cari item..." oninput="window._shopSearch(this.value)">
        </div>
        <div class="shop-filter-tabs" id="shop-filter-tabs">
          <button class="filter-tab active" data-cat="all"    onclick="window._shopFilter('all')">Semua</button>
          <button class="filter-tab"        data-cat="mount"      onclick="window._shopFilter('mount')">Mount</button>
          <button class="filter-tab"        data-cat="pet"        onclick="window._shopFilter('pet')">Pet</button>
          <button class="filter-tab"        data-cat="cosmetic"   onclick="window._shopFilter('cosmetic')">Cosmetic</button>
          <button class="filter-tab"        data-cat="resource"   onclick="window._shopFilter('resource')">Resource</button>
          <button class="filter-tab"        data-cat="tool"       onclick="window._shopFilter('tool')">Tool</button>
          <button class="filter-tab"        data-cat="other"      onclick="window._shopFilter('other')">Other</button>
        </div>
        <button class="save-btn" onclick="window._shopOpenForm()" style="white-space:nowrap">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Item
        </button>
      </div>

      <!-- Stats row -->
      <div class="shop-stats" id="shop-stats"></div>

      <!-- Item grid -->
      <div class="shop-grid" id="shop-grid">
        <div class="empty-state">Memuat item...</div>
      </div>

      <!-- ── FORM MODAL ── -->
      <div class="shop-modal-backdrop" id="shop-modal-backdrop" onclick="window._shopCloseForm()"></div>
      <div class="shop-modal" id="shop-modal">
        <div class="shop-modal-header">
          <div class="shop-modal-title" id="shop-modal-title">Tambah Item</div>
          <button class="btn-icon" onclick="window._shopCloseForm()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="shop-modal-body">
          <div class="field-group">
            <div class="field">
              <label>Nama Item <span style="color:var(--red)">*</span></label>
              <input id="sf-name" placeholder="Pegasus Mount">
            </div>
            <div class="field">
              <label>Kategori</label>
              <select id="sf-category">
                <option value="mount">Mount</option>
                <option value="pet">Pet</option>
                <option value="cosmetic">Cosmetic</option>
                <option value="resource">Resource</option>
                <option value="tool">Tool</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="field-group">
            <div class="field">
              <label>Harga (Rp) <span style="color:var(--red)">*</span></label>
              <input id="sf-price" type="number" min="0" placeholder="15000">
            </div>
            <div class="field">
              <label>Harga Coret (Rp)</label>
              <input id="sf-price-original" type="number" min="0" placeholder="20000">
              <div class="field-hint">Opsional — untuk tampilkan diskon</div>
            </div>
          </div>
          <div class="field-group">
            <div class="field">
              <label>Badge</label>
              <select id="sf-badge">
                <option value="">Tidak ada</option>
                <option value="gold">⭐ Gold</option>
                <option value="green">✅ New</option>
                <option value="diamond">💎 Limited</option>
                <option value="red">🔥 Hot</option>
              </select>
            </div>
            <div class="field">
              <label>Stok</label>
              <input id="sf-stock" type="number" min="-1" placeholder="-1 = unlimited">
              <div class="field-hint">-1 = tidak terbatas</div>
            </div>
          </div>
          <div class="field-group full">
            <div class="field">
              <label>Deskripsi</label>
              <textarea id="sf-desc" placeholder="Deskripsi singkat item ini..."></textarea>
            </div>
          </div>
          <div class="field-group full">
            <div class="field">
              <label>URL Gambar</label>
              <input id="sf-image" placeholder="https://i.imgur.com/...">
              <div class="field-hint">Link gambar item (imgur, discord CDN, dll)</div>
            </div>
          </div>
          <div class="toggle-row">
            <div class="toggle-label">
              <strong>Tampilkan di Toko</strong>
              <span>Item akan muncul di halaman toko website</span>
            </div>
            <div class="toggle on" id="sf-visible" onclick="this.classList.toggle('on')"></div>
          </div>
        </div>
        <div class="shop-modal-footer">
          <button class="btn-ghost" onclick="window._shopCloseForm()">Batal</button>
          <button class="save-btn" onclick="window._shopSaveItem()" id="sf-save-btn">Simpan Item</button>
        </div>
      </div>
    `;

    /* inject styles */
    injectStyles();
    main.appendChild(sec);

    /* expose globals */
    window._shopSearch    = (q) => { searchQuery = q; renderGrid(); };
    window._shopFilter    = (c) => { filterCat   = c; renderGrid(); updateFilterTabs(); };
    window._shopOpenForm  = openForm;
    window._shopCloseForm = closeForm;
    window._shopSaveItem  = saveItem;
    window._shopEditItem  = editItem;
    window._shopDeleteItem= deleteItem;
    window._shopToggleVisible = toggleVisible;
  }

  /* ════════════════════════════════════════════
     STYLES
  ════════════════════════════════════════════ */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* toolbar */
      .shop-toolbar {
        display: flex; align-items: center; gap: 10px;
        flex-wrap: wrap; margin-bottom: 1rem;
      }
      .shop-search-wrap {
        display: flex; align-items: center; gap: 7px;
        background: var(--surface); border: 1px solid var(--border2);
        border-radius: var(--r-md); padding: 7px 11px; flex: 1; min-width: 160px;
      }
      .shop-search-wrap svg { color: var(--text-faint); flex-shrink:0; }
      .shop-search-wrap input {
        background: none; border: none; outline: none;
        color: var(--text); font-size: 13.5px; width: 100%;
      }
      .shop-search-wrap input::placeholder { color: var(--text-faint); }
      .shop-filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
      .filter-tab {
        padding: 5px 11px; border-radius: 20px;
        background: var(--surface2); border: 1px solid var(--border);
        color: var(--text-muted); font-size: 12px; cursor: pointer;
        transition: all .15s; white-space: nowrap;
      }
      .filter-tab:hover { border-color: var(--border3); color: var(--text); }
      .filter-tab.active { background: var(--accent-muted); border-color: rgba(79,125,240,.3); color: var(--accent); }

      /* stats */
      .shop-stats {
        display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1rem;
      }
      .stat-chip {
        padding: 5px 12px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 20px; font-size: 12px; color: var(--text-muted);
      }
      .stat-chip strong { color: var(--text); }

      /* grid */
      .shop-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
      }
      .shop-card {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--r-lg); overflow: hidden;
        transition: border-color .15s, transform .15s;
        position: relative;
      }
      .shop-card:hover { border-color: var(--border3); transform: translateY(-1px); }
      .shop-card.hidden-item { opacity: .45; }

      .shop-card-img {
        width: 100%; aspect-ratio: 1/1; object-fit: cover;
        background: var(--surface3); display: block;
      }
      .shop-card-img-placeholder {
        width: 100%; aspect-ratio: 1/1;
        background: var(--surface3);
        display: flex; align-items: center; justify-content: center;
        color: var(--text-faint); font-size: 28px;
      }
      .shop-card-body { padding: 10px 11px; }
      .shop-card-name {
        font-size: 13px; font-weight: 600; color: var(--text);
        margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .shop-card-cat {
        font-size: 11px; color: var(--text-faint);
        text-transform: capitalize; margin-bottom: 6px;
      }
      .shop-card-price { font-size: 13.5px; font-weight: 700; color: var(--accent); }
      .shop-card-price-orig {
        font-size: 11.5px; color: var(--text-faint);
        text-decoration: line-through; margin-left: 5px;
      }
      .shop-card-actions {
        display: flex; gap: 6px;
        padding: 8px 11px; border-top: 1px solid var(--border);
      }
      .shop-card-actions button { flex: 1; }

      /* badge */
      .shop-badge {
        position: absolute; top: 8px; left: 8px;
        font-size: 10px; font-weight: 700; padding: 2px 7px;
        border-radius: 20px; letter-spacing: .4px; text-transform: uppercase;
      }
      .badge-gold    { background: rgba(245,158,11,.15); color: var(--yellow); border: 1px solid rgba(245,158,11,.3); }
      .badge-green   { background: var(--green-muted);  color: var(--green);  border: 1px solid rgba(34,197,94,.3); }
      .badge-diamond { background: var(--accent-muted); color: var(--accent); border: 1px solid rgba(79,125,240,.3); }
      .badge-red     { background: var(--red-muted);    color: var(--red);    border: 1px solid rgba(239,68,68,.3); }

      .shop-card-stock {
        position: absolute; top: 8px; right: 8px;
        font-size: 10px; padding: 2px 7px; border-radius: 20px;
        background: rgba(0,0,0,.55); color: #fff; backdrop-filter: blur(4px);
      }

      /* modal */
      .shop-modal-backdrop {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,.6); z-index: 200;
        backdrop-filter: blur(3px);
      }
      .shop-modal-backdrop.open { display: block; }
      .shop-modal {
        display: none; position: fixed;
        top: 50%; left: 50%; transform: translate(-50%,-50%);
        width: min(520px, calc(100vw - 32px));
        max-height: calc(100vh - 40px);
        background: var(--surface); border: 1px solid var(--border2);
        border-radius: var(--r-lg); box-shadow: var(--shadow-lg);
        z-index: 201; overflow: hidden; flex-direction: column;
      }
      .shop-modal.open { display: flex; }
      .shop-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
      }
      .shop-modal-title { font-size: 14px; font-weight: 700; color: var(--text); }
      .shop-modal-body { flex: 1; overflow-y: auto; padding: 16px; }
      .shop-modal-footer {
        display: flex; gap: 8px; justify-content: flex-end;
        padding: 12px 16px; border-top: 1px solid var(--border); flex-shrink: 0;
      }

      /* edit btn */
      .btn-edit {
        flex: 1; padding: 6px 0;
        background: var(--surface3); border: 1px solid var(--border2);
        border-radius: var(--r-sm); color: var(--text-muted); font-size: 12px;
        cursor: pointer; transition: all .15s;
      }
      .btn-edit:hover { border-color: rgba(79,125,240,.35); color: var(--accent); }
      .btn-del {
        padding: 6px 8px;
        background: transparent; border: 1px solid var(--border);
        border-radius: var(--r-sm); color: var(--text-faint); font-size: 12px;
        cursor: pointer; transition: all .15s;
      }
      .btn-del:hover { border-color: rgba(239,68,68,.4); color: #fca5a5; }

      @media (max-width: 600px) {
        .shop-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        .shop-toolbar { flex-direction: column; align-items: stretch; }
        .shop-search-wrap { min-width: unset; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ════════════════════════════════════════════
     LOAD & RENDER
  ════════════════════════════════════════════ */
  async function loadShopItems() {
    const sb = getSb();
    if (!sb) { setTimeout(loadShopItems, 300); return; }

    const { data, error } = await sb.from('shop_items').select('*').order('created_at', { ascending: false });
    if (error) { toast('Gagal memuat shop items: ' + error.message, 'error'); return; }
    shopItems = data || [];
    renderStats();
    renderGrid();
  }

  function renderStats() {
    const el = document.getElementById('shop-stats');
    if (!el) return;
    const total   = shopItems.length;
    const visible = shopItems.filter(i => i.visible !== false).length;
    const cats    = [...new Set(shopItems.map(i => i.category))].filter(Boolean);
    el.innerHTML = `
      <div class="stat-chip">Total: <strong>${total}</strong></div>
      <div class="stat-chip">Tampil: <strong>${visible}</strong></div>
      <div class="stat-chip">Kategori: <strong>${cats.length}</strong></div>
    `;
  }

  function renderGrid() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    let items = shopItems;
    if (filterCat !== 'all')  items = items.filter(i => i.category === filterCat);
    if (searchQuery.trim())   items = items.filter(i =>
      (i.name||'').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.description||'').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!items.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Tidak ada item ditemukan.</div>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const price    = Number(item.price || 0).toLocaleString('id-ID');
      const origPrice= item.price_original ? Number(item.price_original).toLocaleString('id-ID') : null;
      const badge    = item.badge ? `<div class="shop-badge badge-${item.badge}">${badgeLabel(item.badge)}</div>` : '';
      const stock    = item.stock != null && item.stock >= 0
        ? `<div class="shop-card-stock">Stok ${item.stock}</div>` : '';
      const img      = item.image_url
        ? `<img class="shop-card-img" src="${esc(item.image_url)}" alt="${esc(item.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          + `<div class="shop-card-img-placeholder" style="display:none">🛒</div>`
        : `<div class="shop-card-img-placeholder">🛒</div>`;

      return `
        <div class="shop-card ${item.visible === false ? 'hidden-item' : ''}" id="scard-${item.id}">
          ${badge}${stock}
          ${img}
          <div class="shop-card-body">
            <div class="shop-card-name" title="${esc(item.name)}">${esc(item.name)}</div>
            <div class="shop-card-cat">${esc(item.category||'—')}</div>
            <div>
              <span class="shop-card-price">Rp ${price}</span>
              ${origPrice ? `<span class="shop-card-price-orig">Rp ${origPrice}</span>` : ''}
            </div>
          </div>
          <div class="shop-card-actions">
            <button class="btn-edit" onclick="window._shopEditItem(${item.id})">✏️ Edit</button>
            <button class="btn-edit" onclick="window._shopToggleVisible(${item.id})" title="${item.visible===false?'Tampilkan':'Sembunyikan'}" style="flex:0;padding:6px 8px">${item.visible===false?'👁':'🙈'}</button>
            <button class="btn-del"  onclick="window._shopDeleteItem(${item.id})" title="Hapus">🗑</button>
          </div>
        </div>`;
    }).join('');
  }

  function updateFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === filterCat);
    });
  }

  function badgeLabel(b) {
    return { gold:'⭐ Gold', green:'✅ New', diamond:'💎 Limited', red:'🔥 Hot' }[b] || b;
  }

  /* ════════════════════════════════════════════
     FORM
  ════════════════════════════════════════════ */
  function openForm(item = null) {
    editingId = item ? item.id : null;
    document.getElementById('shop-modal-title').textContent = item ? 'Edit Item' : 'Tambah Item';
    document.getElementById('sf-name').value          = item?.name          || '';
    document.getElementById('sf-desc').value          = item?.description   || '';
    document.getElementById('sf-price').value         = item?.price         || '';
    document.getElementById('sf-price-original').value= item?.price_original|| '';
    document.getElementById('sf-image').value         = item?.image_url     || '';
    document.getElementById('sf-stock').value         = item?.stock ?? -1;
    document.getElementById('sf-category').value      = item?.category      || 'other';
    document.getElementById('sf-badge').value         = item?.badge         || '';
    const vis = document.getElementById('sf-visible');
    item?.visible === false ? vis.classList.remove('on') : vis.classList.add('on');

    document.getElementById('shop-modal-backdrop').classList.add('open');
    document.getElementById('shop-modal').classList.add('open');
    document.getElementById('sf-name').focus();
  }

  function closeForm() {
    document.getElementById('shop-modal-backdrop').classList.remove('open');
    document.getElementById('shop-modal').classList.remove('open');
    editingId = null;
  }

  function editItem(id) {
    const item = shopItems.find(i => i.id === id);
    if (item) openForm(item);
  }

  /* ════════════════════════════════════════════
     SAVE / DELETE / TOGGLE
  ════════════════════════════════════════════ */
  async function saveItem() {
    const name  = document.getElementById('sf-name').value.trim();
    const price = document.getElementById('sf-price').value.trim();
    if (!name)  { toast('Nama item wajib diisi.', 'error'); return; }
    if (!price) { toast('Harga wajib diisi.', 'error'); return; }

    const btn = document.getElementById('sf-save-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan...';

    const payload = {
      name,
      description:    document.getElementById('sf-desc').value.trim() || null,
      price:          Number(price),
      price_original: Number(document.getElementById('sf-price-original').value) || null,
      image_url:      document.getElementById('sf-image').value.trim() || null,
      stock:          Number(document.getElementById('sf-stock').value) ?? -1,
      category:       document.getElementById('sf-category').value,
      badge:          document.getElementById('sf-badge').value || null,
      visible:        document.getElementById('sf-visible').classList.contains('on'),
    };

    const sb = getSb();
    let error;
    if (editingId) {
      ({ error } = await sb.from('shop_items').update(payload).eq('id', editingId));
    } else {
      ({ error } = await sb.from('shop_items').insert(payload));
    }

    btn.disabled = false; btn.textContent = 'Simpan Item';
    if (error) { toast('Gagal simpan: ' + error.message, 'error'); return; }

    toast(editingId ? 'Item berhasil diperbarui.' : 'Item berhasil ditambahkan.');
    closeForm();
    await loadShopItems();
  }

  async function deleteItem(id) {
    const item = shopItems.find(i => i.id === id);
    if (!confirm(`Hapus item "${item?.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const sb = getSb();
    const { error } = await sb.from('shop_items').delete().eq('id', id);
    if (error) { toast('Gagal hapus: ' + error.message, 'error'); return; }
    toast('Item dihapus.');
    await loadShopItems();
  }

  async function toggleVisible(id) {
    const item = shopItems.find(i => i.id === id);
    if (!item) return;
    const sb = getSb();
    const { error } = await sb.from('shop_items').update({ visible: !item.visible }).eq('id', id);
    if (error) { toast('Gagal update: ' + error.message, 'error'); return; }
    toast(item.visible ? 'Item disembunyikan.' : 'Item ditampilkan.');
    await loadShopItems();
  }

  /* ════════════════════════════════════════════
     UTILS
  ════════════════════════════════════════════ */
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const container = document.getElementById('toast');
    if (container) { container.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }

})();
