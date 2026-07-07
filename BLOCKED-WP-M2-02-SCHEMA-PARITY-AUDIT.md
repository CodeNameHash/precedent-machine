# BLOCKED-WP-M2-02-SCHEMA-PARITY-AUDIT

Date: 2026-07-07

WP-M2-02 cannot proceed because the schema-first card render path that the parity audit is meant to compare does not exist on `origin/main`.

## Required path is absent

The M2-02 brief requires the harness to render `pages/review/[id].js` twice:

- schema-first path, forced through `provision_cards`
- legacy fallback path, forced through the existing review renderers

Discovery found no such switch in `pages/review/[id].js`.

Expected artefacts from the straitjacket Phase 0 wire-up are also absent:

- `lib/parser-v2/store-cards.js`
- `components/review/ProvisionCardTable.jsx`
- `lib/queries/review-deal.js`

Relevant source text still identifies these as required Phase 0 artefacts:

- `pm-master-straitjacket.codex.md` Phase 0 steps 6, 10, 11, and 12
- `pm-master-straitjacket.codex.md` blocking test `PH0-A`
- `pm-master-straitjacket.codex.md` blocking test `PH0-C`

## Live corpus state

Queried Supabase with service-role credentials from `.env.local`.

```
deals=40
provision_card_rows=0
deals_with_ge_40_cards=0
Metsera deal_id=885edae5-49e8-464a-9f33-edd229119d7c card_count=0
```

So the M2 exit criterion "every deal in `deals` has `provision_cards.count(deal_id) >= 40`" is not just failing at the margins. No deal has any card rows.

## Why this blocks M2-02

A parity audit would be meaningless right now: there is only the existing review renderer. There is no second schema-first card-backed renderer to compare against, and no card data to feed it.

WP-M2-01 has merged, but it updated normalized reconciliation artefacts. It did not create or backfill `provision_cards`.

## Unblock condition

Before resuming M2-02:

1. Ship the missing Phase 0 card wire-up artefacts:
   - `lib/parser-v2/store-cards.js`
   - `components/review/ProvisionCardTable.jsx`
   - `lib/queries/review-deal.js`
   - the `pages/review/[id].js` branch that chooses card-backed rendering when card rows exist
2. Backfill or reextract `provision_cards` for the 40-deal corpus.
3. Verify every deal has at least 40 `provision_cards` rows, including Metsera.

Do not start WP-M2-03 as a substitute unless Ben explicitly wants a parallel diagnostic. Its purpose is also all-deals card-backed audit, so it depends on the same missing card path.
