# Parser Hierarchy Handoff

Updated: 2026-07-05 19:46 EDT

## Current Worktree

- Path: `/Users/bengoodchild/Documents/Claude/precedent-machine/.claude/worktrees/conoco-parser-hierarchy`
- Branch: `codex/parser-hierarchy-plan-completion`
- Dev server: `http://localhost:3001`, running from this worktree.
- Canonical WP: `/Users/bengoodchild/Downloads/pm-wp-parser-hierarchy.codex.md`
- Source gap review: `/Users/bengoodchild/Downloads/gap-review-conocophillips-2020-07-05.md`

## Working Rule

The WP is canonical. Deviate only where there is a concrete contradiction or evidence shows the issue is outside the parser hierarchy layer.

Known contradiction: Phase 10 asks to update `HANDOFF.md`, but the WP allowlist says the modify list is exhaustive and does not include `HANDOFF.md`. Ben separately requested a handoff file, so this file is the explicit handoff surface.

## Dirty Worktree Files

- `components/review/table-logic.js`
- `lib/feature-validation.js`
- `lib/gap-review.js`
- `lib/parser-v2/classify.js`
- `lib/parser-v2/coverage.js`
- `lib/parser-v2/regions.js`
- `lib/parser-v2/regions/atomic.js`
- `lib/parser-v2/run-extract.js`
- `lib/parser-v2/store.js`
- `lib/parser-v2/structural.js`
- `lib/rubric.js`
- `lib/verification.js`
- `pages/admin/gaps.js`
- `pages/api/admin/gaps.js`
- `pages/deals/[id].js`
- `pages/review/[id].js`
- `scripts/eval.js`
- `tests/admin-gaps-scroll.test.js`
- `tests/classify-sweep-rules.test.js`
- `tests/feature-validation.test.js`
- `tests/gap-review.test.js`
- `tests/nosol-rebuild.test.js`
- `tests/parser-hierarchy.test.js`
- `tests/store-dedupe.test.js`
- `tests/taxonomy-preambles.test.js`
- `tests/verification.test.js`
- `PARSER_HIERARCHY_HANDOFF.md`
- `tests/eval.test.js`

## Phase Status

- Phase 0 discovery: substantially done. The WP's `sections` table query does not apply because there is no `public.sections` table in this repo/Supabase shape.
- Phases 1-7: implemented or already present in this branch:
  - typed region enum/helpers,
  - coverage helpers,
  - preamble/backmatter detectors,
  - short section handling,
  - atomic section metadata,
  - definition warnings,
  - double-dummy flag,
  - Conoco G-018 TERMF regression.
- Phase 8: implemented locally. `lib/gap-review.js` now treats only `body.section.unassigned` and `body.section.partial` as reviewable gaps. Definition warnings and data-model flags remain separate admin sections.
- Phase 9: complete for the targeted production-facing path:
  - Focused tests passed.
  - Targeted ingest QA passed for Conoco, Glow / European Wax, Landos / Bespin, and Kraft / H.J. Heinz.
  - `npm run eval` passed with parent repo env injected.
  - `npm test` passed.
  - `npm run build` passed.
  - No complete existing pre/post 19-deal tolerance diff harness exists. The available pieces are `scripts/reprocess.js`, `scripts/diff-runs.js`, and `scripts/ingest-qa.js`.

## Conoco Local State

Deal: `a267309a-fc22-4160-a652-1144fc64e9cf`, ConocoPhillips / Concho.

Current `/api/admin/gaps` on local `:3001` after the live refreshes and stale-leftover cleanup:

- reviewable coverage: `100%`
- raw coverage: `96.9%`
- reviewable gaps: `0`
- ignored gaps: `3`
- parser structural gaps: `0`
- definition warnings: `2`
- data-model flags: `1`
- needs-code: `9`
- unverified quotes: `0`
- provision count: `312`
- located provisions: `312`
- unlocated provisions: `0`

