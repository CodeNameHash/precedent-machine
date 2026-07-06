# Autonomous P7B, WP-UX, Ingest Progress

Updated: 2026-07-06

## Current State

- Base: `main` at `5e10d59` (`feat(schema): P7A empty-state semantic audit (#128)`).
- Repo status at start: clean.
- Last verified gates on P7A: schema tests, full `npm test`, `scripts/ingest-qa.js --all`, and `npm run build` passed.
- Live corpus snapshot from P7A audit: 25 deals, 7,667 provisions, 150,432 scoped feature opportunities, 13,978 populated.

## Working Order

1. P7B: refine empty-state semantics and needs-review noise using the schema-first plan as canonical.
2. Targeted reprocess/reingest only where schema, prompt, or post-pass changes make existing outputs stale.
3. WP-UX: use roadmap v5 only for WP-UX-SHELL and WP-UX-REVIEW scope, then apply aggressive review/card cleanup based on current app state.
4. Ingest expansion: use the current queue, seed, candidate, and QA machinery, not old v5 sequencing assumptions.
5. Stop before P8 destructive cleanup unless Ben explicitly approves.

## Active Lanes

- Main lane: P7B implementation, integration, gates, progress ledger.
- Agent lane A: schema empty-state audit and refinement recommendations, running as `019f357a-6f23-70e1-b4f7-3888fa25f0a2`.
- Agent lane B: WP-UX current-state audit and implementation map, running as `019f357a-7f84-7513-a396-f6e37acf59a2`.
- Agent lane C: ingest expansion readiness and batch plan from current code, running as `019f357a-9404-7741-82db-558048f85703`.

## Gates

- Schema-affecting changes: focused schema tests, `scripts/schema-empty-audit.js`, and `scripts/ingest-qa.js --all`.
- User-facing UI changes: `npm test`, `npm run build`, and browser/runtime check where possible.
- Ingest expansion: queue/candidate sanity check, smoke first, then 2, 4, then 6 to 8 concurrent deals if clean.
- Quote verification: zero unverified quote flags remains a hard gate.

## Decisions

- Do not treat 89.2% coverage as a pass where reviewable gaps are mid-sentence or mid-definition.
- Reviewable coverage should exclude hidden text and other non-reviewable artefacts.
- `needs_review` is for meaningful legal/schema judgement gaps, not generic optional feature absence.
- V5 is authoritative for WP-UX scope only; current repo state and existing queue code govern ingest sequencing.

## Progress

### Region ID Spread, 2026-07-06

- Decision: `region_id` should be spread deliberately through source-bound workflows, not every generic report.
- Implemented locally:
  - Review edit panel re-extract resolves by persisted parser region id first, with `startChar` as legacy fallback.
  - `/api/ingest/extract-section` accepts `region_id`, deletes/reinserts by region first, and stores region identity in row and metadata.
  - Parser extraction fallback provisions and `SECTION-LEFTOVER` rows now retain section region identity.
  - Section-leftover backfill prefers same-region membership and skips mismatched-region text matches, preventing duplicate-text bleed across sections.
  - Worker coverage backfill DB-row conversion preserves region anchors.
  - Admin gap/detail helpers and deal quality metrics carry `region_id` into gap, uncoded, boundary, and unlocated outputs.
  - Store metadata now duplicates `regionId`/`region_id`, `regionKey`, and `regionType` so old consumers still see the anchor.
- Regression added: `tests/parser-region-store.test.js` covers section-leftover region anchoring.
- Gates passed:
  - `node -c` on changed JS/API/test files.
  - `git diff --check`.
  - `node --test tests/parser-region-store.test.js tests/gap-review.test.js tests/ingest-worker.test.js tests/deal-quality-metrics.test.js tests/store-dedupe.test.js`, 45/45.
  - `node --test tests/reprocess.test.js tests/run-history.test.js`, 20/20.
  - `node --test tests/consideration-equity-schema.test.js tests/schema/consideration/*.test.js tests/consid-per-type-backfills.test.js tests/rsa-espp-treatment-and-instrument-backfill.test.js tests/fb3-chrome.test.js`, 31/31.
  - Temp-copy `npm run build` passed.
- Caveat: Maxwell agent `019f37c9-ed04-7c73-8926-b0c01d6c1aaf` is still active on full-corpus CONSID apply. Do not commit/deploy this mixed tree until that finishes and its data/code diff is reviewed.

### WP-SCHEMA-02 Discovery, 2026-07-06

- Scope: implement `/Users/bengoodchild/Downloads/pm-wp-schema-02-election.codex.md` and `/Users/bengoodchild/Downloads/pm-wp-schema-02-transaction-steps.codex.md` precisely, after Discovery.
- Discovery result:
  - Corpus checked: 41 deals.
  - Classified sections checked: 3,702.
  - Classified sections with `region_id`: 3,702.
  - WP-SCHEMA-01 consideration schema exists in production and current local tree, but the local tree remains uncommitted and Maxwell is still applying full-corpus CONSID.
- Transaction-step fixtures selected:
  - ConocoPhillips / Concho Resources: focused scan reads as `SINGLE_MERGER`, not double-dummy.
  - General Dynamics / CSRA: `TWO_STEP_TENDER` candidate, signals include `Acceptance Time` and Offer mechanics.
  - Global Net Lease / Modiv: single-step control.
- Election fixtures selected:
  - QXO / TopBuild: cash/stock election candidate, signals include `Maximum Cash Election Number` and `Maximum Stock Election Number`.
  - Global Net Lease / Modiv: non-election control.
  - Synthetic CVR-inclusion fixture remains required by WP-SCHEMA-02-ELECTION.
- Implementation guardrail: additive schema/code only; no data writes, no commit, no deploy while Maxwell migration remains active.

### P7B

- Branch: `codex/p7b-ux-ingest`.
- Implemented: `scripts/schema-empty-audit.js` now keeps low-population benchmarkable fields as `candidate_flags` instead of auto-promoting them to `needs_review`.
- Implemented: generated empty-state audit now has no proposed automatic state changes.
- Implemented: final P7B semantic refinements from the schema audit:
  - `materialContractsBuckets`: `needs_review`.
  - `permittedExceptions` and `negativePreambleExceptions`: `extraction_pending`.
  - `parentBuyerIocBuckets`: `not_applicable`.
  - `materialContractsDollarThresholds`, `iocAffirmativeScope`, `iocAffirmativeStandard`: `silent`.
- Live audit after P7B script change:
  - Corpus: 25 deals, 7,667 provisions.
  - Feature opportunities: 150,432.
  - Populated: 13,978.
  - Empty states: `silent` 136,360, `extraction_pending` 91, `needs_review` 0, `not_applicable` 3.
  - Proposed registry states: `silent` 519, `extraction_pending` 3, `needs_review` 1, `not_applicable` 1.
  - Candidate signals: 115.
- Added: `docs/schema-migration/phase-7b-notes.md`.
- Gate passed: `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/schema-empty-audit.test.js`.
- Gate passed: `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/schema/*.test.js tests/schema-coverage.test.js tests/schema-empty-audit.test.js` after final semantic refinements, 35 passing.

### WP-UX

