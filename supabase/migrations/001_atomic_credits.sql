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
