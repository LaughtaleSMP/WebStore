# LAUGHTALE SMP — Coding Standards

**v4.1** · Berlaku untuk semua behavior pack & web dashboard.

> Kode rapat, terbaca dari sintaksisnya. Komentar untuk *why*, bukan *what*.
> Setiap perubahan lulus 8 perspektif pakar di bawah sebelum di-merge.

---

## 0. Prinsip

1. **Efisiensi context AI** — kode padat, nama jelas, no boilerplate.
2. **Self-documenting** — komentar minimal. Naming harus eksplisit.
3. **Comment hanya bila perlu**: invariant non-obvious, alasan trade-off, referensi bug/issue/paper.
4. **Pattern advanced** bila menghemat baris: optional chaining, destructuring, early return, `Map`/`Set`, `Object.freeze`, bitwise ops.
5. **Lulus 8 perspektif pakar** sebelum commit.

---

## Dewan Pakar (8 perspektif)

| # | Pakar | Fokus | Pertanyaan kunci |
|---|---|---|---|
| 🎓 | **Ekonom** (Fisher, Piketty, Thaler) | Money supply, faucet/sink, inflasi | "Bisakah koin muncul/hilang tanpa tracking?" |
| ⚙️ | **Engineer** | TPS, CPU, RAM, DP budget | "Spike? Leak? Per-tick cost?" |
| 🎨 | **Designer** (UX) | Aksesibilitas, responsivitas | "User paham apa yang terjadi?" |
| 💻 | **Programmer** | Arsitektur, maintainability, edge cases | "Robust di semua jalur?" |
| 🔒 | **Security** | Exploit, race, bypass | "Bagaimana player abuse ini?" |
| 🎮 | **Behavioral** (Skinner, Hamari) | Dark pattern, gacha ethics | "Loop sehat (mastery) atau adiktif (FOMO)?" |
| 📊 | **Data Scientist** (Tukey) | Statistical rigor | "Bias outlier? Window dipilih empirical?" |
| 🛡️ | **SRE** (Beyer) | Reliability, SLO, post-mortem | "Apa failure mode? On-call notice gimana?" |

---

## 1. Performa & Stabilitas (Engineer)

### 1.1 Dynamic Property
Limit Bedrock: **1 MB / pack**.
- Tidak ada DP write per-tick. Batch + flush ≥ 5 detik.
- Chunk data > 30 KB.
- Hapus dengan `undefined`.
- Log `getDynamicPropertyTotalByteCount()` saat startup.

```js
const buf = {}; let dirty = false;
const queue = (k, v) => { buf[k] = v; dirty = true; };
system.runInterval(() => {
  if (!dirty) return;
  for (const k in buf) world.setDynamicProperty(k, buf[k]);
  for (const k in buf) delete buf[k];
  dirty = false;
}, 100);
```

### 1.2 CPU & TPS
Target **TPS ≥ 19.5** dengan 10 player.
- Interval rutin ≥ 20 ticks. Operasi berat ≥ 200 ticks.
- TPS-gate: skip jika `getTPS() < 18`.
- Tidak ada `getEntities()` tanpa filter.
- Early return — cek termurah dulu.

### 1.3 RAM & Anti-Leak
- `Map`/`Set` **wajib** punya cleanup `playerLeave` **dan** safety cap (FIFO eviction).
- Cache wajib TTL.
- Jangan simpan entity ref jangka panjang.

### 1.4 Interval Registry
Catat semua `runInterval`/`runTimeout`. Budget ≤ 8 interval/pack.

---

## 2. Ekonomi (Ekonom — Iron Rules)

> Setiap koin masuk harus punya source. Setiap koin keluar harus punya sink.
> Tidak boleh muncul/hilang tanpa tracking.

- `trackFlow(source, ±amount)` untuk semua transaksi.
- Refund ≤ amount yang dibayar. Admin/free → refund = 0.
- **Atomic transaction**: deduct dulu, kasih item, rollback on error.
- **Re-check balance saat action**, bukan saat modal show. Re-read state setelah `await`.
- Validasi input: `Number.isFinite()`, clamp `[0, 2_000_000_000]`, sanitize string.

