/* ══════════════════════════════════════════════════════════════
   supabase-sync.js — Sinkronisasi otomatis dari Admin Panel
   Fetch site_config dari Supabase, lalu terapkan ke website
   ══════════════════════════════════════════════════════════════ */

(async function () {
  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

  // Tunggu Supabase SDK tersedia
  let tries = 0;
  while (typeof supabase === 'undefined' && tries < 20) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }

  if (typeof supabase === 'undefined') {
    console.warn('[supabase-sync] Supabase client tidak ditemukan.');
    return;
  }

  // Gunakan object tunggal agar tidak trigger deprecated-parameters warning
  // dari feature_collector.js (Supabase SDK internal analytics)
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data, error } = await sb.from('site_config').select('*');
    if (error || !data) {
      console.warn('[supabase-sync] Gagal fetch config:', error?.message);
      return;
    }

    // Ubah array rows menjadi object { key: value }
    const cfg = {};
    data.forEach(row => { cfg[row.key] = row.value; });

    // ── 1. Update window.SERVER_CONFIG & window.SERVERCONFIG ──
    const sc = window.SERVER_CONFIG || window.SERVERCONFIG || {};
    if (cfg.server_ip)   sc.ip         = cfg.server_ip;
    if (cfg.server_name) sc.namaServer = cfg.server_name;
    if (cfg.server_type) sc.versi      = cfg.server_type;
    if (cfg.season)      sc.season     = cfg.season;
    if (cfg.seed)        sc.seed       = parseInt(cfg.seed) || sc.seed;
    window.SERVER_CONFIG  = sc;
    window.SERVERCONFIG   = sc;

    // ── 2. Terapkan ke DOM ──────────────────────────────────────
    applyServerConfig(cfg, sc);

    // ── 3. Maintenance mode ─────────────────────────────────────
    if (cfg.maintenance_mode === 'true') {
      showMaintenance(cfg);
    }

    // ── 4. MOTD / Banner pengumuman ─────────────────────────────
    if (cfg.motd_active === 'true' && cfg.motd_text) {
      showMOTD(cfg);
    }

    // ── 5. WA Admin — simpan ke window untuk shop.js ────────────
    try {
      const mainAdmins = JSON.parse(cfg.whatsapp_admins     || '[]');
      const gemAdmins  = JSON.parse(cfg.whatsapp_gem_admins || '[]');
      if (mainAdmins.length || gemAdmins.length) {
        window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };
        window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
      }
    } catch (e) { /* JSON parse gagal — pakai data di shop-config.js */ }


    // ── 6. Shop Items — baca dari shop_config ───────────────────
    try {
      const { data: shopCfgRow, error: shopErr } = await sb
        .from('shop_config')
        .select('value')
        .eq('key', 'main')
        .single();

      if (!shopErr && shopCfgRow?.value) {
        const shopCfg = JSON.parse(shopCfgRow.value);
        const mapped  = shopCfg.items || [];

        // Update SHOP_CONFIG global dengan data terbaru dari admin
        if (window.SHOP_CONFIG) {
          window.SHOP_CONFIG.items      = mapped;
          window.SHOP_CONFIG.admins     = shopCfg.admins     || window.SHOP_CONFIG.admins;
          window.SHOP_CONFIG.gemAdmins  = shopCfg.gemAdmins  || window.SHOP_CONFIG.gemAdmins;
          window.SHOP_CONFIG.categories = shopCfg.categories || window.SHOP_CONFIG.categories;
          window.SHOP_CONFIG.title      = shopCfg.title      || window.SHOP_CONFIG.title;
          window.SHOP_CONFIG.subtitle   = shopCfg.subtitle   || window.SHOP_CONFIG.subtitle;
        }

        window._shopItemsFromSupabase = mapped;

        // Sync WA dari shop_config jika tidak ada di site_config
        if (!window.supabaseWA) {
          const mainAdmins = shopCfg.admins    || [];
          const gemAdmins  = shopCfg.gemAdmins || [];
          if (mainAdmins.length || gemAdmins.length) {
            window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };
            window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
          }
        }

        // ★ Re-render seluruh grid shop dengan data terbaru ★
        reRenderShopCards(mapped, shopCfg.categories);

        // Update judul & subtitle toko
        if (shopCfg.title) {
          const titleEl = document.getElementById('shop-section-title');
          if (titleEl) titleEl.textContent = shopCfg.title;
        }
        if (shopCfg.subtitle) {
          const subEl = document.getElementById('shop-section-subtitle');
          if (subEl) subEl.textContent = shopCfg.subtitle;
        }

        console.log('[supabase-sync] Shop config berhasil disync dari shop_config.');
      } else {
        console.warn('[supabase-sync] shop_config kosong atau belum ada data dari admin panel.');
      }
    } catch (e) {
      console.warn('[supabase-sync] Gagal baca shop_config:', e);
    }

    console.log('[supabase-sync] Config berhasil diterapkan.');

  } catch (e) {
    console.warn('[supabase-sync] Error tidak terduga:', e);
  }


  /* ════════════════════════════════════════════════════════
     Helper: format harga (sama persis dengan shop.js)
  ════════════════════════════════════════════════════════ */
  function fmtPrice(p) {
    if (p === 0) return '<span style="color:#17dd62">GRATIS</span>';
    return 'Rp\u00a0' + p.toLocaleString('id-ID');
  }
  function fmtPlain(p) {
    return p === 0 ? 'GRATIS' : 'Rp\u00a0' + p.toLocaleString('id-ID');
  }

  /* ── Badge color map (sama persis dengan shop.js) ── */
  const BC = {
    gold:    { bg: 'rgba(244,196,48,0.14)',  bd: 'rgba(244,196,48,0.4)',  cl: '#f4c430' },
    green:   { bg: 'rgba(23,221,98,0.12)',   bd: 'rgba(23,221,98,0.4)',   cl: '#17dd62' },
    diamond: { bg: 'rgba(168,85,247,0.14)',  bd: 'rgba(168,85,247,0.4)',  cl: '#c084fc' },
    red:     { bg: 'rgba(255,58,58,0.13)',   bd: 'rgba(255,58,58,0.35)',  cl: '#ff3a3a' },
    '':      { bg: 'rgba(139,148,158,0.1)',  bd: 'rgba(139,148,158,0.3)', cl: '#8892a4' },
  };
  function badgeHtml(item, extra) {
    if (!item.badge) return '';
    const c = BC[item.badgeColor] || BC[''];
    return `<span class="shop-badge" style="background:${c.bg};border:1px solid ${c.bd};color:${c.cl};${extra || ''}">${item.badge}</span>`;
  }

  /* ── Animated SVG thumbnail — delegate ke shop.js jika tersedia ── */
  function animThumbHtml(item) {
    // shop.js mengekspos animThumbHtml melalui window jika di-export,
    // tapi karena shop.js tidak mengekspornya secara eksplisit,
    // kita buat ulang logika minimal: panggil SVG_MAP dari shop.js scope
    // Cara aman: panggil fungsi buildCard milik shop.js jika ada,
    // atau render thumbnail kosong agar tidak error.
    // Kita cukup kembalikan string kosong — thumbnail SVG sudah
    // di-render oleh shop.js saat renderShop() pertama kali.
    // Setelah re-render penuh di bawah, SVG_MAP tidak bisa diakses
    // dari sini (closure shop.js). Tapi buildCard dari shop.js
    // sudah diekspos ke window? Tidak. Jadi kita skip SVG —
    // thumbnail akan blank untuk kartu baru. Untuk kartu lama
    // yang sudah ter-render, kita pertahankan thumb-nya.
    //
    // SOLUSI BENAR: delegasikan buildCard ke shop.js via window.shopBuildCard
    // Jika tersedia (shop.js baru mengeksposnya), gunakan. Jika tidak, fallback.
    if (typeof window.shopBuildCard === 'function') {
      return null; // sinyal untuk pakai shopBuildCard langsung
    }
    return ''; // fallback: tidak ada thumbnail SVG
  }

  /* ── Build HTML satu kartu (versi sync, tanpa SVG animated thumb) ── */
  function buildCardHtml(item) {
    // Jika shop.js sudah mengekspos shopBuildCard, pakai itu
    if (typeof window.shopBuildCard === 'function') {
      return window.shopBuildCard(item);
    }

    // Fallback: bangun kartu tanpa animated SVG thumb
    const sold = item.stock === 'Habis';
    const p    = item.price || 0;
    const op   = item.originalPrice || 0;
    const origHtml = (op > 0 && op > p)
      ? `<span class="shop-price-orig">Rp\u00a0${op.toLocaleString('id-ID')}</span>`
      : '';
    const featHtml = (item.features && item.features.length)
      ? `<ul class="shop-feat-list">${item.features.map(f => `<li>${f}</li>`).join('')}</ul>`
      : '';

    return `<div class="shop-card${sold ? ' shop-sold-out' : ''}" data-category="${item.category}">
      ${badgeHtml(item, 'position:absolute;top:12px;right:12px;z-index:2;')}
      <div class="shop-card-emoji">${item.emoji}</div>
      <div class="shop-card-name">${item.name}</div>
      <div class="shop-card-cat">${item.category}</div>
      <div class="shop-card-desc">${item.description}</div>
      ${featHtml}
      <div class="shop-card-footer">
        <div class="shop-card-price">${fmtPrice(p)}${origHtml}</div>
        ${sold
          ? `<button class="shop-btn shop-btn-sold" disabled>HABIS</button>`
          : `<button class="shop-btn shop-btn-buy" onclick="shopOpenModal(${item.id})">Pesan</button>`}
      </div>
    </div>`;
  }


  /* ════════════════════════════════════════════════════════
     Re-render seluruh grid shop dari nol dengan data Supabase
  ════════════════════════════════════════════════════════ */
  function reRenderShopCards(items, categories) {
    const gridEl = document.getElementById('shop-grid');
    if (!gridEl || !items || !items.length) return;

    const tabsEl    = document.getElementById('shop-tabs');
    const activeCat = tabsEl?.querySelector('.shop-tab.active')?.dataset.cat || 'Semua';

    // ── Render ulang semua kartu ──
    gridEl.innerHTML = items.map(buildCardHtml).join('');

    // ── Update tab filter ──
    if (tabsEl && categories && categories.length) {
      tabsEl.innerHTML = categories.map(c =>
        `<button class="shop-tab${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>`
      ).join('');

      // Re-attach event listener tab (listener lama hilang bersama innerHTML)
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

    // ── Terapkan filter kategori aktif saat ini ──
    if (activeCat && activeCat !== 'Semua') {
      gridEl.querySelectorAll('.shop-card').forEach(c => {
        c.style.display = c.dataset.category === activeCat ? '' : 'none';
      });
    }

    console.log('[supabase-sync] Grid shop di-render ulang penuh (' + items.length + ' item).');
  }


  /* ════════════════════════════════════════════════════════
     Terapkan config ke semua elemen DOM
  ════════════════════════════════════════════════════════ */
  function applyServerConfig(cfg, sc) {
    const ip     = cfg.server_ip || sc.ip || 'laughtale.my.id:19214';
    const season = cfg.season    || sc.season || '';
    const seed   = cfg.seed      || String(sc.seed || '');

    window._serverIP  = ip;
    window.serverIP   = ip;

    const heroIpText = document.getElementById('hero-ip-text');
    if (heroIpText) heroIpText.textContent = ip;

    const addrEl = document.getElementById('server-address-display');
    if (addrEl && addrEl.textContent.includes('Memuat')) {
      addrEl.textContent = ip;
    }

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


  /* ════════════════════════════════════════════════════════
     Tampilkan overlay maintenance
  ════════════════════════════════════════════════════════ */
  function showMaintenance(cfg) {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    const msg     = cfg.maintenance_message || 'Server sedang dalam pemeliharaan.';
    const contact = cfg.maintenance_contact || '';

    let etaText = '';
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
    if (etaEl) {
      etaEl.textContent   = etaText ? 'Estimasi selesai: ' + etaText : '';
      etaEl.style.display = etaText ? 'block' : 'none';
    }

    const conEl = document.getElementById('maint-contact');
    if (conEl) {
      conEl.textContent   = contact ? 'Kontak: ' + contact : '';
      conEl.style.display = contact ? 'block' : 'none';
    }

    overlay.style.display        = 'flex';
    document.body.style.overflow = 'hidden';
  }


  /* ════════════════════════════════════════════════════════
     Tampilkan MOTD banner
  ════════════════════════════════════════════════════════ */
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

})();
