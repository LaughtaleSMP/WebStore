# LAUGHTALE SMP — AI Agent Rules

**v4.4** · Panduan khusus untuk AI coding assistant.

> Companion: [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) · [`CODE_MAP.md`](./CODE_MAP.md)
>
> **Char budget**: File ini ≤ **12.000 karakter**.

---

## 16. AI Context Hints

> Gotcha, decision tree, pola kesalahan — agar kode production-ready di pass pertama.

### 16.1 Bedrock Script API — Gotcha Registry

| # | Gotcha | Solusi |
|---|---|---|
| G1 | `afterEvents` read-only — mutasi entity gagal | `system.run()` |
| G2 | Entity ref stale (despawn/unload) | `entity?.isValid` sebelum akses |
| G3 | `console.log` tidak render emoji | `[TAG]` ASCII |
| G4 | Form button `§7` invisible | `§f` label + `§8` sub-label |
| G5 | Emoji di form → kotak □ | Texture icon path |
| G6 | DP limit 1 MB/pack, gagal silent | `getDynamicPropertyTotalByteCount()` |
| G7 | `getPlayers()` tanpa filter mahal per-tick | Cache / `getPlayers({tags:[]})` |
| G8 | `beforeEvents` bisa cancel tapi terbatas | Default: `afterEvents` + `system.run()` |
| G9 | `applyKnockback` throw jika entity mati | Try-catch |
| G10 | Command registration hanya di startup | Semua `registerCommand` di startup block |
| G11 | `spawnParticle` fire-and-forget | Crossfade pattern: overlap + Date.now() cooldown (§16.4) |
| G12 | Client cache RP lama | Bump `manifest.json` version `[x,y,z+1]` + **sync** `world_resource_packs.json` |

### 16.2 Pattern Decision Tree

**Admin command:**
```
Admin saja? → customCommandRegistry + permissionLevel: Admin
Semua?     → customCommandRegistry + permissionLevel: Any
```

**Simpan data:**
```
Tiap tick? → Map in-memory + flush ≥ 200 ticks (BUKAN DP)
Per-player → player_dp.js (pGet/pSet)
Global kecil → world.setDynamicProperty langsung
Global besar → dp_manager.js + chunking
```

**Event listener:**
```
Sudah ada? (cek §14.3) → Tambah logic di file EXISTING
Belum?                 → Buat baru, catat di §14.3
```

**NPC-gated features (Store, Auction, Gacha):**
```
Entity: lt:market_npc (25 skins, standar + 3D custom)
  BP: entities/market_npc.json | RP: entity/market_npc.entity.json
  Render: Array.geos + Array.skins indexed by query.property('lt:skin')
Interact: beforeEvents.playerInteractWithEntity + cancel → ActionForm
Skin: /lt:npc_skin → ActionForm picker → setProperty('lt:skin', idx)
Export function? → Wrapper (openAuctionNPC, etc) + pre-checks
Sound? → Wajib sound feedback setiap interaksi (§4.3)
```

**Map/Set baru:** Wajib: ① cleanup `playerLeave` ② safety cap ③ TTL (jika cache).

### 16.3 Common AI Mistakes

| # | Kesalahan | Yang Benar |
|---|---|---|
| M1 | `scriptevent` untuk command | `customCommandRegistry` |
| M2 | Global cooldown `let lastMs` | Per-player Map: `_cd.set(player.id, now)` |
| M3 | Lupa `playerLeave` cleanup | Export `cleanup(pid)` + panggil di playerLeave |
| M4 | Import tidak dipakai | Hapus setelah refactor |
| M5 | Akses entity di `system.run()` tanpa cek | `if (!entity?.isValid) return;` |
| M6 | `catch { }` silent | `catch { /* reason */ }` minimal comment |
| M7 | DP write tanpa try-catch | Wrap `setDynamicProperty` |
| M8 | Asumsi API shape | Optional chaining: `ev.damageSource?.cause` |
| M9 | Emoji di form button | Texture icon path |
| M10 | `console.log` production | `console.warn` untuk warning, hapus debug |
| M11 | Edit RP tanpa bump version | Bump `version[2]++` + sync `world_resource_packs.json` |

### 16.4 Quick Reference — Copy-Paste Patterns

