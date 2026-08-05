// middleware.js
//
// Next.js Edge Middleware — the one enforcement point for S2 (ROADMAP.md):
// "put a login in front of the application." Gates every page and every
// /api/** route, not just the API surface, because two pages
// (pages/admin/taxonomy.js, pages/design/index.js) fetch data via
// getServerSideProps calling lib/ directly and never go through pages/api/**
// — an API-only gate would leave them wide open. Running ahead of routing
// (as middleware does) means those pages need no change of their own: by
// the time getServerSideProps runs, this file has already refused the
// request if there was no valid session.
//
// All decision logic lives in lib/auth/gate.js so it is unit-testable with
// plain `node --test`, independent of the Edge runtime — see
// tests/auth/gate.test.js. This file is the thin wrapper that adapts that
// decision to a NextResponse: JSON 401/500 for /api/**, a redirect to
// /login for everything else.
//
// Provenance: reuses the shape of the draft on wp/api-auth-middleware
// (matcher-based Edge middleware, decision logic split into its own module
// for edge/test portability, fail-closed when misconfigured). What changed:
// the draft gated a shared-secret header meant for a future client that
// never got built (every page fetches client-side with no way to attach a
// header); this checks a session cookie instead, which the browser attaches
// by itself, so no page's fetch code has to change. It also widens coverage
// from /api/:path* to the whole app, and drops the draft's PUBLIC_GET_ALLOWLIST
// mechanism (this product has no route that should be reachable
// unauthenticated besides the auth bootstrap itself and the already
// self-gated cron route — see lib/auth/gate.js).

import { NextResponse } from 'next/server';
import { decideAccess } from './lib/auth/gate';

export const config = {
  // Standard Next.js exclusion for framework-internal asset requests.
  // Everything else — every page, every /api/** route, and the small
  // handful of other static files (fonts, spa.css) — reaches
  // decideAccess(), which is the actual source of truth for what is public;
  // this matcher is a performance/defense-in-depth filter on top of it, not
  // a second copy of the policy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(request) {
  const { pathname } = request.nextUrl;

  const decision = await decideAccess({
    pathname,
    cookieHeader: request.headers.get('cookie'),
    env: process.env,
  });

  if (decision.allow) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    const misconfigured = decision.reason === 'not-configured';
    return NextResponse.json(
      {
        error: misconfigured
          ? 'Session auth is not configured (SESSION_SECRET missing)'
          : 'Unauthorized',
      },
      { status: misconfigured ? 500 : 401 },
    );
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(loginUrl);
}
