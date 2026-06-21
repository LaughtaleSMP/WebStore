# AI_GUIDE — WebStore (Laughtale SMP)

> **Tujuan file ini:** AI baca ini dulu sebelum menyentuh kode. Berisi peta singkat
> halaman, script, schema Supabase, dan kontrak data dari behavior pack.
> Companion: `d:\BDS\worlds\THRIVEN\behavior_packs\AI_GUIDE.md`.
>
> Standar koding & dewan pakar 8-perspektif: lihat `CODING_STANDARDS.md`.

---

## 📋 Document Metadata

**Last Updated:** 2026-06-07  
**Auto-sync Status:** ✅ Enabled (via Kiro hooks)  
**Trigger Files:**
- `js/supabase-sync.js` → Singleton client changes
- `admin/js/admin-config.js` → Admin config module changes
- `index.html`, `admin/index.html` → Page structure changes
- Hook: `sync-web-docs` + `post-task-doc-check`

**Update Protocol:**
1. Hooks auto-trigger AI review saat file kunci berubah
2. AI update bagian relevan (halaman baru, script baru, schema changes)
3. Iron rules tetap minimal di `project-guide.md`, detail di sini
4. Changelog di bawah mencatat perubahan major

### 📝 Recent Changes
```
2026-06-07: Added auto-sync metadata and hooks system
            - Hook sync-web-docs: triggers on supabase-sync.js/admin-config/index.html
            - Hook post-task-doc-check: safety net after any task
```

---

## 0. Aturan emas saat edit

1. **Vanilla stack** — HTML/CSS/JS tanpa framework, tanpa bundler. Tambah `<script src="…">` di file HTML yang relevan.
2. **Singleton Supabase** — selalu pakai `window._sbClient` (di-init di `js/supabase-sync.js`). Jangan `supabase.createClient()` lagi di file lain → akan trigger warning "Multiple GoTrueClient".
3. **Anonymous read** — public site pakai `SUPABASE_KEY` publishable (read-only RLS). Admin panel pakai key yang sama tapi authenticated session.
4. **Data flow read-only dari sisi web public**: web TIDAK menulis ke `leaderboard_sync`/`metrics_history`/`economy_history` — hanya BDS yang menulis. Web hanya menulis ke `topup_queue` (admin) & `site_config`/`shop_*` (admin).
5. **Lulus checklist `CODING_STANDARDS.md §11`** — termasuk a11y (`prefers-reduced-motion`, kontras WCAG AA).

---

## 1. Peta workspace

```
WebStore-main/
├── AI_GUIDE.md            ← (file ini)
├── CODING_STANDARDS.md    ← single source of truth (8 perspektif)
├── README.md              ← ringkasan tech stack
├── index.html             ← landing
├── status.html            ← server status & info
├── monitor.html           ← live radar + performance dashboard
├── economy.html           ← analytics ekonomi (gacha LB, log, trend, tax)
├── topup.html             ← redirect WhatsApp untuk topup
├── logs.html              ← raw log viewer
├── dokumentasi.html       ← galeri foto via Google Drive
├── login.html             ← login admin
├── manifest.json          ← PWA manifest
├── sw-monitor.js          ← service worker (monitor.html offline)
├── cleanup_economy_history.sql ← maintenance SQL
├── css/                   ← public stylesheets
├── js/                    ← public scripts (lihat §3)
├── admin/                 ← admin panel (HTML + js + css)
├── assets/                ← gambar, logo, font
└── libs/                  ← vendor lib (Chart.js dll)
```

---

## 2. Halaman publik & script utamanya

| Halaman | Tujuan | Script utama |
|---|---|---|
| `index.html` | Landing + shop + community | `js/supabase-sync.js`, `js/shop.js`, `js/server-status.js`, `js/order-feed.js`, `js/banner-popup.js` |
| `status.html` | Status server detail | `js/status-page.js`, `js/server-status.js` |
| `monitor.html` | Live radar + TPS chart + DP usage + entity heatmap | `js/monitor-page.js`, `sw-monitor.js` |
| `economy.html` | Wealth analytics, log, gacha LB, tax, trend, top items | `js/economy-page.js` |
| `topup.html` | Redirect WA topup gem/koin | `js/topup-page.js`, `js/shop-config.js` |
| `logs.html` | Raw log viewer (per kategori) | `js/logs-page.js` |
| `dokumentasi.html` | Galeri Google Drive | (inline) |
| `login.html` | Login admin via Supabase Auth | (inline + admin/js/supabase-config.js) |

