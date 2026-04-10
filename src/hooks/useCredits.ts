/**
 * Pentagonal — useCredits Hook
 * Manages universal credit balance for the current user.
 * One credit = one audit or one generate ($5 each).
 * NOTE: Deduction is handled server-side by auth-guard.ts inside each AI route.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CREDIT_TYPE } from '@/lib/payments';

interface UseCreditsReturn {
  credits: number;
  loading: boolean;
  error: string | null;
  hasCredits: () => boolean;
  addCredits: (amount: number) => void;
  refetch: () => Promise<void>;
}

export function useCredits(userId: string | undefined): UseCreditsReturn {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('credits')
        .select('remaining')
        .eq('user_id', userId)
        .eq('credit_type', CREDIT_TYPE)
        .single();

      if (fetchError) {
        // No row = 0 credits
        if (fetchError.code === 'PGRST116') {
          setCredits(0);
          setError(null);
        } else {
          setError(fetchError.message);
        }
        return;
      }

      setCredits(data?.remaining ?? 0);
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

  const hasCredits = useCallback((): boolean => {
    return credits > 0;
  }, [credits]);

  // Optimistic add after successful payment verification
  const addCredits = useCallback((amount: number) => {
    setCredits(prev => prev + amount);
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
