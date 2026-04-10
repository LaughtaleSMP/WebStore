# Laughtale SMP v5 — Deployment Guide

## Struktur Folder
```
/  (root server)
├── index.html          ← file utama
├── manifest.json       ← PWA (Add to Home Screen)
├── css/
│   ├── base.css
│   ├── nav.css
│   ├── hero.css
│   ├── status.css
│   ├── skeleton.css
│   ├── sections.css
│   ├── responsive.css
│   └── improvements.css
├── js/
│   ├── nav.js
│   ├── server-status.js
│   ├── ui.js
│   ├── typewriter.js
│   ├── back-to-top.js
│   ├── shop-config.js     ← milik kamu (tidak diubah)
│   ├── shop.js            ← milik kamu (tidak diubah)
│   ├── particles.js       ← milik kamu (tidak diubah)
│   ├── animations.js      ← milik kamu (tidak diubah)
│   └── feat-icons-enhanced.js ← milik kamu (tidak diubah)
└── assets/              ← milik kamu (tidak diubah)
    ├── favicon.svg
    ├── logo.jpeg
    ├── Laughtale-Qris.jpeg
    └── ...
```

## Upload
Upload SEMUA isi folder ini ke root server.
File milik kamu (shop-config.js, shop.js, particles.js, animations.js,
feat-icons-enhanced.js, dan folder assets/) tidak perlu diubah.

## Perubahan v5
- index.html dipecah: 196 KB → 68 KB (65% lebih ringan)
- Typewriter: loop selamanya, hapus "Season XII"
- Skeleton shimmer pada live-stat-cards & player-list
- CSS modular (8 file)
- JS modular (5 file baru)
- PWA manifest.json
