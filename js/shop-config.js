/* ════════════════════════════════════════════════════════════════
🛒 KONFIGURASI SHOP — LAUGHTALE SMP
════════════════════════════════════════════════════════════════

✅ CARA PAKAI (BACA INI DULU!):
─────────────────────────────────────────────────────────────
File ini adalah SATU-SATUNYA file yang perlu kamu edit.
Tidak perlu buka file lain, tidak perlu ngerti coding.

ATURAN AMAN SAAT EDIT:
• Ganti teks di antara "..." sesukamu.
• Ganti angka (harga) langsung, tanpa titik/koma.
• Jangan hapus tanda { } [ ] " : ,
• Baris yang diawali // adalah komentar — aman dihapus.
• Kalau website rusak setelah edit → ada tanda baca yang terhapus,
  kembalikan seperti semula.

════════════════════════════════════════════════════════════════
🖼 CARA PAKAI GALERI GAMBAR CONTOH:
─────────────────────────────────────────────────────────────
① Buat folder: assets/shop/item-{id}/ → contoh: assets/shop/item-1/
② Taruh gambar di sana, beri nama: 1.jpg, 2.jpg, dst.
③ Isi field "images" di item yang sesuai:
   images: [
     "assets/shop/item-1/1.jpg",
     "assets/shop/item-1/2.jpg",
   ],
④ Jika belum ada gambar → biarkan kosong: images: [],

════════════════════════════════════════════════════════════════
📝 PENJELASAN FIELD PENTING:
─────────────────────────────────────────────────────────────
id             → Nomor unik. Jangan ada yang sama!
name           → Nama item di kartu toko
emoji          → Ikon/emoji item
category       → Harus cocok dengan salah satu kategori di atas
price          → Harga (angka saja, tanpa titik/koma). 0 = GRATIS
originalPrice  → Harga coret sebelum diskon. 0 = tidak ada coret
description    → Deskripsi singkat
features       → Daftar poin keuntungan. Kosongkan dengan []
badge          → Label pojok kartu: "POPULER" / "NEW" / "" (kosong)
badgeColor     → "gold" / "green" / "diamond" / "red" / ""
stock          → "Tersedia" atau "Habis"
requiresDesign → true  = pembeli harus siapkan desain dulu (form
                         hanya meminta username + catatan saja)
               → false = tidak perlu desain
images         → Galeri foto contoh desain (lihat petunjuk atas)
needsUsername  → true = minta username Minecraft pembeli
canBuyMultiple → true  = pembeli bisa pilih jumlah (qty)
               → false = qty dikunci ke 1
maxQuantity    → Batas maksimum qty (default 99)
════════════════════════════════════════════════════════════════ */

