# Regex-kill confirmation matrix

Scope: the 6 wired family keys named in the task — `interestRateBasis`,
`ceaseDiscussionsProhibitedList`, `changeOfRecommendationItems`,
`superiorProposalDeterminer`, `governingLaw`, `parentAssignmentConditions` — the
attributes whose render-time regex fallback lives in
`components/review/table-configs/termination-fees.config.js` (interestRateBasis),
`nosol-noshop.config.js` (ceaseDiscussionsProhibitedList, changeOfRecommendationItems),
`nosol-superior.config.js` (superiorProposalDeterminer), and
`misc-boilerplate.config.js` (governingLaw, parentAssignmentConditions). All six read
the canonical code via `labelForCode(code, taxonomyForFeatureKey(attr))`
(`lib/queries/claims-adapter.js`) and fall back to a regex-over-prose summarizer only
when no canonical code is available for that card.

## Method

Pulled all `claims` rows (578 total) for these 6 attributes across all 40 deals
(paginated select, no row-count cap). Classified each (deal, attribute) cell:

- **CANONICAL-PRESENT** — at least one `claims` row for that deal+attribute has a
  non-null, non-empty `canonical`.
- **TEXT-ONLY** — claims exist for that deal+attribute but none has a `canonical`
  value (would still hit the regex-fallback in the read view).
- **NO-CLAIM** — no `claims` row exists at all for that deal+attribute (attribute
  never extracted/backfilled for this deal — falls through to the same regex path,
  or renders empty if the card itself is absent).

Staging deals flagged from `deals.metadata.ingest_status === 'staging'` (6 deals,
all part of the `seed50-batch6-20260706T060243Z` mega-deal-priority run).

## Finding: TEXT-ONLY is empty everywhere

Across all 240 cells (40 deals × 6 attributes), **no cell landed in TEXT-ONLY**.
`claims` rows with a null `canonical` do exist — 11 for `ceaseDiscussionsProhibitedList`
and 3 for `superiorProposalDeterminer`, out of 578 total claims — but in every case
that deal+attribute also has at least one sibling claim row with a canonical code
populated, so the deal-level cell still reads CANONICAL-PRESENT. In other words:
individual list-item claims are sometimes missing a canonical, but no deal is
currently "canonical-blind" for these families where a claim exists at all.

## Matrix (CANON = canonical present, NONE = no claim row for that attribute; **[STAGING]** = `ingest_status: staging`)