The previous four residual gaps are eliminated without reingest:

- Former G-001: Parent IOC, section 6.2, dividend/equity distribution restriction.
- Former G-002: Parent IOC, section 6.2, asset sale/disposition restriction.
- Former G-003: Parent NoSol, section 6.4(f), standstill/confidentiality enforcement.
- Former G-004: Parent NoSol, section 6.4(f), representation about prior standstill action.

Ben confirmed:

- G-001 and G-002 are Parent IOCs.
- G-003 and G-004 are Parent NoSol.
- Agreement structure is 6.1 Company IOC, 6.2 Parent IOC, 6.3 Company NoSol, 6.4 Parent NoSol.

## Key Parser Finding

The parser/classifier understands the parent-side structure:

- 6.1 `Conduct of Company Business Pending the Merger` -> deterministic `IOC-T`, atomic.
- 6.2 `Conduct of Parent Business Pending the Merger` -> deterministic `IOC-B`, atomic.
- 6.3 `No Solicitation by the Company` -> deterministic `NOSOL`, atomic.
- 6.4 `No Solicitation by Parent` -> deterministic `NOSOL`, atomic.

So the four residual admin gaps were not primarily a parser hierarchy failure.

The gap report was misplacing duplicate Parent-side extracted rows at their first near-duplicate Company-side occurrence because `computeCoverage()` and `locateProvisionIntervals()` used `normSource.indexOf(prefix)` without a section-aware placement hint.

Concrete examples:

- Parent IOC dividend row `5096d9b5-eb47-40ad-9db7-697eaf303fe8`:
  - first prefix hit: `136372`, in Company IOC.
  - correct Parent occurrence: `150303`.
- Parent IOC disposition row `9357e3d2-2276-4bb9-8a0f-bdd208a3d954`:
  - first prefix hit: `139707`, in Company IOC.
  - correct Parent occurrence: `153113`.
- Parent NoSol enforcement row `e3c87805-af80-4b18-a22b-b13712e0a3b5`:
  - first prefix hit: `173327`, in Company NoSol.
  - correct Parent occurrence: `193462`.

Current fix in this worktree:

- `lib/verification.js` exports `locateProvisionInSource()`.
- The locator collects all prefix hits, then prefers the occurrence closest after the matching section heading, e.g. `6.2 Conduct of Parent Business Pending the Merger` or `6.4 No Solicitation by Parent`.
- It avoids table-of-contents false headings by comparing candidate heading-to-hit distances.
- `computeCoverage()` uses the locator, so duplicate Parent-side provisions cover the Parent occurrence.
- `lib/gap-review.js` uses the same locator for adjacent-provision context.
- Regression tests added in `tests/verification.test.js` and `tests/gap-review.test.js`.

## Output Review Page Finding

Ben reported that the review page showed no Parent NoSol.

Data check:

- `/api/provisions?deal_id=a267309a-fc22-4160-a652-1144fc64e9cf` returns 32 `NOSOL` rows.
- 17 rows have `ai_metadata.startChar = 149894`, section 6.3 Company NoSol.
- 15 rows have `ai_metadata.startChar = 170168`, section 6.4 Parent NoSol.

Root cause:

- `pages/review/[id].js` had a legacy assumption that all bare `NOSOL` rows belong to `NOSOL-T`.
- The sidebar and filtered view therefore promoted all Parent NoSol rows into Company/Target and synthesized an empty `NOSOL-B` section.
- The older `/deals/[id]` output page also grouped by raw `p.type`, so it displayed bare `NOSOL` rather than the Parent/Company split.

Current fix in this worktree:

