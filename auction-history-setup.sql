-- ═══════════════════════════════════════════════════════════
-- auction_history — Permanent auction transaction log
-- Jalankan di Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Buat tabel
CREATE TABLE IF NOT EXISTS auction_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tx_time    bigint      NOT NULL,            -- epoch ms dari game server
  tx_type    text        NOT NULL,            -- sold | offer_accepted | auction_won | expired
  item_name  text        NOT NULL,
  item_id    text        DEFAULT '',          -- minecraft:item_id
  qty        int         DEFAULT 1,
  seller     text        NOT NULL,
  buyer      text        DEFAULT '',          -- kosong untuk expired
  price      int         DEFAULT 0,
  created_at timestamptz DEFAULT now()        -- server insert time
);

-- 2. Enable RLS (harus sebelum policy)
ALTER TABLE auction_history ENABLE ROW LEVEL SECURITY;

-- 3. Index untuk query by time (web dashboard order=tx_time.desc)
CREATE INDEX IF NOT EXISTS idx_ah_tx_time ON auction_history (tx_time DESC);

-- 4. Index untuk dedup check (item + seller + tx_time)
CREATE INDEX IF NOT EXISTS idx_ah_dedup ON auction_history (item_name, seller, tx_time);

-- 5. Policy: anon bisa INSERT (dari BDS sync)
DO $$ BEGIN
  CREATE POLICY "Anon insert auction_history" ON auction_history
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Policy: anon bisa SELECT (web dashboard read)
DO $$ BEGIN
  CREATE POLICY "Anon select auction_history" ON auction_history
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Verifikasi
SELECT COUNT(*) AS total_rows FROM auction_history;