---

## 3. Keamanan (Security)

| Pattern | Mitigasi |
|---|---|
| Race condition | Re-check balance saat action |
| Negative input | `Math.max(0, n)` + `Number.isFinite()` |
| Free money | `paidWith === "admin" → refund = 0` |
| Overflow | Cap `Math.min(v, 2_147_483_647)` |
| Replay | Nonce / transaction ID |
| Type confusion | `Number()` + `isNaN()` |
| Injection | Sanitize semua user input |

**Anti-dupe checklist** sebelum kasih item/koin:
- Bisa dipanggil berkali-kali? → cooldown / one-time flag.
- Bisa dipanggil offline? → `player.isValid()`.
- Cross-pack lock untuk shared resource.
- Error path wajib rollback.

---

## 4. UI/UX (Designer)

**In-game (Forms):**
- Konfirmasi sebelum action destruktif.
- Saldo before/after ditampilkan.
- Warna: `§a` positif, `§c` negatif, `§e` info.
- Format: `n.toLocaleString("id-ID")`.
- No silent failure.

**Web (Canvas):**
- Detect low-end device → simplify rendering.
- Cap DPR ke 2× di mobile.
- `requestAnimationFrame`, bukan `setInterval`.
- Cache gradient. `shadowBlur ≤ 10` di mobile.
- Pause animasi saat tab hidden.

**Aksesibilitas (minimum):**
- Honor `prefers-reduced-motion` dan `prefers-color-scheme`.
- Kontras teks ≥ WCAG AA (4.5:1 normal, 3:1 large).
- Font ≥ 12px untuk body text. Avoid font < 0.5rem.
- Keyboard navigable: tab order logis, focus indicator visible.
- Color tidak boleh jadi satu-satunya signal (pakai icon + text juga).

---

## 5. Behavioral / Ethical Design (Game Designer)

> Design loop yang *engaging via mastery*, bukan *adiktif via FOMO*.
> Player remaja & anak-anak rentan; default ke konservatif.

### 5.1 Gacha & Probability
- **Disclose rate** di UI (drop rate per rarity, terlihat sebelum pull).
- **Pity counter visible** — player tahu sisa pull ke jaminan.
- Pity wajib ada. Tanpa pity = predatory.
- Tidak boleh "increased rate selama X jam" tanpa display sisa waktu.

### 5.2 Spending & Sink
- **Daily/weekly cap** untuk topup koin/gem (default cap 100k koin/hari).
- Konfirmasi 2-step untuk transaksi > 10× median saldo.
- Tidak ada "near-miss" animation yang menipu (e.g. rolling slot yang sengaja berhenti dekat legendary).

### 5.3 FOMO & Time Pressure
- Limited-time event ≥ 24 jam (jangan < 24h yang memaksa player skip tidur/sekolah).
- Notifikasi tidak boleh menggunakan rasa bersalah ("kamu kehilangan X").
- Daily login bonus boleh, tapi **streak tidak menghukum** (max bonus tetap di hari 7, hari 8 onward = sama).

### 5.4 Anti-Pattern Terlarang
- ❌ Loss aversion exploit: "klaim sekarang atau hilang selamanya".
- ❌ Sunk cost framing: "kamu sudah pull 89× — pull 1 lagi untuk dapat".
- ❌ Variable ratio reinforcement tanpa pity.
- ❌ Hidden currency conversion (gem → coin → premium tanpa rate jelas).

---

## 6. Statistical Rigor (Data Scientist)

> Aggregate dengan jujur. Window/parameter berdasar data, bukan tebakan.

### 6.1 Outlier Handling
- **Winsorize p99** sebelum hitung mean (cap atas + cap bawah, lalu rata-rata).
- Heavy-tailed distribution (saldo, pulls) → laporkan **median + p25/p75**, bukan cuma mean.
- Gini coefficient: jangan clamp ke 0; investigate sumber bias kalau negatif.

### 6.2 Stock vs Flow
- Bedakan **stock** (saldo total, snapshot) dari **flow** (income/sink, rate).
- Jangan ratio antara stock dan flow tanpa konversi unit (per-day, per-week).
- Annualize hanya kalau sample size ≥ 1 cycle penuh.