- Implemented shell pass in current branch:
  - Full Document is no longer a primary tab; it opens as a right slide-over overlay.
  - Old `?tab=full` normalises to the document overlay.
  - Sidebar clicks close full-doc and see-text overlays and return the main surface to provisions.
  - Visible `Filtered` chip removed from the review page.
  - Sidebar removed the fake `All provisions` row and provision/count badges.
  - Sidebar labels wrap instead of truncating.
  - Sections default collapsed and persist per deal in localStorage.
  - Section headers no longer show numeric ordinals and reserve future chip slots.
  - `see text` and sidebar eyebrow styles moved off monospace.
- Needs verification: focused route tests, build, and browser check.
- Gate passed: `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/review-route.test.js tests/schema-empty-audit.test.js tests/ingest-job-runner.test.js`, 21 passing.
- Gate passed: `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/*.test.js`, 812 passing.
- Gate passed: `npm run build` using the temporary dependency-cache symlink.
- Gate passed: browser/runtime check on `http://localhost:3001/review/a267309a-fc22-4160-a652-1144fc64e9cf`.
  - Verified no `.rec-tabs`/`.rec-tab` legacy tab DOM.
  - Verified no visible `Filtered ·` indicator.
  - Verified sections default collapsed.
  - Verified sidebar has no `All provisions` row and no count badges.
  - Verified sidebar labels wrap with `white-space: normal` and `overflow-wrap: anywhere`.
  - Verified Full Document opens as `[role="dialog"][aria-label="Full document"]`.
  - Verified scoped Close removes the dialog and drops `tab=document` from the route.
- Runtime note: dev server showed `/api/provision-types` 500 in offline mode because Supabase env was missing inside that server path, but the deal, provision, agreement-source data, and edited shell behaviours loaded and verified.

### Next Immediate Step

- Run the broader schema test set, then integrate agent audit findings.
- Start WP-UX implementation after schema gates are clean.

### Agent C Ingest Findings

- Queue path should be primary for new seed expansion.
- Do not use `scripts/ingest-seed-batch.js` except for tiny emergency smoke work because it bypasses staged queue QA/finalise.
- Blocking code gap before expansion: `lib/ingest-job-plan.js` default families omit `NOSOL` and `ANTI`, so queue-ingested deals would be incomplete.
- Fixed in branch: `lib/ingest-job-plan.js` now includes `NOSOL` and `ANTI` default family jobs, with tests in `tests/ingest-job-runner.test.js`.
- Gate passed: `scripts/ingest-qa.js --all`, 25/25 deals PASS, 0 unverified quotes, 0 duplicate clauses.
- Candidate admin "Queue" only updates candidate status; actual ingest jobs still require `scripts/ingest-job-runner.js --enqueue`.
- Worker exit code alone is insufficient because worker records failures without always setting `process.exitCode`; must check `/admin/ingest-runs`, candidate status, and `scripts/ingest-qa.js --all`.
- Use current manifest `docs/ingest/seed-50-manifest-2026-07-05.json`, which has 32 priority-ranked selected deals.

### Ingest Expansion, 2026-07-05

- Live queue readiness check passed:
  - `deal_candidates`: 250 rows.
  - `ingest_runs`: 3 rows.
  - `ingest_jobs`: 56 rows.
  - `ingest_job_dependencies`: 92 rows.
  - `ingest_job_artifacts`: 7 rows.
  - `ingest_job_events`: 92 rows.
  - `claim_ingest_jobs` RPC callable with a no-row read probe.
- Existing seed runs already succeeded before the `NOSOL`/`ANTI` default-family fix:
  - `seed50-smoke-20260705-1`: 1 deal, 14/14 old jobs succeeded.
  - `seed50-smoke-20260705-2`: 1 deal, 14/14 old jobs succeeded.
  - `seed50-batch1-20260705-1`: 2 deals, 28/28 old jobs succeeded.
- Repair required before widening ingest: those four deals have 11 family jobs each, missing `NOSOL` and `ANTI`.
- Repair dry-runs passed from cached snapshots, no parse/classify/no fetch:
  - Glow Midco / European Wax Center: `NOSOL` 1 section, `ANTI` 2 sections.
  - Global Net Lease / Modiv Industrial: `NOSOL` 1 section, `ANTI` 0 sections.
  - SUP Parent / Superior Industries: `NOSOL` 1 section, `ANTI` 0 sections.
  - IonQ / SkyWater: `NOSOL` 1 section, `ANTI` 1 section.
- Repair applies completed:
  - SUP Parent / Superior Industries: `NOSOL` +16, `ANTI` +0.
  - Global Net Lease / Modiv Industrial: `NOSOL` +17, `ANTI` +0.
  - Glow Midco / European Wax Center: rewrote existing slices, final QA count delta total 358 to 356, `nosol` 17 to 15.
  - IonQ / SkyWater: `NOSOL` +8, `ANTI` +11.
- Validation emitted auto-wrap warnings for some bare antitrust citable fields; no repair process failed. Corpus QA remains the hard gate before widening ingest.
- Corpus QA after repair passed: 25/25 deals PASS, 0 unverified quotes, 0 duplicate clauses.
- Manifest offsets checked against live candidates:
  - Offsets 0-5 are already `ingested`.
  - Offset 6 is pending Charter / Cox and is the next true smoke.
- Enqueued smoke run `seed50-smoke-20260706T035711Z` at offset 6, limit 1:
  - 16 jobs.
  - 27 dependencies.
  - Confirms current branch queue plan includes 13 families plus prepare, QA, and finalise.
- At Ben's request to maximise time, enqueued second isolated smoke `seed50-smoke2-20260706T035918Z` at offset 7, limit 1:
  - 16 jobs.
  - 27 dependencies.
  - Running with its own run-scoped worker at concurrency 1, alongside the offset-6 smoke.
- As confidence increased, enqueued batch `seed50-batch2-20260706T040049Z` at offsets 8-9, limit 2:
  - 32 jobs.
  - 54 dependencies.
  - Running with a run-scoped worker at concurrency 2.
- Focused post-WP-UX patch tests passed again: `review-route`, `schema-empty-audit`, and `ingest-job-runner`, 21/21.
- Stacked to hard cap after no failed/review states:
  - Enqueued `seed50-batch4-20260706T040528Z` at offsets 10-13, limit 4.
  - 64 jobs.
  - 108 dependencies.
  - Running with a run-scoped worker at concurrency 4.
- Stop condition triggered:
  - `seed50-smoke2-20260706T035918Z` (offset 7, Rocket / Redfin) reached `needs_review` at `deal-qa`.
  - QA result: total 249, `REP-T` 0, `REP-B` 0, `DEF` 164, `COND` 18, coverage 46.9%, unverified quotes 0, duplicate clauses 0, canonical rate 0.95.
  - No further expansion until diagnosed.
  - Read-only diagnostic agent spawned as `019f35a4-bcff-7ad2-b433-80c3e4ff5251`.
  - Main-lane diagnosis: failed deal id `b57d0d65-d9d6-4e77-8e2e-08da4eb58f81`.
  - Live classified snapshot has 41 sections and starts at Article IV, with no `REP-T` / `REP-B`.
  - Stored text contains Article II and Article III reps; `cleanText` + current `parseStructure` on stored text recovers 95 sections and 7 articles, including Article II Company reps and Article III Parent/Merger Sub reps.
  - Likely repair path: reclassify from stored text, re-extract all families for Redfin, rerun QA, then reset/rerun the failed QA/finalise jobs if clean.
