-- =====================================================================
-- mimi_commands — Command Queue untuk Mimi Inka Admin Dashboard
-- Jalankan 1x di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jlxtnbnrirxhwuyqjlzw/sql/new
-- =====================================================================

CREATE TABLE IF NOT EXISTS mimi_commands (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  player_name  TEXT NOT NULL,
  action       TEXT NOT NULL,
  slot         TEXT,
  value        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  result_msg   TEXT
);

CREATE INDEX IF NOT EXISTS idx_mimi_commands_status
  ON mimi_commands (status, created_at ASC);

ALTER TABLE mimi_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mimi_cmd_insert" ON mimi_commands;
CREATE POLICY "mimi_cmd_insert" ON mimi_commands
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "mimi_cmd_read_update" ON mimi_commands;
CREATE POLICY "mimi_cmd_read_update" ON mimi_commands
  FOR ALL USING (true);