const SHOP_CONFIG = {

/* ────────────────────────────────────────────────────────────
   📝 JUDUL TOKO
──────────────────────────────────────────────────────────── */
title:    "Laughtale Store",
subtitle: "Custom Nametag, Title, Cosmetic, dan Gem Coins — semua pembelian membantu server tetap online! 🙏",

/* ────────────────────────────────────────────────────────────
   📱 ADMIN WHATSAPP

   • admins      → untuk semua item KECUALI Gem (dipilih random)
   • gemAdmins   → khusus item kategori "Ingame Gacha" (Gem Coins)

   Format nomor: "62" + nomor tanpa 0 di depan, tanpa spasi
   Contoh: 082323645879 → "6282323645879"

   Untuk menonaktifkan satu admin → hapus baris { name:..., number:... }
──────────────────────────────────────────────────────────── */
admins: [
  { name: "Blackdamen", number: "6282323645879" },
  { name: "Zoe",        number: "6285246205803" },
  { name: "Nuna",       number: "6285186844434" },
],

// Khusus item Gem Coins (kategori "Ingame Gacha")
gemAdmins: [
  { name: "Baim", number: "6282172955865" },
],

whatsappGreeting: "Halo Admin Laughtale Store! Saya ingin memesan item berikut:",

/* ────────────────────────────────────────────────────────────
   🗂 KATEGORI / TAB FILTER
   ⚠ Nama harus sama persis dengan field "category" di tiap item.
──────────────────────────────────────────────────────────── */
categories: [
  "Semua",
  "Custom Nametag",
  "Custom Title",
  "All Cosmetic",
  "Ingame Gacha",
],

/* ════════════════════════════════════════════════════════════
   🛍 DAFTAR ITEM
   Setiap item dimulai dengan { dan diakhiri dengan },
════════════════════════════════════════════════════════════ */
items: [

/* ──────────────── CUSTOM NAMETAG ──────────────── */

{
  id: 1,
  name:          "Name Style (Chat)",
  emoji:         "",
  category:      "Custom Nametag",
  price:         15000,
  originalPrice: 20000,
  description:   "Gaya nama kustom yang tampil saat kamu chat di server.",
  features: [
    "Nama bergaya di chat server",
    "Bebas pilih warna & style",
    "Berlaku permanen selama season",
  ],
  badge:      "TRENDY",
  badgeColor: "diamond",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

{
  id: 2,
  name:          "Name Style (Player)",
  emoji:         "",
  category:      "Custom Nametag",
  price:         15000,
  originalPrice: 20000,
  description:   "Gaya nama kustom yang tampil di atas kepala karaktermu. Terlihat oleh semua pemain!",
  features: [
    "Nama bergaya di atas karakter",
    "Terlihat oleh semua pemain online",
    "Bebas pilih warna & style",
    "Berlaku permanen selama season",
  ],
  badge:      "TRENDY",
  badgeColor: "diamond",
  stock:      "Tersedia",

  requiresDesign: false,
  images: [
    //"assets/shop/item-2/1.jpg",
    // "assets/shop/item-2/2.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

{
  id: 3,
  name:          "Name Style (Replace Design)",
  emoji:         "",
  category:      "Custom Nametag",
  price:         12000,
  originalPrice: 15000,
  description:   "Nametag dengan desain pengganti eksklusif — bukan sekadar ganti warna, tapi ganti tampilan keseluruhan!",
  features: [
    "Desain nametag penuh kustom",
    "Pilih dari koleksi desain eksklusif",
    "Tampil beda dari yang lain",
  ],
  badge:      "SPECIAL",
  badgeColor: "gold",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

/* ──────────────── CUSTOM TITLE ──────────────── */

{
  id: 4,
  name:          "Title Rank/Clan (Message)",
  emoji:         "",
  category:      "Custom Title",
  price:         5000,
  originalPrice: 8000,
  description:   "Title / prefix klan yang muncul di samping namamu saat chat. Tunjukkan identitas klanmu!",
  features: [
    "Title tampil di chat server",
    "Bebas pilih teks & warna title",
    "Cocok untuk rank atau nama klan",
  ],
  badge:      "POPULER",
  badgeColor: "green",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [
    // "assets/shop/item-4/1.jpg",
    // "assets/shop/item-4/2.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

{
  id: 5,
  name:          "Title Rank/Clan (Player)",
  emoji:         "",
  category:      "Custom Title",
  price:         10000,
  originalPrice: 18000,
  description:   "Title / prefix klan yang muncul di atas kepala karaktermu — semua pemain bisa lihat!",
  features: [
    "Title tampil di atas karakter",
    "Terlihat oleh semua pemain online",
    "Bebas pilih teks & warna title",
  ],
  badge:      "",
  badgeColor: "",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [
    // "assets/shop/item-5/1.jpg",
    // "assets/shop/item-5/2.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

{
  id: 6,
  name:          "Title Rank/Clan (Replace Design)",
  emoji:         "",
  category:      "Custom Title",
  price:         8000,
  originalPrice: 10000,
  description:   "Title dengan desain pengganti eksklusif — tampilan berbeda dari title biasa!",
  features: [
    "Desain title penuh kustom",
    "Pilih dari koleksi desain khusus",
    "Tampil premium dan unik",
  ],
  badge:      "SPECIAL",
  badgeColor: "gold",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [
    // "assets/shop/item-6/1.jpg",
    // "assets/shop/item-6/2.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

/* ──────────────── ALL COSMETIC ──────────────── */

{
  id: 7,
  name:          "All Custom (Replace Design)",
  emoji:         "",
  category:      "All Cosmetic",
  price:         30000,
  originalPrice: 45000,
  description:   "Paket lengkap — Name Style Replace Design + Title Replace Design dalam satu harga bundling!",
  features: [
    "Name Style Replace Design (Chat + Player)",
    "Title Rank/Clan Replace Design",
    "Hemat Rp15.000 dibanding beli satuan",
    "Semua desain bisa dikustomisasi",
  ],
  badge:      "BUNDLING",
  badgeColor: "red",
  stock:      "Tersedia",

  requiresDesign: true,
  images: [
    // "assets/shop/item-7/1.jpg",
    // "assets/shop/item-7/2.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true,
  maxQuantity:    100,
},

/* ──────────────── INGAME GACHA ──────────────── */

{
  id: 8,
  name:          "Gem Coins",
  emoji:         "",
  category:      "Ingame Gacha",
  price:         600,
  originalPrice: 0,
  description:   "Mata uang khusus untuk sistem Gacha in-game Laughtale SMP. Kumpulkan dan coba keberuntunganmu!",
  features: [
    "Digunakan di sistem Gacha in-game",
    "Bisa dibeli dalam jumlah banyak",
    "Makin banyak makin hemat waktu",
  ],
  badge:      "SPECIAL",
  badgeColor: "diamond",
  stock:      "Tersedia",

  requiresDesign: false,
  images: [
    // "assets/shop/item-8/1.jpg",
  ],

  needsUsername:  true,
  canBuyMultiple: true, // ← Gem Coins bisa beli banyak sekaligus
  maxQuantity:    999,
},

], // ← Jangan hapus ini

}; // ← Jangan hapus ini