- Redfin repair:
  - Reclassification dry-run passed: 95 sections, regex 87, AI 8; adds Article I, II, III sections, including 26 `REP-T` and 17 `REP-B`.
  - Reclassification apply committed and reset extract status.
  - All-family re-extract started.
  - `REP-T` complete: +27 provisions.
  - `REP-B` complete: +18 provisions.
  - `IOC` refreshed: 21 rewritten.
  - `NOSOL` complete: +15 provisions.
  - `COND` refreshed: 18 rewritten.
  - `TERMR` refreshed: 9 rewritten.
- Batch `seed50-batch2-20260706T040049Z` completed successfully:
  - SecureWorks passed QA and finalised.
  - Bridge passed QA and finalised.
- Root parser fix for Redfin-class raw source:
  - Fresh Redfin SEC source originally parsed only 41 sections across Articles IV-VII.
  - Added `The Parties, intending to be legally bound` as a high-confidence body anchor and taught the preamble path to walk from same-line `Section 1.1` body headings back to the nearest Article I.
  - Added `Redfin-shape` regression in `tests/body-start.test.js`.
  - Parser review found and fixed an inline fallback edge where a short `Section 1.1` could be skipped if Article I was absent.
  - Added `legally-bound inline path keeps short Section 1.1 when Article I is absent`.
  - Focused parser regression set passes 22/22.
  - Fresh Redfin SEC source now parses 96 sections across Articles I-VII, including 27 Article II sections and 18 Article III sections.
- Queue/QA repair after stacked smoke failures:
  - Root coverage bug for Redfin: stored display text serialised section headings as `Section X.Y|Title`, while extracted provisions use `Section X.Y. Title`; `normalizeForMatch` now treats `|` as heading punctuation. Redfin coverage moved from 52.3% to 95.9%, with 0 unverified quotes and 0 duplicates.
  - Root coverage bug for Charter/Cox: large post-signature attachment stack beginning with `Certificate of Designations` was counted in the denominator. Ancillary detection now recognises signature-page attachment stacks and certificate-of-designations exhibits. Charter coverage moved from 58.0% raw/effective to 90.3% effective, with raw coverage still 58.0%.
  - Pre-QA queue path now refreshes catch-all coverage rows (`OTHER` + `SECTION-LEFTOVER`) without touching typed rows. Focused fake-Supabase worker test proves typed rows remain intact.
  - Redfin and Charter QA rows were reset with attempts reset, rerun through patched `scripts/ingest-worker.js`, passed QA, and finalised.
  - `seed50-smoke-20260706T035711Z` now succeeded/finalised Charter/Cox.
  - `seed50-smoke2-20260706T035918Z` now succeeded/finalised Rocket/Redfin.
- Envestnet parser failure:
  - Diagnostic agent confirmed the original snapshot was TOC stubs: 97 sections, 92 under 80 chars, coverage 6.5%.
  - Parser now prefers the operative `NOW, THEREFORE ... agree as follows` anchor over title-page `AGREEMENT ... dated as of` matches and parses operative `Exhibit A / Certain Definitions`.
  - Real Envestnet stored text now parses 99 sections, 12 articles, and `Exhibit-A` definitions.
  - `scripts/reprocess.js --deal Envestnet --classify-only --apply --backend codex --model gpt-5.5` completed: 99 sections, regex 97, AI 2; added `IV-INTRO`, `V-INTRO`, and `Exhibit-A`; removed bogus giant `11.15 ... Exhibit A ...` MISC section.
  - Envestnet all-family re-extract is currently running:
    `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node scripts/reprocess.js --deal Envestnet --types REP-T,REP-B,IOC,NOSOL,ANTI,COND,TERMR,TERMF,DEF,CONSID,STRUCT,COV,MISC --apply --backend codex --model gpt-5.5`
- Focused tests passed after the queue/trust/parser patches:
  - `node --test tests/ingest-worker.test.js tests/store-dedupe.test.js tests/ingest-job-runner.test.js tests/body-start.test.js`: 32/32.
  - `node --test tests/verification.test.js`: 45/45.
- Envestnet repair completed and batch4 finalised:
  - Envestnet all-family re-extract completed with coverage 96.1%, 0 unverified quotes, 0 duplicate clauses, and canonical rate 0.94.
  - `seed50-batch4-20260706T040528Z` reset failed QA/finalise rows, reran patched QA/finalise, and succeeded.
- Corpus QA after repairs passed:
  - `node scripts/ingest-qa.js --all`: 33/33 deals PASS, 0 unverified quote flags, 0 duplicate clauses.
  - Lowest effective reviewable coverage in the checked corpus remained MDC at 86.4%; the new repaired stacked deals passed their gates.
- Batch6 stacked at confidence level 6:
  - Enqueued `seed50-batch6-20260706T060243Z` at offsets 14-19, limit 6, concurrency 6.
  - 96 jobs, 162 dependencies.
  - Initial full worker hit one prepare-time Supabase statement timeout in `findExistingDealBySourceUrl`; the failed prepare was reset and rerun prepare-only at concurrency 1 successfully.
  - Current worker session: `4816`.
  - Current scope: `family-extract,deal-qa,finalize-candidate`, concurrency 6, stop-on-error.
  - Latest queue state: 6 prepares succeeded, 2 family jobs succeeded, 6 family jobs running, 82 pending, no failed or needs-review jobs.
- Batch2b stacked in parallel while staying at the aggregate hard cap:
  - Enqueued `seed50-batch2b-20260706T060935Z` at offsets 20-21, limit 2.
  - 32 jobs, 54 dependencies.
  - Prepare-only worker at concurrency 1 completed both prepares successfully.
  - Current worker session: `87946`.
  - Current scope: `family-extract,deal-qa,finalize-candidate`, concurrency 2, stop-on-error.
- Batch4b staged but not started:
  - Enqueued `seed50-batch4b-20260706T062607Z` at offsets 22-25, limit 4.
  - 64 jobs, 108 dependencies.
  - After first clean batch2b QA/finalise, started prepare-only worker at concurrency 1.
  - Current prepare-only worker session: `94730`.
- First clean stacked QA/finalise after widening:
  - `seed50-batch2b-20260706T060935Z`, candidate `3eed66dd-940a-4e73-9426-0a9f96bd01f3`.
  - Deal: Zymeworks Inc. / Theravance Biopharma, Inc.
  - QA: 283 total provisions, REP-T 23, REP-B 14, DEF 111, COND 16, coverage 95.70%, 0 unverified quotes, 0 duplicate clauses, canonical rate 0.96.
  - Finalise succeeded.
- Duplicate-write stop condition found:
  - `seed50-batch6-20260706T060243Z`, candidate `39395e28-53c1-4b4e-8f4b-a92d613900e0`, also finalised Zymeworks Inc. / Theravance Biopharma, Inc. from the other party's SEC filing.
  - QA for that duplicate was also clean: 282 total provisions, REP-T 23, REP-B 14, DEF 114, COND 16, coverage 95.60%, 0 unverified quotes, 0 duplicate clauses, canonical rate 0.94.
  - Root issue: pre-prepare source-url de-dupe cannot catch dual-party filings with different SEC exhibit URLs.
  - Added a post-metadata party-pair duplicate guard in `scripts/ingest-local.js`: clean existing deals with matching normalised acquirer/target and compatible signing date are reused instead of inserting a new staging deal.
  - Wired `scripts/ingest-worker.js` so a party-pair skip marks candidate/downstream jobs succeeded.
  - Focused de-dupe/worker tests passed: 12/12.
