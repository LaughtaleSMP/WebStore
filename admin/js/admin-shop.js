/* ════════════════════════════════════════════════════════════════
   admin-shop.js — Shop Configurator for Laughtale Admin Panel
   ────────────────────────────────────────────────────────────
   Tabel yang dipakai:
   • shop_items  → setiap item (id, name, price, stock, …)
   • shop_config → config umum (title, subtitle, admins WA)

   Web (shop-supabase.js) membaca langsung dari shop_items &
   shop_config, jadi perubahan admin langsung terlihat.
════════════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    /* ── State ── */
    let items = []; // array item dari shop_items
    let shopMeta = {}; // {title, subtitle, admins, gemAdmins} dari shop_config
    let editingId = null; // id item yang sedang di-edit (null = tambah baru)
    let dirty = false;
    let dirtyMeta = false;

    function getSb() {
        return window._adminSb;
    }

    /* ════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════ */
    document.addEventListener("DOMContentLoaded", () => {
        injectNav();
        injectSection();
    });

    /* ── Sidebar nav ── */
    function injectNav() {
        const sidebar = document.querySelector(".sidebar");
        if (!sidebar) return;
        const grp = document.createElement("div");
        grp.className = "nav-group-label";
        grp.textContent = "Toko";
        sidebar.appendChild(grp);
        const item = document.createElement("div");
        item.className = "nav-item";
        item.id = "nav-shop";
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
        if (typeof showSection === "function") {
            showSection("shop", el);
        } else {
            document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            const sec = document.getElementById("sec-shop");
            if (sec) sec.classList.add("active");
            if (el) el.classList.add("active");
            const bc = document.getElementById("topbar-section");
            if (bc) bc.textContent = "Shop";
        }
        loadData();
    }

    /* ════════════════════════════════════════════
     INJECT HTML SECTION
  ════════════════════════════════════════════ */
    function injectSection() {
        const main = document.querySelector(".main-content");
        if (!main) return;

        const sec = document.createElement("div");
        sec.className = "section";
        sec.id = "sec-shop";
        sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Konfigurasi Shop</div>
          <div class="page-sub">Edit harga, stok, badge, dan informasi item yang tampil di web</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="save-btn" id="shop-save-meta-btn" onclick="window._shopSaveMeta()" style="opacity:.4;cursor:not-allowed" disabled>
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Simpan Pengaturan
          </button>
        </div>
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
            <input id="g-title" oninput="window._shopMetaDirty()">
          </div>
          <div class="field" style="margin-top:10px">
            <label>Subtitle</label>
            <textarea id="g-subtitle" rows="2" oninput="window._shopMetaDirty()"></textarea>
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
            <input id="ef-category" placeholder="Custom Nametag">
            <div class="field-hint" id="ef-category-hint"></div>
          </div>

          <!-- Harga -->
          <div class="field-group" style="margin-top:10px">
            <div class="field">
              <label>Harga (Rp) <span style="color:var(--red)">*</span></label>
              <input id="ef-price" type="number" min="0" placeholder="15000">
            </div>
            <div class="field">
              <label>Harga Coret (Rp)</label>
              <input id="ef-price-orig" type="number" min="0" placeholder="20000 (opsional)">
            </div>
          </div>

          <!-- Badge -->
          <div class="field-group" style="margin-top:10px">
            <div class="field">
              <label>Teks Badge</label>
              <input id="ef-badge" placeholder="POPULER / NEW / SPECIAL / …" maxlength="20">
            </div>
            <div class="field">
              <label>Warna Badge</label>
              <select id="ef-badge-color">
                <option value="">Tidak ada</option>
                <option value="gold">⭐ Gold</option>
                <option value="green">🟢 Green</option>
                <option value="diamond">💎 Diamond (biru)</option>
                <option value="red">🔴 Red</option>
              </select>
            </div>
          </div>

          <!-- Sort order -->
          <div class="field" style="margin-top:10px">
            <label>Urutan Tampil (sort_order)</label>
            <input id="ef-sort-order" type="number" min="0" placeholder="0 = paling atas">
          </div>

          <!-- Stok -->
          <div class="field" style="margin-top:10px">
            <label>Stok</label>
            <select id="ef-stock">
              <option value="Tersedia">✅ Tersedia</option>
              <option value="Habis">❌ Habis</option>
            </select>
          </div>

          <!-- Aktif -->
          <div class="toggle-row" style="margin-top:12px">
            <div class="toggle-label">
              <strong>Tampilkan di web (active)</strong>
              <span>Hilangkan centang untuk sembunyikan item tanpa hapus</span>
            </div>
            <div class="toggle on" id="ef-active" onclick="this.classList.toggle('on')"></div>
          </div>

          <!-- Deskripsi -->
          <div class="field" style="margin-top:10px">
            <label>Deskripsi</label>
            <textarea id="ef-desc" rows="2" placeholder="Deskripsi singkat item…"></textarea>
          </div>

          <!-- Fitur (features) -->
          <div class="field" style="margin-top:10px">
            <label>Fitur <span style="color:var(--text-faint);font-size:11px">(pisahkan dengan Enter)</span></label>
            <textarea id="ef-features" rows="3" placeholder="Bebas pilih warna &amp; style&#10;Berlaku permanen selama season"></textarea>
          </div>

          <!-- Toggle baris -->
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Perlu Desain (requiresDesign)</strong>
                <span>Pembeli harus siapkan file desain sebelum order</span>
              </div>
              <div class="toggle" id="ef-requires-design" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Minta Username Minecraft</strong>
                <span>Form pesanan akan menampilkan field username</span>
              </div>
              <div class="toggle on" id="ef-needs-username" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="toggle-row">
              <div class="toggle-label">
                <strong>Bisa Beli Banyak (qty)</strong>
                <span>Pembeli bisa pilih jumlah yang dibeli</span>
              </div>
              <div class="toggle on" id="ef-can-multi" onclick="this.classList.toggle('on');window._shopToggleMaxQty()"></div>
            </div>
          </div>

          <!-- Max qty -->
          <div class="field" style="margin-top:10px" id="ef-max-qty-wrap">
            <label>Maks. Qty per Pesanan</label>
            <input id="ef-max-qty" type="number" min="1" placeholder="99">
          </div>

        </div>
        <div class="scfg-modal-footer">
          <button class="btn-ghost" onclick="window._shopCloseForm()">Batal</button>
          <button class="save-btn" id="ef-save-btn" onclick="window._shopApplyItem()">Simpan Item</button>
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
        const s = document.createElement("style");
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
      .scfg-item-row.inactive { opacity:.45; }
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
      #shop-save-meta-btn.dirty {
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
        window._shopTab = switchTab;
        window._shopItemSearch = filterItems;
        window._shopNewItem = newItem;
        window._shopEditItem = editItem;
        window._shopDeleteItem = deleteItem;
        window._shopMoveItem = moveItem;
        window._shopCloseForm = closeForm;
        window._shopApplyItem = applyItem;
        window._shopSaveMeta = saveMeta;
        window._shopMetaDirty = markMetaDirty;
        window._shopToggleMaxQty = toggleMaxQty;
        window._shopAddAdmin = addAdminRow;
        window._shopRemoveAdmin = removeAdminRow;
        window._shopAdminChange = adminChange;
    }

    /* ════════════════════════════════════════════
     LOAD DATA — dari shop_items + shop_config
  ════════════════════════════════════════════ */
    async function loadData() {
        const loadEl = document.getElementById("shop-loading");
        loadEl.style.display = "block";
        loadEl.textContent = "Memuat konfigurasi…";
        document.getElementById("shop-tab-items").style.display = "none";
        document.getElementById("shop-tab-general").style.display = "none";

        const sb = getSb();
        if (!sb) {
            loadEl.textContent = "⚠️ Supabase belum siap.";
            return;
        }

        /* Fetch shop_items */
        const { data: itemRows, error: itemErr } = await sb
            .from("shop_items")
            .select("*")
            .order("sort_order", { ascending: true });

        if (itemErr) {
            loadEl.textContent = "⚠️ Gagal memuat item: " + itemErr.message;
            return;
        }
        items = itemRows || [];

        /* Fetch shop_config (meta: title, subtitle, admins WA) */
        const { data: cfgRow } = await sb.from("shop_config").select("value").eq("key", "main").single();

        try {
            shopMeta = cfgRow?.value ? JSON.parse(cfgRow.value) : {};
        } catch (e) {
            shopMeta = {};
        }
        if (!shopMeta.admins) shopMeta.admins = [];
        if (!shopMeta.gemAdmins) shopMeta.gemAdmins = [];
        if (!shopMeta.title) shopMeta.title = "Laughtale Store";
        if (!shopMeta.subtitle) shopMeta.subtitle = "";

        dirty = false;
        dirtyMeta = false;
        updateMetaBtn();

        loadEl.style.display = "none";
        switchTab("items", document.querySelector('.scfg-tab[data-tab="items"]'));
    }

    /* ════════════════════════════════════════════
     TABS
  ════════════════════════════════════════════ */
    let currentTab = "items";
    let itemSearch = "";

    function switchTab(tab, btn) {
        currentTab = tab;
        document.querySelectorAll(".scfg-tab").forEach(b => b.classList.remove("active"));
        if (btn) btn.classList.add("active");
        document.querySelectorAll(".shop-tab-content").forEach(el => (el.style.display = "none"));
        const el = document.getElementById("shop-tab-" + tab);
        if (el) el.style.display = "block";
        if (tab === "items") renderItemList();
        if (tab === "general") renderGeneral();
    }

    /* ════════════════════════════════════════════
     ITEM LIST
  ════════════════════════════════════════════ */
    function filterItems(q) {
        itemSearch = q;
        renderItemList();
    }

    function renderItemList() {
        const el = document.getElementById("shop-item-list");
        if (!el) return;

        let list = items;
        if (itemSearch.trim()) {
            const q = itemSearch.toLowerCase();
            list = list.filter(
                i => (i.name || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q),
            );
        }

        if (!list.length) {
            el.innerHTML = '<div class="empty-state">Tidak ada item ditemukan.</div>';
            return;
        }

        /* update hint kategori di form */
        const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
        const hint = document.getElementById("ef-category-hint");
        if (hint) hint.textContent = cats.length ? "Kategori yang ada: " + cats.join(", ") : "";

        el.innerHTML = list
            .map(item => {
                const priceStr = "Rp " + Number(item.price || 0).toLocaleString("id-ID");
                const origStr = item.original_price
                    ? ' <span style="text-decoration:line-through;opacity:.5">Rp ' +
                      Number(item.original_price).toLocaleString("id-ID") +
                      "</span>"
                    : "";
                const badgeCls = item.badge_color ? `scfg-badge-${item.badge_color}` : "scfg-badge-empty";
                const badgeHtml = item.badge
                    ? `<span class="scfg-badge-preview ${badgeCls}">${esc(item.badge)}</span>`
                    : `<span class="scfg-badge-preview scfg-badge-empty" style="opacity:.4">no badge</span>`;
                const stockHtml =
                    item.stock === "Habis"
                        ? `<span class="scfg-stock-out">❌ Habis</span>`
                        : `<span class="scfg-stock-ok">✅ Tersedia</span>`;
                const activeTag =
                    item.active === false ? `<span style="color:var(--text-faint)">👁 Tersembunyi</span>` : "";

                return `
        <div class="scfg-item-row${item.active === false ? " inactive" : ""}" id="srow-${item.id}">
          <div class="scfg-item-emoji">${esc(item.emoji || "🛒")}</div>
          <div class="scfg-item-info">
            <div class="scfg-item-name">${esc(item.name || "(tanpa nama)")}</div>
            <div class="scfg-item-meta">
              <span>${esc(item.category || "—")}</span>
              <span><strong>${priceStr}</strong>${origStr}</span>
              ${stockHtml}
              ${badgeHtml}
              ${activeTag}
            </div>
          </div>
          <div class="scfg-item-actions">
            <button class="btn-edit" onclick="window._shopEditItem(${item.id})">✏️ Edit</button>
            <button class="btn-del"  onclick="window._shopDeleteItem(${item.id})" title="Hapus">🗑</button>
          </div>
        </div>`;
            })
            .join("");
    }

    /* ════════════════════════════════════════════
     GENERAL TAB
  ════════════════════════════════════════════ */
    function renderGeneral() {
        document.getElementById("g-title").value = shopMeta.title || "";
        document.getElementById("g-subtitle").value = shopMeta.subtitle || "";
        renderAdminList("main");
        renderAdminList("gem");
    }

    function renderAdminList(type) {
        const listId = type === "main" ? "g-admins-list" : "g-gem-admins-list";
        const arrKey = type === "main" ? "admins" : "gemAdmins";
        const el = document.getElementById(listId);
        if (!el) return;
        const arr = shopMeta[arrKey] || [];
        el.innerHTML =
            arr
                .map(
                    (a, i) => `
      <div class="scfg-admin-row">
        <input placeholder="Nama admin" value="${esc(a.name || "")}"
          oninput="window._shopAdminChange('${type}',${i},'name',this.value)">
        <input placeholder="Nomor WA (628…)" value="${esc(a.number || "")}"
          oninput="window._shopAdminChange('${type}',${i},'number',this.value)"
          style="flex:1.5">
        <button class="btn-del" onclick="window._shopRemoveAdmin('${type}',${i})" title="Hapus">🗑</button>
      </div>`,
                )
                .join("") || '<div style="color:var(--text-faint);font-size:12px;padding:4px 0">Belum ada admin.</div>';
    }

    function adminChange(type, idx, field, val) {
        const arrKey = type === "main" ? "admins" : "gemAdmins";
        shopMeta[arrKey][idx][field] = val;
        markMetaDirty();
    }

    function addAdminRow(type) {
        const arrKey = type === "main" ? "admins" : "gemAdmins";
        shopMeta[arrKey].push({ name: "", number: "" });
        markMetaDirty();
        renderAdminList(type);
    }

    function removeAdminRow(type, idx) {
        const arrKey = type === "main" ? "admins" : "gemAdmins";
        shopMeta[arrKey].splice(idx, 1);
        markMetaDirty();
        renderAdminList(type);
    }

    /* ════════════════════════════════════════════
     ITEM FORM — TAMBAH / EDIT
  ════════════════════════════════════════════ */
    function newItem() {
        editingId = null;
        document.getElementById("scfg-modal-title").textContent = "Tambah Item Baru";
        clearForm();
        openModal();
    }

    function editItem(id) {
        const item = items.find(i => i.id === id);
        if (!item) return;
        editingId = id;
        document.getElementById("scfg-modal-title").textContent = "Edit Item";
        document.getElementById("ef-name").value = item.name || "";
        document.getElementById("ef-emoji").value = item.emoji || "";
        document.getElementById("ef-category").value = item.category || "";
        document.getElementById("ef-price").value = item.price ?? "";
        document.getElementById("ef-price-orig").value = item.original_price || "";
        document.getElementById("ef-badge").value = item.badge || "";
        document.getElementById("ef-badge-color").value = item.badge_color || "";
        document.getElementById("ef-sort-order").value = item.sort_order ?? "";
        document.getElementById("ef-stock").value = item.stock || "Tersedia";
        document.getElementById("ef-desc").value = item.description || "";
        document.getElementById("ef-features").value = (item.features || []).join("\n");
        setToggle("ef-active", item.active !== false);
        setToggle("ef-requires-design", !!item.requires_design);
        setToggle("ef-needs-username", item.needs_username !== false);
        setToggle("ef-can-multi", item.can_buy_multiple !== false);
        document.getElementById("ef-max-qty").value = item.max_quantity || "";
        toggleMaxQty();
        openModal();
    }

    function clearForm() {
        [
            "ef-name",
            "ef-emoji",
            "ef-category",
            "ef-price",
            "ef-price-orig",
            "ef-badge",
            "ef-sort-order",
            "ef-desc",
            "ef-features",
            "ef-max-qty",
        ].forEach(id => {
            document.getElementById(id).value = "";
        });
        document.getElementById("ef-badge-color").value = "";
        document.getElementById("ef-stock").value = "Tersedia";
        setToggle("ef-active", true);
        setToggle("ef-requires-design", false);
        setToggle("ef-needs-username", true);
        setToggle("ef-can-multi", true);
        toggleMaxQty();
    }

    /* ── Simpan satu item ke Supabase (upsert) ── */
    async function applyItem() {
        const name = document.getElementById("ef-name").value.trim();
        const price = document.getElementById("ef-price").value.trim();
        if (!name) {
            toast("Nama item wajib diisi.", "error");
            return;
        }
        if (price === "") {
            toast("Harga wajib diisi.", "error");
            return;
        }

        const sb = getSb();
        if (!sb) {
            toast("Supabase belum siap.", "error");
            return;
        }

        const canMulti = document.getElementById("ef-can-multi").classList.contains("on");

        /* Tentukan id: edit = id lama, tambah baru = max(id)+1 */
        const newId = editingId !== null ? editingId : items.length ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;

        const row = {
            id: newId,
            name,
            emoji: document.getElementById("ef-emoji").value.trim() || "🛒",
            category: document.getElementById("ef-category").value.trim() || "Lainnya",
            price: Number(price),
            original_price: Number(document.getElementById("ef-price-orig").value) || 0,
            badge: document.getElementById("ef-badge").value.trim(),
            badge_color: document.getElementById("ef-badge-color").value,
            sort_order: Number(document.getElementById("ef-sort-order").value) || 0,
            stock: document.getElementById("ef-stock").value,
            active: document.getElementById("ef-active").classList.contains("on"),
            description: document.getElementById("ef-desc").value.trim(),
            features: document
                .getElementById("ef-features")
                .value.split("\n")
                .map(s => s.trim())
                .filter(Boolean),
            requires_design: document.getElementById("ef-requires-design").classList.contains("on"),
            needs_username: document.getElementById("ef-needs-username").classList.contains("on"),
            can_buy_multiple: canMulti,
            max_quantity: canMulti ? Number(document.getElementById("ef-max-qty").value) || 99 : 1,
            images: editingId !== null ? items.find(i => i.id === editingId)?.images || [] : [],
        };

        const saveBtn = document.getElementById("ef-save-btn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Menyimpan…";

        const { error } = await sb.from("shop_items").upsert(row, { onConflict: "id" });

        saveBtn.disabled = false;
        saveBtn.textContent = "Simpan Item";

        if (error) {
            toast("Gagal: " + error.message, "error");
            return;
        }

        /* Update local state */
        if (editingId !== null) {
            const idx = items.findIndex(i => i.id === editingId);
            if (idx !== -1) items[idx] = row;
        } else {
            items.push(row);
        }
        /* Re-sort by sort_order */
        items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        closeForm();
        renderItemList();
        toast(editingId !== null ? "Item berhasil diperbarui ✅" : "Item baru berhasil ditambahkan ✅");
    }

    /* ── Hapus item dari Supabase ── */
    async function deleteItem(id) {
        const item = items.find(i => i.id === id);
        if (!confirm(`Hapus item "${item?.name}"?\nTindakan ini tidak bisa dibatalkan.`)) return;
        const sb = getSb();
        if (!sb) {
            toast("Supabase belum siap.", "error");
            return;
        }
        const { error } = await sb.from("shop_items").delete().eq("id", id);
        if (error) {
            toast("Gagal hapus: " + error.message, "error");
            return;
        }
        items = items.filter(i => i.id !== id);
        renderItemList();
        toast("Item dihapus.");
    }

    /* ── Pindah urutan sort_order ── */
    async function moveItem(id, dir) {
        const idx = items.findIndex(i => i.id === id);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= items.length) return;
        const sb = getSb();
        if (!sb) return;

        /* Tukar sort_order dua item */
        const a = items[idx];
        const b = items[newIdx];
        const tmpSort = a.sort_order;
        a.sort_order = b.sort_order;
        b.sort_order = tmpSort;

        /* Upsert keduanya */
        await sb.from("shop_items").upsert(
            [
                { id: a.id, sort_order: a.sort_order },
                { id: b.id, sort_order: b.sort_order },
            ],
            { onConflict: "id" },
        );

        /* Tukar posisi di array lokal */
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        renderItemList();
    }

    /* ════════════════════════════════════════════
     SIMPAN META (title, subtitle, admins WA)
     → shop_config key='main'
  ════════════════════════════════════════════ */
    async function saveMeta() {
        if (!dirtyMeta) return;
        const sb = getSb();
        if (!sb) {
            toast("Supabase belum siap.", "error");
            return;
        }

        /* Baca dari DOM sebelum simpan */
        const gTitle = document.getElementById("g-title");
        const gSubtitle = document.getElementById("g-subtitle");
        if (gTitle) shopMeta.title = gTitle.value.trim() || shopMeta.title;
        if (gSubtitle) shopMeta.subtitle = gSubtitle.value.trim() || "";

        const btn = document.getElementById("shop-save-meta-btn");
        btn.disabled = true;
        btn.textContent = "Menyimpan…";

        const { error } = await sb.from("shop_config").upsert(
            {
                key: "main",
                value: JSON.stringify(shopMeta),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "key" },
        );

        btn.disabled = false;
        btn.innerHTML = metaBtnInner();

        if (error) {
            toast("Gagal: " + error.message, "error");
            markMetaDirty();
            return;
        }

        dirtyMeta = false;
        btn.classList.remove("dirty");
        btn.disabled = true;
        toast("Pengaturan shop berhasil disimpan ✅");
    }

    function metaBtnInner() {
        return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Pengaturan`;
    }

    function markMetaDirty() {
        dirtyMeta = true;
        updateMetaBtn();
    }

    function updateMetaBtn() {
        const btn = document.getElementById("shop-save-meta-btn");
        if (!btn) return;
        if (dirtyMeta) {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
            btn.classList.add("dirty");
        } else {
            btn.disabled = true;
            btn.style.opacity = ".4";
            btn.style.cursor = "not-allowed";
            btn.classList.remove("dirty");
        }
    }

    /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
    function openModal() {
        document.getElementById("scfg-backdrop").classList.add("open");
        document.getElementById("scfg-modal").classList.add("open");
        document.getElementById("ef-name").focus();
    }

    function closeForm() {
        document.getElementById("scfg-backdrop").classList.remove("open");
        document.getElementById("scfg-modal").classList.remove("open");
        editingId = null;
    }

    function toggleMaxQty() {
        const canMulti = document.getElementById("ef-can-multi").classList.contains("on");
        document.getElementById("ef-max-qty-wrap").style.display = canMulti ? "" : "none";
    }

    function setToggle(id, on) {
        const el = document.getElementById(id);
        if (!el) return;
        on ? el.classList.add("on") : el.classList.remove("on");
    }

    function esc(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function toast(msg, type = "success") {
        const el = document.createElement("div");
        el.className = "toast-item toast-" + type;
        el.textContent = msg;
        const c = document.getElementById("toast");
        if (c) {
            c.appendChild(el);
            setTimeout(() => el.remove(), 3200);
        }
    }
})();
