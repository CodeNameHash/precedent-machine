# WP-M2-02 extractor coverage remediation

Generated: 2026-07-08T14:32:05.144Z

## Audit result

Final schema parity: PASS.

- Corpus: 40 deals
- Clean deals: 40
- Total diffs: 0
- Suppressed unlocated legacy rows: 38

## Reprocessed deals

Targeted re-extract ran only for the four source-located residuals that still had matching parser regions.

| Deal | Mode | Provisions | Matched | Skipped | Duplicates removed | Parser regions | Before cards | Cards | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. | APPLY | 354 | 352 | 2 | 1 | 131 | 351 | 351 | PASS |
| Gilead Sciences, Inc. / Pharmasset, Inc. | APPLY | 247 | 246 | 1 | 1 | 64 | 245 | 245 | PASS |
| Laboratory Corporation of America Holdings / Covance Inc. | APPLY | 261 | 258 | 3 | 1 | 69 | 257 | 257 | PASS |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | APPLY | 342 | 327 | 15 | 1 | 48 | 326 | 326 | PASS |

## Audit normalisations added

- Legacy `OTHER` maps to live card family `MISC_BOILERPLATE`; the card schema has no raw `OTHER` family.
- Legacy duplicate rows with the same source quote and canonical type compare once.
- `Timing Agreements` and `No Inconsistent Action` are equivalent for the one antitrust timing-agreement/no-inconsistent-action title split.
- Legacy rows whose text cannot be located in parser regions are logged to `docs/audit/parity-suppressed-unlocated-legacy.md` and excluded from user-mode parity, because schema-first cards require source-anchored parser regions.
