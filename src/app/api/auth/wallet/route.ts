import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, walletType } = await request.json();

    if (!walletAddress || !walletType) {
      return NextResponse.json({ error: 'Missing wallet address or type' }, { status: 400 });
    }

    const walletEmail = `${walletAddress.toLowerCase()}@wallet.pentagonal.dev`;
    const walletPassword = `wallet_${walletAddress.toLowerCase()}_pentagonal_v2`;

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: walletEmail,
      password: walletPassword,
    });

    if (!signInError && signInData.session) {
      return NextResponse.json({
        success: true,
        session: signInData.session,
        user: signInData.user,
      });
    }

    // Sign in failed — try creating the user
    // If we have the service role key, we can create pre-confirmed users
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasServiceRole) {
      // Admin API: create user with auto-confirmation
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: walletEmail,
        password: walletPassword,
        email_confirm: true, // Auto-confirm — no email verification needed
        user_metadata: {
          wallet_address: walletAddress,
          wallet_type: walletType,
          auth_method: 'wallet',
        },
      });

      if (adminError && !adminError.message.includes('already been registered')) {
        return NextResponse.json({ error: adminError.message }, { status: 400 });
      }

      // Now sign in with the confirmed account
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
        email: walletEmail,
        password: walletPassword,
      });

      if (sessionError) {
        return NextResponse.json({ error: sessionError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        session: sessionData.session,
        user: sessionData.user,
      });
    } else {
      // No service role key — use anon client signup + handle confirmation gap
      // Sign up the user (may require confirmation depending on Supabase settings)
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: walletEmail,
        password: walletPassword,
        options: {
          data: {
            wallet_address: walletAddress,
            wallet_type: walletType,
            auth_method: 'wallet',
          },
        },
      });

      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }

      // If signup returns a session, we're good (email confirmation disabled)
      if (signUpData.session) {
        return NextResponse.json({
          success: true,
          session: signUpData.session,
          user: signUpData.user,
        });
      }

      // If no session, email confirmation is required
      // Try signing in anyway — maybe user already exists and confirmed
      const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
        email: walletEmail,
        password: walletPassword,
      });

      if (!retryError && retryData.session) {
        return NextResponse.json({
          success: true,
          session: retryData.session,
          user: retryData.user,
        });
      }

      // Give a clear error about what's happening
      return NextResponse.json({
        error: 'Email confirmation is required for new accounts. Add SUPABASE_SERVICE_ROLE_KEY to .env.local to enable automatic wallet authentication, or disable "Confirm email" in Supabase Dashboard → Auth → Settings.',
        requiresConfig: true,
      }, { status: 400 });
    }
  } catch (err) {
    console.error('Wallet auth error:', err);
    return NextResponse.json(
      { error: 'Internal authentication error' },
      { status: 500 }
    );
  }
}