| Deal | Announce | intRate | ceaseDisc | CoR-items | SPdeterminer | govLaw | parentAssign |
|---|---|---|---|---|---|---|---|
| Gilead Sciences, Inc. / Pharmasset, Inc. | 2011-11-21 | CANON | CANON | CANON | CANON | CANON | CANON |
| Laboratory Corporation of America Holdings / Covance Inc. | 2014-11-02 | CANON | CANON | CANON | CANON | CANON | CANON |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | 2015-03-24 | CANON | CANON | CANON | CANON | CANON | NONE |
| Shire plc / Dyax Corp. | 2015-11-02 | CANON | CANON | CANON | CANON | CANON | CANON |
| Marriott International, Inc. / Starwood Hotels & Resorts Worldwide, Inc. | 2015-11-15 | NONE | CANON | CANON | CANON | CANON | NONE |
| Amazon.com, Inc. / Whole Foods Market, Inc. | 2017-06-15 | CANON | CANON | CANON | CANON | CANON | CANON |
| Sanofi / Bioverativ Inc. | 2018-01-21 | CANON | CANON | CANON | CANON | CANON | CANON |
| General Dynamics Corporation / CSRA Inc. | 2018-02-09 | CANON | CANON | NONE | CANON | CANON | CANON |
| Antlia Holdings LLC / Forest City Realty Trust, Inc. | 2018-07-30 | CANON | CANON | CANON | CANON | CANON | NONE |
| International Business Machines Corporation / Red Hat, Inc. | 2018-10-28 | CANON | CANON | CANON | CANON | CANON | CANON |
| Chevron Corporation / Anadarko Petroleum Corporation | 2019-04-11 | CANON | CANON | NONE | CANON | CANON | CANON |
| ConocoPhillips / Concho Resources Inc. | 2020-10-18 | CANON | CANON | CANON | CANON | NONE | NONE |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | 2021-02-22 | CANON | CANON | CANON | CANON | CANON | CANON |
| Merck & Co., Inc. / Prometheus Biosciences, Inc. | 2023-04-15 | CANON | CANON | CANON | CANON | CANON | CANON |
| Hewlett Packard Enterprise Company / Juniper Networks, Inc. **[STAGING]** | 2024-01-09 | NONE | NONE | NONE | NONE | CANON | NONE |
| Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. | 2024-01-16 | CANON | CANON | CANON | CANON | CANON | CANON |
| SH Residential Holdings, LLC / M.D.C. Holdings, Inc. | 2024-01-17 | CANON | CANON | CANON | CANON | CANON | NONE |
| Creek Parent, Inc. / Catalent, Inc. **[STAGING]** | 2024-02-05 | CANON | NONE | CANON | NONE | CANON | CANON |
| Hearts Parent, LLC / HireRight Holdings Corporation | 2024-02-15 | CANON | NONE | NONE | NONE | CANON | CANON |
| Bespin Subsidiary, LLC / Landos Biopharma, Inc. | 2024-03-24 | CANON | CANON | NONE | CANON | CANON | CANON |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. **[STAGING]** | 2024-04-02 | NONE | CANON | CANON | CANON | CANON | CANON |
| BCPE Pequod Buyer, Inc. / Envestnet, Inc. | 2024-07-11 | CANON | CANON | CANON | CANON | CANON | NONE |
| Verizon Communications Inc. / Frontier Communications Parent, Inc. **[STAGING]** | 2024-09-04 | CANON | NONE | NONE | NONE | CANON | CANON |
| Sophos Inc. / SecureWorks Corp. | 2024-10-21 | NONE | NONE | NONE | NONE | CANON | CANON |
| Quikrete Holdings, Inc. / Summit Materials, Inc. **[STAGING]** | 2024-11-24 | NONE | NONE | NONE | NONE | CANON | CANON |
| Apollo Global Management, Inc. / Bridge Investment Group Holdings Inc. | 2025-02-23 | CANON | CANON | CANON | CANON | CANON | NONE |
| Rocket Companies, Inc. / Redfin Corporation | 2025-03-09 | CANON | CANON | CANON | CANON | CANON | NONE |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | 2025-03-31 | CANON | CANON | NONE | CANON | CANON | CANON |
| Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. | 2025-05-04 | CANON | CANON | CANON | CANON | CANON | CANON |
| Charter Communications, Inc. / Cox Enterprises, Inc. | 2025-05-16 | NONE | CANON | NONE | CANON | CANON | NONE |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 2025-06-16 | CANON | CANON | NONE | CANON | CANON | CANON |
| SUP Parent Holdings, LLC / Superior Industries International, Inc. | 2025-07-08 | NONE | CANON | CANON | CANON | CANON | NONE |
| Pfizer Inc. / Metsera, Inc. | 2025-09-21 | CANON | CANON | CANON | CANON | CANON | CANON |
| IonQ, Inc. / SkyWater Technology, Inc. | 2026-01-25 | CANON | CANON | CANON | CANON | CANON | CANON |
| Glow Midco, LLC / European Wax Center, Inc. | 2026-02-09 | CANON | CANON | CANON | CANON | CANON | CANON |
| Stanley Martin Homes, LLC / United Homes Group, Inc. | 2026-02-22 | CANON | CANON | CANON | CANON | CANON | NONE |
| QXO, Inc. / TopBuild Corp. | 2026-04-18 | CANON | CANON | CANON | CANON | CANON | CANON |
| Global Net Lease, Inc. / Modiv Industrial, Inc. | 2026-05-03 | CANON | CANON | CANON | CANON | CANON | NONE |
| ENDRA Life Sciences Inc. / Noble Africa LLC **[STAGING]** | 2026-06-25 | NONE | NONE | NONE | NONE | CANON | NONE |
| Zymeworks Inc. / Theravance Biopharma, Inc. | 2026-06-28 | CANON | CANON | NONE | CANON | CANON | CANON |

