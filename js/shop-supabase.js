/* ══════════════════════════════════════════════════
   shop-supabase.js — Live data loader dari Supabase
   Data shop (harga, item, dll) dibaca dari database,
   bukan dari shop-config.js (file statis).
══════════════════════════════════════════════════ */
(async function () {

  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

  /* Tunggu Supabase SDK tersedia */
  let tries = 0;
  while (typeof supabase === 'undefined' && tries < 20) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  if (typeof supabase === 'undefined') {
    console.warn('[shop-supabase] Supabase client tidak ditemukan.');
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
  });

  async function fetchShopData() {
    try {
      /* Ambil semua item aktif dari shop_items */
      const { data: rows, error: itemErr } = await sb
        .from('shop_items')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (itemErr) throw new Error('Gagal fetch shop_items: ' + itemErr.message);

      /* Ambil konfigurasi utama (judul, admin WA, dsb) dari shop_config */
      const { data: cfgRows, error: cfgErr } = await sb
        .from('shop_config')
        .select('value')
        .eq('key', 'main')
        .single();

      if (cfgErr && cfgErr.code !== 'PGRST116') {
        console.warn('[shop-supabase] Gagal fetch shop_config:', cfgErr.message);
      }

      const cfg = cfgRows?.value ? JSON.parse(cfgRows.value) : {};

      /* Susun ulang format agar cocok dengan yang diharapkan shop.js */
      const items = (rows || []).map(r => ({
        id:             r.id,
        name:           r.name,
        emoji:          r.emoji,
        category:       r.category,
        price:          r.price,
        originalPrice:  r.original_price,
        description:    r.description,
        features:       r.features       || [],
        badge:          r.badge          || '',
        badgeColor:     r.badge_color    || '',
        stock:          r.stock,
        requiresDesign: r.requires_design,
        needsUsername:  r.needs_username,
        canBuyMultiple: r.can_buy_multiple,
        maxQuantity:    r.max_quantity,
        images:         r.images         || [],
      }));

      /* Kumpulkan kategori unik sesuai urutan item */
      const cats = ['Semua'];
      items.forEach(i => { if (!cats.includes(i.category)) cats.push(i.category); });

      /* Override SHOP_CONFIG global dengan data live dari Supabase */
      window.SHOP_CONFIG = {
        title:            cfg.title            || 'Laughtale Store',
        subtitle:         cfg.subtitle         || '',
        categories:       cfg.categories       || cats,
        admins:           cfg.admins           || [],
        gemAdmins:        cfg.gemAdmins        || [],
        whatsappGreeting: cfg.whatsappGreeting  || '',
        items,
      };

      /* Simpan nomor WA untuk dipakai shop.js */
      window._supabaseWA = {
        main: cfg.admins    || [],
        gem:  cfg.gemAdmins || [],
      };

      /* Trigger render ulang shop setelah data live dimuat */
      /* Hanya dispatch event — biarkan supabase-sync.js yang handle re-render
         agar tidak terjadi double render / race condition harga */
      document.dispatchEvent(new CustomEvent('shopDataReady'));

    } catch (err) {
      console.warn('[shop-supabase] Gagal load data live, fallback ke shop-config.js:', err.message);
      /* Fallback: biarkan shop.js pakai SHOP_CONFIG dari shop-config.js */
    }
  }

  /* Jalankan setelah DOM siap */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchShopData);
  } else {
    fetchShopData();
  }

})();
