-- Pentagonal: Atomic credit deduction RPC
-- Run this in Supabase SQL Editor to create the functions.

-- ─── Atomic deduct: returns new remaining or -1 if insufficient ───
CREATE OR REPLACE FUNCTION deduct_credit(
  p_user_id UUID,
  p_credit_type TEXT
)
RETURNS INT AS $$
DECLARE
  v_remaining INT;
BEGIN
  UPDATE credits
  SET remaining = remaining - 1
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
    AND remaining > 0
  RETURNING remaining INTO v_remaining;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  -- Log usage (non-critical, inside same transaction)
  INSERT INTO usage_log (user_id, action)
  VALUES (p_user_id, p_credit_type);

  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Atomic increment: adds credits after payment ───
CREATE OR REPLACE FUNCTION increment_credits(
  p_user_id UUID,
  p_credit_type TEXT,
  p_amount INT
)
RETURNS INT AS $$
DECLARE
  v_remaining INT;
BEGIN
  -- Try update first
  UPDATE credits
  SET remaining = remaining + p_amount
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
  RETURNING remaining INTO v_remaining;

  -- If no row existed, insert
  IF NOT FOUND THEN
    INSERT INTO credits (user_id, credit_type, remaining)
    VALUES (p_user_id, p_credit_type, p_amount)
    RETURNING remaining INTO v_remaining;
  END IF;

  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Atomic refund: returns new remaining ───
CREATE OR REPLACE FUNCTION refund_credit(
  p_user_id UUID,
  p_credit_type TEXT
)
RETURNS INT AS $$
DECLARE
  v_remaining INT;
BEGIN
  UPDATE credits
  SET remaining = remaining + 1
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
  RETURNING remaining INTO v_remaining;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
