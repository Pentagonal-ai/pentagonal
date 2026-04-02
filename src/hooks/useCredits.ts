/**
 * Pentagonal — useCredits Hook
 * Manages credit balance fetching and display for the current user.
 * NOTE: Deduction is handled server-side by auth-guard.ts inside each AI route.
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
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
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
    addCredits,
    refetch: fetchCredits,
  };
}
