# API route classification (SEC-1 support doc)

Companion to `reports/CODEBASE-REVIEW-2026-07-15.md` §SEC-1 and
`middleware.js`. Enumerates every route under `pages/api/**` as of this
branch, classifies its sensitivity, and records its current gate. This is the
map Ben needs to decide the auth rollout policy — it is not itself a fix.

**Current gate, every route below: NONE**, except `pages/api/cron/edgar-watch.js`
(own `CRON_SECRET` check, which fails *open* if the env var is unset — see
`reports/scratchpad/review-R3-security.md`). `middleware.js` in this branch
adds an auth layer but ships **disabled by default** (`API_AUTH_ENABLED`
unset/false) — it changes none of the "current gate" column below until an
operator flips the flag.

## Classification legend

- **PUBLIC-READ** — read-only, serves no deal/corpus/operational data; safe
  to leave unauthenticated even with the gate on.
- **AUTHENTICATED-READ** — read-only, but serves corpus data, operational
  state, or costs LLM tokens; needs the shared-secret header once the gate
  is on.
- **WRITE** — creates/updates non-destructively.
- **ADMIN** — operational/curation surface (path is under `pages/api/admin/**`
  or equivalent privileged tooling); both reads and writes here are grouped
  ADMIN since the whole surface is meant for operators, not the deal-review
  app's end users.
- **DESTRUCTIVE** — deletes, or deletes-then-reinserts, rows. Highest bar.

Note on the **PUBLIC-READ allowlist being empty**: every current GET route
either reads the corpus (deals/provisions/claims), reads
operational/admin/queue state, or costs Anthropic tokens. `pages/api/query/kinds.js`
came closest (it only returns static schema JSON off disk, no DB call) but even
that is left AUTHENTICATED-READ here rather than pre-populated into the
allowlist — enumerating query *kinds* still discloses the shape of the query
surface, and the app's own page (`pages/query/[kind]/[id].js`) fetches it
client-side with no session mechanism to distinguish "our app" from "anyone,"
so there is no way to scope it narrower today. Populating
`PUBLIC_GET_ALLOWLIST` in `lib/api-auth.js` is a one-line, low-risk change
*once* Ben decides a route qualifies — the mechanism is there, unused.

**The client-side-fetch problem (read before enabling the flag):** almost
every page in `pages/**` fetches its own API routes from the browser
(`fetch('/api/...')` in component code — see the list at the bottom).
Enabling `API_AUTH_ENABLED=true` today, with no other change, breaks the
entire UI: the browser has no way to attach `x-pm-api-key` because nothing in
the app currently sends it. The two routes that run server-side
(`pages/admin/taxonomy.js` `getServerSideProps`, `pages/design/index.js`
`getServerSideProps`) call `lib/` functions directly and never go through
`pages/api/**`, so they're unaffected either way. Turning the flag on for
real needs one of: (a) a session-cookie auth model instead of/in addition to
the shared secret, (b) a server-side proxy/BFF layer that injects the key,
or (c) accepting that the key ships in the client bundle for this internal
tool. That decision is explicitly out of scope for this draft — flagged here
so it isn't discovered by breaking prod.

## Routes

