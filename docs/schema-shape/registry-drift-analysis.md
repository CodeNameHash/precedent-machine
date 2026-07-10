# Feature-schema registry drift: diagnosis & fix

## TL;DR

The committed generated registry (`lib/schema/features.generated.js`,
`lib/schema/tags.generated.js`) had drifted ~21 keys + hundreds of field
values behind what a clean pipeline run produces, because it was generated
from a **stale inventory** and then **hand-patched** in place. Fixed by
refreshing the inventory, teaching the generator to emit the 12 phase-0-C
reconciliation keys (so the generator output is a superset of the persistence
gate), and regenerating. A new guard test (`tests/registry-generated-drift.test.js`)
re-runs the full pipeline into a temp dir and fails on any future drift.

`interestRateBasis` survives the regen. **Zero** in-use / persisted keys are
removed. Safe path.

## The three-layer schema, corrected

The task brief lists `features.generated.js`, `features.js`, and
`tags.generated.js` as "the generated files." That is not what the generator
does. Ground truth from `scripts/generate-registry.js`:

- It reads `docs/schema-migration/inventory.jsonl` +
  `docs/schema-migration/source-inventory.json` (produced by
  `scripts/schema-inventory.js` from `lib/rubric.js`, `lib/taxonomy.js`, the
  expected-sets/category-summary helpers, and the review UI).
- It **writes only** `lib/schema/features.generated.js` and
  `lib/schema/tags.generated.js`.
- It **never writes** `lib/schema/features.js` or `lib/schema/tags.js`.

`lib/schema/features.js` is a **hand-maintained** registry that was seeded once
from `features.generated.js` and then curated (real descriptions, real
extraction prompts, `objectShape`, `listItemTagFamily`, `whenEmpty` states,
narrowed `provisionCodes`). It is the file `lib/parser-v2/store-claims.js`
imports, so it is the **persistence gate**. Overwriting it with generator
output would replace every curated `extractionPrompt` with a bare label and
every description with `TODO:` — a corpus-wide extraction-quality regression.
So `features.js` was **not** overwritten. Only the two true generator outputs
were regenerated.

## Root cause of the drift

`features.generated.js` at HEAD was **not** pure generator output:

1. **Stale inventory.** It had been generated from an older
   `inventory.jsonl` that predated recent `rubric.js` growth. Since then the
   rubric gained the `IOC-B` / `IOC-T` provision types and the
   `terminationFees`, `party_role`, and `interestRateBasis` (TERMF) keys.
   Re-running `schema-inventory.js` adds 10 keys to the inventory and updates
   `provisionTypes` on `materialityQualifier`, `parentBuyerIocBuckets`,
   `scheduleReference`, and `flags` (now include `IOC-B`/`IOC-T`), which in
   turn shifts `displayOrder` on ~267 downstream entries.
2. **Hand-patches.** `interestRateBasis` and `scheduleReference` had rich,
   hand-written `description`/`extractionPrompt` values pasted directly into
   `features.generated.js` (the "hand-inserted to avoid a dirty regen"
   pattern). The generator legitimately emits `TODO:` descriptions there;
   curation belongs in `features.js`, where these keys already carry the rich
   text. So the hand-patches were curation in the wrong file.
3. **Reconciliation keys only in `features.js`.** The phase-0-C registry
   reconciliation added 12 keys (below) to `features.js` but not to
   `rubric.js` and not anywhere `schema-inventory.js` scans, so the generator
   never emitted them. That means a "regenerate then reseed `features.js`"
   (the documented original workflow) would have **silently dropped all 12**
   from the persistence gate — the exact high-stakes failure mode.

## Drift, quantified

`features.generated.js`: HEAD had 525 keys; a clean regen produces 546.

