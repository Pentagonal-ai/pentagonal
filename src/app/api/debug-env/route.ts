// TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE PUBLIC LAUNCH
// Checks if critical env vars are present (not their values)
export async function GET() {
  const checks = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_KEY_PREFIX: process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION,
  };
  return Response.json(checks);
}
