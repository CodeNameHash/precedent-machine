// middleware.js
//
// Next.js Edge Middleware gating pages/api/**. Draft for SEC-1
// (reports/CODEBASE-REVIEW-2026-07-15.md - "No auth on any API route").
//
// SAFE BY DEFAULT: this file is a no-op unless API_AUTH_ENABLED=true is set
// in the environment. Merging this file with the flag unset (or set to
// anything other than 'true') changes zero request behavior - every request
// falls through to `NextResponse.next()` exactly as if this middleware did
// not exist. That is a deliberate, load-bearing property: it lets this land
// as an inert scaffold that Ben can review and turn on when the rollout plan
// (which routes, which key distribution, whether/how the app's own
// client-side fetches send the header) is decided - see
// docs/API-ROUTE-CLASSIFICATION.md for the full route inventory and the open
// questions that decision needs to resolve.
//
// AUTH MODEL (minimum viable, per BEN-QUEUE SEC-1):
//   - Shared-secret header `x-pm-api-key`, compared to process.env.PM_API_KEY
//     with a constant-time comparison (lib/api-auth.js#constantTimeEqual).
//   - A PUBLIC_GET_ALLOWLIST (lib/api-auth.js) exempts specific read-only GET
//     routes that serve no deal/corpus data from the key requirement. It is
//     empty today - see the classification doc for why none of the current
//     routes qualify (every GET route either serves corpus data or
//     operational/admin state, and the app's own pages fetch these routes
//     client-side with no session mechanism to piggyback on yet).
//   - /api/cron/** is left to its own existing CRON_SECRET check
//     (pages/api/cron/edgar-watch.js) rather than double-gated here.
//   - If the flag is on but PM_API_KEY is unset, requests fail CLOSED (500)
//     rather than silently passing through open.
//
// All decision logic lives in lib/api-auth.js so it can be unit-tested
// without the edge runtime - see tests/api-auth-middleware.test.js.
//
// Env vars:
//   API_AUTH_ENABLED - 'true' to enforce; anything else (including unset) is
//                       fully inert.
//   PM_API_KEY        - the shared secret clients must send as x-pm-api-key.

import { NextResponse } from 'next/server';
import { AUTH_HEADER, decideApiAuth } from './lib/api-auth';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request) {
  const { pathname } = request.nextUrl;
  const decision = decideApiAuth({
    pathname,
    method: request.method,
    apiKeyHeader: request.headers.get(AUTH_HEADER),
    env: process.env,
  });

  if (decision.allow) {
    return NextResponse.next();
  }

  return NextResponse.json(decision.body || { error: 'Unauthorized' }, { status: decision.status });
}
