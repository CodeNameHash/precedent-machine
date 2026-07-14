# Parity Data Sweep — 2026-07-15

Data-gathering pass for the M2 acceptance gate. This report presents raw
comparison output from `scripts/audit/schema-parity.js` (legacy `provisions`
table vs. schema-first `shapeReviewDealRows` cards) run corpus-wide,
read-only, against the current post-rematerialize DB state. **This report does
not judge whether any drop or addition is acceptable** — that judgment pass
happens separately. Machine-readable copy: `reports/parity-data-sweep-2026-07-15.json`.

Run method: a scratch script
(`/tmp/claude-0/.../scratchpad/run-parity-sweep.js`, not committed) imported
`compareDeal`/`legacyCells`/`schemaCells` from the existing harness and read
`deals`/`provisions`/`provision_cards`/`parser_regions` via Supabase
`select()` only — no writes were issued to the DB, and the harness's own
`--no-write` file-writing path was bypassed entirely so nothing under
`docs/audit/` or `docs/schema-migration/` was touched.

## Corpus totals

- Deals compared: 40
- Total cells compared (legacy + schema): 24870 (legacy 12553, schema 12317)
- Clean matched pairs: 11894
- Legacy-only signals (potential drops, `missing_schema_card`): 541
- New-only signals (additions, `schema_only_card`): 450
- Short-title mismatches (same quote, different canonical label): 118
- Type mismatches (same quote, different canonical type): 0 (harness reported none in this corpus)
- Deals with zero diffs: 0 / 40

**Observation (data-level, not a judgment):** legacy-only and new-only counts
are close in magnitude for the same field names across many deals (e.g.
"Change of Recommendation" 50 legacy-only vs. 45 new-only corpus-wide). That
pattern is consistent with the same conceptual provision existing on both
sides but failing the harness's exact-quote-hash match (paraphrase/whitespace/
excerpt-boundary differences), rather than a clean drop or a clean addition.
Field-level manual comparison is needed to tell those apart — left to the
judgment pass.

## Top 10 legacy-only signals by frequency (corpus-wide, by field)

| Field | Deals affected (count of diff rows) |
|---|---:|
| Change of Recommendation | 50 |
| Disclosure of Terms | 37 |
| Notice to Counterparty | 36 |
| Confidentiality Agreement Requirement | 33 |
| Provision of Information to Bidder | 31 |
| Solicitation Prohibition | 30 |
| Exceptions / Fiduciary Out | 30 |
| Matching Rights | 30 |
| Company Termination Fee | 27 |
| Negotiation Period | 26 |

## Top 10 new-only signals by frequency (corpus-wide, by field)

| Field | Diff rows |
|---|---:|
| Change of Recommendation | 45 |
| Company Termination Fee | 28 |
| Solicitation Prohibition | 27 |
| Confidentiality Agreement Requirement | 26 |
| Matching Rights | 26 |
| Notice to Counterparty | 25 |
| Effect of Termination | 24 |
| Tail Provision | 22 |
| Disclosure of Terms | 22 |
| Provision of Information to Bidder | 21 |

## Per-family rollup

Family assigned by looking up the legacy provision's raw `type` code (for
`missing_schema_card`/`short_title_mismatch`) or the schema card's
`provision_type` (for `schema_only_card`), via the harness's own `TYPE_MAP`.

| Family | Legacy-only | New-only | Type mismatch | Short-title mismatch | Deals affected |
|---|---:|---:|---:|---:|---:|
| COVENANT_NO_SOLICITATION | 419 | 312 | 0 | 12 | 38 |
| TERMINATION_FEE | 115 | 131 | 0 | 5 | 39 |
| MISC_BOILERPLATE | 7 | 7 | 0 | 101 | 32 |

Note: `COVENANT_NO_SOLICITATION` and `TERMINATION_FEE` together account for 977 of 991 legacy-only + new-only signals (99%). `MISC_BOILERPLATE` contributes a small, symmetric legacy-only/new-only tail (7 and 7) but the bulk of its 101 short-title mismatches are a separate signal (canonical label drift, not missing/extra content) spread across 32 deals.

