/**
 * Pentagonal — useCredits Hook
 * Manages credit balance fetching, checking, and deduction for the current user.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CreditType } from '@/lib/payments';

interface Credits {
  creation: number;
  audit: number;
  edit: number;
}

interface UseCreditsReturn {
  credits: Credits;
  loading: boolean;
  error: string | null;
  hasCredits: (type: CreditType) => boolean;
  deductCredit: (type: CreditType) => Promise<boolean>;
  addCredits: (type: CreditType, amount: number) => void;
  refetch: () => Promise<void>;
}

const EMPTY_CREDITS: Credits = { creation: 0, audit: 0, edit: 0 };

export function useCredits(userId: string | undefined): UseCreditsReturn {
  const [credits, setCredits] = useState<Credits>(EMPTY_CREDITS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setCredits(EMPTY_CREDITS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('credits')
        .select('credit_type, remaining')
        .eq('user_id', userId);

      if (fetchError) {
        console.error('[useCredits] Fetch error:', fetchError);
        setError(fetchError.message);
        return;
      }

      const result: Credits = { ...EMPTY_CREDITS };
      for (const row of data || []) {
        if (row.credit_type in result) {
          result[row.credit_type as CreditType] = row.remaining;
        }
      }
      setCredits(result);
      setError(null);
    } catch (err) {
      console.error('[useCredits] Unexpected error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const hasCredits = useCallback((type: CreditType): boolean => {
    return credits[type] > 0;
  }, [credits]);

  const deductCredit = useCallback(async (type: CreditType): Promise<boolean> => {
    if (!userId) return false;
    if (credits[type] <= 0) return false;

    try {
      const res = await fetch('/api/deduct-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, creditType: type }),
      });

      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to deduct credit');
        return false;
      }

      // Optimistic update
      setCredits(prev => ({
        ...prev,
        [type]: result.remaining,
      }));

      return true;
    } catch (err) {
      console.error('[useCredits] Deduct error:', err);
      setError(String(err));
      return false;
    }
  }, [userId, credits]);

  // Optimistic add after successful payment verification
  const addCredits = useCallback((type: CreditType, amount: number) => {
    setCredits(prev => ({
      ...prev,
      [type]: prev[type] + amount,
    }));
  }, []);

  return {
    credits,
    loading,
    error,
    hasCredits,
    deductCredit,
    addCredits,
    refetch: fetchCredits,
  };
}