- Batch4b prepare stopped:
  - Offset 24 / candidate `5ec3dd57-7ee6-4408-b31c-d09749bfbfab`: bad source, fetched text only 4,877 chars.
  - Offset 23 / candidate `81d566e2-8fd2-4adf-82e3-513994c44287`: Codex CLI prepare exited 1 with only manifest warning text captured; likely retryable but not retried yet because the duplicate-write stop condition took priority.
  - Offsets 22 and 25 remain pending. Do not start batch4b family extraction until prepare failures and duplicate policy are resolved.
- Side lane:
  - Agent `019f360a-e312-70a3-814d-b5240cf887f7` patched the future prepare-time source-url lookup timeout risk.
  - `findExistingDealBySourceUrl` now tries a targeted `metadata->>source_url` JSON filter first and falls back to the legacy metadata scan only if the filtered query errors.
  - Focused agent test passed: `node --test tests/ingest-worker.test.js`, 8/8.
- Current branch test gates after the lookup patch:
  - Focused parser/queue/trust set passed: 79/79.
  - Full test run initially found one parser regression in `tests/dyax-bare-decimal-bodystart.test.js`: appended CVR form exhibits were being surfaced as definitions annex pseudo-sections.
  - Fixed by requiring definitions annexes to be titled as definitions, rather than merely containing an Article I definitions section inside a separate attached agreement.
  - Targeted Dyax/body-start regressions passed: 10/10.
  - Full test gate passed in dot mode: `node --test --test-reporter=dot tests/*.test.js`.
  - Build gate passed from `/tmp/pm-p7b-build` with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
  - Direct in-repo `next build` is blocked by the existing tracked `node_modules` self-symlink loop; the tracked symlink was not changed.
  - Full test gate passed again after party-pair duplicate guard: `node --test --test-reporter=dot tests/*.test.js`.
- Batch2b stopped on QA:
  - Candidate `7e3bf9f8-b68f-49fd-ba3f-49fba049c8dc`, ENDRA Life Sciences Inc. / Noble Africa LLC.
  - QA: 330 total provisions, REP-T 29, REP-B 29, DEF 141, COND 23, coverage 73.50% FAIL, canonical rate 0.41 FAIL, 0 unverified quotes, 0 duplicate clauses.
  - Worker exited after marking `deal-qa` as `needs_review`.
  - Diagnostic subagent `019f362f-89a0-7d43-a2ad-b950cc54ca43` errored on usage limit, so diagnosis stays with main lane.
- Batch6 completed and stopped on QA:
  - Candidate `39395e28-53c1-4b4e-8f4b-a92d613900e0`, Zymeworks/Theravance duplicate: QA passed and finalise succeeded.
  - Candidate `512ad36d-19eb-49a8-86fc-2f75576a8504`, Wildcat EGH Holdco / Endeavor Group Holdings: coverage 95.80%, 0 quote flags, 0 duplicates, canonical rate 0.63 FAIL.
  - Candidate `8b2c7a6b-56df-44a7-b530-de8831ab9749`, Creek Parent / Catalent: coverage 98.10%, 0 quote flags, 0 duplicates, canonical rate 0.08 FAIL.
  - Candidate `a8c1e3ed-bbd0-418f-8198-1fe236f9a643`, HPE / Juniper: coverage 97.80%, 0 quote flags, 0 duplicates, canonical rate 0.06 FAIL.
  - Candidate `cae89f83-11d6-4876-8357-519223655bd2`, Verizon / Frontier: COND 3 FAIL, coverage 12.10% FAIL, canonical rate 0.05 FAIL, 0 quote flags, 0 duplicates.
  - Candidate `ea4a36ee-9762-4e00-b350-90b49017b5e1`, Quikrete / Summit: coverage 90.60%, 0 quote flags, 0 duplicates, canonical rate 0.09 FAIL.
  - Worker exited; no active ingest sessions remain.
- Canonical-rate diagnostic:
  - Failure is real, not just a QA math issue: failed deals have many non-DEF provisions stored with categories like `Unclassified — Corporate Authorization`, `No-Solicitation / No-Shop`, or `Termination Fees & Expenses`, but no `ai_metadata.code` and no `features.canonicalCode`.
  - Examples: Catalent 11/131 non-DEF provisions coded; HPE/Juniper 8/130; Verizon/Frontier 4/87; Quikrete/Summit 11/128; ENDRA/Noble 78/189.
  - Likely root: per-family queue extraction is not reliably enforcing/stamping canonical codes for rows produced as broad `Unclassified — ...` categories. Fix code-stamping/enforcement before any more ingest.
- Admin review exposure:
  - Missing canonical-code rows are surfaced by `/admin/gaps` as `U-###` Needs Code items, not `G-###` coverage gaps.
  - Refreshed stored `deal_quality_metrics` for batch6/batch2b deal rows so the admin summary table shows current Needs Code counts/canonical rates:
    - Catalent: 253 Needs Code, canonical 0.084.
    - ENDRA/Noble: 165 Needs Code, canonical 0.413.
    - HPE/Juniper: 215 Needs Code, canonical 0.062.
    - Quikrete/Summit: 249 Needs Code, canonical 0.086.
    - Verizon/Frontier: 158 Needs Code, canonical 0.046.
    - Wildcat/Endeavor: 63 Needs Code, canonical 0.632.
    - Zymeworks/Theravance duplicates: 11 and 7 Needs Code respectively.
  - Live production API check passed against `https://precedent-machine.vercel.app/api/admin/gaps` for all eight review deal ids. Each detail response includes `needs_code` detail rows starting at `U-001`.
  - Review URLs:
    - Catalent / Creek Parent: `https://precedent-machine.vercel.app/admin/gaps?deal_id=bb5f062d-2818-4f9f-b968-ad9980445b6f`
    - ENDRA / Noble: `https://precedent-machine.vercel.app/admin/gaps?deal_id=65a3e3c8-91e6-4075-bad0-4e3c4d1b43b9`
    - HPE / Juniper: `https://precedent-machine.vercel.app/admin/gaps?deal_id=a1b07312-5ab1-4d6e-b173-6eccb5173d36`
    - Quikrete / Summit: `https://precedent-machine.vercel.app/admin/gaps?deal_id=fc03e7e3-e9ca-4936-bb9a-282a6276783a`
    - Verizon / Frontier: `https://precedent-machine.vercel.app/admin/gaps?deal_id=00d49e6a-3a99-4164-8417-76bf2713a3ec`
    - Wildcat / Endeavor: `https://precedent-machine.vercel.app/admin/gaps?deal_id=0a043659-68fb-4d20-98e6-b926aa758799`
    - Zymeworks / Theravance A: `https://precedent-machine.vercel.app/admin/gaps?deal_id=04f5871a-338e-44a3-8f42-ef75b352368b`
    - Zymeworks / Theravance B: `https://precedent-machine.vercel.app/admin/gaps?deal_id=0d38cc1f-2f49-47ee-bc21-de68d7884b90`
