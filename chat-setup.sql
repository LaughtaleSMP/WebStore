-- ══════════════════════════════════════════════════════════════
--   Laughtale SMP — Live Chat Tables (v2: with accounts)
-- ══════════════════════════════════════════════════════════════

-- 1. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('game', 'web')),
  player_name TEXT NOT NULL,
  message     TEXT NOT NULL CHECK (char_length(message) <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages (created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_chat" ON chat_messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_chat" ON chat_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_chat" ON chat_messages FOR DELETE TO anon USING (true);

-- 2. Chat Verify (one-time verification codes)
CREATE TABLE IF NOT EXISTS chat_verify (
  id          BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  code        TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verify_code ON chat_verify (code);

ALTER TABLE chat_verify ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_verify" ON chat_verify FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. Chat Accounts (persistent verified gamertag + PIN)
--    Once a player verifies via code, they set a 4-digit PIN.
--    Next time they just login with gamertag + PIN (no re-verify).
CREATE TABLE IF NOT EXISTS chat_accounts (
  id          BIGSERIAL PRIMARY KEY,
  gamertag    TEXT NOT NULL UNIQUE,
  pin_hash    TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_acct_gt ON chat_accounts (gamertag);

ALTER TABLE chat_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_accounts" ON chat_accounts FOR ALL TO anon USING (true) WITH CHECK (true);
