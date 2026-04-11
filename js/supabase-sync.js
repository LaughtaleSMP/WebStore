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
    const sc = window.SERVER_CONFIG || window.SERVERCONFIG || {};
    if (cfg.server_ip)   sc.ip         = cfg.server_ip;
    if (cfg.server_name) sc.namaServer = cfg.server_name;
    if (cfg.server_type) sc.versi      = cfg.server_type;
    if (cfg.season)      sc.season     = cfg.season;
    if (cfg.seed)        sc.seed       = parseInt(cfg.seed) || sc.seed;
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
        window.supabaseWA  = { main: mainAdmins, gem: gemAdmins };
        window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
      }
    } catch (e) { /* JSON parse gagal — pakai data di shop-config.js */ }


    // ── 6. Shop Items — baca dari shop_config (sesuai admin panel) ──
    // Admin panel menyimpan ke tabel shop_config (key='main'), bukan shop_items.
    try {
      const { data: shopCfgRow, error: shopErr } = await sb
        .from('shop_config')
        .select('value')
        .eq('key', 'main')
        .single();

      if (!shopErr && shopCfgRow?.value) {
        const shopCfg = JSON.parse(shopCfgRow.value);
        const mapped  = shopCfg.items || [];

        if (window.SHOP_CONFIG) {
          window.SHOP_CONFIG.items      = mapped;
          window.SHOP_CONFIG.admins     = shopCfg.admins     || window.SHOP_CONFIG.admins;
          window.SHOP_CONFIG.gemAdmins  = shopCfg.gemAdmins  || window.SHOP_CONFIG.gemAdmins;
          window.SHOP_CONFIG.categories = shopCfg.categories || window.SHOP_CONFIG.categories;
          window.SHOP_CONFIG.title      = shopCfg.title      || window.SHOP_CONFIG.title;
          window.SHOP_CONFIG.subtitle   = shopCfg.subtitle   || window.SHOP_CONFIG.subtitle;
        }

        // Simpan ke window agar shop.js bisa re-render
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

        // Update harga langsung di DOM kartu shop
        mapped.forEach(item => {
          const btn = document.querySelector(`.shop-btn-buy[onclick="shopOpenModal(${item.id})"]`);
          if (btn) {
            const card = btn.closest('.shop-card');
            if (card) {
              const priceEl = card.querySelector('.shop-card-price');
              if (priceEl) {
                const p   = item.price || 0;
                const fmt = p === 0
                  ? '<span style="color:#17dd62">GRATIS</span>'
                  : 'Rp ' + p.toLocaleString('id-ID');
                const op = item.originalPrice || 0;
                const origHtml = op > 0
                  ? `<span class="shop-price-orig">Rp ${op.toLocaleString('id-ID')}</span>`
                  : '';
                priceEl.innerHTML = fmt + origHtml;
              }
            }
          }
        });

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


  /* ══════════════════════════════════════════════════════
     Terapkan config ke semua elemen DOM
     ══════════════════════════════════════════════════════ */
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

})();