- `components/review/table-logic.js` now maps bare Parent-side `NOSOL` rows to display type `NOSOL-B` using section text and strong Parent-side markers.
- `pages/review/[id].js` no longer force-adds all bare `NOSOL` rows into `NOSOL-T`.
- Direct sidebar clicks and direct provision-route hydration use `displayTypeForProvision()` rather than raw `provision.type`.
- `pages/deals/[id].js` uses `displayTypeForProvision()` and labels `NOSOL-T` / `NOSOL-B`.
- `tests/nosol-rebuild.test.js` has a Conoco-shaped regression.

Focused tests passed:

- `node --test tests/nosol-rebuild.test.js tests/review-route.test.js tests/review-layout.test.js`

Manual import sanity:

- Company 6.3 fixture -> `NOSOL-T`
- Parent 6.4 fixture -> `NOSOL-B`
- Parent Competing Proposal notice fixture -> `NOSOL-B`

Browser/API verification:

- Opened `http://localhost:3001/review/a267309a-fc22-4160-a652-1144fc64e9cf?section=NOSOL-B`.
- The page rendered `Filtered · No-Solicitation (Buyer / Parent)`.
- It did not render `No-Shop (Buyer) — None`.
- Visible text included Parent-side substance, including `Parent Competing Proposal` and `Parent Board`.
- UI helper count against live `/api/provisions`: `NOSOL-T = 17`, `NOSOL-B = 15`.
- Opened `http://localhost:3001/deals/a267309a-fc22-4160-a652-1144fc64e9cf`.
- The output page rendered both `No-Solicitation (Target / Company)` and `No-Solicitation (Buyer / Parent)`.
- Visible output page text included Parent-side substance, including `Parent Competing Proposal`.

## Admin UI Verification

Opened `http://localhost:3001/admin/gaps?deal_id=a267309a-fc22-4160-a652-1144fc64e9cf`.

Visible admin state:

- `COVERAGE`: `97.0%`
- `GAPS`: `0`
- `NEEDS CODE`: `22`
- `LARGEST GAP`: `0 chars`
- `CANONICAL`: `89%`
- `UNVERIFIED QUOTES`: `0`
- `PARSER GAPS`: `0`
- `DEFINITION WARNINGS`: `2`
- `DATA FLAGS`: `1`
- Page text says `No coverage gaps above the threshold.`
- Parser Review lists `DW-001`, `DW-002`, and `DM-001`.
- Needs Code list is visible and starts at `U-001`.

Browser console note: the admin page still emits a pre-existing React hydration warning from randomized `SkeletonTable` widths in `components/UI.js`. Not touched, because it is outside this WP's parser/admin-gap scope.

## Live Refresh Status

Targeted live reprocesses have been applied to the review corpus:

- Conoco / Concho: reviewable `100`, raw `96.9`, gaps `0`, ignored `3`, largest `0`, quotes `0`, needs-code `9`.
- Glow / European Wax: reviewable `98.9`, raw `86.7`, gaps `5`, ignored `2`, largest `1215`, quotes `0`, needs-code `19`.
- Landos / Bespin: reviewable `95.0`, raw `74.3`, gaps `10`, ignored `2`, largest `4734`, quotes `0`, needs-code `8`.
- Kraft / H.J. Heinz: reviewable `97.9`, raw `59.0`, gaps `4`, ignored `3`, largest `4484`, quotes `0`, needs-code `29`.

Targeted QA passed:

- `node scripts/ingest-qa.js --deal Conoco`
- `node scripts/ingest-qa.js --deal "European Wax"`
- `node scripts/ingest-qa.js --deal Landos`
- `node scripts/ingest-qa.js --deal Kraft`
- `npm run eval`, with `/Users/bengoodchild/Documents/Claude/precedent-machine/.env.local` injected because this worktree does not contain secrets.

Coding-task queue:

- total `15`
- `11` applied
- `4` needs_review
- `0` pending

Live provision updates were applied for the concrete queue items:

- `MISC-AMEND`
- `MISC-WAIVER`
- `REP-B-SUBSIDIARIES`
- `REP-B-REALPROPERTY`
- `DEF-ENVIRONMENTAL-CLAIMS`