| Route | Methods | Class | Notes |
|---|---|---|---|
| `pages/api/admin/audit/decision.js` | POST | ADMIN | audit decision write |
| `pages/api/admin/audit/freeze.js` | POST | ADMIN | freeze audit state |
| `pages/api/admin/audit/matrix.js` | GET (no method check) | ADMIN | audit matrix read |
| `pages/api/admin/candidates.js` | GET, PATCH | ADMIN | updates candidate rows |
| `pages/api/admin/check-agreement-duplicate.js` | POST | ADMIN | updates dup-check state |
| `pages/api/admin/find-deal.js` | POST | ADMIN | LLM-backed lookup |
| `pages/api/admin/gaps.js` | POST | ADMIN | inserts gap rows |
| `pages/api/admin/ingest-batch.js` | POST | ADMIN / DESTRUCTIVE | delete+insert+update; batch ingest orchestration |
| `pages/api/admin/ingest-runs.js` | GET, PATCH | ADMIN | ingest run tracking |
| `pages/api/admin/parse-files.js` | POST | ADMIN | zip/docx upload parsing — see EXT/SEC review for zip-bomb note |
| `pages/api/admin/parse-pdf.js` | POST | ADMIN | PDF parsing, no page cap (LOW finding in R3) |
| `pages/api/admin/processing-flow/metrics.js` | GET | ADMIN | pipeline metrics read |
| `pages/api/admin/reconcile/decide.js` | POST | ADMIN | reconciliation decision write |
| `pages/api/admin/reconcile/queue.js` | GET (no method check) | ADMIN | reconciliation queue read |
| `pages/api/admin/reconcile/split.js` | POST | ADMIN | reconciliation write |
| `pages/api/admin/registry/decision.js` | POST | ADMIN | taxonomy registry decision write |
| `pages/api/admin/registry/freeze.js` | POST | ADMIN | taxonomy freeze write |
| `pages/api/admin/registry/preview.js` | GET | ADMIN | taxonomy registry preview read |
| `pages/api/admin/reprocess-cond.js` | POST | **DESTRUCTIVE** | delete+reinsert provisions/annotations; TEST-1 in review notes zero tests, pairs with SEC-1 |
| `pages/api/admin/review-queue/index.js` | GET | ADMIN | review queue read |
| `pages/api/admin/review-queue/[id]/resolve.js` | POST | ADMIN | review queue resolution write |
| `pages/api/admin/schema-loss/decide.js` | POST | ADMIN | schema-loss decision write |
| `pages/api/admin/schema-loss/queue.js` | GET | ADMIN | schema-loss queue read |
| `pages/api/admin/schema-loss/rerun.js` | POST | ADMIN | triggers reprocess |
| `pages/api/admin/store-agreement.js` | POST | ADMIN | insert+update agreement/deal rows |
| `pages/api/agreement-source.js` | GET | AUTHENTICATED-READ | source doc metadata by deal_id |
| `pages/api/ai/annotate.js` | POST | WRITE | LLM-backed annotation suggestion (no DB write itself, but token cost — HIGH finding in R3) |
| `pages/api/ai/categorize.js` | POST | WRITE | LLM-backed, token cost |
| `pages/api/ai/check-duplicate.js` | POST | AUTHENTICATED-READ | LLM-backed check, no DB write |
| `pages/api/ai/suggest-annotations.js` | POST | WRITE | LLM-backed, token cost |
| `pages/api/annotations.js` | GET, POST, PATCH, **DELETE** | **DESTRUCTIVE** | full CRUD incl. delete |
| `pages/api/annotations/propagate.js` | POST | WRITE | inserts propagated annotations |
| `pages/api/ask.js` | POST | AUTHENTICATED-READ | LLM Q&A over provision context; token-burn DoS vector (HIGH, R3); prompt-injection surface (LOW, R3) |
| `pages/api/comments.js` | GET, POST | WRITE | comment CRUD (no delete) |
| `pages/api/compare.js` | POST | AUTHENTICATED-READ | LLM-backed comparison, token cost |
| `pages/api/compare/features.js` | GET | AUTHENTICATED-READ | feature comparison read |
| `pages/api/compare/rep-materiality.js` | GET | AUTHENTICATED-READ | materiality comparison read |
| `pages/api/comparisons.js` | GET, POST, PATCH | WRITE | saved-comparison CRUD |
| `pages/api/corrections.js` | GET, POST | WRITE | human-correction records (feeds DATA-2 re-matcher) |
| `pages/api/cron/edgar-watch.js` | GET, POST | **self-gated** | own `CRON_SECRET` check; fails open if unset (see R3); left out of `middleware.js`'s scope — see `lib/api-auth.js` `SELF_GATED_PREFIXES` |
| `pages/api/deals.js` | GET, POST, PATCH, **DELETE** | **DESTRUCTIVE** | full deal CRUD incl. delete |
| `pages/api/home.js` | GET | AUTHENTICATED-READ | dashboard aggregate read |
| `pages/api/ingest/agreement.js` | POST | ADMIN | insert+update, LLM-backed ingest step |
| `pages/api/ingest/classify.js` | POST | ADMIN | LLM classify + update |
| `pages/api/ingest/extract-section.js` | POST | ADMIN / DESTRUCTIVE | delete+insert+update within ingest pipeline |
| `pages/api/ingest/extract-type.js` | POST | ADMIN | LLM extraction step |
| `pages/api/ingest/from-url.js` | POST | **ADMIN / DESTRUCTIVE-adjacent** | insert+update; unauthenticated SSRF vector (HIGH, R3) — fetches attacker-supplied URL server-side, follows redirects with no revalidation |
| `pages/api/ingest/parse-only.js` | POST | ADMIN | parsing only, no DB write |
| `pages/api/ingest/review.js` | POST | ADMIN | LLM-backed ingest review step |
| `pages/api/ingest/run-all.js` | POST | ADMIN | orchestrates full ingest pipeline |
| `pages/api/ingest/segment.js` | POST | ADMIN | insert+update, 5 LLM calls |
| `pages/api/ingest/segment-v2.js` | POST | ADMIN | ingest segmentation step |
| `pages/api/provision-types.js` | GET, POST, PATCH, **DELETE** | **DESTRUCTIVE** | provision-type/category CRUD incl. delete, also upsert |
| `pages/api/provisions.js` | GET, POST, PATCH, **DELETE** | **DESTRUCTIVE** | full provision CRUD incl. delete |
| `pages/api/query/kinds.js` | GET | AUTHENTICATED-READ | static schema JSON off disk (no DB call) — closest thing to PUBLIC-READ today, deliberately not allowlisted; see note above |
| `pages/api/query/run.js` | GET, POST | AUTHENTICATED-READ | full corpus query execution; QRY-1 pagination bug lived here (fixed separately) |
| `pages/api/redline.js` | POST | AUTHENTICATED-READ | LLM-backed redline generation, token cost |
| `pages/api/review/[id]/cards.js` | GET | AUTHENTICATED-READ | full review-deal payload (PERF-1 slimmed this, still full corpus read) |
| `pages/api/saved-queries.js` | GET, POST, PATCH | WRITE | saved-query CRUD; `is_admin` gate here is the fake-authz finding (MEDIUM, R3) |
| `pages/api/schema-coverage.js` | GET | AUTHENTICATED-READ | schema coverage read across all deals |
| `pages/api/search.js` | POST | AUTHENTICATED-READ | LLM-backed search, token cost |
| `pages/api/signoffs.js` | GET, POST | WRITE | sign-off record CRUD |
| `pages/api/trust/report.js` | GET | AUTHENTICATED-READ | trust-report read by deal_id |
| `pages/api/users.js` | GET, POST | **WRITE — flagged** | POST accepts `is_admin` straight from the request body (self-grant, MEDIUM finding in R3); highest-priority route to fix logic on, separately from auth |