```js
// Admin command (di startup block)
registry.registerCommand(
  { name: "lt:feature", description: "Desc",
    permissionLevel: CmdLevel.Admin, cheatsRequired: false },
  (origin) => {
    const player = origin.sourceEntity;
    if (!player || typeof player.sendMessage !== "function") return;
    system.run(() => doSomething(player));
    return { status: 0 };
  }
);

// Safe entity mutation
system.run(() => {
  if (!entity?.isValid) return;
  try { entity.applyKnockback(x, z, h, v); } catch { }
});

// Per-player cooldown
const _cd = new Map();
const CD_MS = 5_000;
function checkCD(pid) {
  const now = Date.now();
  if (now - (_cd.get(pid) ?? 0) < CD_MS) return false;
  _cd.set(pid, now); return true;
}
export function cleanup(pid) { _cd.delete(pid); } // WAJIB di playerLeave

// Startup log
console.log("[ModuleName] Loaded: key1=val1 key2=val2");

// ── Anti-Flicker Particle Crossfade ──
// spawnParticle() fire-and-forget. Crossfade = Date.now() cooldown + overlap.
// CONSTRAINT: lifetime < 2 × cooldown (maks 2 particle overlap)
// Recommended: overlap=3s, k=0.083, dip=1.7%, life=8s (cd=5s)
//
// Particle JSON tinting:
//   "color": [1,1,1, "math.clamp(math.min(
//     v.particle_age * K, (v.life_time - v.particle_age) * K
//   ), 0, ALPHA_MAX)"]
//
// Script cooldown (TPS-independent):
//   if (Date.now() - (_map.get(name)||0) < COOLDOWN_MS) continue;
//   _map.set(name, Date.now());
```

---

## 17. AI Agent Efficiency

> **Minimum input, maximum output, zero rework.**

### 17.1 Strategi Baca

**Urutan (efisiensi, BUKAN penghematan):**
1. CODE_MAP.md → gambaran besar
2. AI_AGENT.md §16 → gotcha & pattern
3. `grep_search` → lokasi spesifik
4. `view_file` → file relevan (**FULL** jika perlu)
5. File terkait → baca SEMUA dependency

**Aturan:**
- Baca selengkap yang dibutuhkan — jangan skip demi hemat token.
- Parallelkan `view_file` independen.
- Baca config.js dulu sebelum main.js.
- Ragu relevan? → **baca** (lebih baik lebih daripada kurang).
- **Dilarang:** skip file karena "terlalu besar" atau "sudah cukup tahu".

### 17.2 Strategi Tulis — Satu Pass, Tuntas

| Situasi | ❌ Salah | ✅ Benar |
|---|---|---|
| Edit 3 tempat 1 file | 3× `replace` terpisah | 1× `multi_replace` batch |
| File baru | Write → fix → fix | Rencanakan → tulis benar sekali |
| Refactor import | Edit A, lupa B | Semua file sekaligus |
| Fitur baru | Setengah jadi | Lengkap termasuk edge case |

**Sebelum tulis:** cek §16.1→§16.2→§16.3→§16.4.
**Setelah tulis:** verifikasi semua file diubah, import/export konsisten.

### 17.3 Tool Cost Matrix

| Tool | Cost | Kapan |
|---|---|---|
| `grep_search` | 🟢 | Cari lokasi, cek pattern |
| `list_dir` | 🟢 | Cek struktur |
| `view_file` ≤100 baris | 🟢 | Targeted setelah grep |
| `view_file` 800 baris | 🟡 | File kecil / first-time |
| `write/replace` | 🟡 | Pastikan benar sebelum tulis |
| `multi_replace` | 🟢 | Batch banyak edit 1 file |
| `run_command` | 🔴 | Hanya test/build |
| `search_web` | 🔴 | Info tidak ada di codebase |
| `browser_subagent` | 🔴 | Visual verification saja |

### 17.4 Ketuntasan — 100% atau Belum Selesai

**Tuntas = semua terpenuhi:**
1. Kode ditulis DAN diverifikasi
2. Semua file yang perlu diubah SUDAH diubah
3. Import/export konsisten
4. Checklist §11 dijalankan
5. CODE_MAP.md di-update jika ada file baru
6. Edge cases ditangani

**Aturan:**
- Jangan serahkan sisa ke user (kecuali butuh keputusan).
- Jangan tulis TODO tanpa implementasi.
- Context penuh → rangkum progress + sisa PERSIS.

### 17.5 Kejujuran

**Urutan wajib sebelum "tidak tahu":**
1. `.agents/rules/` → 2. `grep_search` → 3. `view_file` → 4. `search_web` → 5. Knowledge Items

Masih tidak yakin → jujur: *"Sudah cek [X,Y,Z], tidak menemukan. Kemungkinan [A], perlu verifikasi."*

**Terlarang:** mengarang API, asumsi tanpa verifikasi, confident tapi salah.

### 17.6 Checklist Efisiensi

```
□ Sudah baca CODE_MAP.md?
□ Sudah baca AI_AGENT.md §16?
□ Rencana edit lengkap? (semua file + perubahan)
□ Bisa selesai 1 pass?
□ Respons ringkas? (tabel > paragraf)
```

> **Catatan:** Rules komunikasi (§3), reload/restart (§4), risiko (§8) ada di `GEMINI.md` — tidak diduplikasi di sini.