- Verizon marker/title-only cleanup:
  - Confirmed `[[DEFINED]]` / `[[/DEFINED]]` markers had leaked into stored `provisions.full_text` rows, especially Verizon definitions such as `"Final Order"[[/DEFINED]]`.
  - Patched parser/storage normalisation so marker-laden display text is cleaned before per-type extraction and before provision rows persist.
  - Live Supabase scrubbed existing provision rows only, not `deals.metadata.full_text` because the full-document renderer intentionally uses display markers.
  - Result: Verizon stored provision rows now have `titleOnly: 0` and `markerRows: 0`.
  - Root cause of Verizon `U-029` through `U-034`: headerless same-line table-of-contents stubs were accepted as body sections because `SECTION 1.01. The Merger` had a title but no body prose.
  - Added a body-start discriminator requiring substantive inline prose after the section-title period, plus a Verizon-shaped regression.
  - Reclassified Verizon / Frontier from stored text with the patched parser, then reprocessed stale families sequentially:
    - `REP-B`, then `ANTI`, `COND`, `CONSID`, `IOC`, `COV`, `STRUCT`, `TERMR`, `TERMF`, `MISC`, `DEF`, `REP-T`.
    - One combined run failed on a Supabase `fetch failed` during `COV`; resumed with narrower family batches and completed.
  - Live Verizon now passes QA:
    - 265 total provisions, REP-T 25, REP-B 13, DEF 115, COND 13.
    - Coverage 97%, reviewable coverage 98.2%, canonical rate 0.973, unverified quotes 0, duplicate clauses 0.
    - Admin `/admin/gaps` shows 4 Needs Code items, all substantive proposed-code items, no title-only Needs Code rows.
- Rocket boundary side-agent:
  - Agent `019f3780-d266-7691-ba08-42821a679053` implemented the Rocket boundary slice from `/Users/bengoodchild/Downloads/rocket.md.rtf`.
  - New parser helpers:
    - `lib/parser-v2/text-layers.js`
    - `lib/parser-v2/detectors/defined-terms-toc.js`
    - `lib/parser-v2/invariants/enacting-hard-wall.js`
    - `lib/parser-v2/invariants/list-continuity.js`
    - `lib/parser-v2/invariants/provision-completeness.js`
    - `lib/parser-v2/invariants/sentence-integrity.js`
  - Wired into `lib/parser-v2/structural.js`: boundary-noise cleanup, defined-terms TOC strip, enacting hard wall, exhibit/form body-end wall.
  - Added `tests/parser-boundaries.test.js`.
  - Agent did not write live data; main lane reviewed overlap with the Verizon body-start fix.
- Current gates after Verizon + Rocket:
  - Focused combined parser/marker/QA suite passed: 127/127.
  - Full test gate passed: `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test --test-reporter=dot tests/*.test.js`.
  - `git diff --check` passed.
  - Build gate passed from `/tmp/pm-p7b-verify-build` with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
- Reconnect note, 2026-07-06 09:29 EDT:
  - Local process check shows `node scripts/ingest-worker.js --run-id seed50-batch6-20260706T060243Z ...` plus a `codex exec` child still active, despite the earlier queue note saying no active ingest sessions.
  - Commit/deploy can proceed because no files are being changed under the worker after this note, but ingest status should be checked before restarting or widening any queue batch.
- Boundary/performance pass, 2026-07-06 10:09 EDT:
  - Verizon G-001 is now classified as TOC/frontmatter by a same-line TOC detector, so it should become non-reviewable after deploy/metrics refresh.
  - Verizon G-002 is not ANTI-specific. It is a generic provision boundary failure where extracted text stopped after a closing parenthesis while the clause continued.
  - Added a generic extraction boundary repair pass in `lib/parser-v2/extract.js`:
    - runs for full ingest and per-type reprocess before `SECTION-LEFTOVER` generation,
    - extends provision text to the next real legal sentence/list boundary inside the same classified section,
    - stops before the next located provision/list item.
  - Fixed `nextStartsList` in `sentence-integrity` so roman markers like `(ix)` are recognised as list starts.
  - Added locator normalisation for split decimal citations: source `FAR Section 45.10 1` now matches provision text `45.101`.
  - General Dynamics review agent `019f37bc-e04b-7be3-aee3-251ddbec0902` findings:
    - Deal id `6369cc9c-3cb7-40b6-9227-2b9b0361c2a3`.
    - G-001: STRUCT §2.1 tender-offer mechanics stopped mid-list after `other provisions of this`.
    - G-002: REP-T §4.12 locator false-negative caused by `45.10 1` vs `45.101`.
    - G-003: ANTI §6.3(d) uncovered because stored row was a non-contiguous splice.
    - G-004: NOSOL §6.4 under-extracted, row stopped mid-sentence and gap ran into proxy/meeting text.
    - Expected fix path: deploy code, reprocess General Dynamics `STRUCT`, `REP-T`, `ANTI`, `NOSOL`, refresh quality metrics, rerun QA. G-002 should improve from locator normalisation without a semantic extraction change.
  - Admin/deal-list performance:
    - `/api/deals` list mode now uses a narrow projection and provision counts from `deal_quality_metrics`, without `metadata.full_text`.
    - Deal selector and review index no longer fan out to `/api/provisions` for counts.
    - `/admin/gaps` summary defaults to persisted `deal_quality_metrics`; live recompute is behind explicit Refresh (`refresh_metrics=1`); detail remains live/on-demand.
    - Pending/stale metrics now render as pending/unknown rather than clean zeroes.
  - Gates run so far:
    - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/parser-boundaries.test.js tests/verification.test.js tests/gap-review.test.js tests/ingest-qa.test.js tests/run-extract-quality.test.js tests/per-type-parity-followups.test.js` passed 89/89.
  - Local process check at 10:09 EDT showed no active Next/dev server, ingest worker, reprocess, or Codex CLI child.

## Open Risks

- Some existing extracted data may be stale after schema prompt/rendering or hierarchy fixes.
- Admin/review summary pages are now persisted-first, but detail pages remain live by design.
- Long-running test/build gates need dependency symlink handling because this repo tracks `node_modules` as a symlink.
- Batch6 and Batch2b are no longer live.
- Batch4b is stopped with two failed prepare rows; do not restart until duplicate policy and failed candidates are handled.
- There are currently two clean Zymeworks/Theravance deal rows in Supabase; decide whether to mark/delete one duplicate before treating corpus counts as clean.
- Systematic canonical-rate failure remains on several high-coverage deals other than Verizon; diagnose before broad ingest resumes.
- Verizon's DEF refresh materially changed definition row shape/count from 82 to 115. QA/admin numbers are strong, but this is worth a quick legal/data review before treating the refresh pattern as safe for every failed deal.
- Boundary repair is code-level only until target deals are reprocessed and metrics refreshed. Do not declare General Dynamics clean until `STRUCT`, `REP-T`, `ANTI`, and `NOSOL` reruns plus QA confirm it.

## 2026-07-06 10:55 EDT Update

- Production deploy `90b2fbf` completed earlier in this lane:
  - `https://precedent-machine.vercel.app` aliases `https://precedent-machine-11tf4947k-codenamehashs-projects.vercel.app`.
  - `/api/deals` returned 35 deals without `metadata.full_text`, using persisted provision counts.
  - `/api/admin/gaps?limit=25` returned `mode:"stored_only"` after metrics warm.