## Totals

- 64 route files under `pages/api/**`.
- **1** self-gated (`cron/edgar-watch`, and that gate fails open if `CRON_SECRET` unset).
- **63** with zero gate today.
- By class (of the 63 ungated): **~26 ADMIN**, **~18 AUTHENTICATED-READ**,
  **~11 WRITE**, **~6 DESTRUCTIVE** (`deals`, `provisions`, `provision-types`,
  `annotations`, `admin/reprocess-cond`, `admin/ingest-batch` /
  `ingest/extract-section` delete+insert internals), **0 PUBLIC-READ**.
  (Some routes straddle two classes across their GET/POST branches — counts
  are per dominant/highest-risk behavior, not a strict partition; see the
  per-route table for the exact split.)

## Pages that fetch these routes client-side (browser `fetch`, no session today)

`components/review/BoundaryAuditPanel.js`, `components/review/EditPanel.js`,
`components/review/TrustStrip.js`, `pages/admin.js`,
`pages/admin/agreements.js`, `pages/admin/candidates.js`,
`pages/admin/gaps.js`, `pages/admin/ingest-runs.js`, `pages/admin/registry.js`,
`pages/admin/review-queue.js`, `pages/admin/schema-loss.js`,
`pages/deals/index.js`, `pages/frankenstein.js`, `pages/index.js`,
`pages/library.js`, `pages/provisions/[id].js`, `pages/review/[id].js`.

## Pages that fetch server-side (unaffected by this middleware either way)

`pages/admin/taxonomy.js` (`getServerSideProps`, calls `lib/` directly — no
`pages/api/**` round-trip), `pages/design/index.js` (`getServerSideProps`,
same pattern), `pages/admin/processing-flow.js` and `pages/admin/registry.js`
(`getStaticProps`, build-time only).

## What this doc does not decide

- Whether the shared-secret model is the final answer or a stepping stone to
  session-based auth (Vercel/Supabase Auth) — R3's fix recommendation
  suggested the latter as the stronger long-term posture.
- Which (if any) routes should move to `PUBLIC_GET_ALLOWLIST`.
- How the client-side pages listed above will authenticate once the flag is
  actually turned on — see "The client-side-fetch problem" above.
- Fixing `pages/api/users.js`'s `is_admin` self-grant logic, the SSRF hole in
  `ingest/from-url.js`, or the `CRON_SECRET` fail-open — those are separate
  BEN-QUEUE items (SEC-1 companions), not part of this additive middleware.
