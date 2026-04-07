/* ════════════════════════════════════════════════════════════════
   🛒 KONFIGURASI SHOP — LAUGHTALE SMP
   ════════════════════════════════════════════════════════════════

   📌 CARA EDIT:
   - File ini adalah satu-satunya file yang perlu kamu ubah untuk
     mengatur semua isi toko.
   - Tidak perlu tahu coding! Cukup ganti tulisan/angka yang ada.
   - Tanda  //  di depan baris = komentar (tidak berpengaruh ke website).
   - Jangan hapus tanda  {  }  [  ]  "  :  ,  kecuali memang mau
     menghapus satu item sekaligus (lihat petunjuk di bawah).

   ════════════════════════════════════════════════════════════════ */

const SHOP_CONFIG = {

  /* ────────────────────────────────────────────────────────────
     📝 JUDUL & DESKRIPSI SECTION SHOP
     Ganti teks di antara tanda " " sesukamu.
  ──────────────────────────────────────────────────────────── */
  title:    "Laughtale Store",
  subtitle: "Support server dan dapatkan keuntungan eksklusif! Semua pembelian membantu biaya operasional server tetap jalan. 🙏",

  /* ────────────────────────────────────────────────────────────
     💳 INFO PEMBAYARAN
     Ini yang muncul saat pemain klik tombol "Beli".
  ──────────────────────────────────────────────────────────── */
  payment: {
    // Metode pembayaran (contoh: "QRIS / Transfer Bank")
    method: "QRIS",

    // Instruksi singkat untuk pembeli
    instructions: "Scan QRIS di bawah, lalu kirim bukti bayar ke admin beserta nama item yang dibeli.",

    // Link tombol "Hubungi Admin" (gunakan link WhatsApp atau Discord)
    contactLink:  "https://chat.whatsapp.com/C2ksT3ncowT7jvkF2TNFnc",
    contactLabel: "💬 Chat Admin WhatsApp",

    // NMID QRIS kamu (tertera di struk/merchant info)
    qrisNmid: "ID1024360757248 — A01",

    // Path gambar QRIS (letakkan file gambar QRIS di folder assets/)
    qrisImage: "assets/Laughtale-Qris.jpeg",
  },

  /* ────────────────────────────────────────────────────────────
     🗂 KATEGORI / TAB FILTER
     Tambah atau hapus kategori sesukamu.
     ⚠ Nama kategori DI SINI harus sama persis dengan
       field "category" di setiap item di bawah.
  ──────────────────────────────────────────────────────────── */
  categories: ["Semua", "Rank", "Cosmetic", "Title", "Item Spesial"],

  /* ────────────────────────────────────────────────────────────
     🛍 DAFTAR ITEM
     ════════════════════════════════════════════════════════════

     CARA TAMBAH ITEM BARU:
     1. Copy satu blok item dari { ... }, termasuk tanda koma di akhir.
     2. Tempel di bawah item terakhir (sebelum tanda ] ).
     3. Ganti isi datanya.

     CARA HAPUS ITEM:
     Hapus seluruh blok dari tanda { sampai } berikut koma di akhirnya.

     PENJELASAN TIAP FIELD:
     ─ id          : Angka unik, jangan sampai ada yang sama.
     ─ name        : Nama item yang tampil di kartu.
     ─ emoji       : Emoji/ikon item (copy paste dari hp/internet).
     ─ category    : Harus sama dengan salah satu kategori di atas.
     ─ price       : Harga dalam Rupiah (angka saja, tanpa titik/koma).
                     Tulis 0 jika gratis.
     ─ description : Deskripsi singkat item.
     ─ features    : Daftar keuntungan item. Boleh dikosongkan [].
     ─ badge       : Label kecil di pojok kartu (contoh: "POPULER", "NEW", "LIMITED").
                     Kosongkan "" jika tidak mau pakai badge.
     ─ badgeColor  : Warna badge → pilih: "gold", "green", "diamond", "red", atau ""
     ─ stock       : Tulis "Tersedia" atau "Habis".
  ──────────────────────────────────────────────────────────── */
  items: [

    /* ── RANK ── */
    {
      id: 1,
      name:        "VIP Rank",
      emoji:       "⭐",
      category:    "Rank",
      price:       15000,
      description: "Rank dasar untuk mendukung server. Dapatkan tag [VIP] di chat dan akses ke fitur-fitur member eksklusif.",
      features:    [
        "Tag [VIP] di chat server",
        "Akses channel eksklusif di Discord",
        "Nama tercantum di papan Supporter",
      ],
      badge:       "POPULER",
      badgeColor:  "gold",
      stock:       "Tersedia",
    },
    {
      id: 2,
      name:        "VIP+ Rank",
      emoji:       "🌟",
      category:    "Rank",
      price:       25000,
      description: "Upgrade dari VIP biasa dengan lebih banyak benefit. Tag [VIP+] berwarna khusus di chat server.",
      features:    [
        "Tag [VIP+] berwarna emas di chat",
        "Semua benefit VIP",
        "Prioritas daftar allowlist musim berikutnya",
      ],
      badge:       "REKOMENDASI",
      badgeColor:  "diamond",
      stock:       "Tersedia",
    },
    {
      id: 3,
      name:        "MVP Rank",
      emoji:       "👑",
      category:    "Rank",
      price:       50000,
      description: "Rank tertinggi untuk supporter setia Laughtale SMP. Tag [MVP] berkilauan dan semua keistimewaan member.",
      features:    [
        "Tag [MVP] animasi berkilau di chat",
        "Semua benefit VIP+",
        "Role khusus MVP di Discord",
        "Shoutout di TikTok/konten server",
      ],
      badge:       "PREMIUM",
      badgeColor:  "red",
      stock:       "Tersedia",
    },

    /* ── COSMETIC ── */
    {
      id: 4,
      name:        "Particle Pack — Flame",
      emoji:       "🔥",
      category:    "Cosmetic",
      price:       10000,
      description: "Efek partikel api yang mengelilingi karaktermu. Tampil keren dan mencolok di hadapan semua pemain!",
      features:    [
        "Partikel api permanen",
        "Aktif di semua dimensi",
      ],
      badge:       "KEREN",
      badgeColor:  "red",
      stock:       "Tersedia",
    },
    {
      id: 5,
      name:        "Particle Pack — Aurora",
      emoji:       "✨",
      category:    "Cosmetic",
      price:       10000,
      description: "Efek partikel aurora biru-ungu yang elegan. Bikin karaktermu terlihat seperti dari dimensi lain.",
      features:    [
        "Partikel aurora permanen",
        "Aktif di semua dimensi",
      ],
      badge:       "",
      badgeColor:  "",
      stock:       "Tersedia",
    },
    {
      id: 6,
      name:        "Cape Eksklusif S12",
      emoji:       "🦸",
      category:    "Cosmetic",
      price:       20000,
      description: "Cape edisi terbatas Season 12. Hanya tersedia selama S12 berlangsung — dapatkan sebelum kehabisan!",
      features:    [
        "Cape desain eksklusif S12",
        "Terlihat oleh semua pemain",
        "Tidak tersedia di season lain",
      ],
      badge:       "LIMITED",
      badgeColor:  "gold",
      stock:       "Tersedia",
    },

    /* ── TITLE ── */
    {
      id: 7,
      name:        "Custom Title",
      emoji:       "🏷️",
      category:    "Title",
      price:       8000,
      description: "Title kustom di atas namamu sesuai permintaan. Tulis teks apa saja (maks 16 karakter, bebas warna).",
      features:    [
        "Teks bebas (maks 16 karakter)",
        "Pilih warna teks sesukamu",
        "Terlihat oleh semua pemain",
      ],
      badge:       "CUSTOM",
      badgeColor:  "diamond",
      stock:       "Tersedia",
    },
    {
      id: 8,
      name:        "Prefix — [The Dragon]",
      emoji:       "🐉",
      category:    "Title",
      price:       12000,
      description: "Prefix bergengsi [The Dragon] untuk para penakluk Ender Dragon. Tunjukkan pencapaianmu!",
      features:    [
        "Prefix [The Dragon] berwarna merah",
        "Cocok untuk yang sudah kill Ender Dragon",
      ],
      badge:       "EPIC",
      badgeColor:  "red",
      stock:       "Tersedia",
    },

    /* ── ITEM SPESIAL ── */
    {
      id: 9,
      name:        "Starter Kit",
      emoji:       "🎒",
      category:    "Item Spesial",
      price:       5000,
      description: "Paket pemula berisi peralatan dasar untuk mempercepat awal permainanmu. Cocok untuk pemain baru!",
      features:    [
        "Peralatan besi lengkap",
        "Makanan untuk 10 hari",
        "Torch dan beberapa material dasar",
      ],
      badge:       "MURAH",
      badgeColor:  "green",
      stock:       "Tersedia",
    },
    {
      id: 10,
      name:        "Mystery Box",
      emoji:       "📦",
      category:    "Item Spesial",
      price:       7500,
      description: "Kotak misteri berisi item random dari enchanted tools hingga material langka. Beruntung kah kamu?",
      features:    [
        "1 item random dari pool 20+ item",
        "Chance mendapat item enchanted tinggi",
      ],
      badge:       "RANDOM",
      badgeColor:  "gold",
      stock:       "Tersedia",
    },

  ], // ← Jangan hapus tanda kurung siku dan koma ini!

}; // ← Jangan hapus baris ini!