---

## 3. JS layer publik (`js/`)

| File | Peran |
|---|---|
| `supabase-sync.js` | **Master**: init `window._sbClient`, fetch `site_config`, apply ke DOM (server IP, season, MOTD, maintenance), fetch `shop_items` & re-render grid |
| `shop.js` | Build shop card (animasi SVG, modal pesan, generate WA message) |
| `shop-config.js` | Fallback config item (kalau Supabase fail) |
| `shop-supabase.js` | Sengaja dikosongkan — fetch dipindah ke `supabase-sync.js` |
| `shop-catalog.js` / `store-catalog.js` | Hardcoded katalog backup |
| `server-status.js` | Poll `mcsrvstat.us` API tiap N detik |
| `monitor-page.js` | Radar canvas, fetch `leaderboard_sync.server_metrics`, fallback chain mcsrvstat → Supabase → OFFLINE banner |
| `economy-page.js` | Fetch `leaderboard_sync.gacha_lb/bank_log/auction_log/gacha_log/topup_log/disc_codes`, render KPI/wealth/inflation/Gini/top holders/pricing/gacha |
| `status-page.js` / `topup-page.js` / `logs-page.js` | Page-specific renderer |
| `order-feed.js` / `banner-popup.js` / `event-popup.js` | Floating notification & pop-up |
| `back-to-top.js` / `auto-refresh.js` / `loading.js` / `nav.js` / `page-nav.js` | UX util |
| `animations.js` / `particles.js` / `typewriter.js` / `feat-icons-enhanced.js` | Visual effects (honor `prefers-reduced-motion`) |
| `hero-utils.js` | Hero section helpers (IP copy, count-up) |
| `auth.js` | Auth helper (login redirect) |

---

## 4. Admin panel (`admin/`)

| File | Peran |
|---|---|
| `admin/index.html` | Single-page admin dashboard (tabs: Config, Shop, Topup, WA, Finance, Users, Server Status, Activity Log, Banner) |
| `admin/js/admin-init.js` | Init `sb` client (persistent session), state global |
| `admin/js/admin-auth.js` | Login/logout, role check |
| `admin/js/admin-config.js` | CRUD `site_config` (server_ip, season, MOTD, maintenance flag) |
| `admin/js/admin-shop.js` | CRUD `shop_items` (item, harga, badge, kategori) |
| `admin/js/admin-topup.js` | Push ke `topup_queue` (BDS poller akan apply) |
| `admin/js/admin-wa.js` / `admin-wa-template.js` | Manage admin WA list & template pesan |
| `admin/js/admin-finance.js` / `admin-finance-v2.js` | Dashboard pendapatan, chart pie/line/bar |
| `admin/js/admin-users.js` | Manage user roles via temp-client |
| `admin/js/admin-server-status.js` | Live status untuk admin |
| `admin/js/admin-orders.js` | Pesanan masuk dari shop public |
| `admin/js/admin-banner.js` | Atur banner promo |
| `admin/js/admin-activity-log.js` | Log aksi admin (audit trail) |
| `admin/js/admin-collapse.js` / `admin-enhance.js` / `admin-nav.js` | UI util |

---

## 5. Supabase schema (yang dipakai di kode)

> Hosted at `https://jlxtnbnrirxhwuyqjlzw.supabase.co`. Anon key publishable.

### `site_config` (key-value)
- `server_ip`, `server_name`, `server_type`, `season`, `seed`, `season_desc`
- `maintenance_mode` (`"true"`/`"false"`), `maintenance_message`, `maintenance_eta`, `maintenance_contact`
- `motd_active`, `motd_text`, `motd_btn`, `motd_url`, `motd_type` (info/success/warning/error)
- `whatsapp_admins` (JSON array), `whatsapp_gem_admins` (JSON array)
- `servers` (JSON array — multi-server support di monitor.html)

