-- Pentagonal — API Keys
-- Per-user API keys stored as SHA-256 hashes.
-- Users generate keys on pentagonal.ai; keys let them use credits from Claude Code / MCP.

CREATE TABLE IF NOT EXISTS api_keys (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash       TEXT        UNIQUE NOT NULL,   -- SHA-256(raw_key), never stored plain
  name           TEXT        NOT NULL DEFAULT 'Default',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at   TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ
);

-- Index for fast lookup by hash on every API request
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);

-- Index for listing keys per user
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);

-- RLS: users can only see/manage their own keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys"
  ON api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Touch last_used_at atomically (called server-side via service role)
CREATE OR REPLACE FUNCTION touch_api_key_usage(p_key_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE api_keys
  SET last_used_at = NOW()
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL;
END;
$$;
