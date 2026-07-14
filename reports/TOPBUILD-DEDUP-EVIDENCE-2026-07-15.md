# TopBuild dedup dry-run (deal `7dc3a05f-b170-4d59-a255-b7103cca16e1`)

## The pair

- `1cb455a9-bbb9-42f5-8ad3-2e7a16eb596f` — `provisions.type='NOSOL'`, `category='Solicitation Prohibition'`
- `b70adc75-d415-49b9-a059-be6fd379fe22` — `provisions.type='NOSOL'`, `category='Solicitation Prohibition'`

## Full-row pull (all columns)

Both rows share the columns `id, deal_id, type, category, full_text, prohibition, exceptions,
ai_favorability, created_at, ai_metadata, region_id, consideration_equity_provision_id`
(this deal's provisions rows have no populated `parent_id`, `depth`, `sort_order`, `text_hash`,
`display_tier`, `agreement_source_id`, or `updated_at` — all null/undefined on both rows).

| Field | `1cb455a9…` | `b70adc75…` |
|---|---|---|
| `created_at` | 2026-07-13T22:16:37.998231+00:00 | 2026-07-13T22:16:37.998231+00:00 (identical — same ingest batch) |
| `full_text` length | 1258 chars | 1256 chars |
| `region_id` | null | null |
| `ai_metadata.code` | `NOSOL-PROHIBIT` | `NOSOL-PROHIBIT` |
| `ai_metadata.startChar` | 191164 | 216469 (≈25,300 chars later in the source document) |
| `ai_metadata.features.mainConcept` | "Core no-solicit covenant barring **the Company** from soliciting..." | "Core covenant prohibiting **Parent** from soliciting..." |

## Char-by-char diff

Levenshtein similarity: **98.41%** (edit distance 20 over max length 1258). The only
differences are systematic term swaps: `Company` ↔ `Parent` (×3), `Section 4.3` ↔
`Section 4.4` (×1), plus one comma. **This is not textual noise from a bad re-ingest —
it is the deliberate difference between two distinct covenants.**

Full text of each (verbatim, for the record):

- `1cb455a9…` (Section 4.3): "...not, directly or indirectly, (A) solicit, initiate or
  knowingly facilitate or knowingly encourage ... a **Company** Acquisition Proposal
  (including by granting any waiver under Section 203 of the DGCL) ... this **Section 4.3**..."
- `b70adc75…` (Section 4.4): "...not, directly or indirectly, (A) solicit, initiate or
  knowingly facilitate or knowingly encourage ... a **Parent** Acquisition Proposal
  (including by granting any waiver under Section 203 of the DGCL) ... this **Section 4.4**..."

## Why two rows exist: this is a dual no-solicit merger, not a duplicate

QXO/TopBuild is a stock-for-stock structure requiring **both** companies' stockholder
votes (`Company Stockholder Approval` and `Parent Stockholder Approval` both appear in
the agreement — see the FTV sweep, which found `ai_metadata.features.forceTheVote=true`
on both the Company-side and Parent-side "Change of Recommendation" provisions for this
same deal). Each side — the Company (TopBuild) and Parent (QXO) — carries its own
no-solicit covenant (Sections 4.3 and 4.4 respectively). This corpus already has a
naming convention for exactly this situation: other dual-obligation deals use a
`(Parent)` category suffix to distinguish the mirrored provision — e.g. ConocoPhillips/
Concho has `Exceptions / Fiduciary Out (Parent)`, `Provision of Information to Bidder
(Parent)`, `Enforcement of Standstills (Parent)`; Marriott/Starwood has `Change of
Recommendation (Parent)`. **TopBuild's classifier did not apply that suffix consistently** —
every one of its 16 NOSOL categories was extracted exactly twice (Company + Parent) but
only `Change of Recommendation` (5 rows, mixed) shows any tagging irregularity; the rest,
including `Solicitation Prohibition`, both got the bare, unsuffixed category name.

## Claims/cards check

Searched `provision_cards` for this deal (`region_full_text` match, scoped by `deal_id`
per the anchor convention in `supabase/schema-05-claims.sql`):

- **`1cb455a9…` (Company, Sec 4.3) → HAS a clean card**: excerpt_id
  `7dc3a05f-b170-4d59-a255-b7103cca16e1:4.1 | Solicitation Prohibition | 467de7afa956...`,
  `provision_type = COVENANT_NO_SOLICITATION`. This is the only `COVENANT_NO_SOLICITATION`
  card in the deal with `short_title = 'Solicitation Prohibition'`.
