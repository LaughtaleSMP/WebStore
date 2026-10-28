# LAUGHTALE SMP — Master Design System & UI Guidelines

**v2.0** · Master Visual Standard & Design DNA untuk WebStore & Dashboard Laughtale SMP.
Berlaku otomatis untuk semua komponen web, formulir, modal, dashboard player, dan panel admin.
*"Simpel, Bersih, Kontras Tinggi, Simetris, dan Bebas dari AI-Slop."*

---

## 1. Filosofi Inti: "Pure Clarity, High Contrast & Effortless Precision"

Keindahan antarmuka Laughtale lahir dari kesederhanaan ekstrem, kontras tinggi yang tajam dan nyaman dibaca, sudut lengkung *squircle* mulus standar Apple macOS / iOS, serta proporsi yang simetris sempurna.

* **Bukan Pelangi Neon**: Warna latar belakang harus tenang dan membiarkan konten utama yang bersinar.
* **Sentuhan Berbobot**: Setiap tombol yang ditekan harus memberikan umpan balik fisik yang nyata melalui skala mikro (*micro-press feedback* `scale(0.97)`).
* **Simetri Rapi**: Elemen-elemen yang sejajar atau bertahap wajib memiliki proporsi, tinggi, dan ukuran tipografi yang seimbang tanpa ada yang timpang ("tidak ada yang satu besar satu kecil").

---

## 2. Aturan Mutlak Mode Terang / Light Mode (Anti-Washed Out)

DILARANG membuat komponen di Light Mode yang buram, pudar, atau abu-abu berkabut yang membuat mata silau/lelah:

* **Latar Modal & Kartu Formulir**:
  * Wajib menggunakan warna putih solid pekat (`#ffffff`) dengan bayangan halus terukur (`box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12)`).
  * Dilarang menggunakan kartu transparan berkabut (`rgba(255, 255, 255, 0.45)`) di atas backdrop abu-abu karena akan mengubah kartu menjadi abu-abu kusam.
* **Kotak Input & Garis Tepi (Border)**:
  * Latar input: `#ffffff` pekat.
  * Border input: Wajib tegas berukuran `1.5px solid rgba(0, 0, 0, 0.14 s.d. 0.16)`. Dilarang menggunakan border putih transparan di atas latar putih.
  * Focus ring: Biru Apple (`#0071e3`) dengan *glow* lembut `0 0 0 3px rgba(0, 113, 227, 0.15)`.
* **Warna Teks & Kontras Tipografi (WCAG AAA)**:
  * Teks utama & ketikan input: Hitam pekat pejal (`#0f172a`).
  * Teks label formulir: Slate gelap (`#334155`), font-weight: `600`.
  * Teks placeholder & deskripsi sekunder: Slate seimbang (`#64748b` s.d. `#94a3b8`).

---

## 3. Aturan Simetri & Proporsi Baku (Anti-Timpang / Anti-Besar Kecil)

Pengguna sangat sensitif terhadap ketidakteraturan ukuran. Terapkan prinsip kesetaraan visual mutlak:

* **Kotak Sejajar / Bertahap Wajib Seragam**:
  * Ketika ada dua langkah atau dua kartu berdampingan (contoh: Langkah 1 Perintah vs Langkah 2 Kode), kedua kotak wajib memiliki **tinggi yang persis sama (`min-height: 42px`)**, padding yang sama (`4px 6px 4px 12px`), dan radius yang sama (`var(--border-radius-sm)`).
* **Ukuran Font Seimbang**:
  * Kode perintah dan kode digit harus memiliki ukuran font yang proporsional (contoh: `1.02rem` untuk keduanya).
  * Dilarang menempatkan satu badge raksasa (font 1.25rem dengan spasi melar) di sebelah badge kerdil (font 0.9rem).
* **Tombol Salin & Aksi Inline Seragam**:
  * Tombol aksi pendamping (seperti tombol Salin) wajib memiliki tinggi `32px` yang seragam, sudut melengkung `6px`, dan ikon SVG yang berukuran identik (`13px-14px`).

---

## 4. Formulir Super Simpel & Bersih (Zero Clutter)

* **Paragraf Panduan Singkat**:
  * Maksimal 1 kalimat instruksi yang padat dan jelas. Dilarang menaruh dinding teks atau catatan kaki bertele-tele di dalam modal kecil.
