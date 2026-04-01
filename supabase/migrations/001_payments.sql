-- Pentagonal: Sovereign Crypto Payments Schema
-- Run in Supabase SQL Editor

-- Credits balance per user per type
CREATE TABLE IF NOT EXISTS credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('creation', 'audit', 'edit')),
  remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, credit_type)
);

-- Verified payment receipts (prevents double-spend)
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  credits_type TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage deduction log
CREATE TABLE IF NOT EXISTS usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('creation', 'audit', 'edit')),
  chain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only read their own data
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own payments" ON payment_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own usage" ON usage_log FOR SELECT USING (auth.uid() = user_id);

-- Updated_at trigger for credits
CREATE OR REPLACE FUNCTION update_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credits_updated_at
  BEFORE UPDATE ON credits
  FOR EACH ROW
  EXECUTE FUNCTION update_credits_timestamp();