- **`b70adc75…` (Parent, Sec 4.4) → HAS NO clean card.** Its Section 4.4 text was never
  card-materialized as a no-solicitation covenant. Instead it is scattered across three
  `MISC_BOILERPLATE` leftover cards: `4.4 | Uncovered text — No Solicitation by Parent`,
  `4.4 | Uncovered text — No Solicitation by Parent (#2)`, `4.4 | Uncovered text — No
  Solicitation by Parent (#3)`.
- No `claims` rows reference either provision directly (claims anchor to
  `provision_cards.excerpt_id`; since the Parent no-solicit text was never card-ified as
  a proper covenant, it cannot carry claims either).

## Recommendation

**Do not delete either row.** They are not duplicates — they are the Company-side and
Parent-side no-solicit covenants of a genuinely dual-obligation merger agreement, and
deleting either would silently drop one party's no-solicit obligation from the corpus.

Instead:
1. **Re-categorize** `b70adc75-d415-49b9-a059-be6fd379fe22` to `Solicitation Prohibition
   (Parent)` to match the established `(Parent)`-suffix convention already used
   elsewhere in this corpus, so it stops colliding with the Company-side row under the
   same category label.
2. **Higher-priority real gap**: the Parent-side no-solicit covenant (Section 4.4) has no
   proper `COVENANT_NO_SOLICITATION` card at all — its text only exists as `MISC_BOILERPLATE`
   "Uncovered text" leftovers, so it's invisible to any claims-adapter-driven review UI
   for Parent-side obligations. This is a card-materialization gap, not a dedup issue, and
   is worth its own fix before touching the category naming.
3. This pair should **not** be treated as a template for other same-deal "duplicate"
   pairs without inspection — see below, the corpus-wide scan surfaces the same
   Company/Parent-mirroring pattern repeatedly.

## Corpus-wide scan for other same-deal/same-type/same-category pairs differing <5%

Method: grouped all 12,619 provisions by `(deal_id, type, category)`; found 1,013 groups
with ≥2 rows (134,916 possible pairs). Prefiltered on full_text length ratio ≥0.95 (13,502
pairs), then 4-gram shingle Jaccard similarity >0.85 (200 pairs), then computed exact
Levenshtein similarity on all 200. **49 pairs have ≥95% textual similarity** (i.e. <5%
character-level difference) — the TopBuild pair above is one of them.

Spot-checking a representative sample across categories (Marriott/Starwood `IOC-T
Compensation and Benefits`, TopBuild `NOSOL Cease Existing Discussions`, TopBuild `NOSOL
Acquisition Proposal Definition`, Wildcat/Endeavor `DEF General Definitions Section`)
shows the same two root causes every time, **not** accidental re-ingestion duplicates:

- **Company/Parent (or Target/Acquirer) mirrored covenants** in dual-obligation deals
  (TopBuild, Marriott/Starwood, Heinz/Kraft, Charter/Cox, Wildcat/Endeavor, ENDRA/Noble,
  Sophos/SecureWorks, LabCorp/Covance, Goodyear/Cooper, Apollo/Bridge, Shire/Dyax,
  ConocoPhillips/Concho, Rocket/Mr. Cooper, Global Net Lease/Modiv) — each side has its
  own near-identically-worded IOC-T, NOSOL, or DEF provision that differs only by party
  name and section number.
- **Short parallel-structure definitions** in `DEF / General Definitions Section` that
  differ only in the defined term (e.g. Wildcat/Endeavor: `"Company Class X Common
  Stock" means Class X Common Stock ... $0.00001 per share` vs `"Company Class Y Common
  Stock" means Class Y Common Stock ... $0.00001 per share` — 103 characters each,
  differing only in "X"/"Y").

**No true accidental duplicate (same clause ingested twice under the same section) was
found in the sampled subset.** That said, this is a heuristic scan (shingle-prefiltered,
sampled for manual verification) — flag the full 49-pair list below for a human read
before concluding none of them are genuine dedup candidates.

### Full list of ≥95%-similar same-deal/same-type/same-category pairs (49)

