/* ══════════════════════════════════════════════════
   shop-config.js — Laughtale SMP Store
   ✏ Edit file ini untuk mengubah data toko.
   ⚠ Jangan taruh logika di sini. Logika ada di shop.js.
══════════════════════════════════════════════════ */

window.SHOP_CONFIG = {
    title: "Laughtale Store",
    subtitle: "Kustomisasi tampilan Minecraft kamu",

    categories: ["Semua", "Name Style", "Title", "Paket", "Currency"],

    /* ─────────────────────────────────────────
     STRUKTUR ITEM:
     {
       id            : number   — wajib, harus unik, cocok dengan SVG_MAP di shop.js
       name          : string   — nama produk
       category      : string   — harus ada di daftar categories di atas
       description   : string   — deskripsi singkat (1 baris di card)
       price         : number   — harga dalam rupiah (0 = GRATIS)
       originalPrice : number?  — harga coret jika ada diskon
       stock         : string?  — isi 'Habis' untuk nonaktifkan tombol beli
       badge         : string?  — teks badge kecil di pojok card (contoh: 'NEW', 'SALE')
       badgeColor    : string?  — 'gold' | 'green' | 'diamond' | 'red' | ''
       features      : string[] — list fitur (opsional, muncul di card)
       needsUsername : boolean? — true = form username Minecraft muncul di modal
       canBuyMultiple: boolean? — true = input qty muncul di modal
       maxQuantity   : number?  — batas maksimal qty (default 99)
       requiresDesign: boolean? — true = tampilkan notice "siapkan desain dulu"
     }
  ───────────────────────────────────────── */

    items: [
        {
            id: 1,
            name: "Name Style (Chat)",
            category: "Name Style",
            description: "Nama berwarna-warni di chat server.",
            price: 15000,
            badge: "POPULER",
            badgeColor: "green",
            features: ["Warna nama animasi", "Terlihat di semua chat"],
            needsUsername: true,
        },
        {
            id: 2,
            name: "Name Style (Player)",
            category: "Name Style",
            description: "Nametag di atas kepala karakter.",
            price: 15000,
            features: ["Nametag berwarna animasi", "Terlihat semua pemain"],
            needsUsername: true,
        },
        {
            id: 3,
            name: "Name Style (Custom)",
            category: "Name Style",
            description: "Desain nametag sepenuhnya custom.",
            price: 25000,
            badge: "CUSTOM",
            badgeColor: "diamond",
            features: ["Desain bebas dari nol", "File 1:1 dari kamu"],
            needsUsername: true,
            requiresDesign: true,
        },
        {
            id: 4,
            name: "Title (Chat)",
            category: "Title",
            description: "Badge titel/klan di depan nama chat.",
            price: 15000,
            needsUsername: true,
        },
        {
            id: 5,
            name: "Title (Player)",
            category: "Title",
            description: "Badge titel melayang di atas karakter.",
            price: 15000,
            needsUsername: true,
        },
        {
            id: 6,
            name: "Title (Custom)",
            category: "Title",
            description: "Desain title sepenuhnya custom.",
            price: 25000,
            badge: "CUSTOM",
            badgeColor: "diamond",
            needsUsername: true,
            requiresDesign: true,
        },
        {
            id: 7,
            name: "Paket Lengkap",
            category: "Paket",
            description: "Name Style + Title custom, hemat Rp15.000.",
            price: 35000,
            originalPrice: 50000,
            badge: "HEMAT",
            badgeColor: "gold",
            features: ["Name Style custom", "Title custom", "Hemat Rp15.000"],
            needsUsername: true,
            requiresDesign: true,
        },
        {
            id: 8,
            name: "Gem Coins",
            category: "Currency",
            description: "Mata uang Gacha in-game. Rp600 / koin.",
            price: 600,
            canBuyMultiple: true,
            maxQuantity: 500,
            badge: "GACHA",
            badgeColor: "diamond",
        },
    ],
};