- Metrics warm for `/api/admin/gaps?limit=100&refresh_metrics=1` recomputed/wrote 41 metrics rows.
- Metsera full reingest agent `019f37c9-ed04-7c73-8926-b0c01d6c1aaf` completed:
  - Deal id `885edae5-49e8-464a-9f33-edd229119d7c`, Pfizer Inc. / Metsera, Inc.
  - Inserted 310 provisions.
  - QA passed: coverage 97.20, unverified quotes 0, duplicate clauses 0, canonical rate 0.92.
  - Stored metrics after admin refresh: reviewable coverage 100, raw coverage 79.4, gap_count 0, ignored_gap_count 4, needs_code_count 14.
  - No duplicate Metsera-like deal row found.
- Edit-mode boundary audit UI is in progress on this branch:
  - New `/api/admin/gaps?deal_id=...` detail payload key: `boundary_audit`.
  - New `BoundaryAuditPanel` opens from the review-page toolbar in edit mode.
  - Panel shows source-order spans, starts, tails, gaps, unlocated rows, warning/error flags, and edit/read links.
  - Flag logic checks real provision tails, not truncated starts, and suppresses expected DEF and same-family contained overlaps.
  - Broad different-family parent spans are flagged once as `contains_nested_spans` instead of warning on every contained child.
  - Browser smoke on Conoco edit view passed locally: button present, panel opens, `FLAGGED` count 14, all spans/tails/Edit links visible.
  - Focused tests passed: `tests/gap-review.test.js tests/parser-boundaries.test.js tests/verification.test.js`, 69/69.
  - Full tests passed: `node --test --test-reporter=dot tests/*.test.js`.
  - Build passed from a temp copy with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
- Do not stage `lib/llm-cli-client.js` unless intentionally changing concurrency. The temporary Metsera agent `MAX_CONCURRENT = 6` edit was reverted to repo default `2`.

## 2026-07-06 11:20 EDT Boundary Audit Follow-Up

- Fixed the boundary audit drawer based on Ben's live review:
  - Edit buttons now keep the audit drawer open as the left analysis pane while the edit panel appears on the right.
  - Boundary rows now render full text, not just preview/tail snippets.
  - The primary list is a single source-order list; unlocated rows sit below it because they have no source position.
  - Removed the duplicated `Flagged in source order` section.
  - Added a segmented `Source order` / `Issues first` sort.
- Local browser smoke passed on Conoco:
  - Source-order list appears first.
  - Full text is visible.
  - Clicking an audit-row Edit button opens the edit panel at `?mode=edit&edit=<provision_id>` while the audit remains visible on the left.
- Gates passed:
  - Focused parser/gap/verification tests: 69/69.
  - Full `node --test --test-reporter=dot tests/*.test.js`.
  - Temp-copy `npm run build`.

## 2026-07-06 Definition Text Lock

- Ben flagged that DEF `definitionText` was editable separately from the provision text.
- Implemented lock in two layers:
  - Review editor no longer surfaces `definitionText` as a structured-summary field.
  - `/api/provisions` strips `definitionText` from incoming feature updates and preserves the stored value.
- Focused tests passed:
  - `tests/edit-schema.test.js`
  - `tests/provision-metadata-locks.test.js`
- Temp-copy `npm run build` passed.
- Full `node --test --test-reporter=dot tests/*.test.js` currently has unrelated CONSID backfill failures in the dirty parser/schema worktree.

## 2026-07-06 WP-SCHEMA-02 Implementation

- Implemented the two attached schema briefs locally, not committed/deployed:
  - `/Users/bengoodchild/Downloads/pm-wp-schema-02-transaction-steps.codex.md`
  - `/Users/bengoodchild/Downloads/pm-wp-schema-02-election.codex.md`
- Migration files are deliberately split per the briefs:
  - `supabase/schema-02-transaction-steps.sql`
  - `supabase/schema-02-election.sql`
- Transaction-step work:
  - `lib/parser-v2/detectors/transaction-steps.js`
  - `lib/schema/topology-detector.js`
  - store path materialises `transaction_steps` before `deal_topology`, then binds multi-step `consideration_equity_provisions.transaction_step_id`.
  - API/UI expose `deal_topology` and show a topology badge on non-single-step deal pages.
  - `scripts/backfill-transaction-steps.js` is dry-run by default.
- Election work:
  - `lib/parser-v2/elections.js`
  - `components/review/ElectionCard.jsx`
  - consideration renderer shows the election panel once above treatment cards, with option cards separated by `OR`, default/deadline, and proration source language.
  - store path writes `proration_rules`, `election_mechanisms`, `election_options` with write-time invariants and best-effort cleanup on child insert failure.
  - `scripts/backfill-elections.js` is dry-run by default.
- Discovery / dry-runs before shareholder-election carrier fix:
  - ConocoPhillips / Concho: `SINGLE_MERGER`, one `MERGER` step, section `1.2`.
  - General Dynamics / CSRA: `TWO_STEP_TENDER`, `TENDER_OFFER` then `BACK_END_MERGER`, warning only on chaining.
  - Global Net Lease / Modiv: `SINGLE_MERGER`, one `MERGER` step.
  - Initial QXO, Skechers, and Global Net Lease election dry-runs produced `election_mechanisms: 0` because the first implementation only scanned existing `consideration_equity_provisions`, which had employee-equity rows only. That was not good enough for the intended cash/stock election product.
- Shareholder-election carrier correction:
  - `lib/parser-v2/consideration-equity.js` now builds a `CONSID-ELECTION` carrier from election-bearing ordinary `CONSID` provisions, including cash/stock shareholder consideration provisions.
  - Store path now permits a `CONSID-ELECTION` carrier with zero employee-equity treatments, while still enforcing election quote fidelity and option/proration invariants.
  - `scripts/backfill-elections.js` now scans live `provisions` CONSID rows as well as existing consideration carrier rows, and can create/link a carrier row on `--apply`.
  - This still does not add WP-SCHEMA-03 cash modelling. It only gives the election mechanism a parent consideration provision so split cash/stock consideration can be displayed and queried.
- Election dry-runs after correction:
  - QXO / TopBuild: `election_mechanisms: 1`, `CASH_OR_STOCK`, `CASH_ELECTION` + `STOCK_ELECTION`, prorated.
  - Skechers: `election_mechanisms: 3`, cash/mixed election-bearing sections detected. Types currently classify as `OTHER` because these sections do not expose a clean standalone `STOCK_ELECTION`; review before apply.
  - Global Net Lease / Modiv: `election_mechanisms: 0`, non-election control remains clean.
- Gates after final patches:
  - Syntax passed for schema-02 parser/store/scripts.
  - Focused schema/store/consideration tests passed: 38/38.
  - Temp-copy `npm run build` passed with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
  - `git diff --check` passed.
- Do not run apply backfills yet. Next required step is human review of the dry-run output and migration application order, then apply `schema-02-transaction-steps.sql`, `schema-02-election.sql`, and only then run backfills with `--apply`.