| Deal | Type/Category | Similarity | IDs |
|---|---|---|---|
| ENDRA/Noble Africa | IOC-T / General Exceptions | 99.30% | 63ae432d… vs 59db7ee3… |
| Marriott/Starwood | IOC-T / Compensation and Benefits | 98.57% | 87dc7d92… vs a84f0a57… |
| **QXO/TopBuild** | **NOSOL / Solicitation Prohibition** | **98.41%** | **1cb455a9… vs b70adc75…** (the pair above) |
| QXO/TopBuild | IOC-T / Commitments | 98.53% | 8b496a6b… vs 59a45ea4… |
| Charter/Cox | DEF / General Definitions Section | 98.52% | 3 rows: b88aa807…, 3203b7b4…, ccd45cc6… (3 pairs) |
| Goodyear/Cooper Tire | IOC-T / Commitments | 98.35% | ddf72ffb… vs 39c11806… |
| Apollo/Bridge Investment | DEF / General Definitions Section | 98.10% | 42abc5f7… vs a9342ba7… |
| Wildcat/Endeavor | DEF / General Definitions Section | 95.5–98.1% | 4 rows (bcbb2542…, 259f6364…, 790fa9a5…, 33ad5e10…, 05a785a5…) — 8 pairwise hits |
| ENDRA/Noble Africa | IOC-T / General Exceptions | 97.73% | 9da3c887… vs 164035dd… |
| Marriott/Starwood | DEF / Company Benefit Plan | 97.59% | b1b80ae7… vs ec82b94e… |
| Heinz/Kraft | DEF / Indebtedness | 97.21% | a721ff5d… vs 80ed1205… |
| QXO/TopBuild | NOSOL / Cease Existing Discussions | 97.15% | 5bd1f13b… vs 1606523d… |
| ENDRA/Noble Africa | DEF / General Definitions Section | 97.14% | abc386fb… vs e4d21318… |
| Marriott/Starwood | NOSOL / Subsequent Matching / Amendment Rights | 97.12% | 1afd5c85… vs d34a78ab… |
| Heinz/Kraft | IOC-T / Mergers, Acquisitions, Dispositions | 97.09% | 3b602bee… vs 7e986b65… |
| Marriott/Starwood | DEF / Permit | 96.79% | 08934c37… vs bc0de807… |
| Marriott/Starwood | DEF / General Definitions Section | 96.64% | 1ad5a478… vs e2113164… |
| Marriott/Starwood | IOC-T / Issuance of Securities | 96.57% | f9738710… vs 6a7b1c9f… |
| Charter/Cox | IOC-T / Commitments | 96.51% | bcdabba8… vs 45237356… |
| Marriott/Starwood | IOC-T / Settlement of Claims | 96.51% | fe3ff693… vs 496b5c5e… |
| LabCorp/Covance | IOC-T / Dividends and Distributions | 96.34% | 8ca744fe… vs 1339d75d… |
| LabCorp/Covance | IOC-T / IOC Positive Preamble | 96.20% | 4b2decc2… vs 5140fe0b… |
| Sophos/SecureWorks | DEF / Company Equity Awards | 96.17% | 338fa160… vs 89ec8bc0… |
| Heinz/Kraft | IOC-T / Compensation and Benefits | 96.17% | 199444aa… vs 52d5a12f… |
| Rocket/Mr. Cooper | DEF / Company Disclosure Letter | 96.02% | caa14068… vs 0cf32d5f… |
| ConocoPhillips/Concho | DEF / Superior Proposal | 95.93% | d08a5af9… vs bae5a5f8… |
| Heinz/Kraft | IOC-T / Compensation and Benefits | 95.69% | ed253d56… vs d5b580be… |
| Shire/Dyax | DEF / General Definitions Section | 95.55% | 484c2f3c… vs 3033bf34… |
| Heinz/Kraft | IOC-T / Mergers, Acquisitions, Dispositions | 95.53% | 4b7f7710… vs d0801a6b… |
| LabCorp/Covance | IOC-T / Accounting Changes | 95.52% | 6abfca2c… vs c551dfc7… |
| Wildcat/Endeavor | DEF / General Definitions Section | 95.45% | 68e9def7… vs 29bfcd1b… |
| Marriott/Starwood | NOSOL / Superior Proposal Definition | 95.45% | 85f4c9c1… vs a1449ca0… |
| Heinz/Kraft | DEF / Company Benefit Plan | 95.43% | 3121b649… vs 2a739477… |
| Global Net Lease/Modiv | DEF / Tax / Taxes | 95.34% | 9491f95c… vs 10beb127… |
| Heinz/Kraft | DEF / Affiliate | 95.28% | c732da56… vs eef0e4b8… |
| QXO/TopBuild | NOSOL / Acquisition Proposal Definition | 95.24% | 8861d5de… vs 7473d0b5… |
| Marriott/Starwood | IOC-T / Mergers, Acquisitions, Dispositions | 95.19% | ed7a8674… vs cf7185c2… |
| LabCorp/Covance | IOC-T / Commitments | 95.12% | 81dfadab… vs 5f5b9b73… |
| QXO/TopBuild | DEF / General Definitions Section | 95.11% | 2f049e79… vs 61b252a0… |

(counts above total 49 pairwise hits once the Charter/Cox and Wildcat/Endeavor
multi-row cliques are expanded to all pairs within each group.)