### `shop_items` (e-commerce)
Field: `id, name, emoji, category, price, original_price, description, features, badge, badge_color, stock, requires_design, needs_username, can_buy_multiple, max_quantity, images, active, sort_order`.

### `shop_config`
Single row `key='main'`, `value` JSON: `{ admins, gemAdmins, categories, title, subtitle }`.

### `leaderboard_sync` (in-game ↔ web bridge — **paling penting**)
Single row `id='current'`. **Only BDS writes**, all web pages read.

| Kolom | Source code | Isi |
|---|---|---|
| `week_start`, `time_left_ms` | `sync.js` `_readWeeklyLb()` | Status weekly LB |
| `entries` | `sync.js` | Top 10 weekly leaderboard |
| `online_players` | `sync.js` `_gatherOnlineNames()` | Array nama online |
| `gacha_lb` | `sync_gacha.js` | Per-rarity LB + summary (gini, p25/p75, dst) |
| `bank_log`, `auction_log`, `gacha_log`, `topup_log` | `sync.js` `_readEconLogs()` | 50 entri terakhir per kategori |
| `disc_codes` | `sync.js` | Active discount codes |
| `server_metrics` | `sync_metrics.js` + `cachedFullExtras` | TPS, entity count per dim, dp_breakdown, hotspots, weather, world_time, player_details, players_per_dim, etc. **Update setiap 5 detik via micro-sync PATCH.** |
| `synced_at` | `sync.js` | ISO timestamp last write |

### `topup_queue` (admin → BDS)
Field: `player_name, amount, currency (coin/gem), status (pending/done/failed), admin_key, admin_note, ts, completed_at`.
- Web admin INSERT row dengan `status=pending` & `admin_key='laughtale-topup'`.
- BDS poller (`sync_topup.js`) GET pending tiap 30 detik, validate cap harian, apply ke scoreboard, PATCH `status=done`.

### `metrics_history` (time-series)
Insert dari BDS `sync_history.pushMetricsHistory()` setiap full sync. Dipakai grafik trend di `monitor.html`/`economy.html`.

### `economy_history` (time-series)
Insert dari BDS `sync_history.pushEcoHistory()` dengan flow snapshot + price index. Dipakai trend chart di `economy.html`.

### `weather_history` (time-series, retention 90d)
Insert dari BDS `sync_history.pushWeatherHistory()` setiap transisi cuaca (`clear`/`rain`/`thunder`). Field: `wx`, `start_ts`, `dur_ms`, `tod` (0=pagi..3=malam dari world_time start), `dow`, `world_day`. Dibaca `js/monitor-forecast.js` (anon SELECT) untuk Markov-based forecasting di Atmosphere card. Filter outlier: durasi <30s atau >2 jam di-skip (anti `/weather` spam & server-pause).

### `auth.users` + custom `app_users`
Untuk login admin. Role di `app_users.role` (`admin`, `viewer`, dst).

---

## 6. Alur read public site

```
[load index.html]
  ↓
DOMContentLoaded
  ↓
supabase.js SDK (CDN)
  ↓
js/supabase-sync.js IIFE:
  1. Wait Supabase ready
  2. window._sbClient = createClient(URL, KEY)
  3. fetch('site_config') → cfg{}
  4. applyServerConfig(cfg, sc)  → DOM update (IP, season, seed)
  5. cfg.maintenance_mode === 'true' → showMaintenance()
  6. cfg.motd_active === 'true' → showMOTD()
  7. fetch('shop_items') + 'shop_config'
  8. reRenderShopCards(mapped, categories) → grid
  9. dispatchEvent('shopItemsReady') + 'shopDataReady'

[shop.js menerima event]
  ↓
shopBuildCard() per item → animasi SVG
shopOpenModal() → generate WA message → window.open()
```

---

## 7. Alur monitor.html (live radar)

