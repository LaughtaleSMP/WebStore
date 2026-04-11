/* ════════════════════════════════════════════════════════
   supabase-sync.js — Sinkronisasi otomatis dari Admin Panel
   Fetch site_config dari Supabase, lalu terapkan ke website
   ════════════════════════════════════════════════════════ */

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

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const { data, error } = await sb.from('site_config').select('*');
    if (error || !data) {
      console.warn('[supabase-sync] Gagal fetch config:', error?.message);
      return;
    }

    // Ubah array rows menjadi object { key: value }
    const cfg = {};
    data.forEach(row => { cfg[row.key] = row.value; });

    // ── 1. Update window.SERVER_CONFIG & window.SERVERCONFIG (handle keduanya) ──
    // Index.html menggunakan window.SERVERCONFIG (tanpa underscore)
    // supabase-sync dan server-status menggunakan window.SERVER_CONFIG
    const sc = window.SERVER_CONFIG || window.SERVERCONFIG || {};
    if (cfg.server_ip)   sc.ip         = cfg.server_ip;
    if (cfg.server_name) sc.namaServer = cfg.server_name;
    if (cfg.server_type) sc.versi      = cfg.server_type;
    if (cfg.season)      sc.season     = cfg.season;
    if (cfg.seed)        sc.seed       = parseInt(cfg.seed) || sc.seed;
    // Pastikan kedua variabel tersinkron
    window.SERVER_CONFIG  = sc;
    window.SERVERCONFIG   = sc;

    // ── 2. Terapkan ke DOM ────────────────────────────────
    applyServerConfig(cfg, sc);

    // ── 3. Maintenance mode ───────────────────────────────
    if (cfg.maintenance_mode === 'true') {
      showMaintenance(cfg);
    }

    // ── 4. MOTD / Banner pengumuman ───────────────────────
    if (cfg.motd_active === 'true' && cfg.motd_text) {
      showMOTD(cfg);
    }

    // ── 5. WA Admin — simpan ke window untuk shop.js ──────
    try {
      const mainAdmins = JSON.parse(cfg.whatsapp_admins     || '[]');
      const gemAdmins  = JSON.parse(cfg.whatsapp_gem_admins || '[]');
      if (mainAdmins.length || gemAdmins.length) {
        window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };  // dibaca oleh shop.js
        window._supabaseWA = { main: mainAdmins, gem: gemAdmins };  // legacy support
      }
    } catch (e) { /* JSON parse gagal — pakai data di shop-config.js */ }


    // ── 6. Shop Items — override SHOP_CONFIG dari Supabase ──────
    try {
      const { data: shopItems, error: shopErr } = await sb
        .from('shop_items')
        .select('id, name, price, stock')
        .order('id', { ascending: true });

      if (!shopErr && shopItems && shopItems.length > 0) {
        const mapped = shopItems.map(row => ({
          id:              row.id,
          name:            row.name,
          emoji:           row.emoji          || '',
          category:        row.category,
          price:           row.price,
          originalPrice:   row.original_price || 0,
          description:     row.description    || '',
          features:        Array.isArray(row.features)   ? row.features  : [],
          badge:           row.badge          || '',
          badgeColor:      row.badge_color    || '',
          stock:           row.stock          || 'Tersedia',
          requiresDesign:  !!row.requires_design,
          needsUsername:   row.needs_username !== false,
          canBuyMultiple:  row.can_buy_multiple !== false,
          maxQuantity:     row.max_quantity   || 99,
          images:          Array.isArray(row.images)     ? row.images    : [],
        }));

        // Update SHOP_CONFIG jika tersedia
        if (window.SHOP_CONFIG) {
          window.SHOP_CONFIG.items = mapped;
          // Rebuild kategori unik dari items aktif
          const cats = ['Semua', ...new Set(mapped.map(i => i.category))];
          window.SHOP_CONFIG.categories = cats;
        }
        // Simpan ke window agar shop.js bisa re-render
        window._shopItemsFromSupabase = mapped;
      }
    } catch (e) { /* shop_items gagal — SHOP_CONFIG tetap dari shop-config.js */ }

    // 6. Sync harga shop dari Supabase
    await syncShopPrices(sb);

    console.log('[supabase-sync] Config berhasil diterapkan.');

  } catch (e) {
    console.warn('[supabase-sync] Error tidak terduga:', e);
  }


  /* ══════════════════════════════════════════════════════
     Terapkan config ke semua elemen DOM
     ══════════════════════════════════════════════════════ */
  function applyServerConfig(cfg, sc) {
    const ip     = cfg.server_ip || sc.ip || 'laughtale.my.id:19214';
    const season = cfg.season    || sc.season || '';
    const seed   = cfg.seed      || String(sc.seed || '');

    // Simpan IP ke SEMUA variabel yang mungkin dipakai di berbagai tempat
    window._serverIP  = ip;   // untuk server-status.js baru
    window.serverIP   = ip;   // untuk heroDirectConnect lama di index.html

    // Hero — IP text
    const heroIpText = document.getElementById('hero-ip-text');
    if (heroIpText) heroIpText.textContent = ip;

    // Server address di section status (hanya update kalau masih "Memuat...")
    const addrEl = document.getElementById('server-address-display');
    if (addrEl && addrEl.textContent.includes('Memuat')) {
      addrEl.textContent = ip;
    }

    // Stats bar — Season
    document.querySelectorAll('.stat-label').forEach(el => {
      if (el.textContent.trim() === 'Season') {
        const val = el.previousElementSibling;
        if (val && season) val.textContent = season;
      }
    });

    // Stats bar — Seed counter
    document.querySelectorAll('.stat-val[data-target], .stat-val').forEach(el => {
      const item  = el.closest('.stat-item');
      const label = item && item.querySelector('.stat-label');
      if (!label) return;
      if (label.textContent.trim() === 'Seed' && seed) {
        el.setAttribute('data-target', seed);
        el.textContent = seed;
      }
    });

    // Section seed value (angka besar)
    const seedVal = document.querySelector('.seed-value');
    if (seedVal && seed) seedVal.textContent = seed;

    // Season desc (opsional)
    if (cfg.season_desc) {
      const descEl = document.querySelector('.season-desc, #season-desc');
      if (descEl) descEl.textContent = cfg.season_desc;
    }
  }


  /* ══════════════════════════════════════════════════════
     Tampilkan overlay maintenance
     ══════════════════════════════════════════════════════ */
  function showMaintenance(cfg) {
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    const msg     = cfg.maintenance_message || 'Server sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.';
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


  /* ══════════════════════════════════════════════════════
     Tampilkan MOTD banner
     ══════════════════════════════════════════════════════ */
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

  // 6. Sync harga shop_items dari Supabase → override SHOPCONFIG
  async function syncShopPrices(sb) {
    try {
      const { data: shopItems, error } = await sb.from('shop_items').select('id, price, stock');
      if (error || !shopItems || shopItems.length === 0) return;

      // Update SHOPCONFIG in-memory (untuk modal price display)
      // SHOPCONFIG pakai const di top-level, bisa diakses tanpa window.
      const cfg = (typeof SHOPCONFIG !== 'undefined') ? SHOPCONFIG : null;

      shopItems.forEach(row => {
        // 1. Update in-memory SHOPCONFIG untuk modal
        if (cfg && cfg.items) {
          const item = cfg.items.find(i => i.id === row.id);
          if (item) {
            item.price = row.price;
            if (row.stock !== undefined && row.stock !== null) item.stock = row.stock;
          }
        }

        // 2. Update DOM harga langsung di kartu toko
        const btn = document.querySelector(`.shop-btn-buy[onclick="shopOpenModal(${row.id})"]`);
        if (btn) {
          const card = btn.closest('.shop-card');
          if (card) {
            const priceEl = card.querySelector('.shop-card-price');
            if (priceEl) {
              const p = row.price;
              const fmt = p === 0
                ? '<span style="color:#17dd62">GRATIS</span>'
                : 'Rp ' + p.toLocaleString('id-ID');
              // Pertahankan harga coret originalPrice jika ada
              const orig = priceEl.querySelector('.shop-price-orig');
              priceEl.innerHTML = fmt + (orig ? orig.outerHTML : '');
            }
          }
        }
      });

      console.log('[supabase-sync] Harga shop berhasil disync dari Supabase.');
    } catch(e) {
      console.warn('[supabase-sync] Gagal sync shop_items:', e);
    }
  }

})();