### 6.3 Window & Smoothing
- EMA alpha harus dijustifikasi: `α = 2/(N+1)` di mana N = lookback window.
- Document window choice di kode: `// 5 sample = 25 menit window (sync interval 5 min)`.
- Min sample size sebelum trust signal: ≥ 30 untuk distribusi, ≥ 7 untuk trend.

### 6.4 Anti-Gaming
- Setiap metric yang dipakai untuk auto-policy harus tahan terhadap:
  - **Wash trading** (kirim koin A→B→A untuk inflate volume).
  - **Smurfing** (split saldo ke alt account).
  - **Coordinate timing** (semua player aktif 1 menit lalu sepi).
- Mitigasi: dedup by IP cluster, weight by account age, gunakan median bukan sum.

---

## 7. Reliability (SRE)

> Asumsikan semua external dependency akan gagal. Plan for it.

### 7.1 SLO per Fitur
Setiap fitur dengan side-effect external wajib punya SLO tertulis di header file:
```js
// SLO: sync success ≥ 99% per 24h. Latency p95 ≤ 5s.
//      Error budget: ~14 min/24h. Beyond → freeze new releases.
```

### 7.2 Failure Mode
- **Circuit breaker**: 3 consecutive failure → pause feature 5 min.
- **Exponential backoff**: 1s → 2s → 4s → 8s, jitter ±25%.
- **Idempotency**: setiap mutation harus aman di-retry (pakai dedup ID).
- **Timeout wajib**: tidak ada `await` tanpa timeout.

### 7.3 Observability
- Log **terstruktur**: `[Module] event=action result=ok/fail player=X latency=Yms`.
- Counter metric naik saat error → dashboard alert.
- Stuck-guard wajib ada: jika sync overlap > 60s, force reset + log warning.

### 7.4 Graceful Degradation
- External call gagal ≠ feature mati. Fallback ke cached/default value.
- `OFFLINE_MODE` flag wajib untuk fitur yang depend ke external service.
- DB write gagal → buffer in-memory, retry next interval (jangan throw ke caller).

### 7.5 Runbook
Setiap fitur dengan SLO punya runbook pendek di `docs/runbook/<feature>.md`:
- Symptom yang user lihat
- Cara verify (log/metric apa yang dicek)
- Mitigation steps (rollback, disable flag, manual intervention)

---

## 8. Arsitektur (Programmer)

### 8.1 Struktur file
- File ≤ 500 baris. Fungsi ≤ 50 baris.
- 1 file = 1 tanggung jawab.
- Magic number → named constant di `config.js`.
- Tidak ada copy-paste logic.
- Tidak ada `console.log` di production.

### 8.2 Naming
```
UPPER_SNAKE_CASE   konstanta
camelCase          fungsi/variabel (verb-first)
_prefixUnderscore  private/internal
is/has/can/should  boolean
```

### 8.3 Error handling
- Setiap operasi yang bisa fail → `try/catch` dengan default fallback.
- Log meaningful: `[Module] action failed for ${name}: ${e.message}`.

### 8.4 Console Output — No Emoji
Bedrock `console.log`/`console.warn` tidak bisa render emoji Unicode (⚠️, 🔴, ✅, dll). Gunakan teks ASCII:
```
❌  console.warn("⚠️ Low yield!");
✅  console.warn("[WARN] Low yield!");
```
Emoji hanya boleh di Markdown docs, bukan di kode runtime.

### 8.5 Cross-pack
DP scoped per-pack. Pakai scoreboard sebagai bridge.

---

## 9. Komentar — kapan boleh

✅ **Tulis** bila:
- Invariant non-trivial (`// uses=1: drop key, not set to 0`).
- Trade-off (`// debounce 5s untuk hindari DP spam`).
- Referensi external (issue, PR, paper, RFC).
- Workaround bug Bedrock API.
- Pre/post-condition fungsi publik.
- **SLO statement** untuk fitur dengan reliability target.

