# LAUGHTALE SMP — Coding Standards

**v4.4** · Berlaku untuk semua behavior pack & web dashboard.

> Kode rapat, terbaca dari sintaksisnya. Komentar untuk *why*, bukan *what*.
> Setiap perubahan lulus 8 perspektif pakar + 9 prinsip sebelum di-merge.

**Dokumen terkait:**
- [`CODE_MAP.md`](./CODE_MAP.md) — Peta kode LT-Economy & WebStore
- [`AI_AGENT.md`](./AI_AGENT.md) — Panduan AI: gotcha, decision tree, efisiensi

---

## §0 Prinsip (9 aturan)

1. **Efisiensi context** — kode padat, nama jelas, no boilerplate.
2. **Self-documenting** — komentar minimal, naming eksplisit.
3. **Comment hanya bila perlu**: invariant non-obvious, trade-off, referensi bug.
4. **Pattern advanced** bila hemat baris: optional chaining, destructuring, early return, `Map`/`Set`.
5. **Lulus 8 perspektif pakar** sebelum commit.
6. **Research before code** — pahami existing 100% sebelum sentuh keyboard.
7. **Jujur** — jangan mengarang jawaban. Tidak tahu? Riset dulu, masih buntu? Jujur katakan.
8. **Tuntas 100%** — tidak ada "sisanya tinggal kamu", tidak ada TODO tanpa implementasi.
9. **Transparan & mendidik** — beritahu risiko, jelaskan bahasa sederhana.

---

## §0.5 Metodologi (5 fase)

| Fase | Inti |
|---|---|
| **1. Research** | Baca SEMUA file terkait. Pahami pattern existing (command, permission, cleanup). Jangan asumsi. |
| **2. Plan** | Daftar file yang diubah, titik integrasi, edge case, pertanyaan. |
| **3. Implement** | Ikuti standar §1-§13. File baru/hapus → update `CODE_MAP.md`. |
| **4. Audit** | Self-review: entity validity, Map cleanup, try-catch, input validation, cooldown, startup log, unused imports, permission. |
| **5. Verify** | Jalankan checklist §11. SEMUA harus ✅. |

**Anti-pattern:** Langsung kode tanpa baca existing ❌ · Asumsi pattern tanpa verifikasi ❌ · "Sudah jalan" = production ready ❌

---

## Dewan Pakar (8 perspektif)

| Pakar | Fokus | Pertanyaan kunci |
|---|---|---|
| 🎓 **Ekonom** | Money supply, faucet/sink | Koin muncul/hilang tanpa tracking? |
| ⚙️ **Engineer** | TPS, CPU, RAM, DP | Spike? Leak? Per-tick cost? |
| 🎨 **Designer** | UX, aksesibilitas | User paham apa yang terjadi? |
| 💻 **Programmer** | Arsitektur, edge cases | Robust di semua jalur? |
| 🔒 **Security** | Exploit, race, bypass | Bagaimana player abuse ini? |
| 🎮 **Behavioral** | Dark pattern, gacha ethics | Loop sehat atau adiktif? |
| 📊 **Data Scientist** | Statistical rigor | Bias outlier? Window empirical? |
| 🛡️ **SRE** | Reliability, SLO | Failure mode? Degradation gimana? |

---

## §1 Performa & Stabilitas

**Dynamic Property** — Limit 1 MB/pack.
- No DP write per-tick. Batch + flush ≥ 5 detik. Chunk data > 30 KB. Hapus dengan `undefined`.
- Log `getDynamicPropertyTotalByteCount()` saat startup.

```js
// Throttled DP write pattern
const buf = {}; let dirty = false;
const queue = (k, v) => { buf[k] = v; dirty = true; };
system.runInterval(() => {
  if (!dirty) return;
  for (const k in buf) world.setDynamicProperty(k, buf[k]);
  for (const k in buf) delete buf[k];
  dirty = false;
}, 100);
```

**CPU & TPS** — Target TPS ≥ 19.5 (10 player).
- Interval rutin ≥ 20 ticks. Berat ≥ 200 ticks + TPS-gate (`< 18` → skip).
- No `getEntities()` tanpa filter. Early return — cek termurah dulu.

**RAM** — Map/Set wajib cleanup `playerLeave` + safety cap. Cache wajib TTL. Jangan simpan entity ref jangka panjang.

**Interval** — Catat semua `runInterval`/`runTimeout`. Budget ≤ 8/pack.

---

## §2 Ekonomi (Iron Rules)

> Setiap koin masuk harus punya source. Keluar harus punya sink. Tidak boleh muncul/hilang tanpa tracking.

