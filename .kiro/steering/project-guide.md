---
inclusion: always
---
# WebStore (Laughtale SMP) — Iron Rules

Aturan top-of-mind. Detail map workspace auto-load saat edit `.js`/`.html` (lihat `code-map.md`).
Standar koding penuh 8 perspektif: invoke `#coding-standards`.

## Iron rules (jangan dilanggar)

- **Vanilla stack**: HTML/CSS/JS, tanpa framework, tanpa bundler. Tambah `<script src>` di HTML relevan.
- **Singleton Supabase**: selalu `window._sbClient` (di-init di `js/supabase-sync.js`). Tidak boleh `supabase.createClient()` ulang.
- **Public read-only**: web tidak menulis `leaderboard_sync`/`metrics_history`/`economy_history`. Hanya admin tulis `topup_queue`/`site_config`/`shop_*`.
- **A11y wajib**: honor `prefers-reduced-motion`, kontras WCAG AA, font ≥ 12px, focus visible, color + icon (bukan color-only).
- **Fallback chain monitor.html**: live mcsrvstat → Supabase synced_at < 2 menit (CACHED) → OFFLINE banner.
- **Konstanta** (jangan hardcode di tempat lain): `SUPABASE_URL`, `SUPABASE_KEY`, admin key topup `laughtale-topup`.

## Companion

- Detail web (peta page, JS layer, schema Supabase): `WebStore-main/AI_GUIDE.md`
- Standar koding 8 perspektif: `WebStore-main/CODING_STANDARDS.md` (invoke `#coding-standards`)
- Sisi addon Bedrock (producer data): `d:\BDS\worlds\DWELVE\behavior_packs\AI_GUIDE.md`
