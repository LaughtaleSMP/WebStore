/* ══════════════════════════════════════════════════
   shop-supabase.js — Live data loader dari Supabase
   Data shop (harga, item, dll) dibaca dari database,
   bukan dari shop-config.js (file statis).
══════════════════════════════════════════════════ */
(function () {

  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';

  async function fetchShopData() {
    try {
      /* Ambil semua item aktif dari shop_items */
      const itemsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shop_items?active=eq.true&order=sort_order.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!itemsRes.ok) throw new Error('Gagal fetch shop_items');
      const rows = await itemsRes.json();

      /* Ambil konfigurasi utama (judul, admin WA, dsb) dari shop_config */
      const cfgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shop_config?key=eq.main&select=value`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!cfgRes.ok) throw new Error('Gagal fetch shop_config');
      const cfgRows = await cfgRes.json();
      const cfg = cfgRows[0] ? JSON.parse(cfgRows[0].value) : {};

      /* Susun ulang format agar cocok dengan yang diharapkan shop.js */
      const items = rows.map(r => ({
        id:             r.id,
        name:           r.name,
        emoji:          r.emoji,
        category:       r.category,
        price:          r.price,
        originalPrice:  r.original_price,
        description:    r.description,
        features:       r.features || [],
        badge:          r.badge || '',
        badgeColor:     r.badge_color || '',
        stock:          r.stock,
        requiresDesign: r.requires_design,
        needsUsername:  r.needs_username,
        canBuyMultiple: r.can_buy_multiple,
        maxQuantity:    r.max_quantity,
        images:         r.images || [],
      }));

      /* Kumpulkan kategori unik sesuai urutan item */
      const cats = ['Semua'];
      items.forEach(i => { if (!cats.includes(i.category)) cats.push(i.category); });

      /* Override SHOP_CONFIG global dengan data live dari Supabase */
      window.SHOP_CONFIG = {
        title:    cfg.title    || 'Laughtale Store',
        subtitle: cfg.subtitle || '',
        categories: cfg.categories || cats,
        admins:   cfg.admins   || [],
        gemAdmins: cfg.gemAdmins || [],
        whatsappGreeting: cfg.whatsappGreeting || '',
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
