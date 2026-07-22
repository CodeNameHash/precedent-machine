# Canonical Corpus V2 handoff, 2026-07-22

This is the operational checkpoint for the next implementer. The governing
programme remains `docs/CODEX-PROGRAM.md`. Do not reopen settled architecture
through this handoff.

## Repository state

- Production repository: `/Users/bengoodchild/Documents/Claude/precedent-machine`
- Canonical integration worktree:
  `/Users/bengoodchild/Documents/Claude/precedent-machine-canonical-v2`
- Integration branch: `codex/canonical-corpus-v2`
- `main`, `origin/main`, and `origin/codex/canonical-corpus-v2` are all at
  `3df4ed79723705383add2df3cdaa2fad0761f4af` before this handoff-only commit.
- `docs/codex-program/engine-build-map.md` is an untracked Ben-owned file in
  the integration worktree. Preserve it. Do not stage, delete, or overwrite it.

## Completed architectural slice

Commit `3df4ed7` binds the serving projection to immutable corpus releases.
It prevents a changed query-row shape from being published under an existing
release identity.

The slice added:

- Frozen serving projection contracts for legacy V1 and current V2 rows.
- Exact V2 field validation, including `payment_timings` and
  `trigger_conditions`.
- Projection version and contract digest binding in candidate manifests,
  bundles, import plans, receipts, release identity, SQL records, and import
  validation.
- Backward reconstruction and validation for existing V1 and V2 artefacts.
- A new QXO material candidate identity for the projection-bound release.
- Additive staging schema support for the projection contract digest.

The frozen V2 serving projection contract digest is:

`048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827`

The schema digest after this slice is:

`29ba5cb3a6cbd7d8adb69cb692956ccadf81ff1bcde3ed166ff393b31e13d0a8`

## Staging state

Staging Supabase project:

- Project ref: `sjumbznveyyiizhwvixj`
- Project name: `deal-corpus-canonical-v2-staging`

The schema migration passed dry-run, apply, and post-apply verification. The
QXO candidate passed rollback-only dry-run, inactive import, inactive
verification, rollback rehearsal, and re-import. No active pointer was changed.

New inactive QXO candidate:

- Corpus release:
  `df83cf6f0328dd387280ae17fd5ebda4c0a606d9af0cff1c189399a1461b077d`
- Release seed digest:
  `0735cad212c782e92c149212365edf5d757cddb09f6c0cd3857a8d6af93c7fa3`
- Namespace:
  `bd6715c4a8f0a75194b568fef10ee118fb63612e82b2ad90da0d0e0ef985bb9b`
- Manifest:
  `65d5afe597f48fa095176e941803fabeafc71922195b120a3d05bfc50f9276f1`
- Incomplete row:
  `437f3b439417ded9691c061880f7325dff3a7e85d2b71870f12cd7d7aadbcb34`
- Correction seal:
  `7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd`

The new V2 and old V1 partitions coexist. The active staging pointer remains:

- Generation: `8`
- Pointer:
  `eda01d9851522edada42a76f1bb1afebd8061528166523124bed3a20c9babf8b`
- Corpus release:
  `c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3`
- Namespace:
  `9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68`

Do not activate the QXO candidate without Ben's approval.

## Production state

Vercel deployment:

- Deployment id: `dpl_CCrtzYCRVRKjm2LEk3r5eXksz74t`
- Production URL: `https://deal-corpus.vercel.app`
- Deployment URL:
  `https://deal-corpus-dzuexl8c2-codenamehashs-projects.vercel.app`

Live verification completed after deployment:

- `/` returned `200`.
- `/review/7dc3a05f-b170-4d59-a255-b7103cca16e1` returned `200`.
- `POST /api/canonical-v2/query` returned `503 FEATURE_DISABLED`.
- `POST /api/market-stats` returned `503 MARKET_STATS_DISABLED`.

Production containment must remain in place. Do not enable Canonical Query,
reopen market stats, activate a corpus release, re-extract, backfill, replay a
corpus, or load-test production.

## Verification already green

- `npm test`: 2,674 of 2,674 passed.
- `npm run verify:codex-program`: passed with programme digest
  `48442a6b1b9634464eeede0955c0d0688b03dfb1e1aff8b148ee8db1dea09470`.
- `npm run build`: passed.
- `git diff --check`: passed.

The build emitted only the existing missing-ESLint warning and existing large
page-data warnings for administration pages.

## Next bounded slice

Implement the first feature-flagged Canonical Query UI path for one supported
request only: an ad hoc `MARKET_RANGE` query for the seller termination fee as
a percentage of deal value.

Required behaviour:

1. Add a pure mapper from the existing request shape
   `{ TERMINATION_FEE, feePctOfDealValue, deal_filter }` to the governed
   canonical concept, metric, seller party, and cohort filters.
2. For that exact supported request, skip the legacy resolver preflight, make
   one bounded POST to `/api/canonical-v2/query`, and render the shared
   canonical row/result contract.
3. Keep saved queries, reverse termination fees, unsupported metrics, and all
   other query shapes on the existing legacy path.
4. Keep every new feature flag disabled by default in production.
5. Add unit and route tests proving supported routing, legacy fallback, party
   specificity, percentage normalisation, one-request behaviour, disabled-flag
   behaviour, and safe error rendering.
6. Verify with the full test suite, programme checks, build, and browser smoke.

This is a thin integration slice. Do not redesign the whole Query page, widen
the supported-query set, alter taxonomy, or activate the candidate corpus as
part of it.

## Outstanding decision, not an implementation blocker for the thin UI slice

The genuine Freeze Gate remains pending for QXO termination taxonomy codes.
Do not invent or silently adopt codes while implementing the UI path. Any
taxonomy or codebook decision still requires Ben.

## Non-negotiable safety constraints

- Work only in the dedicated integration worktree for canonical changes.
- Use staging-only credentials for candidate corpus and serving work.
- Every corpus write is dry-run first and must be local, Ben-run, and staging
  only.
- Keep completed architectural slices deployable behind disabled flags.
- Never mutate an existing published corpus release.
- Never expose unresolved discovery or review payloads through serving/query
  roles.
- Never make corpus-proportional database calls from one market request.
- Preserve production database containment until the bounded, set-based,
  cacheable request path has passed its programme gates.