## Part 3 — extension-deal detail (families Metsera does not exercise)

| Deal | Family exercised | Legacy cells | Schema cells | Clean matches | Legacy-only | New-only | Short-title mismatch | Total diffs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ConocoPhillips / Concho Resources Inc. | reciprocal (both-side termination fee / no-sol) | 312 | 309 | 277 | 34 | 32 | 1 | 67 |
| Gilead Sciences, Inc. / Pharmasset, Inc. | tender offer | 244 | 240 | 233 | 9 | 6 | 2 | 17 |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | stock-for-stock | 409 | 412 | 397 | 11 | 14 | 1 | 26 |

For reference, Metsera (Pfizer Inc. / Metsera, Inc.) itself:

| Deal | Legacy cells | Schema cells | Clean matches | Legacy-only | New-only | Short-title mismatch | Total diffs |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pfizer Inc. / Metsera, Inc. | 301 | 302 | 289 | 11 | 12 | 1 | 24 |

## Part 2 — legacy render reference: did not boot (structural, not a timeout)

**Finding, established well inside the 45-minute box:** this repository's
git history contains no pre-M2-00 commit to check out at all. Total commits
reachable from any ref: 112 (`git rev-list --count HEAD`; `git log --all` shows
the same set). The oldest commit in the entire history is `c0fa5bc` ("Shared
standard->colour system; hide ERISA from benefits table"), and `git ls-tree -r
c0fa5bc` already contains `lib/queries/review-deal.js`,
`scripts/audit/schema-parity.js`, `tests/audit/schema-parity.spec.js`, and the
WP-M2-00 phase-allowlist files
(`.github/phase-allowlists/wp-m2-00-04-review-deal-query.json`). In other
words, the schema-first migration (WP-M2-00) predates the very first commit
captured in this repo's history — there is no earlier ref, tag, or branch to
worktree out. `git log --oneline --all | grep -i "WP-M2-00"` and `grep -i
"PLAN-M2"` both return zero commit-message hits, confirming this isn't a
missed tag naming convention.

No worktree was created and no `npm ci`/`next dev` was attempted, since there
is no legacy commit to boot. Falling back to archived snapshots per the spec:
`docs/audit/m2-09-legacy-inventory.md` (1,440 lines — a detailed static
inventory of legacy review-page fields/sections) and
`docs/audit/legacy-layout-inventory.md` (surface-to-config mapping with gap/
mapped status per legacy surface) are the best available legacy-render
references for Fable's judgment pass; no live legacy HTML/API snapshot could
be produced.

## Per-deal table (all 40 deals)

| Deal | Compared | Legacy | Schema | Clean matches | Legacy-only | New-only | Short-title mismatch | Total diffs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Amazon.com, Inc. / Whole Foods Market, Inc. | 466 | 235 | 231 | 218 | 15 | 15 | 2 | 32 |
| Antlia Holdings LLC / Forest City Realty Trust, Inc. | 612 | 308 | 304 | 298 | 9 | 9 | 1 | 19 |
| Apollo Global Management, Inc. / Bridge Investment Group Holdings Inc. | 760 | 384 | 376 | 367 | 14 | 16 | 3 | 33 |
| BCPE Pequod Buyer, Inc. / Envestnet, Inc. | 557 | 276 | 281 | 257 | 18 | 23 | 1 | 42 |
| Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. | 697 | 349 | 348 | 337 | 11 | 12 | 1 | 24 |
| Bespin Subsidiary, LLC / Landos Biopharma, Inc. | 666 | 334 | 332 | 315 | 15 | 13 | 4 | 32 |
| Charter Communications, Inc. / Cox Enterprises, Inc. | 1254 | 628 | 626 | 617 | 11 | 9 | 0 | 20 |
| Chevron Corporation / Anadarko Petroleum Corporation | 548 | 278 | 270 | 270 | 8 | 8 | 0 | 16 |
| ConocoPhillips / Concho Resources Inc. | 621 | 312 | 309 | 277 | 34 | 32 | 1 | 67 |
| Creek Parent, Inc. / Catalent, Inc. | 566 | 295 | 271 | 263 | 20 | 3 | 12 | 35 |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 677 | 341 | 336 | 322 | 13 | 12 | 6 | 31 |
| ENDRA Life Sciences Inc. / Noble Africa LLC | 665 | 336 | 329 | 314 | 8 | 1 | 14 | 23 |
| General Dynamics Corporation / CSRA Inc. | 645 | 328 | 317 | 306 | 16 | 5 | 6 | 27 |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 484 | 244 | 240 | 233 | 9 | 6 | 2 | 17 |
| Global Net Lease, Inc. / Modiv Industrial, Inc. | 715 | 362 | 353 | 348 | 14 | 18 | 0 | 32 |
| Glow Midco, LLC / European Wax Center, Inc. | 696 | 350 | 346 | 334 | 12 | 18 | 4 | 34 |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | 821 | 409 | 412 | 397 | 11 | 14 | 1 | 26 |
| Hearts Parent, LLC / HireRight Holdings Corporation | 608 | 309 | 299 | 292 | 16 | 10 | 1 | 27 |
| Hewlett Packard Enterprise Company / Juniper Networks, Inc. | 504 | 264 | 240 | 226 | 25 | 2 | 13 | 40 |
| International Business Machines Corporation / Red Hat, Inc. | 464 | 235 | 229 | 222 | 13 | 12 | 0 | 25 |
| IonQ, Inc. / SkyWater Technology, Inc. | 635 | 321 | 314 | 310 | 7 | 6 | 4 | 17 |
| Laboratory Corporation of America Holdings / Covance Inc. | 512 | 256 | 256 | 248 | 6 | 9 | 2 | 17 |
| Marriott International, Inc. / Starwood Hotels & Resorts Worldwide, Inc. | 585 | 303 | 282 | 275 | 28 | 15 | 0 | 43 |
| Merck & Co., Inc. / Prometheus Biosciences, Inc. | 518 | 261 | 257 | 249 | 11 | 7 | 1 | 19 |
| Pfizer Inc. / Metsera, Inc. | 603 | 301 | 302 | 289 | 11 | 12 | 1 | 24 |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | 574 | 293 | 281 | 266 | 14 | 2 | 13 | 29 |
| QXO, Inc. / TopBuild Corp. | 610 | 319 | 291 | 279 | 37 | 18 | 3 | 58 |
| Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. | 617 | 308 | 309 | 289 | 18 | 19 | 1 | 38 |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | 666 | 341 | 325 | 330 | 10 | 9 | 1 | 20 |
| Rocket Companies, Inc. / Redfin Corporation | 639 | 317 | 322 | 309 | 8 | 14 | 0 | 22 |
| Sanofi / Bioverativ Inc. | 561 | 282 | 279 | 277 | 4 | 4 | 1 | 9 |
| SH Residential Holdings, LLC / M.D.C. Holdings, Inc. | 586 | 296 | 290 | 286 | 7 | 6 | 3 | 16 |
| Shire plc / Dyax Corp. | 479 | 240 | 239 | 229 | 10 | 11 | 1 | 22 |
| Sophos Inc. / SecureWorks Corp. | 634 | 321 | 313 | 319 | 1 | 1 | 1 | 3 |
| Stanley Martin Homes, LLC / United Homes Group, Inc. | 711 | 358 | 353 | 335 | 23 | 21 | 0 | 44 |
| SUP Parent Holdings, LLC / Superior Industries International, Inc. | 475 | 237 | 238 | 227 | 8 | 9 | 2 | 19 |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | 650 | 325 | 325 | 307 | 18 | 19 | 0 | 37 |
| Verizon Communications Inc. / Frontier Communications Parent, Inc. | 529 | 264 | 265 | 258 | 2 | 3 | 4 | 9 |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. | 703 | 354 | 349 | 332 | 17 | 14 | 5 | 36 |
| Zymeworks Inc. / Theravance Biopharma, Inc. | 557 | 279 | 278 | 267 | 9 | 13 | 3 | 25 |