```
loadConfig()  → fetch 'servers' atau fallback 'server_ip'
  ↓
fetchStatus() (interval ~10s)
  ↓
fetchBDSData() → GET leaderboard_sync?id=eq.<sync_id>&select=online_players,synced_at,server_metrics
  ↓
applyBDSMetrics(m)  → render radar canvas, TPS chart, entity heatmap, etc.
  ↓
Fallback chain (CODING_STANDARDS §7.4):
  live mcsrvstat → Supabase synced_at < 2 menit ('CACHED') → OFFLINE banner
```

Semua fetch lewat circuit breaker manual (`_cb` state) sesuai `CODING_STANDARDS §7.2`.

---

## 8. Alur economy.html (analytics)

```
DOMContentLoaded
  ↓
restore localStorage cache (CACHE_KEY='eco_data', TTL 90s)
  ↓
fetchAll()
  ↓
GET leaderboard_sync?id=eq.current&select=gacha_lb,bank_log,auction_log,gacha_log,topup_log,disc_codes,synced_at
  ↓
renderAnalytics() → KPI, Wealth (Gini), Inflation, Tx Volume, Top Holders, Pricing, Gacha LB
renderLogStats() / renderLogs() / renderDiscCodes() / renderTax()
fetchTrend() → metrics_history time-series → drawTrendChart()
```

Semua aggregate ikut `CODING_STANDARDS §6` — winsorize, median + p25/p75, justify EMA window.

---

## 9. Aturan tambah halaman / fitur

1. **HTML**: tambah file `*.html` di root. Include CSS dari `css/` dan script dari `js/`.
2. **Script baru**: letakkan di `js/<topic>-page.js`. **Wajib** include `supabase-sync.js` dulu untuk pakai `window._sbClient`.
3. **Read data BDS**: query `leaderboard_sync` (atau history table). Jangan baca DP langsung — DP scoped ke pack.
4. **Tulis data**: hanya admin panel boleh INSERT/UPDATE. Public page = read-only.
5. **Admin tab baru**: edit `admin/index.html` (sidebar + section), tambah `admin/js/admin-<feature>.js`, register di `admin-init.js` kalau perlu state global.
6. **A11y**: honor `prefers-reduced-motion`, kontras AA, font ≥ 12px, focus indicator visible.
7. **PWA**: kalau page perlu offline (`monitor.html`), update `sw-monitor.js` cache list.

---

## 10. Diagnostic cepat

| Gejala | Cek pertama |
|---|---|
| Halaman blank, console error "Multiple GoTrueClient" | Ada `createClient()` ganda — pastikan semua pakai `window._sbClient` |
| Shop kosong di index | `shop_items` table empty / RLS block. Cek di Supabase dashboard. |
| `monitor.html` OFFLINE banner padahal server hidup | `synced_at` > 2 menit. BDS sync mati / `OFFLINE_MODE=true` di addon |
| Topup admin tidak masuk game | `topup_queue` row tetap `status=pending`. BDS poller mati / cap harian (`DAILY_CAP` di `sync_topup.js`) tercapai |
| Maintenance banner muncul terus | `site_config.maintenance_mode === 'true'` — toggle di admin panel |
| Chart kosong di economy.html | `leaderboard_sync.gacha_lb` parse fail / `summary.coin` null. Cek `safeParse()` log |

---

## 11. Konstanta penting (jangan hardcode di tempat lain)

- `SUPABASE_URL` = `https://jlxtnbnrirxhwuyqjlzw.supabase.co`
- `SUPABASE_KEY` (publishable) = `sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq`
- `SUPABASE_KEY` (anon, untuk monitor-page.js & file lama) = JWT yang exp 2091 (lihat `monitor-page.js` line ~6)
- Server IP fallback default = `laughtale.my.id:19214`
- Admin key topup = `laughtale-topup` (di `admin/js/admin-topup.js` & addon `sync_topup.js`)

---

## 12. Cross-link

- Sisi addon (producer data): `d:\BDS\worlds\THRIVEN\behavior_packs\AI_GUIDE.md`
- Standar koding 8-perspektif: `CODING_STANDARDS.md`
- Tech stack & deployment: `README.md`
- SQL maintenance: `cleanup_economy_history.sql`