The 4 needs-review items are taxonomy or corpus-sweep calls, not safe mechanical queue applies:

- spin-off completion condition,
- target/seller tax opinion side mapping,
- no-control IOC global sweep.

## Admin Gaps Load Hotfix

Production issue found after deploy: `/admin/gaps` looked like it was not loading data because the summary list defaulted to `limit=100` and recomputed expensive metrics on request for every listed deal.

Measured live timings:

- `/api/admin/gaps?deal_id=c34415ed-44f7-432f-8d7c-6464b0310239`: about `7s`.
- `/api/admin/gaps?limit=10`: about `28s`.
- `/api/admin/gaps?limit=100`: about `53s` in one run and may time out.

Cause:

- The table summary path fetches all provisions per deal and recomputes coverage, reviewable gaps, quote verification, canonical rate, parser review, and needs-code counts.
- The detail path does the same work for one deal, so it is usable.

Hotfix in this branch:

- `pages/admin/gaps.js` default summary limit reduced from `100` to `10`.
- Direct `deal_id` pages skip the summary auto-load and render the deal detail directly.
- Manual `Refresh` still loads the table if needed.

Proper follow-up:

- Persist per-deal quality metrics after ingest/reprocess/provision edits.
- Make the summary table read those stored metrics instead of recomputing full-text coverage and parser review on every request.
- Keep the expensive recomputation path for detail pages and explicit refresh/repair tooling.

## Glow Gap Review Follow-up

Ben reviewed Glow / European Wax (`86a01770-f565-47c5-8e7d-2a75a66b5e8b`) and identified that the first three live G rows were recitals. Confirmed.

Current finding:

- Live before this follow-up: reviewable `98.9`, `5` reviewable gaps.
- Local patched gap classifier: `7` raw gaps, `5` ignored, `2` reviewable.
- Estimated reviewable coverage after deploy: about `99.7`.

What changed locally:

- `lib/gap-review.js` now classifies mid-recital slices as `preamble.recitals` when a broader context window shows a lettered recital run leading into `NOW, THEREFORE`.
- This handles Glow's `Article I. RECITALS` form where the gap slice itself starts mid-sentence and does not contain `WHEREAS`.
- `tests/gap-review.test.js` locks this regression.
- `pages/admin/gaps.js` review-queue links now use `scroll={false}` so clicking G/U/parser rows does not jump to the page top.
- `tests/admin-gaps-scroll.test.js` locks that regression.

Glow residual reviewable gaps after the local patch:

- NoSol tail: text starting `inquiry or proposal that constitutes... (iv) approve, endorse or recommend... (vi) authorize...`. This sits between the stored `NOSOL / Solicitation Prohibition` row and `NOSOL / Enforcement of Standstills`. It is a real NoSol extraction hole. Re-extracting NOSOL alone was already attempted earlier, so this likely needs extractor/splitter/prompt repair before another NOSOL reprocess.
- No Consent Fees: `(b) No Consent Fees...` in Section 6.1 / Section 6.2 boundary. This is a real efforts / antitrust covenant extraction hole, not a U-row. It should become an extracted ANTI/COV provision after the relevant extractor path is fixed or refreshed.

Glow U-001 / U-002 agent findings:

- `U-001`, provision `7b8ed998-a011-4e1d-94f7-3ffbf3035b37`: Section 5.2 Forbearance Covenants chapeau. Complete negative covenant lead-in. Root cause is extractor logic: `splitIocPreamble()` only emits `IOC-NEGATIVE-PREAMBLE` after detecting affirmative limbs. Fix extractor to emit standalone `IOC-NEGATIVE-PREAMBLE`, then reprocess IOC.
- `U-002`, provision `42625bbb-7ef0-4ac8-8567-e8f8c9e4db72`: first fragment of Section 5.1 Affirmative Obligations. It is incomplete. Nearby rows hold the later exception limbs and actual positive obligations. Root cause is `splitSubClauses()` treating pre-obligation exception list `(a)/(b)/(c)/(d)` as real subclauses. Fix IOC subclause splitting before reprocessing IOC. Do not manually code this row as-is.

