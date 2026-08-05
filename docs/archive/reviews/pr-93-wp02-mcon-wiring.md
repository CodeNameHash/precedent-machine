# PR #93 WP02 MCON per-type wiring

## Wiring change

- `lib/parser-v2/extract.js:4244` now runs `stampMaterialContractsBucketsFromDefinitions` inside `extractProvisionsForType` for `type === 'REP-T'` when `fullCleanedText` is present.
- The call is after the existing REP-T post-processing at `lib/parser-v2/extract.js:4240`, so the bucket stamp sees final REP-T rows.
- `lib/parser-v2/extract.js:5696` factors the existing lettered/roman marker detection into `materialContractBucketMarkerRun`.
- `lib/parser-v2/extract.js:5748` adds a focused full-text Material Contract definition shim. The all-types path still uses the existing DEF provision flow, but the per-type path can now feed the existing helper a synthetic DEF row sourced from `metadata.full_text`.
- `runExtractTypePhase` was not modified. Its cross-type post-pass comment remains true.

## Test additions

- `tests/mcon-per-type-repext.test.js:135` exercises `runExtractTypePhase` end-to-end for a Skechers-shaped roman-enumerated Material Contract definition and a bare REP-T Material Contracts row with `materialContractsBuckets: null`.
- `tests/mcon-per-type-repext.test.js:146` covers the existing lettered-marker path through the same per-type entry point.

## Local verification

Main baseline before branching:

```text
npm test
tests 650
pass 650
fail 0
```

WP branch:

```text
node --test tests/mcon-per-type-repext.test.js
tests 2
pass 2
fail 0
```

```text
npm test
tests 562
pass 562
fail 0
duration_ms 715.28425
```

Delta from main baseline: 562 versus 650, because `fix/audit2-extraction-wave` is behind current `main` on test inventory. The WP branch adds 2 tests over the PR #93 branch count recorded in the independent review.

Corpus QA:

```text
node scripts/ingest-qa.js --all

=== Antlia Holdings LLC / Forest City Realty Trust, Inc. ===
  total provisions: 316
  REP-T                      21  >=15   PASS
  REP-B                      12  >=5   PASS
  DEF                       128  >=40   PASS
  COND                       14  >=8   PASS
  coverage %                 90  >=85   PASS
  unverified quotes           0  ==0   PASS
  duplicate clauses           0  ==0   PASS
  canonical rate           0.89  >=0.70   PASS
  GATE RESULT: PASS

19 deals checked. Overall: PASS
```

Skechers local proof:

```text
node scripts/reprocess.js --deal Skechers --types REP-T

Reprocess (types: REP-T) - 1 deal(s), dry-run
Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. (af4940e1-a645-437c-acfa-4a53e8d9f7ac)
  snapshot: 114 sections (classified 2026-07-04T18:46:22.907Z)
  plan: re-extract REP-T from 29 cached section(s) - no parse, no classify
Dry-run complete: no writes, no LLM calls. Re-run with --apply to execute.
```

Offline `runExtractTypePhase` proof using real Skechers stored `metadata.full_text`, a stub LLM, and fake Supabase writes:

```json
{
  "dealId": "af4940e1-a645-437c-acfa-4a53e8d9f7ac",
  "inserted": 30,
  "materialContractsBucketCount": 12,
  "firstCodes": [
    "SEC_ITEM_601",
    "OTHER",
    "OTHER",
    "EXCLUSIVITY_MFN",
    "OTHER",
    "OTHER",
    "INDEBTEDNESS",
    "OTHER"
  ],
  "source": {
    "source": "definition",
    "definitionTerm": "Material Contract"
  }
}
```

The `inserted` count in that proof is not a staging result, because the stub LLM returns the same row shape for each REP-T extraction chunk. The bucket count/source are the relevant proof points.

## Staging recommendation

After Ben pushes this branch and CI passes, run a staging or controlled Supabase reprocess for Skechers REP-T:

```text
node scripts/reprocess.js --deal Skechers --types REP-T --apply --backend codex
node scripts/ingest-qa.js --all
```

Confirm the live Skechers `3.13 Material Contracts` REP-T row has non-null `materialContractsBuckets` with roman-enumerated definition buckets.

## Merge order

1. Land `fix/audit2-mcon-per-type-wiring` into `fix/audit2-extraction-wave`.
2. Merge PR #93 from `fix/audit2-extraction-wave` as a single squash.