- `trackFlow(source, ±amount)` untuk semua transaksi.
- Refund ≤ amount dibayar. Admin/free → refund = 0.
- **Atomic**: deduct dulu → kasih item → rollback on error.
- **Re-check balance saat action**, bukan saat modal show. Re-read state setelah `await`.
- Validasi: `Number.isFinite()`, clamp `[0, 2_000_000_000]`, sanitize string.

---

## §3 Keamanan

| Exploit | Mitigasi |
|---|---|
| Race condition | Re-check balance saat action |
| Negative input | `Math.max(0, n)` + `Number.isFinite()` |
| Free money | `paidWith === "admin" → refund = 0` |
| Overflow | `Math.min(v, 2_147_483_647)` |
| Replay | Nonce / transaction ID |
| Type confusion | `Number()` + `isNaN()` |
| Injection | Sanitize semua user input |

**Anti-dupe:** bisa berkali-kali → cooldown · offline → `isValid()` · cross-pack lock · error path → rollback.

---

## §4 UI/UX

### In-game (Forms)
- Konfirmasi sebelum destruktif. Saldo before/after. Format `n.toLocaleString("id-ID")`.
- Warna: `§a` positif, `§c` negatif, `§e` info. No silent failure.

### Emoji & Warna — Aturan Ketat
- **No emoji Unicode** di form (Bedrock render kotak). Gunakan simbol: `★ ✦ ◆ ► ── ├ └ ═`.
- **Tombol**: `§f` label utama, `§8` sub-label. JANGAN `§7` (tidak terbaca). JANGAN emoji.
- Gunakan texture icon: `form.button("§c  PvP Menu\n§r  §8Info", "textures/items/iron_sword")`.

### Web
- Detect low-end → simplify. Cap DPR 2× mobile. `requestAnimationFrame` bukan `setInterval`.
- Cache gradient. `shadowBlur ≤ 10` mobile. Pause saat tab hidden.
- **No emoji** di web UI — gunakan **inline SVG** (stroke-based, `currentColor`, viewBox benar).
- Icon set: Lucide / Heroicons / Phosphor.

### Aksesibilitas
- Honor `prefers-reduced-motion` & `prefers-color-scheme`. Kontras ≥ WCAG AA.
- Font ≥ 12px. Keyboard navigable. Color bukan satu-satunya signal.

### Sound Feedback (Bedrock) — Wajib

> Setiap interaksi bermakna HARUS ada sound. Player harus "mendengar" berhasil/gagal.

| Momen | Sound | Volume |
|---|---|---|
| Buka menu / NPC | `random.pop` / `random.click` | 0.3-0.5 |
| Aksi berhasil | `random.orb` / `note.pling` | 0.5-0.7 |
| Aksi gagal | `note.bass` / `mob.villager.no` | 0.5-0.7 |
| Pembelian berhasil | `random.levelup` | 0.7-1.0 |
| Event besar (boss, border) | Layered SFX 3-5 sound | 1.0-2.0 |

Variasikan pitch `0.8-1.3`. No spam per-tick. Layered SFX pakai `runTimeout` stagger.

---

## §5 Behavioral / Ethical Design

> Design loop *engaging via mastery*, bukan *adiktif via FOMO*. Player remaja rentan; default konservatif.

- **Gacha**: disclose rate di UI, pity counter visible, pity wajib ada.
- **Spending**: daily/weekly cap, konfirmasi 2-step transaksi > 10× median saldo, no "near-miss" menipu.
- **FOMO**: event ≥ 24 jam, no guilt notification, streak tidak menghukum (max bonus hari 7).
- **Dilarang**: loss aversion exploit ❌ · sunk cost framing ❌ · variable ratio tanpa pity ❌ · hidden currency conversion ❌

---

## §6 Statistical Rigor

- **Outlier**: winsorize p99. Heavy-tailed → median + p25/p75. Gini: jangan clamp ke 0.
- **Stock vs flow**: bedakan snapshot vs rate. Jangan ratio tanpa konversi unit.
- **Window**: EMA α dijustifikasi (`α = 2/(N+1)`). Min sample ≥ 30 distribusi, ≥ 7 trend.
- **Anti-gaming**: tahan wash trading, smurfing, coordinate timing. Mitigasi: dedup IP, weight by age, median.

---

## §7 Reliability (SRE)

