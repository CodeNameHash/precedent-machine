# No-shop timing certification F24 implementation plan

## Scope

Extend the exact F23 copy-delivery release with three separately governed QXO
timing metrics:

1. initial notice;
2. initial match period; and
3. subsequent match period.

F24 certifies source, normalisation, party, trigger, cohort, cache and Query
identities. It does not activate Canonical Query, change an active pointer,
persist corpus data, alter production or certify prohibited actions.

## Task 1: preserve the certified predecessor

1. Treat the exact F23 bundle and manifest as immutable predecessors.
2. Do not modify F19 through F23 or the F21-frozen serving validators.
3. Create an F24 successor registry and certification bundle.
4. Require the exact F23 manifest ID, payload digest, bundle ID and
   copy-delivery admission before accepting the successor.

## Task 2: certify three exact legal clocks

For each metric, bind the exact V12 metric definition, reviewed claim, party,
source excerpts and normalisation:

1. `NO_SHOP_NOTICE_PERIOD_DAYS`: Company/target covenant obligation,
   twenty-four elapsed hours normalised to one elapsed day, triggered by
   receipt of a Company Acquisition Proposal or Company Request.
2. `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS`: Parent/acquirer right, four business
   days, triggered by superior-proposal notice.
3. `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS`: Parent/acquirer right, a new four
   business day period, triggered by each material amendment to the superior
   proposal.

The notice certification must bind the authoritative F15 notice revision,
retain the raw hours, preserve the source-local singular/plural Company Request
definition treatment and remain distinct from the copy-delivery metric. Match
and rematch must remain separate cohorts.

## Task 3: metric-scoped carriers

For each timing metric:

1. create one content-addressed admission with no wildcard authority;
2. carry the admission through one source-backed timing record, one set-based
   cohort request/result and one Query projection;
3. include release, metric, party, basis and admission identities in the
   cohort and cache keys;
4. bind exact source offsets, excerpt IDs, claim IDs and normalisation
   lineage;
5. make the clear/ambiguous state explicit without borrowing the separate
   copy-delivery ambiguity; and
6. retain `NONE` for active release, Query, pointer, write and production
   authority.

## Task 4: successor manifest

Create one F24 manifest that:

1. binds the exact F23 manifest and bundle;
2. lists all four no-shop timing admissions, including the preserved
   copy-delivery admission;
3. contains three new timing certifications with exact set equality across
   admissions and carriers;
4. content-addresses all carrier partitions;
5. defines one bounded set-based read shape for the three new metrics; and
6. remains ineligible for activation.

## Task 5: adversarial verification

Prove:

1. hours normalise to elapsed days without losing raw units;
2. business days never compare with elapsed days;
3. notice, copy delivery, initial match and rematch cannot substitute for one
   another;
4. party, trigger, source, claim, contract, release or admission substitution
   fails;
5. source-local `Company Requests` is not treated as a second definition;
6. a malformed timing member fails locally while valid siblings remain
   renderable;
7. forged re-signing cannot escape the exact source and F23 predecessor;
8. cache identity changes with metric, basis, party, release or admission;
9. F19 through F23 fixtures remain unchanged; and
10. no route, flag, pointer, retry or production authority is introduced.

## Task 6: staging proof and shipment

1. Use only `deal-corpus-canonical-v2-staging`.
2. Validate the bundle locally before database work.
3. Insert all three timing certifications in one set-based statement inside a
   short transaction with timeouts, advisory lock, RLS and revoked public
   access.
4. Roll back unconditionally and prove no table or pointer change remains.
5. Run focused and complete tests, production build, programme verification
   and the F24 phase allowlist.
6. Obtain independent architecture and legal-semantic reviews.
7. Commit only F24 files, preserving
   `docs/codex-program/engine-build-map.md` untouched.
8. Push, merge after checks, deploy `deal-corpus`, smoke-test the disabled
   production APIs and continue directly into F25.
