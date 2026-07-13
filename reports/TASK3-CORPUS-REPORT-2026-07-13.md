# TASK 3 — corpus reprocess + rematerialize (2026-07-13)

Run: `reprocess.js --types NOSOL,MISC,TERMF --apply` per deal across all 40 deals
(4 parallel workers, claude-cli backend, all 40 exit 0), then
`rematerialize-claims.js --all --apply --partial --run-id takeover-corpus-2026-07-13`.

## Headline
- **12,259 / 12,387 cards matched** to provisions deterministically (98.97%); 70,161 claims materialized.
- **18/40 deals fully clean** (zero ambiguity, zero card-less coded provisions).
- **66 card-less coded provisions** across 22 deals (extraction-granularity drift: fresh
  NOSOL splits with no card yet — the M3 backlog, per PLAN §1.3/§M3). No guessing occurred:
  ambiguous pairs and card-less provisions were reported, not written.
- **Code population (deals with ≥1 canonical, of 40):** governingLaw 39, ceaseDiscussions 33,
  superiorProposalDeterminer 33, interestRateBasis 31, parentAssignmentConditions 26,
  changeOfRecommendationItems 25. Zeros concentrate in staging deals + card-less rows +
  genuine absences. **Regex-fallback deletion stays deferred** — corpus-wide confirmation not met.
- **QA gates:** 0 unverified quotes and 0 duplicate clauses on ALL 40 deals. 12 deals fail
  soft gates: all 5 canonical-rate failures are pre-existing staging deals; the 7 live-deal
  failures are coverage% only, which today's extraction-only run cannot move (classification
  came from cached snapshots) — pre-existing structural gaps.
- **Spot audits (live pages):** Cooper Tire / Whole Foods / Red Hat canonical pills verified,
  including `SPLIT_FINANCING` governing-law codes confirmed correct against clause text
  (Delaware primary + NY Financing-Sources carve-out).
- Idempotency: repeat run converges to 0 stale deletes (two deals needed one extra pass;
  third run is a strict no-op).

## Follow-ups (Ben-gated)
1. **Corpus prune round 2** — the 22 non-clean deals carry the same duplicate-card/provision
   pathology the pilot prune fixed; needs a decisions file like the pilots (keep/re-home/delete).
2. **M3 card-writing path** for the 66 card-less coded provisions.
3. Regex-fallback deletion once 1+2 close the gaps.

## Per-deal table
| deal | matched | ambiguities | card-less coded provisions | claims upserted |
|---|---|---|---|---|
| Anadarko Petroleum Corporation | 272/272 | 0 | 0 | 1712 |
| Bioverativ Inc. | 278/279 | 0 | 0 | 1555 |
| Bridge Investment Group Holdings Inc | 374/376 | 0 | 0 | 2570 |
| CSRA Inc. | 317/319 | 0 | 4 | 1424 |
| Carrols Restaurant Group, Inc. | 297/309 | 5 | 3 | 1517 |
| Catalent, Inc. | 269/271 | 0 | 5 | 887 |
| Concho Resources Inc. | 297/310 | 4 | 3 | 1589 |
| Cooper Tire & Rubber Company | 325/329 | 1 | 2 | 2067 |
| Covance Inc. | 254/257 | 0 | 1 | 1525 |
| Cox Enterprises, Inc. | 625/626 | 0 | 1 | 3480 |
| Dyax Corp. | 244/245 | 0 | 0 | 1655 |
| Endeavor Group Holdings, Inc. | 350/351 | 0 | 2 | 1962 |
| Envestnet, Inc. | 276/283 | 0 | 0 | 1681 |
| European Wax Center, Inc. | 337/346 | 1 | 2 | 2187 |
| Forest City Realty Trust, Inc. | 306/308 | 0 | 0 | 1806 |
| Frontier Communications Parent, Inc. | 264/265 | 0 | 0 | 1710 |
| HireRight Holdings Corporation | 294/299 | 0 | 5 | 1735 |
| Juniper Networks, Inc. | 238/240 | 0 | 8 | 787 |
| Kraft Foods Group, Inc. | 412/415 | 0 | 0 | 1952 |
| Landos Biopharma, Inc. | 332/335 | 1 | 1 | 1584 |
| M.D.C. Holdings, Inc. | 287/290 | 0 | 1 | 1913 |
| Metsera, Inc. | 300/303 | 0 | 0 | 1993 |
| Modiv Industrial, Inc. | 348/353 | 0 | 0 | 2431 |
| Mr. Cooper Group Inc. | 324/326 | 0 | 1 | 1928 |
| Noble Africa LLC | 328/329 | 0 | 3 | 1313 |
| Pharmasset, Inc. | 244/245 | 2 | 0 | 1440 |
| Prometheus Biosciences, Inc. | 255/257 | 0 | 2 | 1426 |
| Red Hat, Inc. | 236/237 | 0 | 1 | 1666 |
| Redfin Corporation | 317/323 | 0 | 0 | 1865 |
| SecureWorks Corp. | 313/313 | 0 | 0 | 2045 |
| Skechers U.S.A., Inc. | 349/351 | 0 | 0 | 2462 |
| SkyWater Technology, Inc. | 313/314 | 0 | 0 | 1887 |
| Starwood Hotels & Resorts Worldwide, | 277/285 | 5 | 5 | 1703 |
| Summit Materials, Inc. | 279/281 | 0 | 7 | 517 |
| Superior Industries International, I | 236/238 | 0 | 0 | 1371 |
| Theravance Biopharma, Inc. | 273/278 | 0 | 0 | 1357 |
| TopBuild Corp. | 290/298 | 4 | 8 | 2321 |
| United Homes Group, Inc. | 354/356 | 0 | 1 | 1934 |
| Verve Therapeutics, Inc. | 337/337 | 0 | 0 | 1549 |
| Whole Foods Market, Inc. | 238/238 | 0 | 0 | 1655 |