/* ════════════════════════════════════════════════════════
   supabase-sync.js — Sinkronisasi otomatis dari Admin Panel
   Fetch site_config dari Supabase, lalu terapkan ke website
════════════════════════════════════════════════════════ */

(async function () {
  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

  // Tunggu Supabase client tersedia
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
      console.warn('[supabase-sync] Gagal fetch:', error?.message);
      return;
    }

    // Ubah array rows menjadi object { key: value }
    const cfg = {};
    data.forEach(row => { cfg[row.key] = row.value; });

    // ── 1. Override window.SERVER_CONFIG ──────────────────
    if (window.SERVER_CONFIG) {
      if (cfg.server_ip)   window.SERVER_CONFIG.ip        = cfg.server_ip;
      if (cfg.server_name) window.SERVER_CONFIG.namaServer = cfg.server_name;
      if (cfg.server_type) window.SERVER_CONFIG.versi      = cfg.server_type;
      if (cfg.season)      window.SERVER_CONFIG.season     = cfg.season;
      if (cfg.seed)        window.SERVER_CONFIG.seed       = parseInt(cfg.seed) || window.SERVER_CONFIG.seed;
    }

    // ── 2. Terapkan ke DOM ────────────────────────────────
    applyServerConfig(window.SERVER_CONFIG);

    // ── 3. Maintenance mode ───────────────────────────────
    if (cfg.maintenance_mode === 'true') {
      showMaintenance(cfg);
    }

    // ── 4. MOTD / Banner pengumuman ───────────────────────
    if (cfg.motd_active === 'true' && cfg.motd_text) {
      showMOTD(cfg);
    }

    // ── 5. WA Admin override untuk toko ──────────────────
    try {
      const mainAdmins = JSON.parse(cfg.whatsapp_admins     || '[]');
      const gemAdmins  = JSON.parse(cfg.whatsapp_gem_admins || '[]');
      if (mainAdmins.length || gemAdmins.length) {
        window._supabaseWA = { main: mainAdmins, gem: gemAdmins };
      }
    } catch (e) { /* JSON parse gagal — pakai data di shop-config.js */ }

    console.log('[supabase-sync] Config berhasil diterapkan.');

  } catch (e) {
    console.warn('[supabase-sync] Error:', e);
  }


  /* ── Terapkan SERVER_CONFIG ke semua elemen DOM ── */
  function applyServerConfig(sc) {
    if (!sc) return;

    // Season counter
    document.querySelectorAll('.stat-label').forEach(el => {
      if (el.textContent.trim() === 'Season') {
        var val = el.previousElementSibling;
        if (val) val.textContent = sc.season;
      }
    });

    // Seed, Total Fitur, Peraturan
    var map = {
      'Total Fitur': sc.totalFitur,
      'Peraturan':   sc.totalPeraturan,
      'Seed':        sc.seed,
    };
    document.querySelectorAll('.stat-val[data-target]').forEach(el => {
      var label = el.closest('.stat-item') && el.closest('.stat-item').querySelector('.stat-label');
      if (label && map[label.textContent.trim()] !== undefined) {
        el.setAttribute('data-target', map[label.textContent.trim()]);
        el.textContent = map[label.textContent.trim()];
      }
    });

    // IP server yang tampil di halaman
    document.querySelectorAll('#server-address-display, .server-ip-text').forEach(el => {
      el.textContent = sc.ip;
    });

    // Simpan IP agar heroDirectConnect pakai data terbaru
    window._serverIP = sc.ip;
  }


  /* ── Tampilkan overlay maintenance ── */
  function showMaintenance(cfg) {
    var overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    var msg  = cfg.maintenance_message || 'Server sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.';
    var eta  = cfg.maintenance_eta
      ? new Date(cfg.maintenance_eta).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
      : null;
    var contact = cfg.maintenance_contact || '';

    document.getElementById('maint-msg').textContent = msg;

    var etaEl = document.getElementById('maint-eta');
    if (eta && etaEl) {
      etaEl.textContent    = '⏱ Estimasi selesai: ' + eta;
      etaEl.style.display  = 'block';
    }

    var conEl = document.getElementById('maint-contact');
    if (contact && conEl) {
      conEl.textContent   = '📞 Kontak: ' + contact;
      conEl.style.display = 'block';
    }

    overlay.style.display  = 'flex';
    document.body.style.overflow = 'hidden';
  }


  /* ── Tampilkan MOTD banner ── */
  function showMOTD(cfg) {
    var banner = document.getElementById('motd-banner');
    if (!banner) return;

    var palette = {
      info:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  color: '#60a5fa' },
      success: { bg: 'rgba(93,189,58,0.10)',   border: 'rgba(93,189,58,0.25)',   color: '#5dbd3a' },
      warning: { bg: 'rgba(244,196,48,0.10)',  border: 'rgba(244,196,48,0.25)',  color: '#f4c430' },
      error:   { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',   color: '#ef4444' },
    };
    var p = palette[cfg.motd_type] || palette.info;

    banner.style.background   = p.bg;
    banner.style.borderBottom = '1px solid ' + p.border;
    banner.style.color        = p.color;

    document.getElementById('motd-text').textContent = cfg.motd_text;

    if (cfg.motd_btn && cfg.motd_url) {
      var btn      = document.getElementById('motd-btn');
      btn.textContent   = cfg.motd_btn;
      btn.href          = cfg.motd_url;
      btn.style.display = 'inline-flex';
      btn.style.color   = p.color;
      btn.style.border  = '1px solid ' + p.border;
    }

    banner.style.display = 'flex';
  }

})();