* **Tombol Aksi Tunggal Full-Width**:
  * Gunakan 1 tombol utama berukuran tinggi `44px` dengan sudut membulat penuh (`border-radius-full`) yang nyaman ditekan di layar HP.
  * Hindari tombol "Batal" kedua di samping tombol simpan jika sudah ada tombol silang (×) di pojok kanan atas dialog dan area luar dialog bisa diklik untuk menutup.
* **Tautan Navigasi Minimalis**:
  * Tempatkan tautan pergantian form (Daftar Akun / Lupa PIN / Kembali Masuk) di dasar form sebagai teks tautan bersih `0.82rem` dengan aksen warna brand tanpa dekorasi mencolok.

---

## 5. Zero AI-Slop & Standar Kebersihan Visual

Aturan larangan mutlak untuk mencegah gaya generik murahan:

* **DILARANG Alert Kapsul Pink Pastel**: Dilarang membuat banner kotak peringatan pink muda transparan dengan tanda seru `(!)`. Gunakan teks helper netral atau `showToast()` bersih.
* **DILARANG Eyebrow Capsule & Dot Berpendar**: Dilarang membungkus subjudul dalam kapsul lonjong melayang dengan titik neon bercahaya `[ • Season XII • ]`. Gunakan tipografi overline murni standar Apple (`font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;`).
* **DILARANG Animasi Radar Ping / Pulsing Glow Ring**: Gunakan titik status padat statis berukuran 6–7px solid (Apple System Status dot), tanpa gelombang berkedip.
* **DILARANG Panah Mentah (`->`, `→`, `&rarr;`)**: Semua ikon penunjuk arah wajib menggunakan inline SVG chevron bertulang ramping (`<polyline points="9 18 15 12 9 6"/>`).
* **DILARANG Emoji di Tombol/UI Utama**: Semua tombol navigasi dan aksi memakai inline SVG bertulang presisi (gaya SF Symbols). Emoji hanya diizinkan di obrolan chat player game.

---

## 6. Mikro-Interaksi & Kepastian Visual (Feedback Loop)

* **Tombol Salin (Copy-to-Clipboard)**:
  * Wajib memberikan umpan balik instan: saat ditekan, tombol berubah warna hijau (`#10b981`), memunculkan teks *"Tersalin"* dan ikon centang SVG selama 1,5 detik sebelum kembali normal.
* **Fisika Tekan Pegas (Apple Spring Press)**:
  * Setiap tombol memiliki efek kenyal saat disentuh: `transform: scale(0.97)` dengan durasi transisi `120ms` menggunakan kurva pegas `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 7. Batas Ukuran & Ergonomi Mobile (Responsive Guardrails)

* **Batas Sentuhan Minimum**: Tombol utama minimal tinggi `40px–44px` agar ramah sentuhan jari di smartphone.
* **Tinggi Modal Pinned Column**:
  * Modal dialog dibatasi maksimal `85dvh–90dvh` dengan tata letak *Flex Column*.
  * Header judul dan tombol aksi bawah wajib terkunci (*pinned*), hanya bagian konten tengah yang boleh bergulir (*overflow-y: auto*).
  * Tombol aksi tidak boleh tenggelam atau hilang di bawah layar HP.
* **Lebar Dialog Modal Ramping**:
  * Lebar dialog modal form akun dibatasi maksimal `375px–380px` (sangat ideal dan proporsional baik di layar mobile maupun monitor desktop lebar).

---

## 8. Checklist Verifikasi Visual Sebelum Selesai (9 Poin Wajib)

Sebelum menyatakan tugas antarmuka / visual selesai, AI wajib memverifikasi:
1. Apakah di Light Mode semua teks, label, dan batas input terbaca pekat, jelas, dan kontras (tanpa kartu abu-abu kusam)?
2. Apakah elemen sejajar (kotak langkah, kartu, input) memiliki tinggi dan proporsi yang simetris 100% tanpa ada yang timpang?
3. Apakah formulir sudah ringkas, to-the-point, dan bebas dari paragraf bertele-tele?
4. Apakah tombol salin memiliki umpan balik visual instan (*"Tersalin"* + centang)?
5. Apakah layout bersih dari elemen AI-slop (tanpa alert pink, tanpa pulsing dot, tanpa panah mentah)?
6. Apakah tombol utama memiliki tinggi minimal 40px–44px yang ramah jari HP?
7. Apakah dialog modal tidak memotong tombol aksi di viewport mobile (375px/390px)?
8. Apakah kode lulus uji `npm run build` dan bebas dari error konsol?
9. Apakah respons diakhiri dengan status reload/restart yang jujur dan jelas?
