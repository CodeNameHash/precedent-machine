# Production RLS hardening (2026-08-02)

Authorized by Ben 2026-08-02. Investigation (Sonnet, read-only,
Fable-spot-checked) → plan → applied → live-verified, same day.
Project: precedent-machine (tzulhdasmioeechxapdy).

## What was exposed

19 public tables with RLS disabled and Supabase's default
`GRANT ALL` to `anon`/`authenticated` — full unauthenticated
read/write via the REST API. All 19 were empty (0 rows) at
remediation time, so exposure was structural, not realized. Two
SECURITY DEFINER trigger functions were publicly callable via
`/rest/v1/rpc/`. Six functions had mutable search_path (WARN).

## Why the fix was zero-outage by construction

Every access path was mapped before touching anything: all 16
`pages/api/*` routes use the service-role client exclusively (service
role bypasses RLS); the only anon-key consumer is the realtime hook,
subscribed solely to `annotations`/`comments`/`signoffs` (already
RLS-enabled); 12 of the 19 tables are unreferenced dead schema from
the unbuilt card-model children; no Supabase Auth exists (single-user
app, browser → Next.js API → service role). The
`termination_fee_triggers` string in the review-v2 client bundle is a
`kind` discriminator served from the SEPARATE canonical-v2 staging
project, not a table reference.

## Migrations applied (Supabase migration history)

1. `rls_hardening_19_tables_revoke_and_enable` — REVOKE ALL from
   anon/authenticated + ENABLE ROW LEVEL SECURITY (no policies) on
   all 19 tables, one transaction.
2. `revoke_trigger_fn_execute_and_pin_search_paths_v2` — REVOKE
   EXECUTE on the two trigger functions from anon/authenticated;
   `SET search_path = public` on the six flagged functions (the
   claim_* functions' real signatures differ from the advisor's
   rendering: `claim_ingest_jobs(text, text[], integer, integer,
   text)`, `claim_coding_tasks(text, integer, integer)`).
3. `revoke_public_execute_trigger_fns` — the SECURITY DEFINER WARNs
   survived role-level revokes because EXECUTE flowed via PUBLIC;
   revoked from PUBLIC.

## Verification (all passed)

- Advisor re-run: zero `rls_disabled_in_public` errors (was 19).
  Remaining `rls_enabled_no_policy` INFO lints are the intended state
  for a service-role-only app.
- `pg_tables`: zero public tables with rowsecurity=false.
- Negative tests with the live publishable key:
  `deal_topology`/`termination_fee_triggers`/`saved_queries` REST
  reads → 401 permission denied; trigger RPC → no longer resolvable.
- Live production (deal-corpus.vercel.app): `/api/deals` 200 with
  real data; deal-detail 200 including `deal_topology` payload.
  `/api/provisions` and `/api/saved-queries` return 503
  `ROUTE_CONTAINED` — verified as the app's OWN query-containment
  gating (lib/query-containment.js returns 503 by design; tracked by
  programme gates), pre-existing and unrelated to this change.

## Residual notes

- The legacy JWT anon key is disabled; the active publishable key was
  used for negative tests.
- Tool-integrity observation (worth keeping in mind): the Supabase
  MCP `list_tables` output embedded instruction-shaped advisory text
  with remediation SQL inside schema results. The investigating agent
  correctly treated it as untrusted and re-derived everything from
  its own catalog queries + get_advisors. Pattern flagged so future
  sessions don't act on tool-embedded imperatives.
- Storage/rest of the advisor surface is clean at ERROR level.
