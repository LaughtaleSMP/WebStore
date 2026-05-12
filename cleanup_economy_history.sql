-- ═══════════════════════════════════════════════════════════
-- Cleanup economy_history — Hapus snapshot anomali
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- STEP 1: PREVIEW dulu (lihat apa yang akan dihapus, TANPA menghapus)
-- ----------------------------------------------------------
WITH stats AS (
  SELECT
    percentile_cont(0.25) WITHIN GROUP (ORDER BY coin_total) AS q1,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY coin_total) AS q3
  FROM economy_history
  WHERE coin_total > 0
),
bounds AS (
  SELECT
    q1 - 5 * (q3 - q1) AS lo,
    q3 + 5 * (q3 - q1) AS hi
  FROM stats
)
SELECT
  id, ts, player_count, coin_total, coin_avg, coin_median
FROM economy_history, bounds
WHERE coin_total < bounds.lo OR coin_total > bounds.hi
ORDER BY ts DESC;


-- STEP 2: HAPUS snapshot anomali (pakai IQR × 5 fence, sama dgn chart)
-- ----------------------------------------------------------
-- ⚠ PASTIKAN review hasil STEP 1 dulu, baru jalankan ini!
WITH stats AS (
  SELECT
    percentile_cont(0.25) WITHIN GROUP (ORDER BY coin_total) AS q1,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY coin_total) AS q3
  FROM economy_history
  WHERE coin_total > 0
),
bounds AS (
  SELECT
    q1 - 5 * (q3 - q1) AS lo,
    q3 + 5 * (q3 - q1) AS hi
  FROM stats
)
DELETE FROM economy_history
USING bounds
WHERE coin_total < bounds.lo OR coin_total > bounds.hi;


-- STEP 3: HAPUS duplikat dekat (snapshot dalam 30 detik dari snapshot sebelumnya)
-- ----------------------------------------------------------
-- Penyebab utama anomali: dua BDS aktif bersamaan → dua insert berdekatan
WITH dups AS (
  SELECT
    id,
    ts,
    LAG(ts) OVER (ORDER BY ts) AS prev_ts
  FROM economy_history
)
DELETE FROM economy_history
WHERE id IN (
  SELECT id FROM dups
  WHERE prev_ts IS NOT NULL
    AND EXTRACT(EPOCH FROM (ts - prev_ts)) < 30
);


-- STEP 4: (Opsional) Hapus snapshot dgn coin_total = 0 atau player_count = 0
-- ----------------------------------------------------------
-- Biasanya dari startup BDS sebelum data terisi
DELETE FROM economy_history
WHERE coin_total = 0 OR player_count = 0;


-- STEP 5: Verifikasi hasil
-- ----------------------------------------------------------
SELECT
  COUNT(*) AS total_rows,
  MIN(ts) AS oldest,
  MAX(ts) AS newest,
  ROUND(AVG(coin_total)) AS avg_coin,
  MIN(coin_total) AS min_coin,
  MAX(coin_total) AS max_coin
FROM economy_history;