❌ **Jangan** bila:
- Parafrase kode (`// increment counter`).
- "Step 1, 2, 3" — pakai whitespace + nama fungsi.
- Restating types yang sudah jelas.
- ASCII art (`═══`).
- TODO tanpa konteks/owner.

**Header file** maksimal 5 baris: nama, 1 kalimat tujuan, key invariant / SLO.

---

## 10. Pattern Advanced

```js
const v = obj?.field?.sub ?? def;          // optional chaining + nullish
const { a, b = 1 } = src;                  // destructuring
const cnt = (m.get(k) ?? 0) + 1; m.set(k, cnt);
const cx = x | 0;                          // floor untuk x ≥ 0
const cz = x >> 4;                         // chunk dari blok
const CFG = Object.freeze({ MIN: 0 });     // frozen const
const ALLOW = new Set(["a","b"]);          // O(1) lookup
if (!player) return;                       // early return

// Single-pass aggregate
let income = 0, sink = 0;
for (const k in flow) {
  const v = flow[k]; if (!v) continue;
  if (INCOME.has(k)) income += Math.abs(v);
  else if (SINK.has(k)) sink += Math.abs(v);
}
```

---

## 11. Pre-Commit Checklist

**Ekonomi**
- [ ] No money creation tanpa source tracking. Refund ≤ paid. Admin = 0.

**Performa**
- [ ] No DP write per-tick. Interval ≥ 20 ticks. Heavy ≥ 200 + TPS-gate.
- [ ] No `getEntities()` tanpa filter.

**RAM**
- [ ] Map/Set: cleanup `playerLeave` + safety cap. Cache punya TTL.

**Keamanan**
- [ ] Re-check balance saat action. Validasi input. Cooldown per-player.

**UX & Aksesibilitas**
- [ ] Error message jelas. Konfirmasi destruktif. Format angka.
- [ ] Honor `prefers-reduced-motion`. Kontras WCAG AA. Color + icon (not color-only).

**Behavioral**
- [ ] Gacha rate disclosed. Pity visible. Spending cap ada.
- [ ] No FOMO < 24h. No loss-aversion / sunk-cost framing.

**Statistical**
- [ ] Aggregate: median + percentile (bukan cuma mean) untuk heavy-tailed.
- [ ] EMA alpha / window dijustifikasi di komentar.
- [ ] Metric tahan wash-trade / smurf / timing attack.

**Reliability**
- [ ] SLO ditulis di header. Timeout di setiap external call.
- [ ] Circuit breaker / backoff untuk retry. Stuck-guard ada.
- [ ] Fallback graceful saat external gagal.

**Arsitektur**
- [ ] File ≤ 500. Fungsi ≤ 50. Komentar minimal. No `console.log`.

---

## 12. File Layout

```
scripts/
  config.js          konstanta global
  main.js            entry point
  utils.js           pure functions
  db.js              DP/scoreboard persistence
  feature/
    handler.js       event handlers
    logic.js         pure business logic
    ui.js            form builders
  shared/
    cache.js         SafeCache (TTL+cap)
    flow.js          eco flow tracking
    bridge.js        cross-pack scoreboard
docs/
  runbook/           per-feature runbook (SRE)
```

**Dependency rules:**
- `logic.js` tidak boleh import `db.js`/`ui.js`.
- `config.js`/`utils.js` boleh diimport semua.
- `ui.js`/`db.js` hanya dipakai `handler.js`/`main.js`.

---

## 13. Performance Budget

| Metric | Budget | Alert |
|---|---|---|
| DP usage | < 800 KB | > 80% |
| Intervals | ≤ 8/pack | > 10 |
| Per-tick CPU | < 2 ms | > 5 ms |
| Map size | < 500 entries | > 1000 |
| Scoreboard objectives | ≤ 15/pack | > 20 |
| Sync success rate (SLO) | ≥ 99% / 24h | < 95% |
| HTTP p95 latency | ≤ 5s | > 10s |

Startup health check wajib di tiap pack.

---

> Single source of truth. Pelanggaran wajib dijustifikasi di PR description.
> Major change harus lulus review dari ≥ 3 perspektif pakar yang relevan.
