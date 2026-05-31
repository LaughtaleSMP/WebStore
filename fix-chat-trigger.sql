-- ══════════════════════════════════════════════════════════════
--   FIX: Drop broken trigger on chat_messages
--   The trigger calls net.http_post() which is not available
--   (pg_net extension not enabled), causing ALL INSERTs to fail
--   with error 42883 (undefined_function).
--
--   Run this in Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste → Run
-- ══════════════════════════════════════════════════════════════

-- Step 1: List all triggers on chat_messages (for diagnosis)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages';

-- Step 2: Drop ALL triggers on chat_messages (safe — we don't need any triggers on this table)
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'chat_messages'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON chat_messages';
    RAISE NOTICE 'Dropped trigger: %', t.trigger_name;
  END LOOP;
END $$;

-- Step 3: Verify — should return 0 rows
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'chat_messages';

-- Step 4: Test insert (should succeed now)
INSERT INTO chat_messages (source, player_name, message)
VALUES ('system', '_system_test', 'Trigger fix verified ✓');

-- Clean up test message
DELETE FROM chat_messages WHERE player_name = '_system_test';
DELETE FROM chat_messages WHERE player_name = '_antigravity_test';
