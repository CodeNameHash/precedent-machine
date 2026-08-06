# WP04 P4: Tender Offer Mechanics

## Scope

Adds `STRUCT-OFFER` for two-step tender-offer mechanics in Verve, CSRA, Bioverativ, and Pharmasset.

## Source Review

Read the stored agreement text for the four tender-offer deals from `deals.metadata.full_text` and parsed locally, read-only:

- Verve: §1.1 The Offer, §1.2 Company Consent; Schedule 14D-9, §1.3 Stockholder Lists, §2.1-2.6 back-end merger / §251(h).
- CSRA: §2.1 The Offer, §2.2 Company Actions, §2.3 Directors, §2.5 back-end / short-form merger.
- Bioverativ: §2.01 The Offer, §2.02 Company Actions, §2.03 closing, §2.04 / §6.03 back-end merger under §251(h).
- Pharmasset: §1.1 The Offer, §1.2 Company Actions, §1.3 Company Directors, §1.6 back-end merger.

## Implementation

- Added canonical rubric code `STRUCT-OFFER` with an offer-specific feature schema.
- Added deterministic classification refinement for true offer-mechanics section titles: `The Offer`, `Company Actions`, `Company Consent; Schedule 14D-9`, and `Stockholder Lists`.
- Added deterministic extraction for offer launch, price, conditions reference, extension, acceptance/payment, Schedule TO, Schedule 14D-9, stockholder-list support, board-designation text, and back-end merger mechanics.
- Wired the review STRUCT table and compare summary fields so tender-offer mechanics are visible, not buried as generic STRUCT text.

## Corpus Classification Dry-Run

`node scripts/reprocess.js --all --classify-only` was run read-only with env sourced from the main repo.

Result:

- `STRUCT-OFFER` appears only in the four tender-offer deals: Verve, CSRA, Bioverativ, Pharmasset.
- No non-tender deal gained `STRUCT-OFFER`.
- No provision type reclassification was caused by this change. Existing same-type code refinements such as `COV-MEETING` still appear in the dry-run output.

## Gates

- `node --test tests/tender-offer-mechanics.test.js`: PASS, 5 tests.
- `npm test`: PASS, 672 tests.
- `node scripts/ingest-qa.js --all`: PASS, 19 deals.

No live reprocess or apply was run.
