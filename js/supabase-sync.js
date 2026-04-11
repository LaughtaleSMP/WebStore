/* ══════════════════════════════════════════════════════════════
   supabase-sync.js — Sinkronisasi otomatis dari Admin Panel
   Fetch site_config dari Supabase, lalu terapkan ke website
   ══════════════════════════════════════════════════════════════ */

(async function () {
  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

  /* ════════════════════════════════════════════════════════
     Helper functions — WAJIB didefinisikan di atas sebelum
     dipakai agar tidak kena Temporal Dead Zone (TDZ)
  ════════════════════════════════════════════════════════ */

  function fmtPrice(p) {
    if (p === 0) return '<span style="color:#17dd62">GRATIS</span>';
    return 'Rp\u00a0' + p.toLocaleString('id-ID');
  }

  /* Badge color map */
  const BC = {
    gold:    { bg: 'rgba(244,196,48,0.14)',  bd: 'rgba(244,196,48,0.4)',  cl: '#f4c430' },
    green:   { bg: 'rgba(23,221,98,0.12)',   bd: 'rgba(23,221,98,0.4)',   cl: '#17dd62' },
    diamond: { bg: 'rgba(168,85,247,0.14)',  bd: 'rgba(168,85,247,0.4)',  cl: '#c084fc' },
    red:     { bg: 'rgba(255,58,58,0.13)',   bd: 'rgba(255,58,58,0.35)',  cl: '#ff3a3a' },
    '':      { bg: 'rgba(139,148,158,0.1)',  bd: 'rgba(139,148,158,0.3)', cl: '#8892a4' },
  };

  function badgeHtml(item, extraStyle = '') {
    if (!item.badge) return '';
    const c = BC[item.badgeColor] || BC[''];
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:0.6rem;font-family:'Press Start 2P',monospace;background:${c.bg};border:1px solid ${c.bd};color:${c.cl};${extraStyle}">${item.badge}</span>`;
  }

  /* ── Re-render grid shop dari nol ── */
  function reRenderShopCards(items, categories) {
    const gridEl = document.getElementById('shop-grid');
    if (!gridEl || !items || !items.length) return;

    const tabsEl    = document.getElementById('shop-tabs');
    const activeCat = tabsEl?.querySelector('.shop-tab.active')?.dataset.cat || 'Semua';

    /* Gunakan shopBuildCard dari shop.js agar animasi SVG tetap muncul */
    if (typeof window.shopBuildCard === 'function') {
      gridEl.innerHTML = items.map(window.shopBuildCard).join('');
    } else {
      gridEl.innerHTML = items.map(item => {
        const sold     = item.stock === 'Habis';
        const p        = item.price || 0;
        const op       = item.originalPrice || item.original_price || 0;
        const origHtml = (op > 0 && op > p)
          ? `<span class="shop-price-orig">Rp\u00a0${op.toLocaleString('id-ID')}</span>`
          : '';
        const featHtml = (item.features && item.features.length)
          ? `<ul class="shop-feat-list">${item.features.map(f => `<li>${f}</li>`).join('')}</ul>`
          : '';
        return `<div class="shop-card${sold ? ' shop-sold-out' : ''}" data-category="${item.category}">
          ${badgeHtml(item, 'position:absolute;top:12px;right:12px;z-index:2;')}
          <div class="shop-card-emoji">${item.emoji || '\uD83D\uDED2'}</div>
          <div class="shop-card-name">${item.name}</div>
          <div class="shop-card-cat">${item.category}</div>
          <div class="shop-card-desc">${item.description || ''}</div>
          ${featHtml}
          <div class="shop-card-footer">
            <div class="shop-card-price">${fmtPrice(p)}${origHtml}</div>
            ${sold
              ? `<button class="shop-btn shop-btn-sold" disabled>HABIS</button>`
              : `<button class="shop-btn shop-btn-buy" onclick="shopOpenModal(${item.id})">Pesan</button>`}
          </div>
        </div>`;
      }).join('');
    }

    if (tabsEl && categories && categories.length) {
      tabsEl.innerHTML = categories.map(c =>
        `<button class="shop-tab${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>`
      ).join('');

      tabsEl.addEventListener('click', e => {
        const btn = e.target.closest('.shop-tab');
        if (!btn) return;
        tabsEl.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        gridEl.querySelectorAll('.shop-card').forEach(c => {
          c.style.display = (cat === 'Semua' || c.dataset.category === cat) ? '' : 'none';
        });
      });
    }

    if (activeCat && activeCat !== 'Semua') {
      gridEl.querySelectorAll('.shop-card').forEach(c => {
        c.style.display = c.dataset.category === activeCat ? '' : 'none';
      });
    }

    console.log('[supabase-sync] Grid shop di-render ulang penuh (' + items.length + ' item).');
  }

  /* ── Terapkan config ke DOM ── */
  function applyServerConfig(cfg, sc) {
    const ip     = cfg.server_ip || sc.ip || 'laughtale.my.id:19214';
    const season = cfg.season    || sc.season || '';
    const seed   = cfg.seed      || String(sc.seed || '');

    window._serverIP = ip;
    window.serverIP  = ip;

    const heroIpText = document.getElementById('hero-ip-text');
    if (heroIpText) heroIpText.textContent = ip;

    const addrEl = document.getElementById('server-address-display');
    if (addrEl && addrEl.textContent.includes('Memuat')) addrEl.textContent = ip;

    document.querySelectorAll('.stat-label').forEach(el => {
      if (el.textContent.trim() === 'Season') {
        const val = el.previousElementSibling;
        if (val && season) val.textContent = season;
      }
    });

    document.querySelectorAll('.stat-val[data-target], .stat-val').forEach(el => {
      const item  = el.closest('.stat-item');
      const label = item && item.querySelector('.stat-label');
      if (!label) return;
      if (label.textContent.trim() === 'Seed' && seed) {
        el.setAttribute('data-target', seed);
        el.textContent = seed;
      }
    });

    const seedVal = document.querySelector('.seed-value');
    if (seedVal && seed) seedVal.textContent = seed;

    if (cfg.season_desc) {
      const descEl = document.querySelector('.season-desc, #season-desc');
      if (descEl) descEl.textContent = cfg.season_desc;
    }
  }

  /* ── Overlay maintenance ── */
  function showMaintenance(cfg) {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;
    const msg     = cfg.maintenance_message || 'Server sedang dalam pemeliharaan.';
    const contact = cfg.maintenance_contact || '';
    let etaText   = '';
    if (cfg.maintenance_eta) {
      try {
        etaText = new Date(cfg.maintenance_eta).toLocaleString('id-ID', {
          dateStyle: 'long', timeStyle: 'short'
        });
      } catch (e) { etaText = cfg.maintenance_eta; }
    }
    const msgEl = document.getElementById('maint-msg');
    if (msgEl) msgEl.textContent = msg;
    const etaEl = document.getElementById('maint-eta');
    if (etaEl) { etaEl.textContent = etaText ? 'Estimasi selesai: ' + etaText : ''; etaEl.style.display = etaText ? 'block' : 'none'; }
    const conEl = document.getElementById('maint-contact');
    if (conEl) { conEl.textContent = contact ? 'Kontak: ' + contact : ''; conEl.style.display = contact ? 'block' : 'none'; }
    overlay.style.display        = 'flex';
    document.body.style.overflow = 'hidden';
  }

  /* ── Banner MOTD ── */
  function showMOTD(cfg) {
    const banner = document.getElementById('motd-banner');
    if (!banner) return;
    const palette = {
      info:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  color: '#60a5fa' },
      success: { bg: 'rgba(93,189,58,0.10)',   border: 'rgba(93,189,58,0.25)',   color: '#5dbd3a' },
      warning: { bg: 'rgba(244,196,48,0.10)',  border: 'rgba(244,196,48,0.25)',  color: '#f4c430' },
      error:   { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' },
    };
    const p = palette[cfg.motd_type] || palette.info;
    banner.style.background   = p.bg;
    banner.style.borderBottom = '1px solid ' + p.border;
    banner.style.color        = p.color;
    const textEl = document.getElementById('motd-text');
    if (textEl) textEl.textContent = cfg.motd_text;
    if (cfg.motd_btn && cfg.motd_url) {
      const btn = document.getElementById('motd-btn');
      if (btn) {
        btn.textContent   = cfg.motd_btn;
        btn.href          = cfg.motd_url;
        btn.style.display = 'inline-flex';
        btn.style.color   = p.color;
        btn.style.border  = '1px solid ' + p.border;
      }
    }
    banner.style.display = 'flex';
  }


  /* ════════════════════════════════════════════════════════
     MAIN — Tunggu Supabase SDK, lalu fetch & apply config
  ════════════════════════════════════════════════════════ */

  let tries = 0;
  while (typeof supabase === 'undefined' && tries < 20) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  if (typeof supabase === 'undefined') {
    console.warn('[supabase-sync] Supabase client tidak ditemukan.');
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession:    false,
      autoRefreshToken:  false,
      detectSessionInUrl:false,
    },
  });

  try {
    const { data, error } = await sb.from('site_config').select('*');
    if (error || !data) {
      console.warn('[supabase-sync] Gagal fetch config:', error?.message);
      return;
    }

    const cfg = {};
    data.forEach(row => { cfg[row.key] = row.value; });

    // ── 1. Update window.SERVER_CONFIG ──
    const sc = window.SERVER_CONFIG || window.SERVERCONFIG || {};
    if (cfg.server_ip)   sc.ip         = cfg.server_ip;
    if (cfg.server_name) sc.namaServer = cfg.server_name;
    if (cfg.server_type) sc.versi      = cfg.server_type;
    if (cfg.season)      sc.season     = cfg.season;
    if (cfg.seed)        sc.seed       = parseInt(cfg.seed) || sc.seed;
    window.SERVER_CONFIG = sc;
    window.SERVERCONFIG  = sc;

    // ── 2. Terapkan ke DOM ──
    applyServerConfig(cfg, sc);

    // ── 3. Maintenance mode ──
    if (cfg.maintenance_mode === 'true') showMaintenance(cfg);

    // ── 4. MOTD / Banner pengumuman ──
    if (cfg.motd_active === 'true' && cfg.motd_text) showMOTD(cfg);

    // ── 5. WA Admin dari site_config ──
    try {
      const mainAdmins = JSON.parse(cfg.whatsapp_admins     || '[]');
      const gemAdmins  = JSON.parse(cfg.whatsapp_gem_admins || '[]');
      if (mainAdmins.length || gemAdmins.length) {
        window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };
        window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
      }
    } catch (e) { /* fallback ke shop-config.js */ }

    // ── 6. Shop Items — baca dari shop_items, sync ke SHOP_CONFIG lalu re-render ──
    try {
      const { data: itemRows, error: itemErr } = await sb
        .from('shop_items')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      const { data: cfgRow } = await sb
        .from('shop_config')
        .select('value')
        .eq('key', 'main')
        .single();

      if (!itemErr && itemRows && itemRows.length) {
        const mapped = itemRows.map(r => ({
          id:             r.id,
          name:           r.name,
          emoji:          r.emoji,
          category:       r.category,
          price:          r.price,
          originalPrice:  r.original_price,
          description:    r.description,
          features:       r.features || [],
          badge:          r.badge          || '',
          badgeColor:     r.badge_color    || '',
          stock:          r.stock,
          requiresDesign: r.requires_design,
          needsUsername:  r.needs_username,
          canBuyMultiple: r.can_buy_multiple,
          maxQuantity:    r.max_quantity,
          images:         r.images         || [],
          active:         r.active,
          sort_order:     r.sort_order,
        }));

        let shopMeta = {};
        try { shopMeta = cfgRow?.value ? JSON.parse(cfgRow.value) : {}; } catch(e) {}

        const cats = ['Semua'];
        mapped.forEach(i => { if (!cats.includes(i.category)) cats.push(i.category); });
        const categories = shopMeta.categories || cats;

        /* Update SHOP_CONFIG global dengan data live DB */
        if (window.SHOP_CONFIG) {
          window.SHOP_CONFIG.items      = mapped;
          window.SHOP_CONFIG.admins     = shopMeta.admins     || window.SHOP_CONFIG.admins;
          window.SHOP_CONFIG.gemAdmins  = shopMeta.gemAdmins  || window.SHOP_CONFIG.gemAdmins;
          window.SHOP_CONFIG.categories = categories;
          window.SHOP_CONFIG.title      = shopMeta.title      || window.SHOP_CONFIG.title;
          window.SHOP_CONFIG.subtitle   = shopMeta.subtitle   || window.SHOP_CONFIG.subtitle;
        }
        window._shopItemsFromSupabase = mapped;

        if (!window.supabaseWA && (shopMeta.admins?.length || shopMeta.gemAdmins?.length)) {
          window.supabaseWA  = { main: shopMeta.admins || [], gem: shopMeta.gemAdmins || [] };
          window._supabaseWA = { main: shopMeta.admins || [], gem: shopMeta.gemAdmins || [] };
        }

        /* Re-render grid pakai shopBuildCard (shop.js) agar animasi SVG tetap ada */
        reRenderShopCards(mapped, categories);

        if (shopMeta.title) {
          const titleEl = document.getElementById('shop-section-title');
          if (titleEl) titleEl.textContent = shopMeta.title;
        }
        if (shopMeta.subtitle) {
          const subEl = document.getElementById('shop-section-subtitle');
          if (subEl) subEl.textContent = shopMeta.subtitle;
        }

        /* Dispatch event agar shop.js tahu data sudah sinkron dari DB */
        document.dispatchEvent(new CustomEvent('shopItemsReady', { detail: { items: mapped } }));

        console.log('[supabase-sync] Shop items berhasil disync dari shop_items (' + mapped.length + ' item).');
      } else {
        console.warn('[supabase-sync] shop_items kosong atau error:', itemErr?.message);
      }
    } catch (e) {
      console.warn('[supabase-sync] Gagal baca shop data:', e);
    }

    console.log('[supabase-sync] Config berhasil diterapkan.');

  } catch (e) {
    console.warn('[supabase-sync] Error tidak terduga:', e);
  }

})();