Glow classify-only dry-run:

- `node scripts/reprocess.js --deal "European Wax" --classify-only --backend codex --model gpt-5.5`, with parent env injected.
- Result: `110` sections classified, `108` regex / `2` cache.
- Only diff: `8.4 Amendment` and `8.5 Extension; Waiver` move from `TERMR` to `MISC` with existing codes `MISC-AMEND` and `MISC-WAIVER`.

Implication:

- The parser/classifier path is mostly stable enough for controlled reprocessing.
- Do not start broad seed ingest yet.
- First do a narrow extractor repair pass for IOC/NOSOL/ANTI-COV on Glow, then apply targeted reprocess and verify that Glow goes to `0` or near-`0` reviewable gaps.

## Next Work

1. Push and deploy the Glow recital/admin-scroll hotfix.
2. Fix IOC extractor handling for standalone negative chapeaux and affirmative exception-list chapeaux.
3. Repair / re-run Glow IOC, NOSOL, and ANTI/COV targeted reprocess.
4. If Glow validates, repeat the same targeted gap-review/reprocess loop on Landos and Kraft.
5. After those pass, resume seed ingest ramp with stored quality metrics as the next admin-table performance improvement.

## Tests Already Run Before This Handoff

- `node --test tests/parser-hierarchy.test.js tests/parser-review.test.js tests/parser-hierarchy-conoco.test.js tests/admin-gaps-scroll.test.js`
- `node --test tests/classify-sweep-rules.test.js tests/parser-hierarchy.test.js tests/parser-review.test.js tests/parser-hierarchy-conoco.test.js`
- After Conoco reprocess:
  - `node --test tests/classify-sweep-rules.test.js tests/parser-hierarchy.test.js tests/parser-review.test.js tests/parser-hierarchy-conoco.test.js tests/gap-review.test.js tests/reprocess.test.js tests/verification.test.js tests/store-dedupe.test.js tests/consid-per-type-backfills.test.js`
- After Parent NoSol review-page fix:
  - `node --test tests/nosol-rebuild.test.js tests/review-route.test.js tests/review-layout.test.js`
- After coverage locator + Phase 8 filter:
  - `node --test tests/verification.test.js tests/gap-review.test.js tests/nosol-rebuild.test.js tests/review-route.test.js tests/review-layout.test.js`
  - Result: 76/76 passed.
  - `node --test tests/verification.test.js tests/gap-review.test.js tests/nosol-rebuild.test.js tests/review-route.test.js tests/review-layout.test.js tests/parser-review.test.js tests/parser-hierarchy.test.js`
  - Result: 90/90 passed.
- Later focused gates:
  - `node --test tests/feature-validation.test.js tests/eval.test.js tests/gap-review.test.js tests/verification.test.js`
  - `node --test tests/store-dedupe.test.js tests/verification.test.js tests/feature-validation.test.js`
  - `node --test tests/taxonomy-preambles.test.js tests/classify-sweep-rules.test.js tests/expected-sets.test.js tests/metsfb2-extraction-batch2.test.js`
  - `git diff --check`
  - Result: passed.
  - `npm test`
  - Result: passed, 790/790.
  - `npm run build`
  - Result: passed. Build reported missing Supabase env during static generation and completed in offline mode, as expected for this worktree.
  - `npm run eval`, with parent env injected.
  - Result: passed. Landos, Metsera, and Verve golden checks all green.
  - Targeted ingest QA for Conoco, Glow / European Wax, Landos / Bespin, and Kraft / H.J. Heinz.
  - Result: all passed.

Full pre/post reprocess safety diff remains unrun because there is no single harness and the `--apply` sequence would mutate live data.
