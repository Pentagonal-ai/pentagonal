-- Pentagonal: Token-holder daily free credit
-- Holders of >= 0.25% of the gating token (ERC-20 on Ethereum) get ONE free
-- credit per rolling 24h, usable for an audit OR a generate. The grant is
-- atomic so concurrent requests can't double-claim. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS free_credit_claims (
  user_id         UUID PRIMARY KEY,
  last_granted_at TIMESTAMPTZ
);

-- ─── Atomic claim: stamps now() iff never claimed or >24h since last grant ───
-- Returns TRUE only when a free credit is actually granted on this call.
CREATE OR REPLACE FUNCTION claim_free_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_granted BOOLEAN := FALSE;
BEGIN
  INSERT INTO free_credit_claims (user_id, last_granted_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_granted_at = now()
    WHERE free_credit_claims.last_granted_at IS NULL
       OR free_credit_claims.last_granted_at <= now() - interval '24 hours'
  RETURNING TRUE INTO v_granted;

  RETURN COALESCE(v_granted, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Refund: un-stamp so a failed audit/generate doesn't burn the daily free credit ───
CREATE OR REPLACE FUNCTION refund_free_credit(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE free_credit_claims
  SET last_granted_at = NULL
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
