/* ════════════════════════════════════════════════════════════════
   supabase-sync.js — Sinkronisasi otomatis dari Admin Panel
   • Fetch site_config  → terapkan ke website (server info, MOTD, dll)
   • Fetch shop_config  → override SHOP_CONFIG & re-render toko
   ════════════════════════════════════════════════════════════════ */

(async function () {
  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

  /* ── tunggu Supabase SDK ── */
  let tries = 0;
  while (typeof supabase === 'undefined' && tries < 20) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  if (typeof supabase === 'undefined') {
    console.warn('[supabase-sync] Supabase client tidak ditemukan.');
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ════════════════════════════════════════════════════════════════
     1. SITE CONFIG (server info, maintenance, MOTD, WA admins)
     ════════════════════════════════════════════════════════════════ */
  try {
    const { data, error } = await sb.from('site_config').select('*');
    if (!error && data) {
      const cfg = {};
      data.forEach(row => { cfg[row.key] = row.value; });

      /* Server config */
      const sc = window.SERVER_CONFIG || window.SERVERCONFIG || {};
      if (cfg.server_ip)   sc.ip         = cfg.server_ip;
      if (cfg.server_name) sc.namaServer = cfg.server_name;
      if (cfg.server_type) sc.versi      = cfg.server_type;
      if (cfg.season)      sc.season     = cfg.season;
      if (cfg.seed)        sc.seed       = parseInt(cfg.seed) || sc.seed;
      window.SERVER_CONFIG = sc;
      window.SERVERCONFIG  = sc;

      applyServerConfig(cfg, sc);

      /* Maintenance */
      if (cfg.maintenance_mode === 'true') showMaintenance(cfg);

      /* MOTD */
      if (cfg.motd_active === 'true' && cfg.motd_text) showMOTD(cfg);

      /* WA Admins (fallback — admin-shop sekarang mengelola via shop_config) */
      try {
        const mainAdmins = JSON.parse(cfg.whatsapp_admins     || '[]');
        const gemAdmins  = JSON.parse(cfg.whatsapp_gem_admins || '[]');
        if (mainAdmins.length || gemAdmins.length) {
          window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };
          window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
        }
      } catch (e) { /* pakai data di shop-config.js */ }
    }
  } catch (e) {
    console.warn('[supabase-sync] site_config error:', e);
  }

  /* ════════════════════════════════════════════════════════════════
     2. SHOP CONFIG  — baca dari tabel shop_config key="main"
        Ini adalah sumber kebenaran utama yang dikelola admin panel.
        Jika berhasil → override SHOP_CONFIG sepenuhnya & re-render.
     ════════════════════════════════════════════════════════════════ */
  try {
    const { data: shopRow, error: shopErr } = await sb
      .from('shop_config')
      .select('value')
      .eq('key', 'main')
      .single();

    if (!shopErr && shopRow?.value) {
      const remoteCfg = JSON.parse(shopRow.value);

      /* ── Merge ke SHOP_CONFIG global ── */
      if (window.SHOP_CONFIG) {
        /* Ganti semua field yang ada di remote */
        if (remoteCfg.title)      window.SHOP_CONFIG.title      = remoteCfg.title;
        if (remoteCfg.subtitle)   window.SHOP_CONFIG.subtitle   = remoteCfg.subtitle;
        if (remoteCfg.items && remoteCfg.items.length)
                                  window.SHOP_CONFIG.items      = remoteCfg.items;
        if (remoteCfg.categories) window.SHOP_CONFIG.categories = remoteCfg.categories;
        if (remoteCfg.admins)     window.SHOP_CONFIG.admins     = remoteCfg.admins;
        if (remoteCfg.gemAdmins)  window.SHOP_CONFIG.gemAdmins  = remoteCfg.gemAdmins;
      } else {
        /* SHOP_CONFIG belum ada (urutan load) — buat dari remote */
        window.SHOP_CONFIG = remoteCfg;
      }

      /* Juga pakai sebagai SHOPCONFIG (alias yang dipakai shop.js) */
      if (window.SHOPCONFIG) {
        Object.assign(window.SHOPCONFIG, window.SHOP_CONFIG);
      }

      /* WA admins dari shop_config juga expose ke supabaseWA */
      if (remoteCfg.admins || remoteCfg.gemAdmins) {
        window.supabaseWA  = { main: remoteCfg.admins || [], gem: remoteCfg.gemAdmins || [] };
        window._supabaseWA = window.supabaseWA;
      }

      /* ── Re-render toko jika fungsi sudah tersedia ── */
      reRenderShop(window.SHOP_CONFIG);

      console.log('[supabase-sync] shop_config berhasil di-load dari Supabase Admin Panel ✅');
    } else {
      /* Fallback: tidak ada di shop_config → coba shop_items (tabel lama) */
      await syncShopItemsFallback(sb);
    }
  } catch (e) {
    console.warn('[supabase-sync] shop_config error:', e);
    await syncShopItemsFallback(sb);
  }

  console.log('[supabase-sync] Selesai.');


  /* ════════════════════════════════════════════════════════════════
     RE-RENDER SHOP
     Panggil ulang fungsi render shop di shop.js setelah config update.
     shop.js mengexpose window._shopReRender atau window.renderShopSection.
     ════════════════════════════════════════════════════════════════ */
  function reRenderShop(cfg) {
    if (!cfg) return;

    /* Cara 1 — shop.js expose hook re-render */
    if (typeof window._shopReRender === 'function') {
      window._shopReRender(cfg);
      return;
    }

    /* Cara 2 — patch kartu harga langsung di DOM (live update harga & stok) */
    if (!cfg.items) return;
    cfg.items.forEach(item => {
      /* Update harga di kartu */
      const buyBtn = document.querySelector(`.shop-btn-buy[onclick="shopOpenModal(${item.id})"]`);
      if (buyBtn) {
        const card = buyBtn.closest('.shop-card');
        if (card) {
          const priceEl = card.querySelector('.shop-card-price');
          if (priceEl) {
            const fmt = item.price === 0
              ? '<span style="color:#17dd62">GRATIS</span>'
              : 'Rp ' + Number(item.price).toLocaleString('id-ID');
            const origHtml = item.originalPrice > 0
              ? `<span class="shop-price-orig">Rp ${Number(item.originalPrice).toLocaleString('id-ID')}</span>`
              : '';
            priceEl.innerHTML = fmt + origHtml;
          }

          /* Update badge */
          const badgeEl = card.querySelector('.shop-card-badge');
          if (badgeEl) {
            if (item.badge) {
              badgeEl.textContent = item.badge;
              badgeEl.className   = 'shop-card-badge badge-' + (item.badgeColor || 'gold');
              badgeEl.style.display = '';
            } else {
              badgeEl.style.display = 'none';
            }
          }

          /* Update stok */
          const stockEl = card.querySelector('.shop-card-stock, .shop-stock-label');
          if (stockEl) {
            if (item.stock === 'Habis') {
              stockEl.textContent = '❌ Habis';
              stockEl.classList.add('stock-out');
              stockEl.classList.remove('stock-ok');
              buyBtn.disabled = true;
              buyBtn.textContent = 'Habis';
            } else {
              stockEl.textContent = '✅ Tersedia';
              stockEl.classList.add('stock-ok');
              stockEl.classList.remove('stock-out');
              buyBtn.disabled = false;
              if (buyBtn.textContent === 'Habis') buyBtn.textContent = 'Beli Sekarang';
            }
          }
        }
      }
    });
  }


  /* ════════════════════════════════════════════════════════════════
     FALLBACK: baca shop_items (tabel lama, kolom per field)
     ════════════════════════════════════════════════════════════════ */
  async function syncShopItemsFallback(sb) {
    try {
      const { data: shopItems, error } = await sb
        .from('shop_items')
        .select('*')
        .order('id', { ascending: true });

      if (error || !shopItems || !shopItems.length) return;

      const mapped = shopItems.map(row => ({
        id:             row.id,
        name:           row.name            || '',
        emoji:          row.emoji           || '',
        category:       row.category        || 'Lainnya',
        price:          row.price           || 0,
        originalPrice:  row.original_price  || 0,
        description:    row.description     || '',
        features:       Array.isArray(row.features)   ? row.features  : [],
        badge:          row.badge           || '',
        badgeColor:     row.badge_color     || '',
        stock:          row.stock           || 'Tersedia',
        requiresDesign: !!row.requires_design,
        needsUsername:  row.needs_username  !== false,
        canBuyMultiple: row.can_buy_multiple !== false,
        maxQuantity:    row.max_quantity    || 99,
        images:         Array.isArray(row.images) ? row.images : [],
      }));

      if (window.SHOP_CONFIG) {
        window.SHOP_CONFIG.items      = mapped;
        window.SHOP_CONFIG.categories = ['Semua', ...new Set(mapped.map(i => i.category))];
      }
      window._shopItemsFromSupabase = mapped;
      reRenderShop(window.SHOP_CONFIG);
      console.log('[supabase-sync] Fallback shop_items berhasil di-sync.');
    } catch (e) {
      console.warn('[supabase-sync] Fallback shop_items error:', e);
    }
  }


  /* ════════════════════════════════════════════════════════════════
     APPLY SERVER CONFIG → DOM
     ════════════════════════════════════════════════════════════════ */
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


  /* ════════════════════════════════════════════════════════════════
     MAINTENANCE OVERLAY
     ════════════════════════════════════════════════════════════════ */
  function showMaintenance(cfg) {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    const msgEl = document.getElementById('maint-msg');
    if (msgEl) msgEl.textContent = cfg.maintenance_message || 'Server sedang dalam pemeliharaan.';

    let etaText = '';
    if (cfg.maintenance_eta) {
      try { etaText = new Date(cfg.maintenance_eta).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }); }
      catch (e) { etaText = cfg.maintenance_eta; }
    }
    const etaEl = document.getElementById('maint-eta');
    if (etaEl) { etaEl.textContent = etaText ? 'Estimasi selesai: ' + etaText : ''; etaEl.style.display = etaText ? 'block' : 'none'; }

    const conEl = document.getElementById('maint-contact');
    if (conEl) { conEl.textContent = cfg.maintenance_contact ? 'Kontak: ' + cfg.maintenance_contact : ''; conEl.style.display = cfg.maintenance_contact ? 'block' : 'none'; }

    overlay.style.display        = 'flex';
    document.body.style.overflow = 'hidden';
  }


  /* ════════════════════════════════════════════════════════════════
     MOTD BANNER
     ════════════════════════════════════════════════════════════════ */
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
      if (btn) { btn.textContent = cfg.motd_btn; btn.href = cfg.motd_url; btn.style.display = 'inline-flex'; btn.style.color = p.color; btn.style.border = '1px solid ' + p.border; }
    }

    banner.style.display = 'flex';
  }

})();
