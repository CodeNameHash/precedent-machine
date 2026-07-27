# Metric-scoped serving admission F22

## Purpose

Replace the current all-or-nothing admission boundary for post-V5 contracts
with one reusable metric-scoped boundary. The first admitted candidate is the
V12 QXO no-shop copy-delivery metric already certified by F19 through F21.

F22 changes policy structure only. It does not activate Canonical Query, alter
the active corpus release, write corpus data or make a production metric live.

## User outcome and sequence

No-shop remains the reference vertical slice:

1. Build the reusable metric-scoped gate.
2. Admit the certified copy-delivery identity through that gate without
   activating a release.
3. Certify the remaining no-shop timing metrics.
4. Certify prohibited actions and exception effects.
5. Render the complete no-shop result consistently in Review, Compare, Corpus
   Context and Query.
6. Complete browser acceptance and only then seek production activation.
7. Begin Material Contracts as the first different provision family.

Material Contracts must preserve each raw lookback expression and resolve it
against the signing date where the source permits that derivation. The
normalised observation must retain the resolved anchor, signing date, elapsed
period, precision, derivation version and evidence. An unresolved anchor
remains visible in Review and outside a canonical market cohort.

## Chosen architecture

### Metric admission

Create an immutable `MetricServingAdmission/V1`. One record admits exactly one
metric identity:

- `contract_fingerprint`
- `metric_key`
- `metric_version`
- `concept_key`
- `required_claim_definition_key`
- `interpretation_admission_digest`
- `candidate_metric_definition_admission_id`
- `integration_admission_id`

The record also binds its certification evidence and carries a content-derived
`metric_serving_admission_id`.

The first record may cover only:

- contract V12;
- `NO_SHOP_COPY_DELIVERY_PERIOD_DAYS`, version 1;
- concept `NOSOL-NOTICE`;
- claim `NO_SHOP_COPY_DELIVERY_PERIOD_DAYS`; and
- the exact F19, F20 and F21 identities.

No family, concept or contract wildcard is permitted.

### Dual admission lanes

The existing V1 through V5 fingerprint allowlist remains unchanged for
historical rows and metrics.

V6 and later contracts use the metric-scoped lane and default to denied. A
later-contract row or request is eligible only when:

1. its exact metric identity matches a frozen admission record;
2. the candidate release manifest references that admission ID; and
3. every row, query and cache identity carries the same admission ID.

The two lanes meet in one central validator. Callers cannot select a lane.

### Release and production authority

A metric admission certifies policy eligibility. It does not make the metric
live.

The candidate release manifest must list the exact admission IDs used by its
rows. The active-release pointer and feature flag remain separate production
controls. Therefore:

- adding an admission record cannot activate a release;
- adding rows to a candidate release cannot change the active corpus; and
- activating an unrelated release cannot admit a metric absent from its
  manifest.

## Shared serving contract

Metric-scoped rows use `SharedServingRow/V2`. Historical V1 rows remain
immutable and valid through the legacy lane.

V2 adds one `metric_serving_admission_id`. The validator resolves the
content-addressed admission record and checks its eight identity fields against
the row's provenance and canonical result. UI consumers receive the same
normalised row view regardless of row version.

Internal compiled market requests also carry the admission ID. Public request
payloads do not. The server derives the admission from the active release and
requested governed metric.

Exact-detail responses bind the same admission ID, preventing a source detail
from one metric or release being substituted into another.

## One authoritative validator

Create one pure admission module used by:

- market request compilation;
- serving projection construction;
- candidate release certification and import;
- shared-row validation;
- exact-detail validation; and
- release-aware cache identity construction.

No consumer may maintain a separate metric exception or copy of the registry.
An admission is accepted only through the central module.

## Request and data flow

1. The route resolves the active release server-side.
2. The requested metric resolves to its governed metric definition.
3. The central validator chooses the legacy or scoped lane from the contract,
   never from caller input.
4. For the scoped lane, it resolves the admission ID from the active release
   manifest and validates all eight identity fields.
5. The compiled request performs one indexed, set-based RPC.
6. Returned rows are validated against the same release and admission ID.
7. The cache key includes release, metric, cohort, refinements and admission
   identity.
8. Each UI surface consumes the shared normalised row contract.

Registry validation is in-memory and constant-time. It adds no database call.
One market request remains one bounded database call, independent of corpus
size.

## Failure behaviour

The system fails closed and locally:

- Missing or unknown admission: exclude that metric only.
- Identity mismatch: reject the row or request before database work.
- Admission absent from the release manifest: reject it even if code knows it.
- Malformed sibling row: preserve all valid rows on the page.
- Unresolved legal interpretation: show the source-backed result in Review
  with its reason, but do not admit it to a canonical cohort.
- Database or capacity failure: no immediate retry and no legacy fallback for
  a governed request.

The UI must never convert these states into generic `No market data`. It must
distinguish non-comparable, unresolved, absent, failed and feature-disabled
states.

## No-shop completion contract

After the gate and copy-delivery admission, the no-shop slice is not complete
until it covers:

- initial notice period;
- copy-delivery period;
- initial and subsequent match periods;
- prohibited-action categories;
- exact exception effects and prerequisites;
- primary and alternative interpretations;
- source-local plural and nested definitions;
- hours-to-days normalisation without losing raw units;
- lawyer-visible ambiguity warnings; and
- term-level market analysis rather than mere provision prevalence.

Each metric or categorical comparison receives its own admission and
certification. A failure in one does not suppress the other no-shop rows.

## Testing and acceptance

Mandatory mechanical tests:

- V12 copy delivery passes only with the exact admission.
- Every other V12 metric remains denied.
- Cross-metric, cross-contract, cross-release and interpretation substitution
  fail.
- A forged or omitted release-manifest admission fails.
- Legacy V1 through V5 behaviour remains byte-identical.
- Query, row, exact-detail and cache validation use the same admission.
- A malformed metric leaves valid sibling rows renderable.
- One request performs one bounded RPC and a cache hit performs none.
- No new retry, database write, pointer mutation or feature activation exists.

Before no-shop activation:

- full unit and integration suites pass;
- the database load invariant remains corpus-independent;
- Review, Compare, Corpus Context and Query pass browser acceptance;
- visual regression and accessibility checks pass;
- production feature flags remain closed until explicit activation; and
- architecture and legal-semantic reviews pass.

## Planned increments

1. **F22:** central admission contract, dual-lane validator and exact
   copy-delivery admission, all non-activating.
2. **F23:** V2 shared row, release-manifest binding and rollback-only staging
   proof for copy delivery.
3. **F24:** no-shop notice and match-period certification.
4. **F25:** prohibited-action and exception-effect certification.
5. **F26:** complete cross-view no-shop rendering and browser acceptance.
6. **Activation gate:** explicit production decision after all no-shop checks.
7. **Material Contracts:** first cross-family slice, including signing-date
   relative lookback normalisation.

## Out of scope for F22

- Production feature activation.
- Active-release pointer changes.
- Corpus writes, re-extraction or backfill.
- Admission of any metric other than copy delivery.
- Material Contracts implementation.
- Changes to Ben-approved legal interpretations or taxonomy.
