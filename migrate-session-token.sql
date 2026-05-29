-- ══════════════════════════════════════════════════════════════
--   Migration: Add session_token column to chat_accounts
--   Run this in Supabase SQL Editor (one-time migration)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE chat_accounts ADD COLUMN IF NOT EXISTS session_token TEXT;
CREATE INDEX IF NOT EXISTS idx_chat_acct_token ON chat_accounts (session_token);