## 2026-07-06 12:29 EDT Metsera Review Pass

- User clarification: the large UX/substantive feedback block refers to Metsera.
- Agent lanes:
  - Locke UI lane completed and its UI copy/layout patches were reviewed into the main worktree.
  - Ramanujan antitrust lane completed and its extraction post-pass patches were reviewed into the main worktree.
  - Zeno corpus/schema sweep completed read-only and produced the follow-up map below.
  - Maxwell remains the blocking agent for committing the mixed schema-02/consideration worktree. Do not commit/deploy until Maxwell is polled and its output is integrated or explicitly deferred.
- Implemented Metsera UI/display fixes:
  - Antitrust table no longer repeats the redundant `Antitrust Summary` heading.
  - Antitrust row headers now read `Category` / `Term` / `Provision`.
  - `Pull-Refiling` relabelled to `Pull and Refile`.
  - Antitrust timing rows now prefer full `pullRefileText` and `timingAgreementText` before short enum values, so Metsera's parent pull-and-refile proviso can display.
  - SEC meeting, employee benefits, and No Other Reps/Fraud tables now use `Term` / `Provision` language.
  - SEC adjournment row title no longer says `Company`.
  - Employee Benefits precluding-arrangements label now says `Company pre-closing arrangements`.
  - No Other Reps/Fraud moved to the end before Definitions in sidebar/review order.
  - Material Contracts left column aligned to the standard review label width.
  - IOC side gate now treats single-child filter arrays like `['IOC-T']` as target-only, so Parent/Buyer tables no longer appear in Target-only IOC sections.
  - IOC threshold display now formats bare numeric threshold values as dollars with commas, e.g. `2000000` to `$2,000,000`.
  - Rep lookback display now frames numeric month counts as years before signing, not raw month counts.
  - No-sol Key Definitions now source Intervening Event and Acceptable Confidentiality Agreement from DEF rows when present, suppressing duplicate legacy NOSOL feature-definition rows and deduping child/top-level definition repeats.
- Implemented antitrust extraction/post-pass fixes:
  - Normalises Metsera-shaped pull/refile and timing-agreement text by repairing truncated timing sentences from the same provision boundary.
  - Splits Clear Skies into parent/company scope fields where source text supports it.
  - Suppresses unhelpful generic `capDetail` on ANTI-HOHW.
  - Stamps COND-M-REG antitrust closing conditions as HSR plus Scheduled Approvals.
  - Adds outside-date antitrust extension summary to timing text when the termination-rights outside-date row supports it.
- Observed live Metsera data:
  - Metsera ANTI-TIMING already stored full `pullRefileText` / `timingAgreementText`; the display was preferring the enum.
  - Metsera COND-M-REG already carries HSR plus Scheduled Approvals in structured fields; the UI/condition finder must prefer those fields over broad category language.
  - Metsera dividend IOC row locally resolves as `IOC-DIVIDEND` with dividend-specific exceptions; the earlier `acquisitions / business combinations` display was a row/component display issue, not proof the stored dividend row was miscoded.
- Gates passed after this pass:
  - Syntax: `node -c components/review/table-logic.js` and `node -c lib/parser-v2/extract.js`.
  - Focused UI/parser tests: `tests/audit-fix-batch-ui.test.js tests/nosol-definition-chains.test.js tests/review-layout.test.js tests/anti-regulatory-efforts.test.js tests/sec-meeting.test.js tests/employee-benefits.test.js tests/willful-breach-abry.test.js`, 75/75.
  - Focused schema/parser tests: `tests/schema/validation.test.js tests/schema/formatters.test.js tests/parser-boundaries.test.js tests/canonical-conditions.test.js tests/cond-termr-display.test.js tests/per-type-parity-followups.test.js tests/feature-validation.test.js`, 68/68.
  - Build initially caught a duplicate top-level helper name in `lib/parser-v2/extract.js`; fixed by renaming the antitrust helper to `firstAntitrustSentenceMatching`.
  - Post-fix focused antitrust/boundary tests passed: `tests/anti-regulatory-efforts.test.js tests/parser-boundaries.test.js`, 16/16.
  - Temp-copy `npm run build` passed with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
  - `git diff --check` passed.
- Deferred follow-ups:
  - AOC needs a real schema/rendering lane, not a display patch: add `aocNoMaeSinceDate`, `aocSpecifiedIocComplianceSinceDate`, and resolved `aocSpecifiedIocCovenants` with covenant text and source links.
  - MAE empty data is likely stale DEF-MAE extraction, not a schema absence. Reprocess Metsera DEF/MAE after commit/deploy and add QA warning when DEF-MAE lacks `carveouts` or `maeLimbs`.
  - R&W SEC filing excluded portions need a tagged canonical backfill for `secFilingsExceptionExclusions` / `secFilingsExcludedSections`.
  - IOC `OTHER` / `OTHER_SPECIFIC` taxonomy alignment remains open: specific IOC pages should distinguish section-wide exceptions from local exceptions and show each `OTHER` item with source text.
  - Canonical indicator/pill consistency should become a shared renderer backed by `resolveTaggedLabel`, not more bespoke pill rules.

## 2026-07-06 Metsera NoSOL + Hover Follow-Up

- User review notes:
  - Metsera ARC provision (e) has five A-E items, but the UI compressed them into three canonical chips.
  - Metsera general override provision (g) should surface three not-change items: Rule 14d-9/14e-2 disclosure, required-by-law disclosure, and proposal-receipt / agreement-operation disclosure with recommendation reaffirmation.
  - With explicit `see text`, left-hand term labels should not also show broad hover text. Right-column hovers must point to the specific source phrase driving the value.
- Live data check:
  - Provision `f5f9a180-80af-499a-a7eb-105722a5e773` already stores all five `changeOfRecommendationItems` A-E.
  - Provision `aa713c4d-5b5c-43c7-9f54-fc4b14a6470a` already stores `tenderOfferDisclosureScope`, `legallyRequiredDisclosurePermitted`, and the reaffirming `notChangeOfRecommendationItems` text.
  - Root issue was display compression, not missing live data for these Metsera points.
- Implemented locally:
  - `NosolFourTables` now renders full itemised text rows for `What constitutes a Change of Recommendation`.
  - `NosolFourTables` now renders full itemised text rows for `What does NOT constitute a Change of Recommendation`, deriving 14d-9/14e-2, required-law, and reaffirmation rows from the stored feature fields.
  - NOSOL prompt now explicitly tells extraction to preserve each general-override safe-disclosure carve-out as a separate not-change item.
  - `TermCell` now wraps the explicit `see text` control in source hover.
  - `HoverSource` suppresses popovers triggered inside `.term-cell-label`, so left-hand term labels no longer show broad source hover.
  - IOC threshold amount pills now use a narrow source context around the driving dollar amount instead of the whole provision.
