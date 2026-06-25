// Pentagonal Sentinel — alert creation (Chunk 3)
// Server-side helper to enqueue an alert. The Telegram bot poller delivers it
// from the `alerts` table and flips `delivered`. Used by audit/score/Sentinel flows.

import { createClient } from '@supabase/supabase-js';

export type AlertType =
  | 'new_critical_finding'
  | 'score_drop'
  | 'ownership_change'
  | 'lp_pull'
  | 'risky_approval'
  | 'exploit_forecast'
  | 'test';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AlertInput = {
  type: AlertType;
  severity?: AlertSeverity;
  address?: string;
  chain?: string;
  userId?: string;
  watchedContractId?: string;
  payload?: Record<string, unknown>;
  channel?: 'telegram' | 'x402' | 'web';
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Insert an alert row (service role). Returns the created row id, or null on failure. */
export async function createAlert(input: AlertInput): Promise<string | null> {
  try {
    const { data, error } = await admin()
      .from('alerts')
      .insert({
        type: input.type,
        severity: input.severity ?? 'info',
        address: input.address ?? null,
        chain: input.chain ?? null,
        user_id: input.userId ?? null,
        watched_contract_id: input.watchedContractId ?? null,
        payload: input.payload ?? {},
        channel: input.channel ?? 'telegram',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[alerts] insert failed:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[alerts] insert threw:', e);
    return null;
  }
}