- **SLO**: tulis di header file (`// SLO: sync ≥ 99%/24h, p95 ≤ 5s`).
- **Failure**: circuit breaker (3 fail → pause 5 min), exponential backoff + jitter, idempotency, timeout wajib.
- **Observability**: log terstruktur `[Module] event=X result=ok player=Y`. Stuck-guard: overlap > 60s → reset.
- **Degradation**: external gagal ≠ mati. Fallback cached/default. `OFFLINE_MODE` flag. Buffer in-memory on fail.
- **Runbook**: symptom, verify steps, mitigation di `docs/runbook/<feature>.md`.

---

## §8 Arsitektur

- File ≤ 500 baris. Fungsi ≤ 50 baris. 1 file = 1 tanggung jawab.
- Magic number → `config.js`. No copy-paste. No `console.log` production.
- Naming: `UPPER_SNAKE` konstanta · `camelCase` fungsi · `_prefix` private · `is/has/can` boolean.
- Error: `try/catch` + fallback. Log: `[Module] action failed for ${name}: ${e.message}`.
- **Console no emoji**: `console.warn("[WARN] text")` bukan `console.warn("⚠️ text")`.
- DP scoped per-pack → scoreboard bridge untuk cross-pack.
- **Entity ref safety**: cek `entity?.isValid` sebelum akses di `system.run()`.

---

## §9 Komentar

✅ Invariant non-trivial · trade-off · referensi external · workaround Bedrock · pre/post-condition · SLO.
❌ Parafrase kode · "Step 1,2,3" · restating types · ASCII art · TODO tanpa konteks.
Header file max 5 baris.

---

## §10 Pattern Advanced

```js
const v = obj?.field?.sub ?? def;          // optional chaining + nullish
const { a, b = 1 } = src;                  // destructuring
const cnt = (m.get(k) ?? 0) + 1; m.set(k, cnt);
const cx = x | 0;                          // floor (x ≥ 0)
const cz = x >> 4;                         // chunk dari blok
const CFG = Object.freeze({ MIN: 0 });     // frozen const
const ALLOW = new Set(["a","b"]);          // O(1) lookup
if (!player) return;                       // early return
```

---

## §11 Pre-Commit Checklist

**Research**: file terkait dibaca ✓ pattern existing diikuti ✓ addon di-audit ✓ no unused imports ✓ entity ref `isValid` ✓ Map/Set cleanup ✓ startup log ✓ CODE_MAP updated ✓

**Ekonomi**: no money creation tanpa tracking ✓ refund ≤ paid ✓ admin = 0 ✓

**Performa**: no DP per-tick ✓ interval ≥ 20t ✓ heavy ≥ 200t + TPS-gate ✓ no unfiltered getEntities ✓

**RAM**: Map/Set cleanup + cap ✓ cache TTL ✓

**Keamanan**: re-check balance saat action ✓ validasi input ✓ cooldown per-player ✓

**UX**: error jelas ✓ konfirmasi destruktif ✓ format angka ✓ WCAG AA ✓ sound feedback ✓

**Behavioral**: rate disclosed ✓ pity visible ✓ spending cap ✓ no FOMO < 24h ✓

**Statistical**: median+percentile ✓ EMA justified ✓ anti-gaming ✓

**Reliability**: SLO header ✓ timeout ✓ circuit breaker ✓ fallback graceful ✓

**Arsitektur**: file ≤ 500 ✓ fungsi ≤ 50 ✓ no console.log ✓

**Risiko**: semua risiko dilaporkan ✓ bahasa sederhana ✓ breaking change di-warn ✓

---

## §12 File Layout

```
scripts/
  config.js       konstanta global
  main.js         entry point
  utils.js        pure functions
  db.js           DP/scoreboard persistence
  feature/
    handler.js    event handlers
    logic.js      pure business logic (no import db/ui)
    ui.js         form builders
  shared/
    cache.js      SafeCache (TTL+cap)
    flow.js       eco flow tracking
    bridge.js     cross-pack scoreboard
```

---

## §13 Performance Budget

| Metric | Budget | Alert |
|---|---|---|
| DP usage | < 800 KB | > 80% |
| Intervals | ≤ 8/pack | > 10 |
| Per-tick CPU | < 2 ms | > 5 ms |
| Map size | < 500 entries | > 1000 |
| Scoreboard obj | ≤ 15/pack | > 20 |
| Sync success (SLO) | ≥ 99%/24h | < 95% |
| HTTP p95 latency | ≤ 5s | > 10s |

---

> Single source of truth. Pelanggaran dijustifikasi di PR description.
> Lanjut ke: [`CODE_MAP.md`](./CODE_MAP.md) · [`AI_AGENT.md`](./AI_AGENT.md)