- **Adds (21), removes (0)** vs HEAD:
  `absenceConductedOrdinaryCourse, absenceSpecifiedIOCReferences,
  absenceSpecifiedIOCs, antitrustEffortsStandard, assignmentProvisos,
  buyerEffortsCap, cashAmount, divestitureInCondition,
  feeExpenseAllocationExceptions, interveningEventExceptions,
  nominalTargetParty, notificationCovenantFailureStandard, party_role,
  primaryForum, regionId, region_id, section_number, source_section,
  targetEffortsCap, tenderOffer, terminationFees`.
- **273 shared keys changed:** 267 `displayOrder`-only (inventory re-index);
  6 touch `provisionTypes` / `description` / `extractionPrompt` / `label`
  (`interestRateBasis`, `materialityQualifier`, `parentBuyerIocBuckets`,
  `positiveObligations`, `scheduleReference`, `flags`).
- `tags.generated.js`: **no change** (130 tags, identical).

## Safety gate

Key-set delta between the fresh regen and the committed **persistence gate**
(`lib/schema/features.js`, 539 keys):

- **Regen ADDS vs `features.js` (7):** `assignmentProvisos, cashAmount,
  primaryForum, regionId, region_id, section_number, source_section`. These
  are generator/inventory-derived keys not curated into `features.js`;
  `primaryForum` and `assignmentProvisos` are known orphan taxonomy keys
  slated for separate cleanup. None need to be added to `features.js` here.
- **Regen REMOVES vs `features.js` (0).** The generator output is a strict
  **superset** of the persistence gate. No persisted / in-use key is dropped.
- `interestRateBasis` present in both the regen and `features.js`. ✅
- All 12 phase-0-C reconciliation keys present in the regen. ✅

**Verdict: SAFE.** Identical-or-superset key-set, zero removals.

## The fix (generator-first, never hand-edit features.js)

1. **Refreshed the inventory** by running `scripts/schema-inventory.js`
   (picks up current `rubric.js`: adds `interestRateBasis`, `terminationFees`,
   `party_role`, etc.).
2. **Extended `scripts/generate-registry.js`** with a new
   `supplementalReconciliationFeatures()` set (12 keys) plus a widened
   `supplementalFeature()` signature (now accepts `enumSet`, `provisionCodes`,
   `presence`, `citable`, `requiredEvidence`). These 12 keys were added by the
   phase-0-C reconciliation and live only in `features.js`; emitting them from
   the generator makes the generated baseline a **superset** of the
   persistence gate, so a regen-and-reseed can never drop them. Field shapes
   mirror the reconciliation provenance recorded in
   `docs/schema-shape/normalized-v1.json`.
3. **Regenerated** `features.generated.js` + `tags.generated.js` via the
   default pipeline, so committed == generator output. Curation stays in
   `features.js`; the generated baseline carries `TODO:` descriptions as
   designed.
4. **Did not touch** `lib/schema/features.js`, `lib/taxonomy.js`, or
   `lib/parser-v2/extract.js`.

The pipeline is deterministic: running it twice into separate temp dirs
produces byte-identical `features.generated.js`, `tags.generated.js`,
`inventory.jsonl`, and `source-inventory.json`.

## Guard test

`tests/registry-generated-drift.test.js` (top-level, so `npm test`'s
`tests/*.test.js` glob runs it):

- **Test 1 — no drift.** Re-runs `schema-inventory.js` then
  `generate-registry.js` into a throwaway temp dir (via the new
  `SCHEMA_INVENTORY_OUT` / `SCHEMA_REGISTRY_IN` / `SCHEMA_REGISTRY_OUT` env
  overrides, so nothing on disk is clobbered) and asserts committed
  `features.generated.js` / `tags.generated.js` match the fresh output
  entry-by-entry. Fails on any hand-edit or un-regenerated rubric change.
- **Test 2 — persistence-gate superset.** Asserts every key in
  `lib/schema/features.js` exists in the fresh generator output (no persisted
  key can be dropped by a regen), and pins `interestRateBasis` + the 12
  reconciliation keys explicitly.

Both proven to fail on injected drift (a hand-edited generated entry; a
`features.js` key the generator doesn't emit) and to pass on the committed
tree.
