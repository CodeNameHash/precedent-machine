# WP04 Phase 1: RSA/ESPP treatment and live-ingest instrument backfill

Base resolved at phase start: `origin/fix/audit2-extraction-wave` (`41dbe5f`).

## Root Cause

RSA/ESPP treatment rows rendered blank because `backfillMissingInstrumentMentions` added missing instruments from CONSID-EQUITY source text but deliberately left `instrumentTreatments` empty. After `expandConsidEquityByInstrument`, those synthetic instrument rows had `features.equityAwardTreatment = null`.

Live full ingest uses `scripts/ingest-local.js -> runParserPipeline() -> extractProvisions()` and was already passing through `backfillMissingInstrumentMentions` before row expansion. The missing behaviour was inside the shared backfill, not in the UI or store layer. The per-type path also calls the same backfills in `extractProvisionsForType()`.

## Fix

- `lib/parser-v2/extract.js:6524` adds deterministic clause-span selection for the missing instrument's own limb.
- `lib/parser-v2/extract.js:6547` maps only explicit source-language treatment verbs to canonical `EQUITY_TREATMENT` codes.
- `lib/parser-v2/extract.js:6616` now appends paired treatments for backfilled instruments when the verbatim source clause supports one.

No treatment is invented. If the source text only names an instrument and does not state a treatment, the row still renders blank.

## Tests

Added `tests/rsa-espp-treatment-and-instrument-backfill.test.js`.

Coverage:
- Full-ingest entrypoint parity: calls `extractProvisions()`, the function used by `scripts/ingest-local.js`.
- Per-type parity: calls `extractProvisionsForType()` for CONSID.
- Fixture reproduces the live failure shape: LLM returns only options, while RSA and ESPP are present in source text.
- Asserts RSA gets `ACCELERATED_VESTING` and ESPP gets `CANCELLED_NO_CONSIDERATION` from verbatim source spans.

## Verify

`npm test`

Tail:

```text
tests 564
suites 0
pass 564
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 997.387291
```

Test count delta from base: +2.

No Supabase write was made. `node scripts/ingest-qa.js --all` was not required.

## Repro

Run `npm test -- tests/rsa-espp-treatment-and-instrument-backfill.test.js`, or inspect any CONSID-EQUITY fixture where the model emits only `STOCK_OPTIONS` while the source text also contains a treated RSA and ESPP limb.
