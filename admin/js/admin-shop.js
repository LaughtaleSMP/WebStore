/* ════════════════════════════════════════════════════════
   admin-shop.js — Shop Items Manager for Laughtale Admin Panel
   ════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BADGE_COLORS = ['', 'gold', 'green', 'diamond', 'red'];
  const CATEGORIES   = ['Custom Nametag', 'Custom Title', 'All Cosmetic', 'Ingame Gacha'];

  let _sb    = null;
  let _items = [];

  /* ── Cari Supabase client: intercept createClient + fallback polling ── */
  function waitForSb() {
    // Intercept supabase.createClient agar bisa capture client tanpa edit HTML
    const tryIntercept = () => {
      if (window.supabase && window.supabase.createClient && !window._sbShimDone) {
        window._sbShimDone = true;
        const _orig = window.supabase.createClient.bind(window.supabase);
        window.supabase.createClient = function (...args) {
          const client = _orig(...args);
          window._adminSb = client;
          return client;
        };
      }
    };

    // Jalankan intercept secepatnya (admin-shop.js defer → jalan sebelum DOMContentLoaded)
    tryIntercept();

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      tryIntercept(); // tetap coba kalau supabase belum ada
      const client = window._adminSb || window.adminSb || null;
      if (client) { clearInterval(t); _sb = client; setup(); loadItems(); }
      else if (tries > 100) { clearInterval(t); console.warn('[admin-shop] Supabase client tidak ditemukan'); }
    }, 100);
  }

  /* ══════════════════════════════════════════════════════
     DOM SETUP — inject nav item + section ke admin panel
     ══════════════════════════════════════════════════════ */
  function setup() {
    injectSection();
    injectNavItem();
  }

  function injectSection() {
    const container = document.querySelector('.main-content');
    if (!container || document.getElementById('sec-shop')) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id        = 'sec-shop';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div class="page-title">Manajemen Shop</div>
          <div class="page-sub">Kelola item, harga, stok, dan badge langsung dari panel ini</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
          <span id="shop-status" style="font-size:12px;color:var(--text-faint)"></span>
          <button class="btn-add" onclick="ShopAdmin.openNew()">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tambah Item
          </button>
          <button class="btn-add" onclick="ShopAdmin.reload()">↺ Refresh</button>
        </div>
      </div>

      <div id="shop-item-list"></div>
      <div id="shop-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:none;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)" onclick="if(event.target===this)ShopAdmin.closeModal()"></div>
    `;
    container.appendChild(sec);
  }

  function injectNavItem() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('nav-shop')) return;

    // Buat nav item Shop
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id        = 'nav-shop';
    item.setAttribute('onclick', "showSection('shop', this)");
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      Shop Items
    `;

    // Cari nav-item terakhir di sidebar, sisipkan setelahnya
    const navItems = sidebar.querySelectorAll('.nav-item');
    const lastNav  = navItems[navItems.length - 1];
    if (lastNav && lastNav.parentNode) {
      lastNav.parentNode.insertBefore(item, lastNav.nextSibling);
    } else {
      sidebar.appendChild(item);
    }

    // Tambahkan label ke showSection
    const origShow = window.showSection;
    if (origShow) {
      window.showSection = function(name, el) {
        origShow(name, el);
        if (name === 'shop') {
          const tb = document.getElementById('topbar-section');
          if (tb) tb.textContent = 'Shop Items';
        }
      };
    }
  }

  /* ══════════════════════════════════════════════════════
     LOAD & RENDER
     ══════════════════════════════════════════════════════ */
  async function loadItems() {
    setStatus('⏳ Memuat...');
    try {
      const { data, error } = await _sb
        .from('shop_items').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      _items = data || [];
      renderList();
      setStatus(`✅ ${_items.length} item`);
    } catch (e) {
      setStatus('❌ ' + e.message);
    }
  }

  function renderList() {
    const wrap = document.getElementById('shop-item-list');
    if (!wrap) return;

    if (!_items.length) {
      wrap.innerHTML = `<div class="empty-state">Belum ada item. Klik + Tambah Item.</div>`;
      return;
    }

    wrap.innerHTML = _items.map(item => `
      <div class="card" style="${item.active ? '' : 'opacity:0.45'}">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <span style="font-size:1.4rem;flex-shrink:0">${esc(item.emoji||'')}</span>
            <div style="min-width:0">
              <div style="font-size:13.5px;font-weight:600;color:var(--text)">${esc(item.name)}</div>
              <div style="font-size:12px;color:var(--text-faint)">${esc(item.category)}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            <button class="btn-add" onclick="ShopAdmin.edit(${item.id})">✏ Edit</button>
            <button class="btn-add" onclick="ShopAdmin.toggleActive(${item.id})" style="${item.active ? 'color:var(--green)' : 'color:var(--red)'}">
              ${item.active ? '🟢 Aktif' : '🔴 Nonaktif'}
            </button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
          <span style="${pillStyle('blue')}">Rp ${item.price.toLocaleString('id-ID')}</span>
          ${item.original_price ? `<span style="${pillStyle('gray')}"><s>Rp ${item.original_price.toLocaleString('id-ID')}</s></span>` : ''}
          <span style="${pillStyle(item.stock==='Tersedia'?'green':'red')}">${esc(item.stock)}</span>
          ${item.badge ? `<span style="${pillStyle('purple')}">${esc(item.badge)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function pillStyle(color) {
    const map = {
      blue:   'background:var(--accent-muted);color:var(--accent);border:1px solid rgba(79,125,240,0.3)',
      green:  'background:var(--green-muted);color:var(--green);border:1px solid rgba(34,197,94,0.2)',
      red:    'background:var(--red-muted);color:var(--red);border:1px solid rgba(239,68,68,0.2)',
      purple: 'background:rgba(168,85,247,0.1);color:#c084fc;border:1px solid rgba(168,85,247,0.2)',
      gray:   'background:var(--surface2);color:var(--text-faint);border:1px solid var(--border)',
    };
    return `display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;${map[color]||map.gray}`;
  }

  /* ══════════════════════════════════════════════════════
     MODAL EDIT / TAMBAH
     ══════════════════════════════════════════════════════ */
  function openModal(item) {
    const isNew = !item;
    if (isNew) item = {
      id: Math.max(0, ..._items.map(i=>i.id)) + 1,
      name:'', emoji:'', category:'Custom Nametag',
      price:0, original_price:0, description:'',
      features:[], badge:'', badge_color:'',
      stock:'Tersedia', requires_design:false,
      needs_username:true, can_buy_multiple:true,
      max_quantity:99, images:[], active:true,
      sort_order: (_items.length + 1) * 10,
    };

    const modal = document.getElementById('shop-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-lg);width:100%;max-width:560px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:700;color:var(--text)">${isNew ? '➕ Tambah Item' : '✏ Edit Item #' + item.id}</span>
          <button class="btn-icon" onclick="ShopAdmin.closeModal()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <!-- Body -->
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
          <div class="field-group">
            <div class="field"><label>Emoji</label><input id="sf-emoji" value="${esc(item.emoji||'')}"></div>
            <div class="field" style="grid-column:span 1"><label>Nama Item *</label><input id="sf-name" value="${esc(item.name)}"></div>
          </div>
          <div class="field"><label>Kategori</label>
            <select id="sf-category">${CATEGORIES.map(c=>`<option${c===item.category?' selected':''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field-group">
            <div class="field"><label>Harga (Rp)</label><input id="sf-price" type="number" min="0" value="${item.price}"></div>
            <div class="field"><label>Harga Coret (0 = tidak ada)</label><input id="sf-oprice" type="number" min="0" value="${item.original_price||0}"></div>
          </div>
          <div class="field"><label>Deskripsi</label><textarea id="sf-desc">${esc(item.description||'')}</textarea></div>
          <div class="field"><label>Fitur (satu per baris)</label><textarea id="sf-features">${(item.features||[]).join('\n')}</textarea></div>
          <div class="field-group">
            <div class="field"><label>Badge (kosong = tidak ada)</label><input id="sf-badge" value="${esc(item.badge||'')}"></div>
            <div class="field"><label>Warna Badge</label>
              <select id="sf-badge-color">${BADGE_COLORS.map(c=>`<option value="${c}"${c===item.badge_color?' selected':''}>${c||'— tidak ada —'}</option>`).join('')}</select>
            </div>
          </div>
          <div class="field-group">
            <div class="field"><label>Stok</label>
              <select id="sf-stock">
                <option${item.stock==='Tersedia'?' selected':''}>Tersedia</option>
                <option${item.stock==='Habis'?' selected':''}>Habis</option>
              </select>
            </div>
            <div class="field"><label>Maks Qty</label><input id="sf-maxqty" type="number" min="1" value="${item.max_quantity||99}"></div>
          </div>
          <div class="field"><label>Sort Order (kecil = tampil lebih awal)</label><input id="sf-sort" type="number" value="${item.sort_order||0}"></div>
          <div style="display:flex;flex-wrap:wrap;gap:14px">
            <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-muted);cursor:pointer">
              <input type="checkbox" id="sf-design"${item.requires_design?' checked':''} style="accent-color:var(--accent)"> Butuh Desain
            </label>
            <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-muted);cursor:pointer">
              <input type="checkbox" id="sf-username"${item.needs_username!==false?' checked':''} style="accent-color:var(--accent)"> Minta Username
            </label>
            <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-muted);cursor:pointer">
              <input type="checkbox" id="sf-multi"${item.can_buy_multiple!==false?' checked':''} style="accent-color:var(--accent)"> Bisa Beli Banyak
            </label>
            <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-muted);cursor:pointer">
              <input type="checkbox" id="sf-active"${item.active!==false?' checked':''} style="accent-color:var(--accent)"> Aktif (tampil di toko)
            </label>
          </div>
        </div>
        <!-- Footer -->
        <div class="form-actions" style="border-top:1px solid var(--border);padding:14px 20px;margin-top:0;justify-content:space-between">
          ${!isNew ? `<button class="btn-ghost" style="color:var(--red);border-color:rgba(239,68,68,0.3)" onclick="ShopAdmin.deleteItem(${item.id})">🗑 Hapus</button>` : '<span></span>'}
          <div style="display:flex;gap:8px">
            <button class="btn-ghost" onclick="ShopAdmin.closeModal()">Batal</button>
            <button class="save-btn" onclick="ShopAdmin.save(${item.id})">Simpan</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════
     CRUD
     ══════════════════════════════════════════════════════ */
  async function saveItem(id) {
    const payload = {
      id:              parseInt(id),
      name:            v('sf-name'),
      emoji:           v('sf-emoji'),
      category:        v('sf-category'),
      price:           parseInt(v('sf-price')) || 0,
      original_price:  parseInt(v('sf-oprice')) || 0,
      description:     v('sf-desc'),
      features:        v('sf-features').split('\n').map(s=>s.trim()).filter(Boolean),
      badge:           v('sf-badge'),
      badge_color:     v('sf-badge-color'),
      stock:           v('sf-stock'),
      max_quantity:    parseInt(v('sf-maxqty')) || 99,
      sort_order:      parseInt(v('sf-sort')) || 0,
      requires_design: document.getElementById('sf-design').checked,
      needs_username:  document.getElementById('sf-username').checked,
      can_buy_multiple:document.getElementById('sf-multi').checked,
      active:          document.getElementById('sf-active').checked,
    };
    if (!payload.name) { alert('Nama item wajib diisi!'); return; }

    setStatus('⏳ Menyimpan...');
    try {
      const isExisting = _items.some(i => i.id === parseInt(id));
      let error;
      if (isExisting) {
        ({ error } = await _sb.from('shop_items').update(payload).eq('id', parseInt(id)));
      } else {
        ({ error } = await _sb.from('shop_items').insert(payload));
      }
      if (error) throw error;
      closeModal();
      await loadItems();
      toast('Item berhasil disimpan ✓');
    } catch (e) { setStatus('❌ ' + e.message); toast('Gagal: ' + e.message, 'error'); }
  }

  async function toggleActive(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    try {
      const { error } = await _sb.from('shop_items').update({ active: !item.active }).eq('id', id);
      if (error) throw error;
      await loadItems();
      toast(`Item #${id} ${!item.active ? 'diaktifkan' : 'dinonaktifkan'} ✓`);
    } catch (e) { toast('Gagal: ' + e.message, 'error'); }
  }

  async function deleteItem(id) {
    if (!confirm(`Hapus item #${id}? Tidak bisa dikembalikan.`)) return;
    try {
      const { error } = await _sb.from('shop_items').delete().eq('id', id);
      if (error) throw error;
      closeModal();
      await loadItems();
      toast(`Item #${id} dihapus ✓`);
    } catch (e) { toast('Gagal hapus: ' + e.message, 'error'); }
  }

  function closeModal() {
    const m = document.getElementById('shop-modal');
    if (m) { m.style.display = 'none'; m.innerHTML = ''; }
  }

  /* ── Helpers ── */
  function v(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setStatus(msg) { const el = document.getElementById('shop-status'); if (el) el.textContent = msg; }
  function toast(msg, type) {
    if (window.toast) { window.toast(msg, type||'success'); return; }
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + (type||'success');
    el.textContent = msg;
    document.getElementById('toast')?.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ── Public API ── */
  window.ShopAdmin = {
    edit:         id  => openModal(_items.find(i => i.id === id)),
    openNew:      ()  => openModal(null),
    save:         id  => saveItem(id),
    toggleActive: id  => toggleActive(id),
    deleteItem:   id  => deleteItem(id),
    closeModal:   closeModal,
    reload:       loadItems,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSb);
  } else {
    waitForSb();
  }
})();
