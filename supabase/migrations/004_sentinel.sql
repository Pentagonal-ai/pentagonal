-- Pentagonal Sentinel — continuous monitoring schema (Chunk 0)
-- Substrate for the Sentinel upgrade: watched contracts, audit runs, risk scores,
-- alerts, wallet watches, approval snapshots, and shared exploit signatures.
--
-- Security model (anon key is public, so RLS is mandatory):
--   * USER-OWNED tables (owner = auth.uid()): watched_contracts, audit_runs, alerts,
--     wallet_watches, approvals_seen  -> owner-only read/write; service role writes server-side.
--   * SHARED-INTEL tables (about public contracts): risk_scores, exploit_signatures
--     -> public READ, service-role-only write.

-- ─────────────────────────────────────────────────────────────
-- watched_contracts: a contract a user has registered for monitoring
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watched_contracts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address         TEXT        NOT NULL,
  chain           TEXT        NOT NULL,                    -- slug: ethereum, base, polygon, ...
  label           TEXT,
  status          TEXT        NOT NULL DEFAULT 'active',   -- active | paused
  last_audit_id   UUID,                                    -- soft ref to audit_runs.id
  last_score      INT,                                     -- 0..100
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address, chain)
);
CREATE INDEX IF NOT EXISTS watched_contracts_user_idx ON watched_contracts (user_id);
CREATE INDEX IF NOT EXISTS watched_contracts_addr_idx ON watched_contracts (address, chain);
CREATE INDEX IF NOT EXISTS watched_contracts_active_idx ON watched_contracts (status) WHERE status = 'active';

ALTER TABLE watched_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages watched_contracts" ON watched_contracts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- audit_runs: one record per audit execution (manual or Sentinel-triggered)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_runs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE,  -- nullable: system runs
  watched_contract_id  UUID        REFERENCES watched_contracts(id) ON DELETE SET NULL,
  address              TEXT        NOT NULL,
  chain                TEXT        NOT NULL,
  trigger              TEXT        NOT NULL DEFAULT 'manual',  -- manual | sentinel | upgrade | event
  severity_summary     JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- {critical:n, high:n, ...}
  findings             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  score                INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_runs_user_idx ON audit_runs (user_id);
CREATE INDEX IF NOT EXISTS audit_runs_addr_idx ON audit_runs (address, chain, created_at DESC);

ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads audit_runs" ON audit_runs
  FOR SELECT USING (auth.uid() = user_id);
-- writes are server-side via service role (bypasses RLS).

-- ─────────────────────────────────────────────────────────────
-- risk_scores: published Pentagon Score history per public contract (SHARED INTEL)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_scores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  address       TEXT        NOT NULL,
  chain         TEXT        NOT NULL,
  score         INT         NOT NULL,            -- 0..100
  factors       JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- transparent breakdown
  audit_run_id  UUID        REFERENCES audit_runs(id) ON DELETE SET NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS risk_scores_addr_idx ON risk_scores (address, chain, computed_at DESC);

ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads risk_scores" ON risk_scores
  FOR SELECT USING (true);
-- writes server-side via service role only.

-- ─────────────────────────────────────────────────────────────
-- alerts: generated alerts, delivered to a user via a channel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_contract_id  UUID        REFERENCES watched_contracts(id) ON DELETE CASCADE,
  address              TEXT,
  chain                TEXT,
  type                 TEXT        NOT NULL,   -- new_critical_finding|score_drop|ownership_change|lp_pull|risky_approval|exploit_forecast
  severity             TEXT        NOT NULL DEFAULT 'info',  -- info|low|medium|high|critical
  payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  channel              TEXT        NOT NULL DEFAULT 'telegram',  -- telegram|x402|web
  delivered            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS alerts_user_idx ON alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_undelivered_idx ON alerts (created_at) WHERE delivered = FALSE;

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);
-- writes + delivery flips are server-side via service role (the bot poller).

-- ─────────────────────────────────────────────────────────────
-- wallet_watches: a wallet a user monitors for risky approvals (Chunk 6)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_watches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address     TEXT        NOT NULL,    -- the watched wallet
  chain       TEXT        NOT NULL,
  label       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address, chain)
);
CREATE INDEX IF NOT EXISTS wallet_watches_user_idx ON wallet_watches (user_id);

ALTER TABLE wallet_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages wallet_watches" ON wallet_watches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- approvals_seen: snapshots of a watched wallet's token approvals for risk diffing (Chunk 6)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals_seen (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_watch_id  UUID        NOT NULL REFERENCES wallet_watches(id) ON DELETE CASCADE,
  token_address    TEXT        NOT NULL,
  spender          TEXT        NOT NULL,
  allowance        TEXT        NOT NULL,    -- uint256 as decimal string
  chain            TEXT        NOT NULL,
  risk_flag        TEXT,                    -- unlimited | flagged_spender | drainer | null
  seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS approvals_seen_wallet_idx ON approvals_seen (wallet_watch_id, seen_at DESC);

ALTER TABLE approvals_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads approvals_seen" ON approvals_seen
  FOR SELECT USING (auth.uid() = user_id);
-- writes server-side via service role.

-- ─────────────────────────────────────────────────────────────
-- exploit_signatures: accumulated pre-exploit patterns (SHARED INTEL, Chunk 7)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exploit_signatures (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  pattern      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  severity     TEXT        NOT NULL DEFAULT 'medium',
  source       TEXT,                         -- e.g. 'rules-engine', 'historical:<exploit>'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exploit_signatures_sev_idx ON exploit_signatures (severity);

ALTER TABLE exploit_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads exploit_signatures" ON exploit_signatures
  FOR SELECT USING (true);
-- writes server-side via service role only.
