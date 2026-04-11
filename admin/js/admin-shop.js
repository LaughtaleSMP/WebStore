/* ════════════════════════════════════════════════════════════════
   admin-shop.js — Shop Configurator for Laughtale Admin Panel
   Edit item shop (harga, stok, badge, dll) → simpan ke Supabase
   Web umum membaca dari tabel `shop_config` di Supabase.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Fallback config dari file statis ── */
  function getStaticConfig() {
    return (typeof SHOP_CONFIG !== 'undefined') ? JSON.parse(JSON.stringify(SHOP_CONFIG)) : null;
  }

  /* ── State ── */
  let cfg         = null;   // config aktif (dari Supabase atau statis)
  let editingIdx  = null;   // index item yang sedang di-edit
  let dirty       = false;  // ada perubahan belum tersimpan

  function getSb() { return window._adminSb; }

  /* ════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectSection();
  });

  /* ── Sidebar nav ── */
  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const grp = document.createElement('div');
    grp.className = 'nav-group-label';
    grp.textContent = 'Toko';
    sidebar.appendChild(grp);

    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-shop';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      Shop`;
    item.onclick = () => showShopSection(item);
    sidebar.appendChild(item);
  }

  function showShopSection(el) {
    if (typeof showSection === 'function') {
      showSection('shop', el);
    } else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-shop');
      if (sec) sec.classList.add('active');
      if (el)  el.classList.add('active');
      const bc = document.getElementById('topbar-section');
      if (bc) bc.textContent = 'Shop';
    }
    loadConfig();
  }

  /* ════════════════════════════════════════════
     INJECT HTML SECTION
  ════════════════════════════════════════════ */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-shop';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Konfigurasi Shop</div>
          <div class="page-sub">Edit harga, stok, badge, dan informasi item yang tampil di web</div>
        </div>
        <button class="save-btn" id="shop-save-all-btn" onclick="window._shopSaveAll()" style="opacity:.4;cursor:not-allowed" disabled>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Simpan Semua
        </button>
      </div>

      <!-- Tabs -->
      <div class="shop-cfg-tabs" id="shop-cfg-tabs">
        <button class="scfg-tab active" data-tab="items" onclick="window._shopTab('items',this)">🛍 Item Shop</button>
        <button class="scfg-tab" data-tab="general" onclick="window._shopTab('general',this)">⚙️ Umum &amp; WA</button>
      </div>

      <!-- Loading -->
      <div id="shop-loading" style="padding:2rem;color:var(--text-faint);font-size:13px">Memuat konfigurasi…</div>

      <!-- ══ TAB: ITEMS ══ -->
      <div id="shop-tab-items" class="shop-tab-content" style="display:none">
        <div class="shop-cfg-toolbar">
          <input id="shop-item-search" placeholder="🔍  Cari item…" oninput="window._shopItemSearch(this.value)"
            style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);padding:7px 11px;color:var(--text);font-size:13px;outline:none;flex:1;min-width:160px">
          <button class="save-btn" onclick="window._shopNewItem()" style="white-space:nowrap">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Item
          </button>
        </div>
        <div id="shop-item-list"></div>
      </div>

      <!-- ══ TAB: GENERAL ══ -->
      <div id="shop-tab-general" class="shop-tab-content" style="display:none">
        <div class="scfg-card" style="max-width:680px">
          <div class="scfg-card-title">Info Toko</div>
          <div class="field">
            <label>Judul Toko</label>
            <input id="g-title" oninput="window._shopMarkDirty()">
          </div>
          <div class="field" style="margin-top:10px">
            <label>Subtitle</label>
            <textarea id="g-subtitle" rows="2" oninput="window._shopMarkDirty()"></textarea>
          </div>
        </div>

        <div class="scfg-card" style="max-width:680px;margin-top:14px">
          <div class="scfg-card-title">Admin WhatsApp (untuk semua item kecuali Gem)</div>
          <div id="g-admins-list"></div>
          <button class="btn-ghost" style="margin-top:8px;font-size:12px" onclick="window._shopAddAdmin('main')">+ Tambah Admin</button>
        </div>

        <div class="scfg-card" style="max-width:680px;margin-top:14px">
          <div class="scfg-card-title">Admin WhatsApp Gem Coins</div>
          <div id="g-gem-admins-list"></div>
          <button class="btn-ghost" style="margin-top:8px;font-size:12px" onclick="window._shopAddAdmin('gem')">+ Tambah Admin Gem</button>
        </div>
      </div>

      <!-- ══ FORM EDIT ITEM (modal) ══ -->
      <div class="scfg-backdrop" id="scfg-backdrop" onclick="window._shopCloseForm()"></div>
      <div class="scfg-modal" id="scfg-modal">
        <div class="scfg-modal-header">
          <span id="scfg-modal-title">Edit Item</span>
          <button class="btn-icon" onclick="window._shopCloseForm()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="scfg-modal-body">

          <!-- Nama & Emoji -->
          <div class="field-group">
            <div class="field" style="flex:2">
              <label>Nama Item <span style="color:var(--red)">*</span></label>
              <input id="ef-name" placeholder="Name Style (Chat)">
            </div>
            <div class="field" style="flex:0 0 80px">
              <label>Emoji</label>
              <input id="ef-emoji" placeholder="🏷️" maxlength="8">
            </div>
          </div>

          <!-- Kategori -->
          <div class="field" style="margin-top:10px">
            <label>Kategori</label>
            <input id="ef-category" placeholder="Custom Nametag" oninput="window._shopMarkDirty()">
            <div class="field-hint" id="ef-category-hint"></div>
          </div>

          <!-- Harga -->
          <div class="field-group" style="margin-top:10px">
            <div class="field">
              <label>Harga (Rp) <span style="color:var(--red)">*</span></label>
              <input id="ef-price" type="number" min="0" placeholder="15000" oninput="window._shopMarkDirty()">
            </div>
            <div class="field">
              <label>Harga Coret (Rp)</label>
              <input id="ef-price-orig" type="number" min="0" placeholder="20000 (opsional)" oninput="window._shopMarkDirty()">
            </div>
          </div>

          <!-- Badge -->
          <div class="field-group" style="margin-top:10px">
            <div class="field">
              <label>Teks Badge</label>
              <input id="ef-badge" placeholder="POPULER / NEW / SPECIAL / …" maxlength="20" oninput="window._shopMarkDirty()">
            </div>
            <div class="field">
              <label>Warna Badge</label>
              <select id="ef-badge-color" onchange="window._shopMarkDirty()">
                <option value="">Tidak ada</option>
                <option value="gold">⭐ Gold</option>
                <option value="green">🟢 Green</option>
                <option value="diamond">💎 Diamond (biru)</option>
                <option value="red">🔴 Red</option>
              </select>
            </div>
          </div>

          <!-- Stok -->
          <div class="field" style="margin-top:10px">
            <label>Stok</label>
            <select id="ef-stock" onchange="window._shopMarkDirty()">
              <option value="Tersedia">✅ Tersedia</option>
              <option value="Habis">❌ Habis</option>
            </select>
          </div>

          <!-- Deskripsi -->
          <div class="field" style="margin-top:10px">
            <label>Deskripsi</label>
            <textarea id="ef-desc" rows="2" placeholder="Deskripsi singkat item…" oninput="window._shopMarkDirty()"></textarea>
          </div>

          <!-- Fitur (features) -->
          <div class="field" style="margin-top:10px">
            <label>Fitur <span style="color:var(--text-faint);font-size:11px">(pisahkan dengan Enter)</span></label>
            <textarea id="ef-features" rows="3" placeholder="Bebas pilih warna &amp; style&#10;Berlaku permanen selama season" oninput="window._shopMarkDirty()"></textarea>
          </div>

          <!-- Toggle baris -->
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Perlu Desain (requiresDesign)</strong>
                <span>Pembeli harus siapkan file desain sebelum order</span>
              </div>
              <div class="toggle" id="ef-requires-design" onclick="this.classList.toggle('on');window._shopMarkDirty()"></div>
            </div>
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Minta Username Minecraft</strong>
                <span>Form pesanan akan menampilkan field username</span>
              </div>
              <div class="toggle on" id="ef-needs-username" onclick="this.classList.toggle('on');window._shopMarkDirty()"></div>
            </div>
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Bisa Beli Banyak (qty)</strong>
                <span>Pembeli bisa pilih jumlah yang dibeli</span>
              </div>
              <div class="toggle on" id="ef-can-multi" onclick="this.classList.toggle('on');window._shopMarkDirty();window._shopToggleMaxQty()"></div>
            </div>
          </div>

          <!-- Max qty (tampil hanya bila canBuyMultiple) -->
          <div class="field" style="margin-top:10px" id="ef-max-qty-wrap">
            <label>Maks. Qty per Pesanan</label>
            <input id="ef-max-qty" type="number" min="1" placeholder="99" oninput="window._shopMarkDirty()">
          </div>

        </div>
        <div class="scfg-modal-footer">
          <button class="btn-ghost" onclick="window._shopCloseForm()">Batal</button>
          <button class="save-btn" id="ef-save-btn" onclick="window._shopApplyItem()">Terapkan</button>
        </div>
      </div>
    `;

    injectStyles();
    main.appendChild(sec);
    registerGlobals();
  }

  /* ════════════════════════════════════════════
     STYLES
  ════════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .shop-cfg-tabs { display:flex; gap:6px; margin-bottom:1.2rem; flex-wrap:wrap; }
      .scfg-tab {
        padding:7px 16px; border-radius:20px; font-size:12.5px;
        background:var(--surface2); border:1px solid var(--border);
        color:var(--text-muted); cursor:pointer; transition:all .15s;
      }
      .scfg-tab:hover { color:var(--text); border-color:var(--border3); }
      .scfg-tab.active { background:var(--accent-muted); border-color:rgba(79,125,240,.3); color:var(--accent); }
      .shop-cfg-toolbar {
        display:flex; gap:10px; align-items:center;
        flex-wrap:wrap; margin-bottom:1rem;
      }
      .scfg-item-row {
        display:flex; align-items:center; gap:10px;
        background:var(--surface); border:1px solid var(--border);
        border-radius:var(--r-md); padding:10px 12px;
        margin-bottom:8px; transition:border-color .15s;
      }
      .scfg-item-row:hover { border-color:var(--border3); }
      .scfg-item-emoji { font-size:1.5rem; flex-shrink:0; width:32px; text-align:center; }
      .scfg-item-info { flex:1; min-width:0; }
      .scfg-item-name { font-size:13.5px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .scfg-item-meta { font-size:11.5px; color:var(--text-faint); margin-top:2px; display:flex; gap:10px; flex-wrap:wrap; }
      .scfg-badge-preview {
        display:inline-block; font-size:10px; font-weight:700; padding:1px 7px;
        border-radius:20px; letter-spacing:.4px; text-transform:uppercase;
      }
      .scfg-badge-gold    { background:rgba(245,158,11,.15); color:#f59e0b; border:1px solid rgba(245,158,11,.3); }
      .scfg-badge-green   { background:var(--green-muted,rgba(34,197,94,.12)); color:#22c55e; border:1px solid rgba(34,197,94,.3); }
      .scfg-badge-diamond { background:var(--accent-muted); color:var(--accent); border:1px solid rgba(79,125,240,.3); }
      .scfg-badge-red     { background:var(--red-muted,rgba(239,68,68,.12)); color:#ef4444; border:1px solid rgba(239,68,68,.3); }
      .scfg-badge-empty   { background:var(--surface3); color:var(--text-faint); border:1px solid var(--border); }
      .scfg-stock-ok  { color:#22c55e; }
      .scfg-stock-out { color:#ef4444; }
      .scfg-item-actions { display:flex; gap:6px; flex-shrink:0; }
      .scfg-card {
        background:var(--surface); border:1px solid var(--border);
        border-radius:var(--r-lg); padding:16px;
      }
      .scfg-card-title { font-size:13px; font-weight:700; color:var(--text); margin-bottom:12px; }
      .scfg-admin-row {
        display:flex; gap:8px; align-items:center; margin-bottom:8px;
      }
      .scfg-admin-row input { flex:1; }
      .scfg-backdrop {
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,.6); z-index:200; backdrop-filter:blur(3px);
      }
      .scfg-backdrop.open { display:block; }
      .scfg-modal {
        display:none; position:fixed;
        top:50%; left:50%; transform:translate(-50%,-50%);
        width:min(560px,calc(100vw - 28px));
        max-height:calc(100vh - 40px);
        background:var(--surface); border:1px solid var(--border2);
        border-radius:var(--r-lg); box-shadow:var(--shadow-lg);
        z-index:201; flex-direction:column; overflow:hidden;
      }
      .scfg-modal.open { display:flex; }
      .scfg-modal-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:14px 16px; border-bottom:1px solid var(--border);
        font-size:14px; font-weight:700; color:var(--text); flex-shrink:0;
      }
      .scfg-modal-body { flex:1; overflow-y:auto; padding:16px; }
      .scfg-modal-footer {
        display:flex; gap:8px; justify-content:flex-end;
        padding:12px 16px; border-top:1px solid var(--border); flex-shrink:0;
      }
      #shop-save-all-btn.dirty {
        opacity:1 !important; cursor:pointer !important;
        background:var(--accent) !important; animation:savePulse 1.5s ease-in-out infinite;
      }
      @keyframes savePulse { 0%,100%{box-shadow:0 0 0 0 rgba(79,125,240,.4)} 50%{box-shadow:0 0 0 6px rgba(79,125,240,0)} }
      @media(max-width:600px){
        .scfg-item-row { flex-wrap:wrap; }
        .scfg-item-actions { width:100%; justify-content:flex-end; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ════════════════════════════════════════════
     GLOBALS
  ════════════════════════════════════════════ */
  function registerGlobals() {
    window._shopTab         = switchTab;
    window._shopItemSearch  = filterItems;
    window._shopNewItem     = newItem;
    window._shopEditItem    = editItem;
    window._shopDeleteItem  = deleteItem;
    window._shopMoveItem    = moveItem;
    window._shopCloseForm   = closeForm;
    window._shopApplyItem   = applyItem;
    window._shopSaveAll     = saveAll;
    window._shopMarkDirty   = markDirty;
    window._shopToggleMaxQty= toggleMaxQty;
    window._shopAddAdmin    = addAdminRow;
    window._shopRemoveAdmin = removeAdminRow;
  }

  /* ════════════════════════════════════════════
     LOAD CONFIG
  ════════════════════════════════════════════ */
  async function loadConfig() {
    document.getElementById('shop-loading').style.display = 'block';
    document.getElementById('shop-tab-items').style.display   = 'none';
    document.getElementById('shop-tab-general').style.display = 'none';

    const sb = getSb();
    let loaded = false;

    if (sb) {
      const { data, error } = await sb
        .from('shop_config')
        .select('value')
        .eq('key', 'main')
        .single();
      if (!error && data?.value) {
        try { cfg = JSON.parse(data.value); loaded = true; } catch(e) {}
      }
    }

    if (!loaded) {
      const staticCfg = getStaticConfig();
      if (staticCfg) { cfg = staticCfg; loaded = true; }
    }

    if (!loaded) {
      document.getElementById('shop-loading').textContent = '⚠️ Gagal memuat konfigurasi.';
      return;
    }

    /* pastikan semua field ada */
    if (!cfg.items)      cfg.items      = [];
    if (!cfg.admins)     cfg.admins     = [];
    if (!cfg.gemAdmins)  cfg.gemAdmins  = [];
    /* FIX: rebuild categories dari items agar selalu lengkap */
    rebuildCategories();
    /* FIX: fallback title/subtitle dari SHOP_CONFIG statis jika kosong */
    if (!cfg.title) {
      const sc = getStaticConfig();
      if (sc) { cfg.title = sc.title || ''; cfg.subtitle = sc.subtitle || ''; }
    }

    dirty = false;
    updateSaveBtn();
    document.getElementById('shop-loading').style.display = 'none';
    switchTab('items', document.querySelector('.scfg-tab[data-tab="items"]'));
  }

  /* ════════════════════════════════════════════
     REBUILD CATEGORIES dari semua item
  ════════════════════════════════════════════ */
  function rebuildCategories() {
    /* Ambil urutan kategori lama agar tidak acak */
    const existing = cfg.categories || [];
    const fromItems = [...new Set(cfg.items.map(i => i.category).filter(Boolean))];
    /* Gabungkan: kategori lama yang masih dipakai + kategori baru dari item */
    const merged = [...new Set([...existing.filter(c => c !== 'Semua'), ...fromItems])];
    cfg.categories = ['Semua', ...merged];
  }

  /* ════════════════════════════════════════════
     TABS
  ════════════════════════════════════════════ */
  let currentTab = 'items';
  let itemSearch = '';

  function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.scfg-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.shop-tab-content').forEach(el => el.style.display = 'none');
    const el = document.getElementById('shop-tab-' + tab);
    if (el) el.style.display = 'block';
    if (tab === 'items')   renderItemList();
    if (tab === 'general') renderGeneral();
  }

  /* ════════════════════════════════════════════
     ITEM LIST
  ════════════════════════════════════════════ */
  function filterItems(q) { itemSearch = q; renderItemList(); }

  function renderItemList() {
    const el = document.getElementById('shop-item-list');
    if (!el || !cfg) return;

    let items = cfg.items;
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      items = items.filter(i =>
        (i.name||'').toLowerCase().includes(q) ||
        (i.category||'').toLowerCase().includes(q)
      );
    }

    if (!items.length) {
      el.innerHTML = '<div class="empty-state">Tidak ada item ditemukan.</div>';
      return;
    }

    el.innerHTML = items.map((item) => {
      const realIdx = cfg.items.indexOf(item);
      const priceStr = 'Rp ' + Number(item.price||0).toLocaleString('id-ID');
      const origStr  = item.originalPrice ? ' <span style="text-decoration:line-through;opacity:.5">Rp ' + Number(item.originalPrice).toLocaleString('id-ID') + '</span>' : '';
      const badgeCls = item.badgeColor ? `scfg-badge-${item.badgeColor}` : 'scfg-badge-empty';
      const badgeHtml = item.badge
        ? `<span class="scfg-badge-preview ${badgeCls}">${esc(item.badge)}</span>`
        : `<span class="scfg-badge-preview scfg-badge-empty" style="opacity:.4">no badge</span>`;
      const stockHtml = item.stock === 'Habis'
        ? `<span class="scfg-stock-out">❌ Habis</span>`
        : `<span class="scfg-stock-ok">✅ Tersedia</span>`;

      return `
        <div class="scfg-item-row" id="srow-${realIdx}">
          <div class="scfg-item-emoji">${esc(item.emoji||'🛒')}</div>
          <div class="scfg-item-info">
            <div class="scfg-item-name">${esc(item.name||'(tanpa nama)')}</div>
            <div class="scfg-item-meta">
              <span>${esc(item.category||'—')}</span>
              <span><strong>${priceStr}</strong>${origStr}</span>
              ${stockHtml}
              ${badgeHtml}
            </div>
          </div>
          <div class="scfg-item-actions">
            <button class="btn-edit" onclick="window._shopMoveItem(${realIdx},-1)" title="Naik" ${realIdx===0?'disabled':''}>↑</button>
            <button class="btn-edit" onclick="window._shopMoveItem(${realIdx},1)" title="Turun" ${realIdx===cfg.items.length-1?'disabled':''}>↓</button>
            <button class="btn-edit" onclick="window._shopEditItem(${realIdx})">✏️ Edit</button>
            <button class="btn-del"  onclick="window._shopDeleteItem(${realIdx})" title="Hapus">🗑</button>
          </div>
        </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════
     GENERAL TAB
  ════════════════════════════════════════════ */
  function renderGeneral() {
    if (!cfg) return;
    document.getElementById('g-title').value    = cfg.title    || '';
    document.getElementById('g-subtitle').value = cfg.subtitle || '';
    renderAdminList('main');
    renderAdminList('gem');

    const cats = [...new Set(cfg.items.map(i => i.category).filter(Boolean))];
    const hint = document.getElementById('ef-category-hint');
    if (hint) hint.textContent = cats.length ? 'Kategori yang ada: ' + cats.join(', ') : '';
  }

  function renderAdminList(type) {
    const listId  = type === 'main' ? 'g-admins-list' : 'g-gem-admins-list';
    const arrKey  = type === 'main' ? 'admins' : 'gemAdmins';
    const el = document.getElementById(listId);
    if (!el) return;
    const arr = cfg[arrKey] || [];
    el.innerHTML = arr.map((a, i) => `
      <div class="scfg-admin-row" id="adm-${type}-${i}">
        <input placeholder="Nama admin" value="${esc(a.name||'')}"
          oninput="window._shopAdminChange('${type}',${i},'name',this.value)">
        <input placeholder="Nomor WA (628…)" value="${esc(a.number||'')}"
          oninput="window._shopAdminChange('${type}',${i},'number',this.value)"
          style="flex:1.5">
        <button class="btn-del" onclick="window._shopRemoveAdmin('${type}',${i})" title="Hapus">🗑</button>
      </div>`).join('') || '<div style="color:var(--text-faint);font-size:12px;padding:4px 0">Belum ada admin.</div>';
  }

  window._shopAdminChange = function(type, idx, field, val) {
    const arrKey = type === 'main' ? 'admins' : 'gemAdmins';
    cfg[arrKey][idx][field] = val;
    markDirty();
  };

  function addAdminRow(type) {
    const arrKey = type === 'main' ? 'admins' : 'gemAdmins';
    cfg[arrKey].push({ name: '', number: '' });
    markDirty();
    renderAdminList(type);
  }

  function removeAdminRow(type, idx) {
    const arrKey = type === 'main' ? 'admins' : 'gemAdmins';
    cfg[arrKey].splice(idx, 1);
    markDirty();
    renderAdminList(type);
  }

  /* ════════════════════════════════════════════
     ITEM FORM
  ════════════════════════════════════════════ */
  function newItem() {
    editingIdx = null;
    document.getElementById('scfg-modal-title').textContent = 'Tambah Item Baru';
    clearForm();
    openModal();
  }

  function editItem(idx) {
    editingIdx = idx;
    const item = cfg.items[idx];
    document.getElementById('scfg-modal-title').textContent = 'Edit Item';
    document.getElementById('ef-name').value        = item.name          || '';
    document.getElementById('ef-emoji').value       = item.emoji         || '';
    document.getElementById('ef-category').value    = item.category      || '';
    document.getElementById('ef-price').value       = item.price         ?? '';
    document.getElementById('ef-price-orig').value  = item.originalPrice || '';
    document.getElementById('ef-badge').value       = item.badge         || '';
    document.getElementById('ef-badge-color').value = item.badgeColor    || '';
    document.getElementById('ef-stock').value       = item.stock         || 'Tersedia';
    document.getElementById('ef-desc').value        = item.description   || '';
    document.getElementById('ef-features').value    = (item.features||[]).join('\n');
    setToggle('ef-requires-design', !!item.requiresDesign);
    setToggle('ef-needs-username',  item.needsUsername !== false);
    setToggle('ef-can-multi',       item.canBuyMultiple !== false);
    document.getElementById('ef-max-qty').value     = item.maxQuantity   || '';
    toggleMaxQty();
    openModal();
  }

  function clearForm() {
    ['ef-name','ef-emoji','ef-category','ef-price','ef-price-orig',
     'ef-badge','ef-desc','ef-features','ef-max-qty'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('ef-badge-color').value = '';
    document.getElementById('ef-stock').value = 'Tersedia';
    setToggle('ef-requires-design', false);
    setToggle('ef-needs-username',  true);
    setToggle('ef-can-multi',       true);
    toggleMaxQty();
  }

  function applyItem() {
    const name  = document.getElementById('ef-name').value.trim();
    const price = document.getElementById('ef-price').value.trim();
    if (!name)  { toast('Nama item wajib diisi.', 'error'); return; }
    if (price === '') { toast('Harga wajib diisi.', 'error'); return; }

    const canMulti = document.getElementById('ef-can-multi').classList.contains('on');

    const item = {
      id:             editingIdx !== null ? cfg.items[editingIdx].id : (Math.max(0, ...cfg.items.map(i=>i.id||0)) + 1),
      name,
      emoji:          document.getElementById('ef-emoji').value.trim() || '🛒',
      category:       document.getElementById('ef-category').value.trim() || 'Lainnya',
      price:          Number(price),
      originalPrice:  Number(document.getElementById('ef-price-orig').value) || 0,
      badge:          document.getElementById('ef-badge').value.trim(),
      badgeColor:     document.getElementById('ef-badge-color').value,
      stock:          document.getElementById('ef-stock').value,
      description:    document.getElementById('ef-desc').value.trim(),
      features:       document.getElementById('ef-features').value.split('\n').map(s=>s.trim()).filter(Boolean),
      requiresDesign: document.getElementById('ef-requires-design').classList.contains('on'),
      needsUsername:  document.getElementById('ef-needs-username').classList.contains('on'),
      canBuyMultiple: canMulti,
      maxQuantity:    canMulti ? (Number(document.getElementById('ef-max-qty').value) || 99) : 1,
      images:         editingIdx !== null ? (cfg.items[editingIdx].images || []) : [],
    };

    if (editingIdx !== null) {
      cfg.items[editingIdx] = item;
    } else {
      cfg.items.push(item);
    }

    /* FIX: selalu rebuild categories dari semua item setelah tambah/edit */
    rebuildCategories();

    markDirty();
    closeForm();
    renderItemList();
    toast(editingIdx !== null ? 'Item diperbarui.' : 'Item ditambahkan.');
  }

  function deleteItem(idx) {
    const item = cfg.items[idx];
    if (!confirm(`Hapus item "${item?.name}"?\nTindakan ini tidak bisa dibatalkan.`)) return;
    cfg.items.splice(idx, 1);
    /* FIX: rebuild categories setelah hapus item */
    rebuildCategories();
    markDirty();
    renderItemList();
    toast('Item dihapus.');
  }

  function moveItem(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= cfg.items.length) return;
    [cfg.items[idx], cfg.items[newIdx]] = [cfg.items[newIdx], cfg.items[idx]];
    markDirty();
    renderItemList();
  }

  /* ════════════════════════════════════════════
     SAVE ALL → SUPABASE
  ════════════════════════════════════════════ */
  async function saveAll() {
    if (!dirty) return;

    /* FIX: kumpulkan title & subtitle dari DOM terlebih dulu */
    const gTitle    = document.getElementById('g-title');
    const gSubtitle = document.getElementById('g-subtitle');
    if (gTitle)    cfg.title    = gTitle.value.trim();
    if (gSubtitle) cfg.subtitle = gSubtitle.value.trim();

    /* FIX: fallback title dari SHOP_CONFIG statis jika masih kosong */
    if (!cfg.title) {
      const sc = getStaticConfig();
      if (sc) { cfg.title = sc.title || 'Toko'; cfg.subtitle = cfg.subtitle || sc.subtitle || ''; }
    }

    /* FIX: pastikan categories selalu lengkap sebelum simpan */
    rebuildCategories();

    const btn = document.getElementById('shop-save-all-btn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan…';

    const sb = getSb();
    if (!sb) {
      toast('Supabase belum siap.', 'error');
      btn.disabled = false; btn.innerHTML = saveBtnInner(); return;
    }

    const { error } = await sb.from('shop_config').upsert({
      key:        'main',
      value:      JSON.stringify(cfg),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    btn.disabled = false; btn.innerHTML = saveBtnInner();

    if (error) { toast('Gagal menyimpan: ' + error.message, 'error'); markDirty(); return; }

    dirty = false;
    btn.classList.remove('dirty');
    btn.disabled = true;
    toast('Konfigurasi shop berhasil disimpan! ✅');
  }

  function saveBtnInner() {
    return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Semua`;
  }

  function markDirty() {
    dirty = true;
    updateSaveBtn();
  }

  function updateSaveBtn() {
    const btn = document.getElementById('shop-save-all-btn');
    if (!btn) return;
    if (dirty) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor  = 'pointer';
      btn.classList.add('dirty');
    } else {
      btn.disabled = true;
      btn.style.opacity = '.4';
      btn.style.cursor  = 'not-allowed';
      btn.classList.remove('dirty');
    }
  }

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function openModal() {
    document.getElementById('scfg-backdrop').classList.add('open');
    document.getElementById('scfg-modal').classList.add('open');
    document.getElementById('ef-name').focus();
  }

  function closeForm() {
    document.getElementById('scfg-backdrop').classList.remove('open');
    document.getElementById('scfg-modal').classList.remove('open');
    editingIdx = null;
  }

  function toggleMaxQty() {
    const canMulti = document.getElementById('ef-can-multi').classList.contains('on');
    document.getElementById('ef-max-qty-wrap').style.display = canMulti ? '' : 'none';
  }

  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    on ? el.classList.add('on') : el.classList.remove('on');
  }

  function esc(s) {
    return String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const c = document.getElementById('toast');
    if (c) { c.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }

})();
