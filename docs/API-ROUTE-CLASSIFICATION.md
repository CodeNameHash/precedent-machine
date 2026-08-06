# API route and action inventory

Written for step S2 (`docs/codex-program/ROADMAP.md`), which names this
explicitly as a required artefact of the security gate
(`P9_SECURITY_AUTH` / `ROUTE_ACTION_THREE_WAY_INVENTORY` in
`docs/codex-program/programme-gates.yaml`). Supersedes the same-named
document drafted on branch `wp/api-auth-middleware` (commit `e05bfeb5`,
never merged) — that draft covered 64 routes as of mid-July; this covers
all 79 that exist on this branch, under the new auth model.

## The model, in one paragraph

Every request to this application — every page, every `/api/**` route —
requires a valid `pm_session` cookie, enforced in one place
(`middleware.js`, decision logic in `lib/auth/gate.js`), before Next.js
resolves what to do with the request. A route is exempt from that check
only by appearing in one of two short, explicit lists in `lib/auth/gate.js`:
**`PUBLIC_PATHS`/`PUBLIC_PREFIXES`** (no auth of any kind — today, only the
login page itself, the three `/api/auth/**` bootstrap routes, and static
framework/font assets) or **`SELF_GATED_PREFIXES`** (`/api/cron/**`, which
enforces its own `CRON_SECRET` check and must not also be asked for a
session — Vercel's cron infrastructure has no browser). Everything else —
all 76 pre-existing routes below, and any route added after this document
was written — defaults to refused. That default is what
`tests/auth-route-enforcement.test.js` proves by walking the actual
`pages/api/` directory at test time rather than a remembered list; see that
file for what "proves" means here (real HTTP requests against a real
running server, not source inspection).

**The session gate is a second, independent layer on top of two others that
already exist and that this work does not touch:**

1. **Feature containment.** Most write paths and several read paths already
   return a hard-coded 503 (`lib/broad-corpus-containment.js`,
   `lib/query-containment.js`, `lib/market-stats-containment.js`) —
   "temporarily unavailable" stubs put in place to keep search, market
   statistics, and ingestion switched off in production. This task does not
   remove any of that containment; see "Current gate" below for which
   routes it covers.
2. **Local-repository-artifact routes.** Several `admin/*` routes read or
   write JSON/JSONL files under `docs/` on the local filesystem (taxonomy
   curation tooling meant for Ben running locally, not for a deployed
   environment where filesystem writes don't persist). Those built after
   this pattern was established call `blockVercelRepositoryArtifactRoute()`
   (`lib/admin/repository-artifact-access.js`), which 404s the entire route
   whenever `process.env.VERCEL` is set — i.e. on any Vercel deployment,
   preview or production. A few siblings (`admin/schema-loss/decide.js`,
   `admin/schema-loss/queue.js`, `admin/review-queue/index.js`) do **not**
   call this guard; noted per-route below since it's a real inconsistency,
   not a claim this document is deciding to fix.

The session gate sits in front of both of the above, unconditionally. A
route that is already 503-contained is now also refused pre-session; once
any containment is later lifted (separate work — see ROADMAP.md P7/P8),
the session requirement is already there waiting for it, not something
that has to be remembered at that point.

## Classification legend

- **READ** — no database/state mutation.
- **WRITE** — creates or updates.
- **DESTRUCTIVE** — deletes, or deletes-then-reinserts.
- **Public** — exempt from the session gate (see the two lists above).
  Every route not marked Public requires a valid session.

## The four routes repaired under S2

These were graded critical by the July security review
(`reports/CODEBASE-REVIEW-2026-07-15.md`, `reports/scratchpad/review-R3-security.md`).
All four stay exactly as contained as they were before this work — **the
fix is in a dormant, tested, not-wired-in archive**, the same shape
`lib/query/contained-routes/` already used for the query family:

| Route | Defect | Repaired at |
|---|---|---|
| `pages/api/users.js` | `is_admin` read straight from the POST body (self-grant) | `lib/broad-corpus/contained-routes/users.js` — `is_admin` is no longer read from the request at all; every user created is `is_admin: false` |
| `pages/api/ingest/from-url.js` | Unauthenticated SSRF — fetched any caller-supplied URL server-side, followed redirects with no revalidation | `lib/broad-corpus/contained-routes/from-url-fetch.js` — only `https://sec.gov` / `https://*.sec.gov` are fetchable, every redirect hop is re-validated against the same allowlist, capped at 5 hops |
| `pages/api/admin/reprocess-cond.js` | Unauthenticated destructive delete-and-reinsert | `lib/broad-corpus/contained-routes/reprocess-cond.js` — logic preserved; the defect was purely "unauthenticated", which the session gate now closes once this is wired back in |
| `pages/api/saved-queries.js` | Admin self-grant: the auto-created "Reviewer" bootstrap row defaulted to `is_admin: true` | `lib/query/contained-routes/saved-queries.js` `reviewerUser()` — bootstrap now defaults `is_admin: false`; also fixed the file's pre-existing broken relative imports (`lib/lib/...`, ROADMAP.md P8) so the fix is actually loadable and tested, not just written |

## Full route table

| Route | Methods | Class | Public | Current gate (besides the session layer) |
|---|---|---|---|---|
| `/api/admin/audit/decision` | POST | WRITE (local file) | No | 404 on Vercel (`blockVercelRepositoryArtifactRoute`) |
| `/api/admin/audit/freeze` | POST | WRITE | No | Fully contained (`ROUTE_CONTAINED` 503) |
| `/api/admin/audit/matrix` | GET | READ (local file + Supabase) | No | Contained for non-GET; GET live |
| `/api/admin/candidates` | GET, PATCH | READ / WRITE | No | Fully contained |
| `/api/admin/check-agreement-duplicate` | POST | READ | No | Live |
| `/api/admin/find-deal` | POST | READ (LLM, token cost) | No | Live |
| `/api/admin/gaps` | GET, POST | READ (GET) / WRITE (POST) | No | POST contained; GET live |
| `/api/admin/ingest-batch` | POST | WRITE | No | Fully contained |
| `/api/admin/ingest-runs` | GET, PATCH | READ / WRITE | No | Fully contained |
| `/api/admin/parse-files` | POST | READ (upload parsing, no DB write) | No | Live |
| `/api/admin/parse-pdf` | POST | READ (PDF parsing, no DB write, no page cap) | No | Live |
| `/api/admin/processing-flow/metrics` | GET | READ (static stub data) | No | Live |
| `/api/admin/reconcile/decide` | POST | WRITE (local file) | No | 404 on Vercel |
| `/api/admin/reconcile/queue` | GET | READ (local file) | No | 404 on Vercel |
| `/api/admin/reconcile/split` | POST | READ (validation only) | No | Live |
| `/api/admin/registry/decision` | POST | WRITE (local file) | No | 404 on Vercel |
| `/api/admin/registry/freeze` | POST | WRITE (local file) | No | 404 on Vercel |
| `/api/admin/registry/preview` | GET | READ | No | Live |
| `/api/admin/reports` | GET | READ | No | Live |
| `/api/admin/reprocess-cond` | POST | **DESTRUCTIVE** | No | Fully contained — **critical route, repaired in archive, see above** |
| `/api/admin/review-queue` (`index.js`) | GET | READ (local file) | No | Live — no Vercel-block (inconsistent with its sibling below) |
| `/api/admin/review-queue/[id]/resolve` | POST | WRITE (local file) | No | 404 on Vercel |
| `/api/admin/schema-loss/decide` | POST | WRITE (local file) | No | Live — **no Vercel-block**, unlike `reconcile/decide` and `registry/decision` |
| `/api/admin/schema-loss/queue` | GET | READ (local file) | No | Live — no Vercel-block |
| `/api/admin/schema-loss/rerun` | POST | WRITE (executes local scripts) | No | 404 on Vercel |
| `/api/admin/store-agreement` | POST | WRITE | No | Fully contained |
| `/api/agreement-source` | GET | READ (full agreement text) | No | Live |
| `/api/ai/annotate` | POST | READ (LLM, token cost) | No | Live |
| `/api/ai/categorize` | POST | READ (LLM, token cost) | No | Live |
| `/api/ai/check-duplicate` | POST | READ (LLM, token cost) | No | Live |
| `/api/ai/suggest-annotations` | POST | READ (LLM, token cost) | No | Live |
| `/api/annotations` | GET, POST, PATCH, DELETE | READ (GET) / **DESTRUCTIVE** (others) | No | Non-GET contained; GET live |
| `/api/annotations/propagate` | POST | WRITE | No | Fully contained |
| `/api/ask` | POST | READ (LLM Q&A, token-burn surface) | No | Live |
| `/api/canonical-v2/exact-detail` | GET | READ | No | Live, feature-flag gated (`isCanonicalV2ReviewEnabled`) |
| `/api/canonical-v2/query` | * | READ | No | Fully contained |
| `/api/canonical-v2/review-context` | GET | READ | No | Live, feature-flag gated |
| `/api/comments` | GET, POST | READ (GET) / WRITE (POST) | No | POST contained; GET live |
| `/api/compare/features` | GET | READ | No | Fully contained |
| `/api/compare/rep-materiality` | GET | READ | No | Fully contained |
| `/api/comparisons` | GET, POST, PATCH | READ / WRITE | No | Fully contained |
| `/api/corpus-stats` | GET | READ | No | Fully contained |
| `/api/corpus-stats-batch` | GET | READ | No | Fully contained |
| `/api/corpus-version` | GET | READ | No | Fully contained |
| `/api/corrections` | GET, POST | READ (scoped GET) / WRITE (POST) | No | POST, summary, or unscoped GET contained; scoped GET live |
| `/api/corrections/review` | POST | WRITE | No | Live, but already requires `x-editor-key` (`lib/corrections/editor-keys.js`) — a second, pre-existing, independent auth check the session gate stacks on top of |
| `/api/corrections/submit` | POST | WRITE | No | Fully contained |
| `/api/cron/edgar-watch` | GET, POST | WRITE (discovers + inserts candidate deals) | **Self-gated** | Own `CRON_SECRET` Bearer check (`authorised()`); exempt from the session gate by design — see `lib/auth/gate.js` `SELF_GATED_PREFIXES` |
| `/api/deals` | GET, POST, PATCH, DELETE | READ (GET) / **DESTRUCTIVE** (others) | No | Non-GET contained; GET live |
| `/api/home` | GET | READ (dashboard aggregate) | No | Live |
| `/api/ingest/agreement` | POST | WRITE | No | Fully contained |
| `/api/ingest/classify` | POST | WRITE | No | Fully contained |
| `/api/ingest/extract-section` | POST | WRITE | No | Fully contained |
| `/api/ingest/extract-type` | POST | WRITE | No | Fully contained |
| `/api/ingest/from-url` | POST | WRITE (SSRF-adjacent) | No | Fully contained — **critical route, repaired in archive, see above** |
| `/api/ingest/parse-only` | POST | READ (parsing, no DB write) | No | Live |
| `/api/ingest/review` | POST | READ (LLM, token cost) | No | Live |
| `/api/ingest/run-all` | POST | WRITE | No | Fully contained |
| `/api/ingest/segment` | POST | WRITE | No | Fully contained |
| `/api/ingest/segment-v2` | POST | WRITE | No | Fully contained |
| `/api/market-stats` | POST | READ | No | Fully contained |
| `/api/provision-types` | GET, POST, PATCH, DELETE | READ (GET) / **DESTRUCTIVE** (others) | No | Non-GET contained; GET live |
| `/api/provisions` | GET, POST, PATCH, DELETE | READ (scoped GET) / **DESTRUCTIVE** (others) | No | Non-GET and unscoped GET contained; scoped GET live |
| `/api/query/demo-set` | GET | READ | No | Fully contained |
| `/api/query/field-options` | GET | READ | No | Fully contained |
| `/api/query/interpret` | POST | READ | No | Fully contained |
| `/api/query/kinds` | GET | READ (static schema off disk) | No | Fully contained |
| `/api/query/run` | GET, POST | READ | No | Fully contained |
| `/api/redline` | POST | READ (LLM, token cost) | No | Live |
| `/api/review/[id]/cards` | GET | READ (full review-deal payload) | No | Live |
| `/api/saved-queries` | GET, POST, PATCH | READ / WRITE | No | Fully contained — **critical route, repaired in archive, see above** |
| `/api/schema-coverage` | GET | READ | No | Fully contained |
| `/api/search` | POST | READ (LLM, token cost) | No | Live |
| `/api/signoffs` | GET, POST | READ (GET) / WRITE (POST) | No | POST contained; GET live |
| `/api/trust/report` | GET | READ | No | Live |
| `/api/users` | GET, POST | READ / WRITE | No | Fully contained — **critical route, repaired in archive, see above** |
| `/api/auth/login` | POST | WRITE (issues a session) | **Yes** | You cannot require a session to reach the route that creates one |
| `/api/auth/logout` | POST | WRITE (clears a session) | **Yes** | Idempotent; no harm in an unauthenticated caller clearing a cookie it already controls |
| `/api/auth/session` | GET | READ (own session status only) | **Yes** | Reveals nothing beyond "am I logged in"; used by `pages/login.js` |

79 routes total: 76 pre-existing + the 3 new `/api/auth/**` bootstrap
routes this task adds. **0 are public besides the auth bootstrap.** 1 is
self-gated (cron). 78 require a session.

## Pages

Every page under `pages/**` (excluding `pages/api/**`) is behind the same
session gate as the API routes — `middleware.js`'s matcher covers the whole
app, not just `/api/**`. This matters specifically for
`pages/admin/taxonomy.js` and `pages/design/index.js`, which fetch data via
`getServerSideProps` calling `lib/` directly and never go through
`pages/api/**` at all — an API-only gate would have left them reachable
with no auth of any kind regardless of how every route above is
classified. Because middleware runs ahead of Next's own routing, both pages
need no code change of their own: by the time `getServerSideProps` runs,
the request has already been refused if there was no valid session.

Unauthenticated behavior differs by request type, not by page: an API
request gets a JSON 401; a page navigation gets a redirect to
`/login?next=<path>` (`middleware.js`). `/login` itself, and the static
assets it depends on to render (`/fonts/*`, `/_next/*`, `/spa.css`,
`/favicon.ico`), are the only page-adjacent paths in `PUBLIC_PATHS`/`PUBLIC_PREFIXES`.

**`/generated/home-search-index-v1.json`** (`public/generated/`, the home
page's search-as-you-type snapshot) is deliberately **not** on that public
list, even though it is a static file — it is a build-time snapshot of
corpus deal names, not a framework asset, so it stays behind the session
gate like every other corpus-derived surface. A logged-in browser's
same-origin fetch for it carries the session cookie automatically, so this
costs nothing for the authenticated app.

## What this document does not decide

- Whether any *currently-live* route should later move to the public list.
  None qualifies today — every live GET either serves corpus/operational
  data or costs LLM tokens, matching the July review's own read.
- The local-repository-artifact inconsistency noted per-route above
  (`admin/schema-loss/decide.js` and `admin/schema-loss/queue.js` lacking
  the `blockVercelRepositoryArtifactRoute()` guard their siblings have) —
  flagged, not fixed; it is not part of the four graded-critical routes and
  touching it risks stepping on the admin-tooling surface other work owns.
- Lifting any existing containment (search, market statistics, ingestion) —
  explicitly out of scope for this task; see ROADMAP.md S2 and P7/P8.
- Server-side session revocation. `pm_session` is a stateless signed
  cookie (`lib/auth/session.js`), not a database-backed session store —
  there is nowhere to revoke a single session early short of rotating
  `SESSION_SECRET`, which invalidates all of them at once. Adequate for one
  owner; would need revisiting for a second user who might need to be
  logged out independently.
