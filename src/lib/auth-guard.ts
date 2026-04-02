/**
 * Pentagonal — Auth Guard
 * Server-side authentication and credit enforcement for API routes.
 * Uses Supabase SSR cookie auth — the SAME session the middleware refreshes.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { CreditType } from '@/lib/payments';

// ─── Types ───
export interface AuthResult {
  user: User;
}

export interface CreditResult extends AuthResult {
  remaining: number;
}

// ─── Get authenticated user from cookie session ───
async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── Admin Supabase client (bypasses RLS) ───
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Require authentication (returns user or 401) ───
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  return { user };
}

// ─── Require credits (returns user+remaining or 401/402) ───
// Does NOT deduct — use deductCreditForUser() after this check
export async function requireCredits(
  creditType: CreditType
): Promise<CreditResult | NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getAdminClient();
  const { data: credit, error } = await supabase
    .from('credits')
    .select('remaining')
    .eq('user_id', authResult.user.id)
    .eq('credit_type', creditType)
    .single();

  if (error || !credit || credit.remaining <= 0) {
    return NextResponse.json(
      { error: 'Insufficient credits', creditType, remaining: 0 },
      { status: 402 }
    );
  }

  return { user: authResult.user, remaining: credit.remaining };
}

// ─── Deduct a credit atomically (call BEFORE AI execution) ───
export async function deductCreditForUser(
  userId: string,
  creditType: CreditType
): Promise<{ success: boolean; remaining: number }> {
  const supabase = getAdminClient();

  const { data, error } = await supabase.rpc('deduct_credit', {
    p_user_id: userId,
    p_credit_type: creditType,
  });

  if (error) {
    console.error('[auth-guard] Atomic deduction failed:', error);
    return { success: false, remaining: 0 };
  }

  const remaining = data as number;
  if (remaining === -1) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining };
}

// ─── Refund a credit atomically (call when AI execution fails after deduction) ───
export async function refundCredit(
  userId: string,
  creditType: CreditType
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.rpc('refund_credit', {
    p_user_id: userId,
    p_credit_type: creditType,
  });

  if (error) {
    console.error(`[auth-guard] Refund failed for ${creditType}:`, error);
  }
}