- Gates passed:
  - Syntax checks on touched UI/parser files.
  - Focused NoSOL/hover/IOC suite: `tests/nosol-rebuild.test.js tests/audit-fix-batch-ui.test.js tests/fb3-wiring.test.js tests/nosol-definition-chains.test.js tests/review-layout.test.js`, 60/60.
  - Broader focused UI/parser suite: `tests/audit-fix-batch-ui.test.js tests/nosol-rebuild.test.js tests/nosol-definition-chains.test.js tests/fb3-wiring.test.js tests/review-layout.test.js tests/anti-regulatory-efforts.test.js tests/sec-meeting.test.js tests/employee-benefits.test.js tests/willful-breach-abry.test.js tests/evidence-hover.test.js tests/reps-table-display.test.js`, 124/124.
  - Schema/parser focused suite: `tests/schema/validation.test.js tests/schema/formatters.test.js tests/parser-boundaries.test.js tests/feature-validation.test.js`, 34/34.
  - Temp-copy `npm run build` passed with `node_modules` symlinked to `/tmp/wp-schema-p7-node_modules-1783304291`.
  - `git diff --check` passed.

## 2026-07-06 WP-SCHEMA-03 + Deal Facts Checkpoint

- User requested implementation of `/Users/bengoodchild/Downloads/pm-wp-schema-03-card-model.codex.md` while Maxwell continues, plus Metsera SAR/MAE/no-sol checks, sidebar jump fixes, deal metadata/value/source capture, and consideration display investigation.
- Implemented the explicit WP-SCHEMA-03 additive scaffold:
  - `supabase/schema-03-card-model.sql`
  - `lib/schema/card-model.js`
  - `scripts/lint-schema-fields.js`
  - `tests/schema/card-model/invariants.test.js`
  - `tests/schema/card-model/schema-sql.test.js`
  - `lib/schema/index.js` export
- Important schema-03 boundary:
  - The brief names shared tables and direct-source child tables, but does not specify where many scalar card fields live, including consideration headline fields, rep qualifiers, condition party, no-shop type, fee amount, and similar per-card values.
  - Adding a generic field table, JSON payload, or broad scalar columns would vary from the brief.
  - Section 5.4 also says every child table row must carry source quote/spans, while the specified `closing_condition_cited_provisions` table has no quote/span columns. I treated that as a link table and pinned the guardrail accordingly.
  - Result: explicit migration/helper/guardrails are implemented, but extractor/store/UI cutover is intentionally not done until that ambiguity is resolved.
- Metsera checks:
  - SAR issue: live/API Metsera equity data does not include SAR treatments. SAR mentions are in negated representation language only. No data backfill needed unless Ben sees a stale client page.
  - No-sol uncoded tail: already pulled into the NOSOL provision, live gap counts are clean for that issue.
  - MAE display root cause found and fixed locally: both Company MAE and Parent MAE had the same category/code, and side detection was not reading the defined term text. The review/sidebar now classify parent/buyer/acquiror MAE as Parent and company/target MAE as Company.
- Sidebar provision click fix:
  - Clicking a provision in the left sidebar now scrolls/jumps to that provision instead of narrowing/hiding the other provisions.
  - Edit mode still opens the edit panel.
- Deal facts/value/source work:
  - Added `lib/deal-facts.js` for `deal_facts` metadata helpers.
  - Ingest paths now preserve value, value source, public/display party facts, contractual parties, advisor facts, and derived consideration facts inside `metadata.deal_facts`, while also filling `deals.value_usd` when available.
  - Deal list prefers `deal_facts` for value/consideration display.
  - Review header now has edit-mode deal-data editing for value/source fields, using `/api/deals` PATCH and preserving source metadata.
- Consideration display:
  - Review section headers already route derived `MIXED` / election values through `headlineConsiderationLabel`, including `Election` and `Cash / stock election`.
  - Found one remaining local leak in `ConsiderationTables`: the headline consideration block captured raw `f.considerationType` before display. Patched it to use `resolveConsidTypeLabel`, so raw `MIXED` does not survive into the consideration hero logic.
- Euler consideration agent completed and was closed:
  - Confirmed Envestnet has one consideration-equity provision and three treatment rows, PSU / RSU / Stock Options. Duplicate RSU/PSU display was not duplicate stored treatment rows.
  - Confirmed PSU performance was stored on treatment rows but not rendered.
  - Confirmed Envestnet contractual buyer is `BCPE Pequod Buyer, Inc.` while the public buyer is Bain Capital, so display and contractual-party names should remain distinct.
- Integrated local follow-ups from Euler:
  - Equity award rows now carry `performance_treatment` / `performanceTreatment`.
  - PSU rows render a `Performance` field, including `Greater of target or actual` when the source quote says the award is based on the greater/higher of target and actual performance.
  - Parser post-pass no longer collapses greater-of-target-and-actual PSU language into plain target performance.
  - Review hero uses display buyer/target names from `getDisplayAcquirer` / `getDisplayTarget`, while showing a small `Contractual parent` line when the legal parent differs.
- Gates passed so far:
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/schema/card-model/invariants.test.js tests/schema/card-model/schema-sql.test.js`
  - `node scripts/lint-schema-fields.js`
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/review-layout.test.js`
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/deal-facts.test.js tests/canonical-advisors.test.js tests/seed-batch.test.js`
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/schema/card-model/invariants.test.js tests/schema/card-model/schema-sql.test.js tests/review-layout.test.js`
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/mrcooper-stock-batch.test.js tests/fb3-3g-skechers.test.js tests/audit2-cosmetic-sweep.test.js`
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 node --test tests/consideration-equity-schema.test.js tests/audit2-cosmetic-sweep.test.js tests/mrcooper-stock-batch.test.js tests/fb3-3g-skechers.test.js tests/review-layout.test.js`
  - Temp-copy `npm run build` passed after copying `/tmp/wp-schema-p7-node_modules-1783304291` into the temp app.
- Maxwell completed:
  - Maxwell was a production-data lane, not a code-patch lane.
  - Metsera / WP-SCHEMA-01 consideration migration is complete in production data for deal `885edae5-49e8-464a-9f33-edd229119d7c`.
  - Metsera CONSID-EQUITY now has three schema treatments: STOCK_OPTIONS, RSA, ESPP.
  - Corpus state reported by Maxwell: 29 current CONSID-EQUITY rows, 0 bad legacy equity rows, 31 `consideration_equity_provisions`, 118 `consideration_treatments`, 0 duplicate treatment keys, 0 quote mismatches, 206 archived provision rows.
  - Metsera QA PASS: 310 provisions, coverage 97.20%, unverified quotes 0, duplicates 0, canonical rate 0.92.
  - Admin gaps refreshed: `https://precedent-machine.vercel.app/admin/gaps?deal_id=885edae5-49e8-464a-9f33-edd229119d7c`, gap_count 0, structural gaps 0, data_model flags 0.
- Final local readiness after Maxwell:
  - Patched full-suite expectation drift in `tests/ingest-worker.test.js` for `candidate_deal_value_usd`.
  - Patched brittle Antitrust source-slice test for the current `AntitrustSummaryTable` props.
  - `NODE_PATH=/tmp/wp-schema-p7-node_modules-1783304291 /Users/bengoodchild/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js` passed, 878/878.
  - `git diff --check` passed.
  - Temp-copy `npm run build` passed after copying `/tmp/wp-schema-p7-node_modules-1783304291` into the temp app.
- Deploy state:
  - Code and data are now together and deploy-ready, subject to staging by file and excluding `.DS_Store`.
  - WP-SCHEMA-03 remains the explicit scaffold and guardrail implementation only. Full card-model extractor/store/UI cutover is still blocked by the scalar-field ambiguity in the brief.