## Per-family counts (of 40 deals)

| Family | CANONICAL-PRESENT | TEXT-ONLY | NO-CLAIM |
|---|---|---|---|
| interestRateBasis | 32 | 0 | 8 |
| ceaseDiscussionsProhibitedList | 33 | 0 | 7 |
| changeOfRecommendationItems | 27 | 0 | 13 |
| superiorProposalDeterminer | 33 | 0 | 7 |
| governingLaw | 39 | 0 | 1 |
| parentAssignmentConditions | 26 | 0 | 14 |

`governingLaw` is closest to corpus-wide confirmed (39/40, only ConocoPhillips/Concho
missing). `parentAssignmentConditions` and `changeOfRecommendationItems` are furthest
(14 and 13 NO-CLAIM deals respectively).

## Cells that block "corpus-wide confirmed" (50 total — all NO-CLAIM, since TEXT-ONLY is empty)

20 of the 50 blocker cells sit on the 6 **staging** deals (Quikrete/Summit, Verizon/
Frontier, ENDRA/Noble Africa, HPE/Juniper, Catalent, Endeavor) — those are pre-production
and arguably shouldn't count against a "corpus-wide confirmed" claim about the live
product. Excluding staging, **30 blocker cells remain across 24 non-staging deals**.

Full list (deal | family):

- SH Residential/MDC Holdings | parentAssignmentConditions
- Quikrete/Summit Materials **[staging]** | interestRateBasis, ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer
- BCPE Pequod/Envestnet | parentAssignmentConditions
- SUP Parent/Superior Industries | interestRateBasis, parentAssignmentConditions
- Verizon/Frontier **[staging]** | ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer
- Chevron/Anadarko | changeOfRecommendationItems
- ENDRA/Noble Africa **[staging]** | interestRateBasis, ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer, parentAssignmentConditions
- Antlia (Brookfield)/Forest City | parentAssignmentConditions
- HPE/Juniper **[staging]** | interestRateBasis, ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer, parentAssignmentConditions
- Rocket/Redfin | parentAssignmentConditions
- HireRight | ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer
- Zymeworks/Theravance | changeOfRecommendationItems
- Rocket/Mr. Cooper | changeOfRecommendationItems
- Catalent (Creek Parent/Novo) **[staging]** | ceaseDiscussionsProhibitedList, superiorProposalDeterminer
- H.J. Heinz/Kraft | parentAssignmentConditions
- Endeavor (Wildcat EGH) **[staging]** | interestRateBasis
- Bespin/Landos | changeOfRecommendationItems
- Charter/Cox Enterprises | interestRateBasis, changeOfRecommendationItems, parentAssignmentConditions
- Eli Lilly/Verve Therapeutics | changeOfRecommendationItems
- Global Net Lease/Modiv | parentAssignmentConditions
- Apollo/Bridge Investment | parentAssignmentConditions
- ConocoPhillips/Concho | governingLaw, parentAssignmentConditions
- Sophos/SecureWorks | interestRateBasis, ceaseDiscussionsProhibitedList, changeOfRecommendationItems, superiorProposalDeterminer
- General Dynamics/CSRA | changeOfRecommendationItems
- Stanley Martin Homes/United Homes Group | parentAssignmentConditions
- Marriott/Starwood | interestRateBasis, parentAssignmentConditions

**Bottom line: the regex fallback for these 6 families cannot yet be called "corpus-wide
killed."** `governingLaw` is one deal away. The other five families each have somewhere
between 7 and 14 deals (out of 40) that would still fall through to the render-time
regex path today, concentrated in `parentAssignmentConditions` (14) and
`changeOfRecommendationItems` (13) — these two are the priority backfill targets before
the fallback code can be deleted.
