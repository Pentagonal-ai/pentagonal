/**
 * Pentagonal — x402 Payment Middleware
 *
 * Resource server implementation using @x402/core/server + CDP facilitator.
 * Coinbase CDP handles on-chain settlement — we never hold a signing key.
 *
 * Auth flow for paid routes:
 *   1. Admin MCP key (x-pentagonal-key)   → unlimited, skip all checks
 *   2. x402 X-PAYMENT header              → verify via CDP → fulfill → settle
 *   3. Session cookie + credits           → deduct credits (web app users)
 *   4. Nothing                            → 402 with payment instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { PaymentRequirements, PaymentPayload } from '@x402/core/types';

// ─── Config ───────────────────────────────────────────────────────────────────

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ||
  'https://api.cdp.coinbase.com/platform/v2/x402';

const EVM_ADDRESS = (process.env.TREASURY_WALLET_ADDRESS || '') as `0x${string}`;

// USDC on Base mainnet (chain ID 8453)
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_NETWORK: `${string}:${string}` = 'eip155:8453';

// ─── Route pricing table ──────────────────────────────────────────────────────

export type X402Route = {
  path: string;
  scheme: string;
  amountUSDC: number;
  description: string;
};

export const X402_ROUTES: X402Route[] = [
  { path: '/api/audit-agent', scheme: 'upto',  amountUSDC: 0.50, description: '8-agent smart contract security audit' },
  { path: '/api/generate',    scheme: 'exact', amountUSDC: 0.10, description: 'AI smart contract generation' },
  { path: '/api/fix',         scheme: 'exact', amountUSDC: 0.05, description: 'Vulnerability fix' },
  { path: '/api/compile',     scheme: 'exact', amountUSDC: 0.01, description: 'Contract compilation' },
];

// ─── CDP Facilitator Client singleton ─────────────────────────────────────────

let _cdpClient: HTTPFacilitatorClient | null = null;

function getCdpClient(): HTTPFacilitatorClient {
  if (!_cdpClient) {
    _cdpClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  }
  return _cdpClient;
}

// ─── Build PaymentRequirements for a route ────────────────────────────────────

function buildRequirements(route: X402Route): PaymentRequirements {
  const amountAtomic = String(Math.round(route.amountUSDC * 1_000_000)); // USDC = 6 decimals

  return {
    scheme: route.scheme,
    network: BASE_NETWORK,
    asset: BASE_USDC,
    amount: amountAtomic,
    payTo: EVM_ADDRESS,
    maxTimeoutSeconds: 300,
    extra: {
      name: 'USD Coin',
      version: '3',
    },
  };
}

// ─── 402 payment required response ────────────────────────────────────────────

function paymentRequired(route: X402Route): NextResponse {
  const requirements = buildRequirements(route);

  return NextResponse.json(
    {
      x402Version: 1,
      error: 'Payment required',
      message: `This endpoint costs $${route.amountUSDC} USDC on Base. Send a valid x402 X-PAYMENT header.`,
      resource: `https://www.pentagonal.ai${route.path}`,
      accepts: [requirements],
    },
    {
      status: 402,
      headers: {
        'X-PAYMENT-REQUIRED': JSON.stringify({ x402Version: 1, accepts: [requirements] }),
      },
    }
  );
}

// ─── Main guard ────────────────────────────────────────────────────────────────

export type X402Result =
  | { paid: true;  paymentPayload: PaymentPayload }
  | { paid: false; response: NextResponse };

/**
 * Check if a request has a valid x402 payment.
 *
 * - Returns { paid: true, paymentPayload } if valid.
 * - Returns { paid: false, response } with HTTP 402 if no payment or invalid.
 *
 * Passes verification + settlement to Coinbase CDP.
 * Settlement is fire-and-forget — response is not blocked by it.
 */
export async function checkX402(
  req: NextRequest,
  routePath: string,
): Promise<X402Result> {
  const route = X402_ROUTES.find(r => r.path === routePath);
  if (!route) {
    // Route not in pricing table — treat as unpaid (caller decides how to handle)
    console.warn('[x402] Unknown route, skipping x402 check:', routePath);
    return { paid: false, response: NextResponse.json({ error: 'Route not configured for x402' }, { status: 500 }) };
  }

  const xPaymentHeader = req.headers.get('X-PAYMENT');

  if (!xPaymentHeader) {
    return { paid: false, response: paymentRequired(route) };
  }

  let payment: PaymentPayload;
  try {
    payment = JSON.parse(xPaymentHeader) as PaymentPayload;
  } catch {
    return {
      paid: false,
      response: NextResponse.json(
        { error: 'Invalid X-PAYMENT header — must be valid JSON' },
        { status: 402 }
      ),
    };
  }

  const cdp = getCdpClient();
  const requirements = buildRequirements(route);

  try {
    // Verify via Coinbase CDP
    const verifyResult = await cdp.verify(payment, requirements);

    if (!verifyResult.isValid) {
      return {
        paid: false,
        response: NextResponse.json(
          {
            error: 'Payment verification failed',
            reason: verifyResult.invalidReason,
            detail: verifyResult.invalidMessage,
          },
          { status: 402 }
        ),
      };
    }

    // Settle fire-and-forget — CDP handles on-chain settlement
    cdp.settle(payment, requirements).catch(err => {
      console.error('[x402] settle failed for', routePath, err);
    });

    return { paid: true, paymentPayload: payment };

  } catch (err) {
    console.error('[x402] verification error for', routePath, err);
    return {
      paid: false,
      response: NextResponse.json(
        { error: 'Payment processing error', detail: String(err) },
        { status: 402 }
      ),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasX402Support(): boolean {
  return Boolean(EVM_ADDRESS);
}
