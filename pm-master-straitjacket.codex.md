# WP-MASTER-V1 — Master Straitjacket for Codex

**Repo:** github.com/CodeNameHash/precedent-machine (JS/JSX, Next 14 Pages Router, Supabase, Tailwind)
**Deployed:** precedent-machine.vercel.app
**Local inspection clone:** `/tmp/pm-inspect` (re-clone with `git clone --depth 50 https://github.com/CodeNameHash/precedent-machine.git pm-inspect` if missing)
**Anchor deal:** Metsera — `885edae5-49e8-464a-9f33-edd229119d7c`
**Supersedes / consolidates:** `pm_wp_review_strict_v1`, `pm_wp_review_strict_v2_straitjacket`, `pm_wp_review_strict_v2_straitjacket_amendment_01`, `pm_wp_market_normalization_v1`, `pm_wp_market_normalization_v1_amendment_01`, `employee_equity_mockup`.

This is the FIRST document Codex sees for this work stream. Nothing in the five prior workpackages has been handed to Codex yet. This file is the only brief. It replaces all of them — do not go looking for the originals; every rule that matters has been carried forward here.

---

# PART 0 — HOW TO READ THIS DOCUMENT

**What this is.** A single ordered runbook of 11 phases, each with an objective, numbered steps, a file allowlist, blocking tests, a definition-of-done gate, and a BLOCKED-file protocol. Appendices hold everything Codex needs to grep by name — vocab, schema, forbidden patterns, ACK text, allowlists — so the main runbook stays short and imperative.

**What order to execute.** Exactly the phase order in Part 2, no exceptions:

```
0 → 0.5 → 1 → 2 → 3 → 4 → 4.5 → 4.6 → 5 → 6 → 7
```

Phase N+1 does not start until Phase N's tag is present in `git log`. This is enforced by CI (Appendix F, Appendix H).

**The ACK contract.** Before touching any file, Codex commits `ACK-MASTER-V1.md` at repo root, byte-exact against `docs/acks/ACK-MASTER-V1.reference.md` (Appendix H). CI diffs them. Any drift blocks every PR under this WP, permanently, until fixed.

**Where each reference lives (appendix index):**

| Need | Appendix |
|---|---|
| The ~50 priority market fields + how the rest get generated | A |
| The 10 structural patterns every field must obey | B |
| The 5-table market-registry SQL schema | C |
| Every banned string + why | D |
| The 7 cross-cutting invariants gating every phase tag | E |
| Per-phase file allowlists (JSON) | F |
| Vocab-freeze workflow (PROPOSED → FROZEN) | G |
| WORKLOG contract + ACK-MASTER-V1 reference text | H |
| Reprocess instructions for Skechers/Chevron/Mr. Cooper/Metsera | I |
| Explicit non-scope (what Codex may never touch) | J |

If a rule in Part 2 references "Appendix X," Codex reads Appendix X before writing code for that step. Not after. Not never.

---

# PART 1 — GLOBAL CONSTRAINTS

These apply to every phase, with no exceptions, forever, until a human reviewer explicitly overrides one in writing.

1. **JS/JSX only. Never TypeScript.** No `.ts` or `.tsx` files added or converted. The repo is JS/JSX — stay JS/JSX.
2. **No new npm dependencies. No version bumps.** If a phase seems to need a new package, STOP and write `BLOCKED-P{phase}.md` — do not add it unilaterally.
3. **LLM model plan is frozen.** Codex does not switch models, does not change model call parameters, does not "try a different model to see if it does better." `lib/runtime/model-probe.js` (Phase 0 artifact, carried from V2) writes the active model to `.last-model-used`; CI compares against `.expected-model` (reviewer-committed, Codex may not edit it).
4. **Verbatim quotes only for cited provisions.** Never paraphrase, condense, or repair source text stored in `text`/`full_text`/`text_verbatim` fields. Summarization is a distinct, explicitly-scoped field (e.g. Antitrust Pull-Refile/Timing-Agreement summaries) and nowhere else.
5. **PR + CI + squash merge required.** No direct pushes to `main`. One PR per phase.
6. **`.env.local` is never printed, logged, or committed.** Full stop.
7. **Repo, branch, deployment:** github.com/CodeNameHash/precedent-machine, deployed at precedent-machine.vercel.app. Local inspection clone lives at `/tmp/pm-inspect` for read-only verification; production work happens via normal PR flow against the GitHub repo.
8. **40 deals in corpus.** Reference deal IDs Codex will see repeatedly:
   - Metsera: `885edae5-49e8-464a-9f33-edd229119d7c`
   - Skechers (Beach Acquisition Co Parent, LLC → Skechers): `af4940e1-a645-437c-acfa-4a53e8d9f7ac`
   - Chevron → Anadarko: `dc042001-b987-404f-bd02-41e1939fb914`
   - Mr. Cooper (Rocket Companies, Inc. → Mr. Cooper Group): `8cd0787f-4ca0-40fe-aebf-6f88c0b101da`
   - ConocoPhillips: `a267309a-fc22-4160-a652-1144fc64e9cf`
9. **Phase allowlists live at `.github/phase-allowlists/phase-{N}.json`.** Reviewer commits these once at WP start (Appendix F gives the content). Editing any file outside the active phase's allowlist is a merge-blocking CI failure — no exceptions, no "just this one extra file."
10. **If Codex identifies something outside scope that needs fixing, it does not fix it.** It stops, writes `proposed-amendments/<slug>.md`, and waits. Silent scope expansion is a merge-blocker.
11. **If Codex cannot complete a phase, it does not half-ship.** It writes `BLOCKED-P{phase}.md` (see Part 2, per-phase "what happens if blocked") and opens a WIP PR. It does not merge partial, untested, or silently-reduced-scope work.

---

# PART 2 — PHASE RUNBOOK

Thirteen phases, executed strictly in order: Phase -1 (enforcement teeth), then Phase 0, then Phase 0-A (amendment to Phase 0), then 0.5 through 7. Each phase = one PR = one tag in `git log` = one WORKLOG file = one gate check against Appendix E's 11 invariants before merge. Phase -1 is the exception: it INSTALLS the invariant infrastructure and its own gate is bootstrap-only (see that phase's Definition of Done).

**Phase 0 already shipped.** At the time this amendment was written, commits `c435044` (ACK) and `1e32b5f` (generated-v1.json, generated-v1.md, WORKLOG-P0.md) already exist on `main`. Phase -1 was authored AFTER Phase 0 shipped, which means Phase -1 is retrofit enforcement. Its PR rebases onto the current tip and installs the teeth that Phase 0's WORKLOG claimed passed but which never actually ran. This is the ONLY out-of-order retrofit permitted in this document — every subsequent phase runs against the teeth Phase -1 installs.

---

## PHASE -1 — Enforcement teeth installation (retrofit)

**Why this phase exists.** Every prior phase in this document has a Definition of Done that reads "All 7 (now 11) cross-cutting invariants pass." Audit of the live repo shows none of the invariant infrastructure is committed: `.github/workflows/ci.yml` runs only `npm ci`, `npm test`, `npm run build`; there is no `scripts/lint/` directory, no `scripts/audit/` directory, no `.github/phase-allowlists/` directory, no `docs/acks/` directory, no `docs/vocab/` directory. Phase 0's WORKLOG can only have passed those invariants in the sense that they trivially pass when the scripts don't exist to fail. That is exactly the failure mode this document was written to prevent. Phase -1 fixes it before any further Codex work runs. Phase -1 must merge and tag BEFORE Phase 0-A opens, and BEFORE any of Phases 0.5 through 7 open.

**Scope discipline for this phase.** Phase -1 installs infrastructure ONLY. It does NOT touch application code, extractor code, renderer code, schema, rubric, or vocab source files. It creates the scripts, allowlists, ACK reference, and CI wiring that every other phase's Definition of Done presupposes. If Codex feels the urge to "also fix a bug while it's in there," the answer is no — write `proposed-amendments/<slug>.md` and wait.

**Steps.**

1. **Create `.github/phase-allowlists/`** with one JSON file per phase, each file exactly matching the blocks in Appendix F. Files to create: `phase-0.json`, `phase-0-A.json`, `phase-0.5.json`, `phase-1.json`, `phase-2.json`, `phase-3.json`, `phase-4.json`, `phase-4.5.json`, `phase-4.6.json`, `phase-5.json`, `phase-6.json`, `phase-7.json`. Each file's content is a verbatim copy of the JSON block in Appendix F for that phase — no additions, no re-wording. Reviewer will diff Appendix F against the committed files before merging Phase -1.

2. **Create `docs/acks/ACK-MASTER-V1.reference.md`.** Content: the exact SHA256 hash of `pm-master-straitjacket.codex.md` at the tip of this Phase -1 branch, computed via `shasum -a 256`, plus a fixed-format acknowledgment block that every subsequent WORKLOG's ACK section must match line-for-line. Format specified in Appendix H. This file is REVIEWER-OWNED going forward (Appendix J) — Codex creates it in Phase -1, never edits it after.

3. **Create `scripts/lint/forbidden-patterns.sh`.** Reads Appendix D's grep patterns and greps the entire repo (excluding `node_modules/`, `.next/`, `docs/`, `.git/`). Exit 1 on any match, exit 0 on clean. Wire the exact patterns from Appendix D into the script — no additions, no relaxations. This script is REVIEWER-OWNED going forward (Appendix J) — Codex creates it in Phase -1, never edits it after.

4. **Create the 6 other lint/audit scripts referenced by Appendix E invariants #2, #3, #5, #6, #7.** Each script must exit 0 or exit 1, must be idempotent, and must log its verdict to stdout in the shape `INVARIANT-N: PASS` or `INVARIANT-N: FAIL <one-line reason>`. Files:
   - `scripts/audit/ioc-scope-mismatch.js` (invariant #2)
   - `scripts/lint/closing-condition-scope.js` (invariant #3)
   - `scripts/lint/market-registry-completeness.js` (invariant #5)
   - `scripts/lint/component-reuse.js` (invariant #6)
   - `scripts/lint/party-scope-audit.js` (invariant #7)
   Invariants #2, #3, #6, #7 become MEANINGFUL only after their originating phase ships (Phase 3, 4, and later) — in Phase -1 they must exist AND exit 0 against the current repo state. If any of them exits 1 today, that is a real regression uncovered by the retrofit, not a bug in Phase -1: write `BLOCKED-P-1.md` and stop. Do NOT relax the script to make it pass.

5. **Create the 5 registry scripts referenced by Appendix E invariants #8–#11 and by Phase 0-A.** Files:
   - `scripts/registry/dedupe.js` (invariant infrastructure; the actual dedup RUN happens in Phase 0-A, this phase only commits the script skeleton with the four rules stubbed and unit-tested)
   - `scripts/registry/detect-duplicates.js` (invariant #8)
   - `scripts/registry/orphan-detector.js` (invariant #9)
   - `scripts/registry/coverage-detector.js` (invariant #10)
   - `scripts/registry/provenance-log.js` (invariant #11)
   Same exit-code and stdout contract as step 4. Invariants #8–#11 must exit 0 against the current repo state — which means today, before Phase 0-A ships, they operate against `generated-v1.json` (not `generated-v1.deduped.json`, which doesn't exist yet). Once Phase 0-A ships, the scripts flip their target to the deduped file per their spec in Appendix E. Implement that target-selection logic ("prefer FROZEN-v1.json, else generated-v1.deduped.json, else generated-v1.json") in this phase.

6. **Rewrite `.github/workflows/ci.yml`** to run every invariant on every PR and every push to `main`. New job structure:
   ```yaml
   jobs:
     test-and-build:
       # existing job stays exactly as-is
     invariants:
       runs-on: ubuntu-latest
       needs: test-and-build
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: npm }
         - run: npm ci
         - name: Invariant 1 (already covered by test-and-build)
           run: echo "covered"
         - name: Invariant 2 — ioc-scope-mismatch
           run: node scripts/audit/ioc-scope-mismatch.js
         - name: Invariant 3 — closing-condition-scope
           run: node scripts/lint/closing-condition-scope.js
         - name: Invariant 4 — forbidden-patterns
           run: bash scripts/lint/forbidden-patterns.sh
         - name: Invariant 5 — market-registry-completeness
           run: node scripts/lint/market-registry-completeness.js
         - name: Invariant 6 — component-reuse
           run: node scripts/lint/component-reuse.js
         - name: Invariant 7 — party-scope-audit
           run: node scripts/lint/party-scope-audit.js
         - name: Invariant 8 — detect-duplicates
           run: node scripts/registry/detect-duplicates.js
         - name: Invariant 9 — orphan-detector
           run: node scripts/registry/orphan-detector.js
         - name: Invariant 10 — coverage-detector
           run: node scripts/registry/coverage-detector.js
         - name: Invariant 11 — provenance-log
           run: node scripts/registry/provenance-log.js
     phase-allowlist:
       runs-on: ubuntu-latest
       needs: test-and-build
       steps:
         - uses: actions/checkout@v4
         - name: Detect active phase from branch name
           run: node scripts/ci/detect-phase.js
         - name: Diff-vs-allowlist
           run: node scripts/ci/check-allowlist.js
   ```
   Each invariant is its own named step so a failure is legible in the GitHub Actions UI. Do NOT collapse them into a single step. Do NOT wrap them in `continue-on-error: true` — the whole point is that a red X blocks merge.

7. **Create `scripts/ci/detect-phase.js` and `scripts/ci/check-allowlist.js`.** `detect-phase.js` reads the current branch name (via `GITHUB_HEAD_REF` on PRs, `GITHUB_REF_NAME` on pushes) and maps it to a phase id — branch names must follow the convention `phase-{N}/*` (e.g. `phase-0-A/dedup-and-review-ui`, `phase-1/consideration`). If the branch does not match this pattern, exit 1 with a helpful message. `check-allowlist.js` reads `.github/phase-allowlists/phase-{N}.json` for the detected phase, computes the diff of the PR (via `git diff --name-only origin/main...HEAD`), and fails if any changed file falls outside the phase's `allowed` list OR matches its `denied` list. This is the mechanism that makes Appendix F actually load-bearing.

8. **Enable required-status-check on `main`.** Reviewer-side action (not a Codex commit): after Phase -1 merges, mark all three jobs (`test-and-build`, `invariants`, `phase-allowlist`) as required checks in GitHub branch protection for `main`. This step goes in the PR description as a reviewer TODO, not in a commit — Codex has no permission to touch GitHub branch protection settings.

9. **Create `WORKLOG-P-1.md`** per Appendix H format, including a status line per invariant showing `PASS` (or `TRIVIALLY-PASS` for invariants whose originating phase hasn't shipped yet) and the SHA256 of the straitjacket committed in step 2.

**Files touched (must match `.github/phase-allowlists/phase--1.json`, Appendix F):**
- `.github/workflows/ci.yml` (modify)
- `.github/phase-allowlists/*.json` (NEW — all 12 files, one per downstream phase; Phase -1 does not need an allowlist for itself — it IS the bootstrap)
- `docs/acks/ACK-MASTER-V1.reference.md` (NEW)
- `scripts/lint/forbidden-patterns.sh` (NEW)
- `scripts/lint/closing-condition-scope.js` (NEW)
- `scripts/lint/market-registry-completeness.js` (NEW)
- `scripts/lint/component-reuse.js` (NEW)
- `scripts/lint/party-scope-audit.js` (NEW)
- `scripts/audit/ioc-scope-mismatch.js` (NEW)
- `scripts/registry/dedupe.js` (NEW — skeleton only; Phase 0-A runs it for real)
- `scripts/registry/detect-duplicates.js` (NEW)
- `scripts/registry/orphan-detector.js` (NEW)
- `scripts/registry/coverage-detector.js` (NEW)
- `scripts/registry/provenance-log.js` (NEW)
- `scripts/ci/detect-phase.js` (NEW)
- `scripts/ci/check-allowlist.js` (NEW)
- `tests/lint/*.spec.js` (NEW — one unit test per script above, verifying the exit-code contract and the PASS/FAIL stdout shape)
- `tests/ci/detect-phase.spec.js` (NEW)
- `tests/ci/check-allowlist.spec.js` (NEW)
- `WORKLOG-P-1.md` (NEW)

**Forbidden in Phase -1:** everything else. Explicitly: no `lib/**` edits, no `pages/**` edits (including `pages/admin/registry.js` — that's Phase 0-A), no `components/**` edits, no `db/**` edits, no `supabase/**` edits, no `docs/market-registry/**` edits (the two files that exist there — `generated-v1.json` and `generated-v1.md` — are Phase 0 outputs; Phase -1 reads them but does not touch them), no `docs/vocab/**` edits, no dependency additions, no `package.json` edits beyond adding scripts under the `scripts` object (e.g. `"lint:invariants": "..."`). If a lint script needs a dependency that isn't already installed, use the Node standard library instead — do not add packages.

**Blocking tests:**
- `PH-1-A: every invariant script exists and is executable` — file existence check for all 11 script files plus the two `scripts/ci/` files.
- `PH-1-B: every invariant script exits 0 against current repo state` — shell-out to each script, assert exit code 0. If ANY exits 1, Phase -1 fails and `BLOCKED-P-1.md` documents which invariant surfaced which regression.
- `PH-1-C: every phase allowlist file matches Appendix F verbatim` — read each `.github/phase-allowlists/phase-{N}.json`, read the corresponding JSON block from Appendix F of the straitjacket, deep-equal. Mismatch fails the test with a diff.
- `PH-1-D: ACK-MASTER-V1.reference.md matches straitjacket SHA256` — recompute `shasum -a 256 pm-master-straitjacket.codex.md`, compare to the value pinned in the ACK reference file.
- `PH-1-E: CI workflow runs all 11 invariants` — parse `.github/workflows/ci.yml`, assert every invariant script name appears as a named step in the `invariants` job. Missing any step fails.
- `PH-1-F: check-allowlist.js catches out-of-scope edits` — fixture PR touching a file outside the fake phase's allowed list; `check-allowlist.js` exits 1 with a legible error naming the file. Fixture PR touching only in-scope files; exits 0.
- `PH-1-G: detect-phase.js rejects malformed branch names` — fixture branch `feature/random-thing` fails; `phase-0-A/dedup` passes and returns id `0-A`.

**Definition of done.** All 7 blocking tests green. All 11 invariant scripts exit 0 against the current repo state (or the phase is blocked — see below). CI workflow rewritten and green on the Phase -1 PR itself. All 12 phase-allowlist files committed and verified byte-for-byte against Appendix F. `docs/acks/ACK-MASTER-V1.reference.md` pinned to the tip-of-branch straitjacket SHA256. `WORKLOG-P-1.md` committed. Reviewer TODO in the PR description: enable required-status-check on `main` for the three CI jobs before merging any subsequent phase.

**Bootstrap gate exception.** Because Phase -1 is what installs the invariant infrastructure, this phase's WORKLOG cannot literally rerun "all 11 invariants passed" as a pre-existing check — the invariants come into existence during this PR. The gate is: (a) each script exists after the PR, (b) each script exits 0 when the reviewer runs `bash scripts/ci/run-all-invariants.sh` locally against the tip of the branch, (c) the CI job itself passes on the Phase -1 PR. This exception applies ONLY to Phase -1 — every phase from Phase 0-A forward runs against a fully-installed invariant harness.

**If blocked:** `BLOCKED-P-1.md`. The most likely blocker is that one of the pre-existing invariants (especially #7 party-scope-audit, given the Charter/Cox IOC-T bug already known to be live in the corpus) exits 1 against the current repo. That is not a Phase -1 failure — that is Phase -1 doing its job. Document the failing invariant, the failing file/line, and stop. The fix ships in the originating phase (Phase 3 for scope-audit, Phase 4 for closing-condition-scope, etc.), not by relaxing the invariant.

---

## PHASE 0 — WP-SCHEMA-03 wire-up + Market-registry generation

**Objective.** Two things ship in this phase, in this order, because the second depends on the first being visible: (1) Codex generates the machine- and human-readable market-field registry artifacts from the live schema files, and STOPS for reviewer freeze; (2) only after `docs/market-registry/FROZEN-v1.json` exists does Codex wire the extractor → `provision_cards` and the renderer → `provision_cards`, using Metsera as the reference deal. Forensics confirm the schema exists (`supabase/schema-03-card-model.sql` has 13 tables — `provision_cards`, `provision_field_groups`, `provision_analytical_flags`, `provision_cross_references`, `provision_bring_downs`, `representation_mae_subclauses`, `material_contract_categories`, `closing_condition_bring_down_tiers`, `closing_condition_cited_provisions`, `ioc_positive_obligations`, `ioc_negative_obligations`, `termination_fee_triggers`, `definition_components`) but zero extractor code writes to it and zero renderer code reads from it. This phase fixes both halves of that gap in one PR.

**Steps.**

1. Read `lib/schema/features.js`, `lib/rubric.js`, and `lib/vocab/ioc-categories.js` in full. Do not skim.
2. Produce `docs/market-registry/generated-v1.json` — every field discoverable in those three files, in the shape defined in Appendix A ("GENERATED REMAINDER" section). This is a superset that INCLUDES the ~50 priority fields already inlined in Appendix A (do not omit them from the generated file just because they're inlined here — the generated file must be complete and self-sufficient).
3. Produce `docs/market-registry/generated-v1.md` — one row per field, human-readable, same content as the JSON.
4. Open the Phase 0 PR as **DRAFT** with both artifacts attached. Do not proceed past step 4 until the reviewer commits `docs/market-registry/FROZEN-v1.json`.
5. **STOP. Wait.** Do not touch `lib/parser-v2/store.js`, `pages/api/parse/[dealId].js`, or any renderer file until `docs/market-registry/FROZEN-v1.json` exists in the repo.
6. Once frozen: create `lib/parser-v2/store-cards.js` (NEW) that writes extracted provisions into `provision_cards` and its 12 child tables.
7. Modify `lib/parser-v2/store.js` to call `store-cards.js` during the normal extraction write path.
8. Locate the actual parse API endpoint under `pages/api/parse/` (verify the exact filename in the repo — do not assume `[dealId].js` is correct without checking) and wire it to call the card-model store path.
9. Run the extractor on Metsera. Verify `provision_cards` populates with **≥50 rows** for `deal_id = 885edae5-49e8-464a-9f33-edd229119d7c`.
10. Build `components/review/ProvisionCardTable.jsx` (NEW) — generic renderer for provision cards, rendering `Term | Provision` with sub-rows via `<ProvisionSubRowTable />` (already exists in the repo at `components/review/ProvisionSubRowTable.jsx` — reuse it, do not rebuild it).
11. Create `lib/queries/review-deal.js` (NEW) — reads `provision_cards` + all 12 child tables for a given `deal_id`.
12. In `pages/review/[id].js`, add the branch: if `provision_cards.count(deal_id=X) > 0`, render from cards via `<ProvisionCardTable />`. Else fall back to the existing legacy components (`ConsiderationTables.js`, `NosolFourTables.js`, `EmployeeBenefitsTable.js`, `SecMeetingTable.js`, `NoOtherRepsFraudTable.js`). Do NOT delete legacy components in this phase — Phase 7 does that.
13. Confirm Metsera renders from cards. Attach before/after screenshots to the worklog per Appendix E component-reuse / visual-regression discipline.

**Files touched (must match `.github/phase-allowlists/phase-0.json`, Appendix F):**
- `docs/market-registry/generated-v1.json` (NEW)
- `docs/market-registry/generated-v1.md` (NEW)
- `lib/parser-v2/store-cards.js` (NEW)
- `lib/parser-v2/store.js` (modify)
- `pages/api/ingest/*` — the ingest stages (`segment.js`, `segment-v2.js`, `classify.js`, `extract-section.js`, `extract-type.js`, `run-all.js`, `from-url.js`). `run-all.js` orchestrates. NO endpoint under `pages/api/parse/*` exists — do not create one.
- `components/review/ProvisionCardTable.jsx` (NEW)
- `pages/review/[id].js` (modify — card-first, legacy-fallback branch only)
- `lib/queries/review-deal.js` (NEW)
- `db/migrations/*` — additive only
- `tests/review/phase-0-card-model-wireup.spec.js` (NEW)
- `WORKLOG-P0.md` (NEW)

**Forbidden in Phase 0:** anything under `components/review/` other than `ProvisionCardTable.jsx`; any legacy renderer deletion; anything under `lib/schema/`; any pre-existing migration file edit.

**Blocking tests:**
- `PH0-A: provision_cards populated for Metsera` — `db.count('*').from('provision_cards').where('deal_id', METSERA_ID)` ≥ 50.
- `PH0-B: review page renders provision cards for Metsera` — `screen.getByTestId('provision-card-table')` present.
- `PH0-C: legacy fallback still works for deals without cards` — a deal with zero card rows renders `screen.getByTestId('legacy-review-tables')`.
- `PH0-D: market-registry-completeness` — `docs/market-registry/FROZEN-v1.json` exists and every field it lists has ≥1 resolver reference.

**Definition of done.** All 4 blocking tests green. `docs/market-registry/FROZEN-v1.json` exists (reviewer-committed). `provision_cards` has ≥50 rows for Metsera. All 7 cross-cutting invariants (Appendix E) pass. `WORKLOG-P0.md` committed with `CODEX_MODEL_UNCHANGED:TRUE`.

**If blocked:** write `BLOCKED-P0.md` — state whether the blocker is on the registry-generation half or the wire-up half, cite the exact file/line Codex could not resolve, and stop. Do not half-ship a wire-up without the registry freeze, and do not skip the registry step "to save time."

---

## PHASE 0-A — Registry dedup + reviewer UI (amendment to Phase 0)

**Why this phase exists.** Phase 0 shipped `docs/market-registry/generated-v1.json` with **1,327 rows** across four origins: `schema-features` (524), `rubric-features` (702), `appendix-a-priority` (77), `ioc-categories` (24). An audit of the file found that **1,168 of 1,327 rows (88 percent) sit inside normalized-key duplicate groups**, and 697 of the 702 rubric-features rows have a matching schema-features key. `mainConcept` alone has 62 copies, `partyWhoCanTerminate` 11, `fraudCarveout` / `nonRelianceClause` / `noOtherRepsParty` 7 each. Ninety-plus percent of that duplication is mechanical fanout (schema key repeated once per provision type in `PROVISION_TYPES`), not real design choice. Asking a reviewer to click through 1,327 cards would be malpractice. Phase 0-A produces `generated-v1.deduped.json` (~700 rows), flags the ~50 true near-duplicates that need human judgment (e.g. `carveouts` / `carveOuts` / `carveOutsList` / `carveOutsList`), stands up `/admin/registry` so the reviewer signs off card-by-card, and only then writes `docs/market-registry/FROZEN-v1.json`. Phase 0's step 5 gate ("STOP. Wait.") remains — Phase 0-A is what unblocks it. Nothing in Phase 0-A touches extractor or renderer code; extractor/renderer wire-up (Phase 0 steps 6–13) stays gated behind the freeze produced here.

**Steps.**

1. **Write `scripts/registry/dedupe.js`** (NEW). Input: `docs/market-registry/generated-v1.json`. Output: `docs/market-registry/generated-v1.deduped.json` and `docs/market-registry/merge-report.md`. The deduper applies FOUR classes of rule, in this exact order:
   a. **Normalize keys.** `norm(key) = key.toLowerCase().replace(/[._-]/g, '').replace(/s$/, '')`. Group every row by `norm(key)`. Groups of size 1 pass through untouched.
   b. **Cross-origin merge (MECHANICAL).** For each group with size ≥ 2 that contains at least one `schema-features` row plus one or more `rubric-features` rows: keep the `schema-features` row as canonical, absorb every `rubric-features` sibling into an `also_matches_provision_codes: []` array on the canonical row, and record the absorbed row's origin metadata into a `merged_from: []` provenance array. Do NOT invent new keys, do NOT modify the canonical row's `data_type` / `party_scope` / `structural_patterns` fields — those fields come from the schema-features source of truth. If a `rubric-features` row disagrees with the canonical row on any of those fields, do not silently overwrite: log the disagreement to the merge-report as `REQUIRES_REVIEWER_DECISION` and keep the canonical row's values pending sign-off.
   c. **Multi-scope collapse (MECHANICAL).** For any `schema-features` row that declares `party_scope: ["company", "parent", "both"]` (or any two-of-three combination) and produces per-scope fanout rows in the generated file, collapse the fanout rows into the parent row's `party_scope` array. Per-scope rows that carry `.company` / `.parent` / `.both` suffixes are NOT independent fields — they are the fanout. Party-scope splits that appear as genuinely distinct schema keys (e.g. `companyMAECarveouts` vs. `parentMAECarveouts` as separate declarations in `features.js`) STAY SEPARATE. The heuristic: if two rows share `norm(key)` AND one is a suffix-variant of the other, collapse; if two rows have distinct base keys that happen to overlap, do not collapse.
   d. **True near-duplicates (FLAGGED, NEVER AUTO-MERGED).** For any group where the `norm(key)` groups distinct-but-similar spellings that could plausibly be different concepts (audit list, non-exhaustive): `carveouts` / `carveOuts` / `carve_outs` / `carveOutsList`; `partyWhoCanTerminate` variants across provision families; any pair of keys with Levenshtein distance ≤ 2 that are NOT already caught by rule (b). Write these to `merge-report.md` under section `REQUIRES_REVIEWER_DECISION` with proposed action "merge into X" / "keep separate" / "rename". These rows appear as FLAGGED cards in the reviewer UI (step 4) and are NOT merged by the script.

2. **Generate `docs/market-registry/merge-report.md`** — human-readable summary. Top-of-file counts: input rows, output rows, mechanical merges, flagged near-duplicates, groups untouched. Then section per group with size > 1, showing the canonical row, every absorbed sibling, and (for flagged groups) the proposed action. Every merged field row carries a `provenance: { source_of_truth: "schema-features", absorbed_from: [...] }` block so the trail is auditable.

3. **Post-dedup registry size.** Target: `generated-v1.deduped.json` contains between 650 and 800 rows. If the script produces < 500 or > 900 rows, treat that as a bug in the deduper (over-merge or under-merge), do NOT ship it, and write `BLOCKED-P0-A.md` explaining which rule fired incorrectly. Expected breakdown: ~524 schema-features canonical rows (from `features.js`) + ~77 appendix-a-priority rows + ~24 ioc-categories rows + ~5 rubric-features rows that did NOT find a schema-features match (the 697 that did are absorbed) = ~630 rows. Add the flagged near-duplicates (~50 kept as separate rows pending reviewer merge) → ~680 rows. Anything outside 650–800 = investigate before proceeding.

4. **Build `/admin/registry` reviewer UI.** This is a Next.js admin page matching the existing pattern at `components/admin/AdminNav.js` (Tailwind: `border-accent`, `bg-accent`, `text-inkLight`, `font-ui`; link-based nav with active-state highlighting). Structure:
   - **Route:** `pages/admin/registry.js`.
   - **Nav entry:** add `/admin/registry` to `ADMIN_NAV_LINKS` in `components/admin/AdminNav.js` under label `"Registry"`.
   - **Data source:** reads `docs/market-registry/generated-v1.deduped.json` at build time via `getStaticProps` (or `getServerSideProps` if reviewer state must be live). Reviewer decisions write to `docs/market-registry/reviewer-state.json` (NEW) via `POST /api/admin/registry/decision`.
   - **Layout:** left sidebar = 20 provision-type tabs sourced from `PROVISION_TYPES` in `lib/rubric.js` (verify the exact export name in the file before wiring), plus a top tab `FLAGGED (≈50)` that surfaces the `REQUIRES_REVIEWER_DECISION` groups from `merge-report.md`. Main pane = card list for the active tab.
   - **Card shape (one per registry field):** header row with `label` (human name), monospace `key`, badge for `data_type`, badge(s) for `party_scope`, badge(s) for `structural_patterns`, and (if applicable) a red `FLAGGED` chip. Body: `states` list, `test_deal_ids` (if present), a "Provenance" collapsible showing the `merged_from` array, and a "Live preview" collapsible that pulls the current Metsera provisions row for this key (via `/api/admin/registry/preview?deal_id=METSERA&key=X`) so the reviewer sees a real extracted value.
   - **Actions per card (radio-group, exactly one active at a time):** `Approve` / `Reject` / `Merge into…` (opens key-picker) / `Rename to…` (opens text input) / `Defer to Phase N`. State persists to `reviewer-state.json` on click. No global save button — every action is atomic.
   - **Global controls (top bar):** counts (`approved / rejected / flagged / pending`), a `Filter: pending only` toggle, and a `Freeze registry` button that is disabled until `pending == 0`. Pressing `Freeze registry` calls `POST /api/admin/registry/freeze`, which validates every row has a non-`pending` decision and writes `docs/market-registry/FROZEN-v1.json` (canonical rows only, with `status: "FROZEN-v1"` and a `frozen_at: <ISO8601>` timestamp).
   - **Preview panel data path:** `/api/admin/registry/preview` queries `provision_cards` + child tables for `deal_id = 885edae5-49e8-464a-9f33-edd229119d7c` (Metsera) and returns whatever the extractor currently produces for the requested field key. If Metsera has no row for that key yet, show `— not yet extracted —` and disable the preview panel for that card; do NOT block the reviewer's decision on preview availability (Phase 0 wire-up will backfill later).
   - **Do not** wire this UI to the extractor or renderer. `/admin/registry` reads the deduped JSON, reads `provision_cards` for preview, writes `reviewer-state.json`, and (on freeze) writes `FROZEN-v1.json`. Nothing else.

5. **Vocab reviewer surface (same page pattern).** Add a top-level tab `VOCAB` on `/admin/registry` that surfaces the three FROZEN-v1 vocab sets already listed in Appendix G.1 (IOC other-exclusions, R&W SEC-filings buckets, R&W lookback scopes) plus any future `PROPOSED-*` vocab file discovered under `docs/vocab/`. This tab is READ-ONLY for anything already `FROZEN-v1` (renders the term list with a `FROZEN` badge, no action buttons). For `PROPOSED-*` vocab files, the tab renders the same `Approve / Reject / Merge / Rename / Defer` controls per term. Freezing a vocab set writes the equivalent `docs/vocab/FROZEN-<name>-vN.json` file. This is the standing surface for every future vocab freeze — Codex never edits vocab files directly, all vocab flows through this UI.

6. **STOP. Wait for freeze.** Do not proceed past step 6 until `docs/market-registry/FROZEN-v1.json` exists in the repo and passes the four new Appendix E invariants (#8–#11 below). Only then does Phase 0 step 6 (`store-cards.js`) unblock.

**Files touched (must match `.github/phase-allowlists/phase-0-A.json`, Appendix F):**
- `scripts/registry/dedupe.js` (NEW)
- `scripts/registry/detect-duplicates.js` (NEW — invariant #8, see Appendix E)
- `scripts/registry/orphan-detector.js` (NEW — invariant #9)
- `scripts/registry/coverage-detector.js` (NEW — invariant #10)
- `scripts/registry/provenance-log.js` (NEW — invariant #11)
- `docs/market-registry/generated-v1.deduped.json` (NEW)
- `docs/market-registry/merge-report.md` (NEW)
- `docs/market-registry/reviewer-state.json` (NEW — reviewer decisions log; Codex generates the empty shell, reviewer writes to it via UI)
- `pages/admin/registry.js` (NEW)
- `pages/api/admin/registry/decision.js` (NEW)
- `pages/api/admin/registry/freeze.js` (NEW)
- `pages/api/admin/registry/preview.js` (NEW)
- `components/admin/AdminNav.js` (modify — add `/admin/registry` link only)
- `components/admin/registry/RegistryCard.jsx` (NEW)
- `components/admin/registry/RegistrySidebar.jsx` (NEW)
- `components/admin/registry/FlagBadge.jsx` (NEW)
- `tests/registry/dedupe.spec.js` (NEW)
- `tests/admin/registry-ui.spec.js` (NEW)
- `WORKLOG-P0-A.md` (NEW)

**Forbidden in Phase 0-A:** anything under `lib/parser-v2/` (that's Phase 0 steps 6–13, gated behind this phase's freeze); anything under `pages/review/` (Phase 0 steps 10–13); `docs/market-registry/FROZEN-v1.json` (this file is written by `pages/api/admin/registry/freeze.js` at reviewer-click time, NOT by Codex during PR authoring — Codex creates the API endpoint that will write it, but does not commit the file itself); any file under `lib/schema/`, `lib/rubric.js`, or `lib/vocab/` (Codex reads these, never writes them); any change to `generated-v1.json` (that file is the input, immutable in this phase).

**Blocking tests:**
- `PH0A-A: dedupe produces expected shape` — `scripts/registry/dedupe.js` on `generated-v1.json` yields between 650 and 800 rows; every merged row has a `merged_from` array of length ≥ 1; every flagged group appears in `merge-report.md` under `REQUIRES_REVIEWER_DECISION`.
- `PH0A-B: mainConcept collapses` — post-dedup, exactly ONE row has `key = "mainConcept"` (not 62). Its `also_matches_provision_codes` array contains ≥ 15 provision-type codes.
- `PH0A-C: party-scope splits survive` — post-dedup, `companyMAECarveouts` and `parentMAECarveouts` remain as SEPARATE rows (if both exist in `features.js`), not collapsed.
- `PH0A-D: carveouts variants flagged` — the `carveouts` / `carveOuts` / `carveOutsList` / `carve_outs` group appears in `merge-report.md` under `REQUIRES_REVIEWER_DECISION`, NOT auto-merged.
- `PH0A-E: /admin/registry renders` — GET `/admin/registry` returns 200; DOM contains `data-testid="registry-sidebar"` with ≥ 20 tab entries; DOM contains ≥ 1 `data-testid="registry-card"`.
- `PH0A-F: freeze gated on pending==0` — `POST /api/admin/registry/freeze` with any row in `pending` state returns 409 Conflict; only when `pending == 0` does it write `FROZEN-v1.json`.
- `PH0A-G: freeze writes canonical schema` — after successful freeze, `docs/market-registry/FROZEN-v1.json` contains `status: "FROZEN-v1"`, `frozen_at: <ISO8601>`, and one row per approved field. Rejected / merged-into / renamed rows do NOT appear as independent entries; merge/rename transformations are applied to the output.

**Definition of done.** All 7 blocking tests green. `generated-v1.deduped.json` shipped. `merge-report.md` shipped. `/admin/registry` renders and accepts decisions. `FROZEN-v1.json` exists (reviewer-committed via the freeze API — not by Codex directly). All 11 cross-cutting invariants pass (Appendix E, now including #8–#11). `WORKLOG-P0-A.md` committed.

**If blocked:** `BLOCKED-P0-A.md`. Common trip points: (a) `PROVISION_TYPES` export name differs from expectation in `rubric.js` — verify before wiring, do not guess; (b) `provision_cards` empty for Metsera means Phase 0 wire-up has not run yet, in which case the preview panel gracefully degrades but the phase still ships; (c) if the deduper produces < 500 or > 900 rows, do NOT relax the range — investigate which rule over- or under-fired.

---

## PHASE 0.5 — Election-mechanics reprocess

**Objective.** Skechers ships `MIXED_ELECTION`, a `Fixed` ratio, and a real Election Deadline in its source agreement, and the API even returns `p.consideration_equity.election_mechanism` (`pages/api/provisions.js:161`) with `<ElectionCard>` already built (`components/review/ElectionCard.jsx`, mounted at `components/review/ConsiderationTables.js:888`) — but nothing surfaces on the page for Skechers, Chevron, or Mr. Cooper. Root cause: the extractor pipeline does not populate `consideration_equity.election_mechanism` for many deals even when election signal tokens are present in the source text. This phase reprocesses the affected deals and adds hard gates so the gap cannot silently regress.

**Steps.**

1. Read the canonical election-signal token list at `lib/parser-v2/elections.js:1` (`Cash Election`, `Stock Election`, `Mixed Election`, `Non-Election Shares`, `Election Deadline`, `Form of Election`, `may elect to receive`, `shall be entitled to elect`, `Maximum Cash Election`, `Maximum Stock Election`, `CVR election`, `with CVR`, `without CVR`, `proration`, `oversubscribed`, `Aggregate Cash Consideration`, `Aggregate Stock Consideration`).
2. Write `scripts/reprocess/election-mechanics.js` (NEW). For every deal in the corpus: detect election-signal presence in the full agreement text using the token list from step 1.
3. If a signal is present AND `election_mechanisms` has no row for that deal, re-run `lib/parser-v2/consideration-equity.js` on the CONSID region and persist the result.
4. Log every deal processed to `WORKLOG-P0.5.md` in the shape: `deal_id,slug,had_signal,had_row_before,had_row_after`.
5. Wire the reprocess logic into the existing ingest handoff so any NEW deal ingested going forward automatically runs the election path — do not leave this as a one-off script only.
6. Run the backfill once against production data before the PR merges. Attach the full worklog to the PR.
7. Follow Appendix I reprocess instructions for Skechers, Chevron/Anadarko, and Mr. Cooper specifically before this phase's PR opens — attach `docs/reprocess/round-3.md`.
8. Confirm `<ElectionCard>` renders for Skechers with `data-testid="election-card"` present on `components/review/ElectionCard.jsx`.

**Files touched (must match `phase-0.5.json`, Appendix F):**
- `scripts/reprocess/election-mechanics.js` (NEW)
- `lib/parser-v2/elections.js`
- `lib/parser-v2/consideration-equity.js`
- `pages/api/provisions.js`
- `components/review/ElectionCard.jsx`
- `components/review/ConsiderationTables.js`
- `tests/schema/elections/*.test.js` (NEW)
- `WORKLOG-P0.5.md` (NEW)
- `docs/reprocess/round-3.md` (NEW)

**Market-registry additions this phase:** `deal.consideration.electionAvailable`, `deal.consideration.electionType`, `deal.consideration.electionDeadline` (already inlined in Appendix A — resolvers + `test_deal_ids` required before merge).

**Blocking tests:**
- `signal-then-row.test.js` — fixture agreement with any election signal token → extractor produces an `election_mechanisms` row (unit test on `buildElectionMechanism`).
- `api-attaches-election.test.js` — fixture DB row with `election_mechanisms` for a CONSID provision → `pages/api/provisions.js` returns the provision with non-null `consideration_equity.election_mechanism`.
- `renderer-shows-election-card.test.js` — fixture provisions array with `election_mechanism` set → `<ConsiderationTables>` mounts `<ElectionCard>` (query `data-testid="election-card"`).
- `market-registry-election-fields.test.js` — registry contains all 3 election fields above, each with `test_deal_ids` covering PRESENT, ABSENT, and MIXED_ELECTION states.

**Definition of done.** All 4 tests green. Skechers, Chevron, Mr. Cooper all show non-null `election_mechanism` where their source text has election signals. All 7 cross-cutting invariants pass. `WORKLOG-P0.5.md` committed.

**If blocked:** write `BLOCKED-P0.5.md`. Common trip point: if the join failure is in `pages/api/provisions.js` and not in the extractor, say so explicitly — do not guess and patch the wrong layer.

---

## PHASE 1 — Consideration + Employee Equity

**Objective.** Kill the "Cash" pill entirely (not replace it), merge Chevron's cash+stock hero row into one row, scope-filter Stock Consideration Mechanics so equity-award provisions stop leaking `Floating` into a `Fixed` deal's table, and rebuild Employee Equity as a table with columns `Type | Vesting | CVR | Notes` — no Consideration column, ESPP broken out into its own table.

**Steps.**

1. **Delete the "Cash" pill.** In the deal header consideration box top-right, delete the "Cash" pill code path entirely. Do not replace it with "Cash + CVR" or anything else — DELETE. Consideration type is expressed elsewhere via `<ConsiderationBadge>` in the deal header.
2. **Chevron-shape hero row merge.** When `deal.consideration.type = MIXED` (cash/stock), build `components/review/ConsiderationHeroRow.jsx` (NEW) that composes ONE row reading e.g. `"$16.25 in cash + 0.3869 Parent shares per Company share (Fixed)"`. Exchange Ratio and Per-Share Cash Amount become sub-details revealed under the merged row, not separate top-level rows.
3. **Stock Consideration Mechanics scope filter.** In `components/review/ConsiderationTables.js:704-733`, restrict the `pushStockRow` loop to provisions whose `code` (from `ai_metadata`) is one of `CONSID-MAIN`, `CONSID-STOCK`, `CONSID-EXCHANGE-RATIO`, `CONSID-EXCHANGE`. Explicitly EXCLUDE any provision whose code starts with `CONSID-EQUITY`, `CONSID-OPTION`, `CONSID-RSU`, `CONSID-RSA`, `CONSID-ESPP`. Verify the dedupe at `ConsiderationTables.js:735-744` (keyed on `provisionId::label`) no longer lets two different provisions with the same label survive once the scope filter is in place.
4. **Employee Equity table.** Build `components/review/EmployeeEquityTable.jsx` (NEW). Columns exactly: `Type | Vesting Treatment | CVR | Notes`. Delete the `Consideration` column entirely — consideration is deal-level, not equity-row-level.
5. `Type` values are pills: `Options (ITM)` renders label **"In the money"** — never "ITM only", never "ITM". Other types: `Options (OTM)`, `RSU`, `PSU`, `RSA`, `Director Equity`. No ESPP row in this table (see step 7).
6. `CVR` values: `Yes` / `No` / `In the money only` / `NA`. Metsera options row → `In the money only`. Metsera RSA row → `No`, sourced from the RSA subprovision text itself — verify the exact verbatim clause supports "No" and cite the quote hash (`data-quote-hash`, `[a-f0-9]{16,}`) in the worklog. If the RSA text does not clearly exclude CVR, the row shows `Unknown — needs review` and flags for QA. **Never assume.**
7. **ESPP moves to its own table.** Build `components/review/EsppTable.jsx` (NEW), titled "ESPP Treatment", rendered below Employee Equity via `<ProvisionSubRowTable />` with rows `Status` (pill: Cancelled / Rolled over / Continued), `Cutoff date`, `Notes`.
8. `Notes` column: one line max, 120 chars, free text for wrinkles. Empty if no wrinkle. Never contains raw cash formulas or source-span metadata.
9. Extend `lib/queries/review-deal.js` to fetch ESPP + equity data.
10. Wire the new components into `pages/review/[id].js`; delete the old "Cash" pill code path entirely in the same PR.

**Files touched (must match `phase-1.json`, Appendix F):**
- `components/review/ConsiderationSection.jsx` (NEW)
- `components/review/ConsiderationHeroRow.jsx` (NEW)
- `components/review/EmployeeEquityTable.jsx` (NEW)
- `components/review/EsppTable.jsx` (NEW)
- `components/review/ConsiderationTables.js` (modify — scope filter only, lines ~704-744)
- `lib/queries/review-deal.js` (extend)
- `pages/review/[id].js` (wire in; delete Cash pill path)
- `tests/review/phase-1-consideration.spec.js` (NEW)
- `WORKLOG-P1.md` (NEW)

**Forbidden:** any renderer outside Consideration/Employee Equity/ESPP scope; deleting `ConsiderationTables.js` itself (that's Phase 7, after all deals verified on cards).

**Blocking tests:**
- `PH1-A: no "Cash" pill in top-right of consideration box` — `consideration-type-pill-topright` testid absent; no bare "Cash" text inside `consideration-headline-box`.
- `PH1-B: Employee Equity headers strict` — headers equal exactly `['Type', 'Vesting Treatment', 'CVR', 'Notes']`, no `Consideration` header.
- `PH1-C: Options ITM pill reads "In the money"` — row text includes "In the money", excludes any "ITM" substring.
- `hero-row-merges-cash-and-stock.test.js` — Chevron fixture DOM contains exactly one `consideration-hero-row` node whose text includes both `$16.25` and `0.3869`.
- `stock-mechanics-scope.test.js` — Chevron fixture's `dedupedStockRows` contains exactly ONE `Exchange Ratio Type` row valued `Fixed`; presence of `Floating` fails.

**Definition of done.** All 5 tests + PH1-D (RSA CVR source/flag) + PH1-E (ESPP separate table) from the full test file green. All 7 cross-cutting invariants pass. Forbidden pattern grep (Appendix D) shows zero `Consideration: Cash` and zero `ITM only` matches.

**If blocked:** `BLOCKED-P1.md`. If the RSA CVR source text is genuinely ambiguous, ship `Unknown — needs review`, do not force a "No" without a quote hash.

---

## PHASE 2 — R&W + AOC final rewrite

**Objective.** AOC has been "fixed" 5 times and keeps drifting. This phase is the final spec: the AOC row's right column contains EXACTLY two sub-rows and nothing else. R&W portions-excluded render as canonical pills; unreliable look-back values (the `106.8 years` bug class) get a `Flag for Q/A` pill instead of a numeric guess.

**Steps.**

1. Read `lib/vocab/rw-sec-filings-portions-excluded.js`. It MUST exist and MUST match the FROZEN-v1 scaffold in Appendix G.1.2 byte-for-byte inside the `RW_SEC_FILINGS_PORTIONS_EXCLUDED_CANONICAL` array (order preserved). If the file does not exist, or the array does not match G.1.2 byte-for-byte, STOP and write `BLOCKED-P2.md` naming the mismatch. Do not invent vocab inline. Do not re-propose the set.
2. Build `components/review/RwTargetTable.jsx` (NEW) rendering R&W "portions excluded" as canonical pills sourced from that vocab file.
3. Add DB column `rw_lookback_qa_approved boolean not null default false` (additive migration).
4. Look-back column: if `rw_lookback_qa_approved = false`, render a `Flag for Q/A` pill linking to the admin QA queue — never a numeric guess. Only render the numeric value once approved.
5. Build `components/review/AocRow.jsx` (NEW) — dedicated component so the AOC shape cannot drift again.
6. AOC row title: **"Absence of Certain Changes (AOC)"**. Right column contains EXACTLY these two sub-rows and NOTHING else:
   - Sub-row 1: `No MAE since [ISO date]` — date is a pill.
   - Sub-row 2: `Compliance with IOC covenants since [ISO date]` followed by an indented list of incorporated IOC covenants, each rendered as its actual covenant TEXT (verbatim, expandable) — never a section reference like "§5.01(d)". Each covenant row shows its canonical category label pill from `lib/vocab/ioc-categories.js`.
7. If Codex is tempted to add a third element to the AOC right column — a "MAE (partial)" pill, a standalone "Hybrid" type, a cross-reference list — do not. The acceptance test fails on any additional element by design.
8. Build `lib/queries/aoc.js` (NEW) reading `absence_of_certain_changes` joined with IOC covenants.

**Files touched (must match `phase-2.json`, Appendix F):**
- `components/review/AocRow.jsx` (NEW)
- `components/review/RwTargetTable.jsx` (NEW)
- `lib/queries/aoc.js` (NEW)
- `db/migrations/*` — additive only, adds `rw_lookback_qa_approved`
- `tests/review/phase-2-rw-aoc.spec.js` (NEW)
- `WORKLOG-P2.md` (NEW)

**Forbidden:** anything outside R&W scope; any component outside `components/review/rw/*` and `components/review/AocRow.jsx`.

**Blocking tests:**
- `PH2-A` — R&W portions-excluded rendered as ≥1 canonical pill.
- `PH2-B` — unapproved look-backs render `Flag for Q/A`, never a numeric value; approved ones render `\d+ (months|years)`.
- `PH2-C` — AOC row has EXACTLY 2 structural children: `No MAE since` and `Compliance with IOC covenants since`.
- `PH2-D` — AOC covenant text length > 50 chars (i.e. full text, not a bare section ref) and each has a `category-pill`.
- `PH2-E` — AOC row does NOT contain `MAE (partial)` or bare `Hybrid` text.

**Definition of done.** All 5 tests green. Forbidden-pattern grep shows zero `MAE\s*\(partial\)` matches. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P2.md` — most likely trip point is the missing vocab file; name it explicitly.

---

## PHASE 3 — Material Contracts + IOC(T) + NoSol

**Objective.** Three sections, one phase, because each is small on its own. Material Contracts gets a qualitative-threshold vocab. IOC(T) gets its buyer-contamination bug fixed at the query layer (not the renderer) using a verb-subject classifier. No-Sol gets "root and branch" treatment on its definitions, deduped and limb-decomposed.

**Steps.**

1. **Material Contracts.** Contract types render as plain text in the left column (matching reps rendering — not pills). Thresholds render as pills in the right column.
2. Create `lib/vocab/threshold-qualitative.js` (NEW), seeded from a corpus sweep run in this phase, minimum values: `MATERIAL`, `NON_MATERIAL_ORDINARY_COURSE`, `NO_THRESHOLD`, `INDIVIDUALLY_MATERIAL`, `IN_THE_AGGREGATE`, `SIGNIFICANT`. Seed lives in the phase PR and requires reviewer approval (Appendix G vocab-freeze workflow) — do not ship it PROPOSED into the renderer.
3. **IOC(T) buyer contamination — query-layer fix.** The query for IOC(T) does not filter by `party_scope='COMPANY'`. Fix `lib/queries/ioc-target.js` (NEW) at the query layer, not the renderer. After this phase, no row inside IOC(T) may have `party_scope != 'COMPANY'`.
4. **Verb-subject classifier.** In `lib/parser-v2/classify.js` around lines 84-102, add a new rule set that overrides generic party-name regex: if section text begins with `The Company (and its Subsidiaries) shall` or `The Company shall, and shall cause each of its Subsidiaries to` → classify `IOC-T` regardless of surrounding article/section heading. If section text begins with `Parent shall, and shall cause its Subsidiaries to` or `Parent (and its Subsidiaries) shall` → classify `IOC-B`. This fixes the Skechers §5.1 case where the affirmative-obligation preamble under "Required Action and Forbearance; Efforts" was mis-scoped because the §5.2 "Forbearance Covenants" heading triggered `IOC-T` for the wrong section.
5. **Party-scope contamination audit.** Ship `scripts/audit/ioc-scope-mismatch.js` (NEW): any provision classified `IOC-B` whose text mentions "the Company" more than 3× and "Parent" fewer than 2× must be re-audited and either reclassified or flagged in `provision_analytical_flags` with code `IOC_SCOPE_MISMATCH`. Add a DB check trigger on `ioc_positive_obligations` and `ioc_negative_obligations` indexing on `party_scope`.
6. **No-Sol — root and branch.** Each definition (Superior Proposal, Company Takeover Proposal, Intervening Event, Acceptable Confidentiality Agreement) gets a summary line + canonical pills at the top of its row, followed by verbatim text below, collapsed by default and expandable — both visible together, not one-or-the-other.
7. **Dedupe.** If two rows contain overlapping fields (a definition row plus separate subfield rows), collapse into ONE row with subfields as sub-rows via `<ProvisionSubRowTable />`. No duplicate keys.
8. **Superior Proposal limbs.** Extract key limbs as canonical pills into `lib/vocab/superior-proposal-limbs.js` (NEW), seeded from a corpus sweep this phase. Minimum: "Greater value to shareholders from a financial point of view", "Relative to the transaction, reasonably likely to be completed."
9. **"What does not constitute" pills.** `lib/vocab/nosol-carveouts.js` (NEW): `Rule 14d-9 required disclosure`, `Required by law`, `Public statement of proposal receipt with recommendation reaffirmation`, plus others the corpus reveals.
10. Open the Phase 3 PR as DRAFT after the corpus sweeps; wait for reviewer to freeze the three vocab lists (threshold-qualitative, superior-proposal-limbs, nosol-carveouts) before converting to ready.

**Files touched (must match `phase-3.json`, Appendix F):**
- `components/review/MaterialContractsTable.jsx` (NEW)
- `components/review/IocTargetSection.jsx` (NEW)
- `components/review/NosolSection.jsx` (NEW)
- `lib/vocab/threshold-qualitative.js` (NEW)
- `lib/vocab/superior-proposal-limbs.js` (NEW)
- `lib/vocab/nosol-carveouts.js` (NEW)
- `lib/queries/ioc-target.js` (NEW)
- `lib/queries/nosol.js` (NEW)
- `lib/parser-v2/classify.js` (modify — verb-subject rule addition only)
- `scripts/audit/ioc-scope-mismatch.js` (NEW)
- `scripts/canonical-sweep/threshold-qualitative.js`, `superior-proposal-limbs.js`, `nosol-carveouts.js` (NEW)
- `reports/canonical-sweep/phase-3-*.md` (NEW)
- `db/migrations/*` — additive trigger only
- `tests/review/phase-3-*.spec.js` (NEW)
- `WORKLOG-P3.md` (NEW)

**Blocking tests:**
- `PH3-A` — Material Contracts left column has no pill.
- `PH3-B` — Material Contracts right column always has a pill (threshold or "No threshold").
- `PH3-C` — every row inside `ioc-target-section` has `data-party-scope="COMPANY"`.
- `PH3-D` — NoSol definitions show both `summary-line` and `verbatim-text` per row.
- `PH3-E` — NoSol Superior Proposal test row shows ≥1 canonical pill.
- `classify-ioc-preamble-verb-subject.test.js` — Skechers §5.1 fixture → classifier returns `IOC-T`; a `Parent shall` fixture → `IOC-B`.
- `ioc-scope-mismatch-detects-skechers.test.js` — current Skechers `IOC-B` misclassified rows fail the audit pre-fix, and do not reappear post-fix.

**Definition of done.** All tests green, all 3 vocab lists FROZEN (not PROPOSED) per Appendix G, `scripts/audit/ioc-scope-mismatch.js` reports zero mismatches corpus-wide, all 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P3.md`. If a vocab sweep produces an unclear cluster, list it as an open question in the worklog rather than guessing a canonical label.

---

## PHASE 4 — Antitrust final rewrite

**Objective.** The section Ben has flagged 3+ times. Caps & Limits collapses to ONE canonical pill with everything else behind a collapsed disclosure. Litigation collapses to ONE canonical result value, no sub-label. Every antitrust row routes through `<TermCell>` instead of raw `<button>`. Hover snip grows from 600 to 1500 with sentence-boundary snapping. `<FullDocumentView>` gets a `focusProvisionId` so "see full doc" highlights one provision, not the whole agreement. Clear Skies gets Parent + Company sub-rows. Closing-condition and outside-date sub-rows MUST reuse the existing shared components — building parallel ones is a file-manifest failure.

**Steps.**

1. **Pull-Refile / Timing Agreement.** Do not render the long verbatim provision by default. Render canonical pills of what IS allowed vs NOT allowed, from `lib/vocab/at-pull-refile-restrictions.js` (NEW, seeded from corpus sweep). Toggle to expand verbatim, collapsed by default.
2. **Clear Skies (Prevent/Delay) layout.** Left column: `Prevent/Delay standard` (canonical). Right column: sub-rows for `Parent` and `Company` via `<ProvisionSubRowTable />`. Parent sub-row shows exactly two canonical pills: `Reasonably be expected to prevent or materially delay` and `Reasonably be expected to make material conditions more difficult to satisfy` (verbatim quote on hover). Company sub-row shows exactly one line: `See IOC covenants — [link to IOC section]` and nothing else.
3. **Cap detail hidden for anti-HOHW.** In `<AtCapsRow>`: if `has_cap = false` AND `caps_canonical = 'ANTI_HOHW'`, `renderCapDetail = false`. No exceptions, no partial rendering.
4. **Caps & Limits collapse to ONE canonical pill.** Default cell renders exactly one line, e.g. `"Burdensome-condition cap set at Company MAE"`, with an optional `<details>/<summary>` disclosure (collapsed by default) revealing: cap detail, burden cap, cap description, burdensome-condition scope, whether burdensome condition is defined, whether burdensome condition is present, baseline. This vocab is PROPOSED first at `docs/vocab/antitrust-caps.md`; reviewer commits FROZEN before the pill string lands in the renderer (Appendix G).
5. **Litigation canonical result — ONE value, no sub-label.** Replace the current main-pill + `QUALIFICATION` sub-label with exactly one of: `"Affirmative obligation to litigate to final judgment"`, `"Obligation to defend, no appeal duty"`, `"No obligation to litigate"`, `"Litigation obligation not extracted"`. Delete the `QUALIFICATION` sub-label field from rendering entirely; if underlying data has a qualification, it moves to hover only.
6. **`<TermCell>` for every antitrust row.** Replace every `<button>` label in the antitrust table (`pages/review/[id].js`, around the antitrust rendering block) with `<TermCell provision={row.hit && row.hit.provision} quote={rowQuote}>{row.label}</TermCell>`. The "See text" affordance then appears automatically — do not build a separate see-text mechanism.
7. **Closing-condition surface separation.** The Conditions to Closing → Antitrust row must never contain burdensome-condition language. Text must match `Any applicable [statute] waiting period relating to [transaction] must have expired or been terminated` or another whitelisted template. Add `scripts/lint/closing-condition-scope.js` (NEW) that fails if the rendered closing-condition cell contains `burdensome` (case-insensitive) or `Substantial Detriment`.
8. **Hover snip length.** Raise `TOOLTIP_MAX` in `lib/citable.js:22` from 600 to 1500. Implement a "snap to end of sentence containing the highlight anchor" helper in `components/review/shared.js` (the existing `HoverSource`/snip logic near line 209): if the highlight ends before position 800, snip at the next sentence boundary after 1000 chars; otherwise snip at 1500.
9. **Full-document highlight scope.** `<FullDocumentView>` (`components/review/FullDocumentView.js`) must accept a `focusProvisionId` (or `focusProvisionIds`) prop. When set, only those provisions render as visible highlights; everything else renders as plain text, still visible but not highlighted. The caller at `pages/review/[id].js` (currently invoking `<FullDocumentView provisions={provisions} ... />` with the full array) must route through a new `openFullDocForProvision(provision)` helper that sets `focusProvisionId = provision.id`. Every "see full doc" button across every section — not just antitrust — uses this helper.
10. **Component reuse — closing condition.** The antitrust closing-condition sub-row MUST import and reuse the SAME `<ClosingConditionRow>` component used in the Conditions section. Do not build `AtClosingConditionRow`. If Codex builds a parallel component, this fails the file-manifest test and the phase does not merge.
11. **Component reuse — outside date.** The antitrust outside-date sub-row MUST import and reuse the SAME `<OutsideDateRow>` component used in the Termination section (built in Phase 5 — if Phase 5 hasn't shipped yet, use the placeholder reference and confirm wiring works once Phase 5 lands; do not build `AtOutsideDateRow`).

**Files touched (must match `phase-4.json`, Appendix F):**
- `components/review/AntitrustSection.jsx` (NEW)
- `components/review/AtPullRefileRow.jsx` (NEW)
- `components/review/AtClearSkiesRow.jsx` (NEW)
- `components/review/AtCapsRow.jsx` (NEW)
- `lib/vocab/at-pull-refile-restrictions.js` (NEW)
- `lib/vocab/at-clear-skies-limbs.js` (NEW)
- `lib/citable.js` (modify — `TOOLTIP_MAX` only)
- `components/review/shared.js` (modify — hover snip helper only)
- `components/review/FullDocumentView.js` (modify — `focusProvisionId` prop)
- `pages/review/[id].js` (modify — `<TermCell>` wiring, `openFullDocForProvision` helper)
- `scripts/canonical-sweep/at-pull-refile.js`, `at-clear-skies.js` (NEW)
- `scripts/lint/closing-condition-scope.js` (NEW)
- `reports/canonical-sweep/phase-4-*.md` (NEW)
- `docs/vocab/antitrust-caps.md`, `antitrust-litigation.md` (NEW, PROPOSED status)
- `tests/review/phase-4-antitrust.spec.js` (NEW)
- `WORKLOG-P4.md` (NEW)

**Forbidden:** building `AtClosingConditionRow` or `AtOutsideDateRow` under any name — reuse existing components.

**Blocking tests:**
- `PH4-A` — Pull-Refile row shows pills, not verbatim, by default.
- `PH4-B` — Clear Skies row has exactly 2 sub-rows: Parent, Company.
- `PH4-C` — Company Clear Skies sub-row text matches exactly `^See IOC covenants[^\.]*$`.
- `PH4-D` — Cap detail hidden for anti-HOHW.
- `PH4-E` — antitrust closing-condition and Conditions-section closing-condition both carry `data-component-name="ClosingConditionRow"`.
- `PH4-F` — antitrust outside-date and Termination outside-date both carry `data-component-name="OutsideDateRow"`.
- `caps-and-limits-one-pill.test.js` — top-level Caps & Limits cell renders exactly one visible default line; 7-field expansion is behind collapsed `<details>`.
- `litigation-single-pill.test.js` — Litigation cell matches exactly one of the 4 canonical strings; no additional visible text.
- `antitrust-see-text-present.test.js` — every antitrust row has a `term-cell-seetext` element.
- `closing-condition-no-burdensome.test.js` — corpus-wide: no closing-condition text matches `/burdensome|substantial detriment/i`.
- `hover-snip-length.test.js` — 1400-char quote, highlight at position 900 → displayed text includes the full sentence containing position 900.
- `full-doc-focus-mode.test.js` — `focusProvisionId="p123"` with 20 provisions → exactly ONE highlight region.

**Definition of done.** All 12 tests green. Antitrust-caps and antitrust-litigation vocab FROZEN. Screenshot proof attached for each of the 6 original V2 visual assertions plus the 6 amendment ones. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P4.md`. This is the heaviest phase — if context runs out mid-phase, block cleanly rather than shipping half the sub-fixes; a half-fixed antitrust section is worse than an unfixed one because it hides which parts are done.

---

## PHASE 4.5 — Sidebar MAE scope repair

**Objective.** `components/review/Sidebar.js:113-127` collapses the MAE group subtitle to `maeAppliesToBoth: true` whenever `total === 1` — this is a heuristic bug, not a data bug. Skechers has a `MAE-DEF` only (titled "Company Material Adverse Effect"), no `MAE-DEF-P`, yet the sidebar reads "(applies to Parent and Company)". Fix the derivation to read which child type is actually present.

**Steps.**

1. In `components/review/Sidebar.js` around lines 113-127 (confirmed: `maeAppliesToBoth: true` set at line 125, rendered at line 477-482 with literal text "(applies to Parent and Company)" at line 482), replace the `total === 1` heuristic with explicit presence checks on `MAE-DEF` and `MAE-DEF-P`.
2. Implement the rule table literally:

   | MAE-DEF present | MAE-DEF-P present | Sidebar subtitle |
   |---|---|---|
   | Yes | No | `(Company only)` |
   | No | Yes | `(Parent only)` |
   | Yes | Yes | `(Company and Parent — separate definitions)` |
   | No | No | (group hidden entirely) |

3. Never emit `(applies to Parent and Company)` under any code path. That string is banned (Appendix D).

**Files touched (must match `phase-4.5.json`, Appendix F):**
- `components/review/Sidebar.js`
- `lib/sidebar-groups.js`
- `tests/sidebar-mae-single-company.test.js`, `sidebar-mae-both.test.js`, `sidebar-mae-empty.test.js` (NEW)
- `WORKLOG-P4.5.md` (NEW)

**Blocking tests:**
- `sidebar-mae-single-company.test.js` — Skechers fixture (MAE-DEF only) → subtitle `(Company only)`; `(applies to Parent and Company)` fails.
- `sidebar-mae-both.test.js` — fixture with both types → `(Company and Parent — separate definitions)`.
- `sidebar-mae-empty.test.js` — no MAE provisions → group not rendered.

**Definition of done.** All 3 tests green. Forbidden-pattern grep shows zero `applies to Parent and Company` and zero `maeAppliesToBoth` matches anywhere in the codebase. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P4.5.md`. This is a small, surgical phase — a block here should be rare and specific (e.g. a deal with an undocumented third MAE-type edge case).

---

## PHASE 4.6 — IOC(B) card parity with IOC(T)

**Objective.** Mr. Cooper's dedicated IOC-B section card renders only the preamble + exceptions block — no affirmative/negative sub-tables — even though the combined IOC-T card renders them fine. The sidebar navigates the user to what looks like an empty section. Fix: exactly ONE `<IocPartyCard>` component renders both sides.

**Steps.**

1. Locate all IOC card renderer(s) in the codebase. There must be exactly ONE component (e.g. `components/review/IocPartyCard.jsx`) that renders both `IOC-T` and `IOC-B` sides. If more than one implementation exists, consolidate into one — parallel implementations are banned.
2. When the sidebar navigates to `IOC-B`, that same component renders — either as a standalone card or as the same combined side-by-side card — but never a stripped-down preamble-only card.
3. If the Buyer/Parent side has zero affirmative rows and zero negative rows, render the sub-tables with the empty-state text `"None extracted for this agreement."` — the same string already used in the combined card. Do not render nothing.

**Files touched (must match `phase-4.6.json`, Appendix F):**
- `components/review/IocPartyCard.jsx`
- `pages/review/[id].js`
- `tests/iocb-card-has-affirmative-subtable.test.js`, `iocb-card-has-negative-subtable.test.js`, `ioc-card-single-component.test.js` (NEW)
- `WORKLOG-P4.6.md` (NEW)

**Blocking tests:**
- `iocb-card-has-affirmative-subtable.test.js` — Mr. Cooper IOC-B target renders an `Affirmative Covenants` heading with either row content or `"None extracted for this agreement."`.
- `iocb-card-has-negative-subtable.test.js` — same, for `Negative Covenants`.
- `ioc-card-single-component.test.js` — grep confirms exactly ONE component file renders both `IOC-T` and `IOC-B` sub-headers.

**Definition of done.** All 3 tests green. Mr. Cooper's IOC-B section visibly shows sub-tables (not just preamble) when spot-checked live. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P4.6.md`.

---

## PHASE 5 — Termination + Other Covenants + Definitions

**Objective.** Outside Date pills reused between Termination and Antitrust (via `<OutsideDatePillRow>`/`<OutsideDateRow>`). Other Covenants purged of employee-comp/TSA rows that belong in Employee Benefits. Employee Benefits' "Company pre-closing" scope badge moves from the Term column to the Provision column. Every defined term across the entire review page becomes clickable via `<DefinedTerm>` + `<DefinitionDrawer>`, including inside raw `full_text` blocks, not just computed cell values.

**Steps.**

1. **Outside Date — Termination table.** Render exactly the pills spec: `[6 mo] + [3 mo · AUTOMATIC · other conditions capable of satisfaction]`. If the current render is prose (e.g. Mr. Cooper's `"Outside date: December 31, 2025 (~9 months post-signing)"`), this phase's test blocks merge until fixed. Build `components/review/OutsideDateRow.jsx` (NEW, shared) so Termination and Antitrust reuse the identical component — same one referenced by `buildOutsideDatePillSpec` already used at the antitrust summary table.
2. **Other Covenants — delete rows.** Delete all rows whose category is `EMPLOYEE_COMPENSATION`, `EMPLOYEE_HIRING_TERMINATION`, `BENEFIT_PLANS`, or `COLLECTIVE_BARGAINING` — they belong in Employee Benefits. Delete all rows classified as `TSA` (transition services agreement) outright.
3. Write a one-time migration script `scripts/data-fix/reclassify-other-covenants.js` (NEW) to move any orphaned rows from Other Covenants → Employee Benefits based on category, rather than dropping data silently.
4. **Employee Benefits — column swap.** The `Company pre-closing` scope badge currently prefixes the term name in the LEFT column (`components/review/EmployeeBenefitsTable.js`). Move it to the RIGHT (Provision) column, prefixed to the treatment string. Left column shows ONLY the benefit type (`Base salary`, `Target annual bonus`, etc.) — no scope badge there.
5. **Definitions clickability.** Build `components/review/DefinedTerm.jsx` (NEW) — wraps every defined-term instance; clicking scrolls to the definition and opens `components/review/DefinitionDrawer.jsx` (NEW) with verbatim text, as an overlay (does not navigate away).
6. Build `lib/parser-v2/link-defined-terms.js` (NEW) — post-processes provision text using a `defined_terms_index[]` per deal to find and wrap each occurrence, including occurrences inside `full_text` blocks (both in the definition's own header AND in any cross-reference clauses), not only computed cell values.
7. Build `lib/queries/definitions-index.js` (NEW).

**Files touched (must match `phase-5.json`, Appendix F):**
- `components/review/OutsideDateRow.jsx` (NEW, shared)
- `components/review/DefinedTerm.jsx` (NEW)
- `components/review/DefinitionDrawer.jsx` (NEW)
- `components/review/OtherCovenantsSection.jsx` (NEW)
- `components/review/EmployeeBenefitsTable.jsx` (modify — column swap)
- `lib/parser-v2/link-defined-terms.js` (NEW)
- `lib/queries/definitions-index.js` (NEW)
- `db/migrations/*` — additive, move category rows if needed
- `scripts/data-fix/reclassify-other-covenants.js` (NEW)
- `tests/review/phase-5-*.spec.js` (NEW)
- `WORKLOG-P5.md` (NEW)

**Blocking tests:**
- `PH5-A` — Outside Date row renders exactly 2 pills separated by literal `+`.
- `PH5-B` — Other Covenants section contains no `TSA|transition services`, `employee compensation`, or `benefit plan` text.
- `PH5-C` — ≥50 clickable `data-testid="defined-term"` spans; clicking the first opens `definition-drawer`.
- `termination-outside-date-pill.test.js` — Mr. Cooper Termination table has a `data-component-name="OutsideDatePillRow"` node in the outside-date row.
- `employee-benefits-scope-badge-side.test.js` — Mr. Cooper fixture: left column of every employee-benefits row has no `.badge`/scope pill; right column has `Company pre-closing` as a `.pill`.
- `definitions-clickable-in-full-text.test.js` — Skechers MAE definition provision: EVERY occurrence of "Company Material Adverse Effect" inside `full_text` (header and cross-reference clauses) renders as `<DefinedTerm>`.

**Definition of done.** All 6 tests green. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P5.md`.

---

## PHASE 6 — Hero table backfill

**Objective.** Update deal value AND both-side advisors/legal counsel for every deal in the 40-deal corpus on the home-page hero table.

**Steps.**

1. Write `scripts/backfill/hero-table-data.js` (NEW): iterate every `deals` row. For each deal, read deal value from source in priority order: SEC 8-K, press release, agreement recital.
2. For each deal, read financial advisors and legal counsel (both sides) from the 8-K or proxy DEFM14A.
3. Write to columns: `deals.deal_value_usd`, `deals.financial_advisor_company`, `deals.financial_advisor_parent`, `deals.legal_counsel_company`, `deals.legal_counsel_parent`.
4. If any advisor cannot be found, set `_pending_qa` boolean true and do NOT populate a guess.
5. Run the backfill on the current 40-deal corpus.
6. Update the home-page hero table rendering (`pages/index.js` or wherever it lives — verify the actual file) to show advisors + deal value; it should update automatically since it reads from `deals`.

**Files touched (must match `phase-6.json`, Appendix F):**
- `scripts/backfill/hero-table-data.js` (NEW)
- `lib/parser-v2/extract-advisors.js` (NEW)
- `db/migrations/*` — additive, advisor + legal-counsel columns if missing
- `pages/index.js` — imports `<DealsTable />` from `components/DealsTable.js`. The hero-table backfill writes into the columns that `components/DealsTable.js` reads (deal_value_usd, financial_advisor_company, financial_advisor_parent, legal_counsel_company, legal_counsel_parent). No `pages/newhome.js` changes needed for this phase — that page is the market-query surface, not the hero table.
- `tests/review/phase-6-hero-backfill.spec.js` (NEW)
- `WORKLOG-P6.md` (NEW)

**Blocking tests:**
- `PH6-A` — every deal has non-null `deal_value_usd` OR `_deal_value_pending_qa=true`.
- `PH6-B` — ≥30 of 40 deals have both advisor columns populated.
- `PH6-C` — Metsera hero row shows deal value matching `/\$7/` and a non-empty `financial-advisor-company` cell.

**Worklog additionally requires:** `DEALS_TOTAL`, `DEAL_VALUE_POPULATED`, `DEAL_VALUE_PENDING_QA`, `ADVISORS_BOTH_SIDES`, `ADVISORS_ONE_SIDE`, `ADVISORS_NONE`.

**Definition of done.** All 3 tests green. Worklog backfill summary lines all populated with real counts (not placeholders). All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P6.md` — for deals where advisor data genuinely isn't findable, that's an expected `_pending_qa=true` outcome, not a block; only block if the backfill script itself cannot run.

---

## PHASE 7 — Delete legacy renderers

**Objective.** Only after Phases 0-6 are merged and Metsera + every other deal renders from `provision_cards`, delete the legacy bespoke renderers that Phase 0 kept as fallback.

**Steps.**

1. Confirm precondition: every deal in `deals` has ≥50 `provision_cards` rows AND the legacy-fallback path in `pages/review/[id].js` never fires in a full audit run across all 40 deals.
2. Run the audit. If any deal still falls back to legacy, STOP — do not delete legacy renderers while any deal depends on them. Write `BLOCKED-P7.md` naming the specific deal(s) still on legacy.
3. If the audit is clean, delete: `components/review/ConsiderationTables.js`, `components/review/NosolFourTables.js`, `components/review/EmployeeBenefitsTable.js` (the OLD one, not the Phase 5 rewritten one — verify naming didn't collide), `components/review/SecMeetingTable.js`, `components/review/NoOtherRepsFraudTable.js`, and any other bespoke legacy renderer discovered during the audit.

**Files touched:** the deletions above only, plus the audit script and its output.

**Blocking test:** an audit run visits all 40 deals and never enters the legacy path — this must be true BEFORE deletion, verified in the same PR.

**Definition of done.** Zero legacy renderer files remain. All 40 deals render from `provision_cards`. All 7 cross-cutting invariants pass.

**If blocked:** `BLOCKED-P7.md` — name which deal(s) are not yet card-backed; do not delete legacy code while any deal still needs it.

---

# APPENDIX A — MARKET-FIELD REGISTRY (priority ~50, inline)

Format: `field_key | type | states | source_file/line | resolver_notes | test_deal_ids_required_per_state`

| field_key | type | states | source_file/line | resolver_notes | test_deal_ids_required_per_state |
|---|---|---|---|---|---|
| `deal.consideration.type` | ENUM | PRESENT | `lib/schema/features.js` | Headline: CASH_ONLY / STOCK_ONLY / MIXED / MIXED_ELECTION / CASH_ELECTION / STOCK_ELECTION, with CVR variants | ≥1 per enum value observed in corpus |
| `deal.consideration.perShareCashComponent` | USD_AMOUNT | PRESENT, ABSENT | `lib/parser-v2/consideration-equity.js` | For mixed-consideration deals | Chevron (PRESENT), Metsera (ABSENT — all cash+CVR, no split) |
| `deal.consideration.perShareStockComponent` | ratio | PRESENT, ABSENT | `lib/parser-v2/consideration-equity.js` | For mixed-consideration deals | Chevron (PRESENT) |
| `deal.consideration.exchangeRatio` | FLOAT | PRESENT, NA | `lib/parser-v2/consideration-equity.js` | — | Chevron |
| `deal.consideration.exchangeRatioType` | ENUM | FIXED, FLOATING, NA | `ConsiderationTables.js:704` | Scope resolver MUST pick merger-consideration provision only; EXCLUDES `CONSID-EQUITY-*` | Chevron (FIXED) |
| `deal.consideration.electionAvailable` | BOOLEAN | PRESENT, ABSENT | `lib/parser-v2/elections.js:1` | Signal-token detection over CONSID region | Skechers (PRESENT), Metsera (ABSENT) |
| `deal.consideration.electionType` | ENUM | CASH_ELECTION, STOCK_ELECTION, MIXED_ELECTION, NA | `election_mechanisms.election_type` | — | Skechers (MIXED_ELECTION) |
| `deal.consideration.electionDeadline` | TEXT | PRESENT, ABSENT | `election_mechanisms.election_deadline_quote` | — | Skechers (PRESENT) |
| `deal.consideration.oversubscriptionTreatment` | ENUM | PRESENT, ABSENT | election region | Proration mechanics | Skechers |
| `deal.consideration.collar.present` | BOOLEAN | PRESENT, ABSENT | CONSID region | — | any deal with collar |
| `deal.consideration.collar.floor` | FLOAT | PRESENT, NA | CONSID region | sibling of `.present` | — |
| `deal.consideration.collar.cap` | FLOAT | PRESENT, NA | CONSID region | sibling of `.present` | — |
| `deal.consideration.collar.type` | ENUM | PRESENT, NA | CONSID region | — | — |
| `deal.consideration.walkAwayRight.present` | BOOLEAN | PRESENT, ABSENT | CONSID region | — | — |
| `deal.consideration.walkAwayRight.party` | ENUM | PRESENT, NA | CONSID region | COMPANY/PARENT/MUTUAL | — |
| `deal.consideration.appraisalRightsAvailable` | BOOLEAN | PRESENT, ABSENT | CONSID region | — | — |
| `deal.consideration.cvr.present` | BOOLEAN | PRESENT, ABSENT | CONSID region | — | Metsera (PRESENT) |
| `deal.consideration.cvr.type` | ENUM | PRESENT, NA | CONSID region | — | Metsera |
| `deal.consideration.cvr.milestone` | TEXT | PRESENT, NA | CONSID region | verbatim | Metsera |
| `deal.consideration.cvr.deadline` | ISO_DATE | PRESENT, NA | CONSID region | — | Metsera |
| `deal.consideration.dividendEquivalence` | BOOLEAN | PRESENT, ABSENT | `ConsiderationTables.js:723` | — | — |
| `deal.mae.appliesTo` | ENUM | COMPANY_ONLY, PARENT_ONLY, BOTH, NA | `Sidebar.js:113-127` (post-fix) | Read from MAE-DEF / MAE-DEF-P presence | Skechers (COMPANY_ONLY) |
| `deal.mae.carveouts` | ENUM_MULTI | per category | `lib/vocab/mae-limbs.js` | present + disproportionate carveback boolean per category | Metsera |
| `deal.rw.lookback` | INT_MONTHS | PRESENT, FLAGGED | `lib/parser-v2/extract-rw-lookbacks.js` | "since date X" temporal; reject <0 or >240 months | ≥3 deals with real values (unit-parse bug regression guard) |
| `deal.rw.materialityScrape` | BOOLEAN | PRESENT, ABSENT | R&W region | — | — |
| `deal.rw.knowledgeQualifier` | ENUM | PRESENT, ABSENT | R&W region | — | — |
| `deal.rw.noOtherRepsFraud` | BOOLEAN | PRESENT, ABSENT | R&W region | — | — |
| `deal.ioc.hasCompanyIoc` | BOOLEAN | PRESENT, ABSENT | `ioc_positive_obligations` | — | — |
| `deal.ioc.hasBuyerIoc` | BOOLEAN | PRESENT, ABSENT | `ioc_positive_obligations` | — | Mr. Cooper (PRESENT) |
| `deal.ioc.buyerHasAffirmativeCovenants` | BOOLEAN | PRESENT, ABSENT | IOC-B rows count > 0 | — | Mr. Cooper |
| `deal.ioc.buyerHasNegativeCovenants` | BOOLEAN | PRESENT, ABSENT | IOC-B rows count > 0 | — | Mr. Cooper |
| `deal.ioc.affirmativePreamble.limbs` | ENUM_MULTI | COMPONENT_LIMB | `lib/vocab/ioc-components.js` | ordinary course / preserve relationships / maintain assets | Metsera |
| `deal.ioc.negativeCovenants.debt` | BOOLEAN | PRESENT, ABSENT_INTENTIONAL, UNKNOWN | `IOC_COMPONENTS_CANONICAL.INDEBTEDNESS` | 3-limb component resolver (incur/prepay/guarantee) | Metsera (PRESENT) |
| `deal.ioc.negativeCovenants.debtLimbs` | ENUM_MULTI | COMPONENT_LIMB | `lib/vocab/ioc-components.js` | incurring / prepaying / guaranteeing | Metsera |
| `deal.ioc.negativeCovenants.acquisitions` | BOOLEAN + threshold | COMPONENT_LIMB | `IOC_COMPONENTS_CANONICAL.ACQUISITIONS_BUSINESS_COMBINATIONS` | present + threshold pair | Metsera |
| `deal.ioc.negativeCovenants.capex` | BOOLEAN + threshold | COMPONENT_LIMB | `IOC_COMPONENTS_CANONICAL.CAPITAL_EXPENDITURES` | present + threshold pair | — |
| `deal.ioc.negativeCovenants.dividends` | BOOLEAN + threshold | COMPONENT_LIMB | `IOC_COMPONENTS_CANONICAL.DIVIDENDS_DISTRIBUTIONS` | present + threshold pair; §5.01(d) heading-wins case | Metsera |
| `deal.nosol.definitions.acquisitionProposal` | TEXT+ENUM | PRESENT | NoSol definitions block | summary + verbatim, deduped | Metsera |
| `deal.nosol.definitions.superiorProposal` | TEXT+ENUM_MULTI | PRESENT | NoSol definitions block | limbs per `superior-proposal-limbs.js` | Metsera |
| `deal.nosol.definitions.interveningEvent` | TEXT+ENUM | PRESENT, ABSENT | NoSol definitions block | — | — |
| `deal.nosol.matchingPeriod` | INT_DAYS | PRESENT | NoSol region | party-scoped `.company`/`.parent` | ≥24 deals |
| `deal.nosol.initialMatchPeriodDays` | INT_DAYS | PRESENT | NoSol region | — | ≥24 deals |
| `deal.nosol.refreshPeriodDays` | INT_DAYS | PRESENT, ABSENT | NoSol region | conditional/triggered pattern | — |
| `deal.nosol.fiduciaryOut.present` | BOOLEAN | PRESENT, ABSENT | NoSol region | — | — |
| `deal.nosol.fiduciaryOut.types` | ENUM_MULTI | PRESENT | `lib/vocab/nosol-carveouts.js` | — | — |
| `deal.nosol.lookback` | INT_MONTHS | PRESENT | NoSol region | temporal cutoff | ≥3 deals |
| `deal.antitrust.effortsStandard` | ENUM | PRESENT | AT region | best / commercially reasonable / reasonable | Chevron |
| `deal.antitrust.capStandard` | ENUM | COMPANY_MAE, BURDENSOME_CONDITION, SUBSTANTIAL_DETRIMENT, MATERIAL_ADVERSE_EFFECT_ON_COMBINED, OTHER, NA | Caps & Limits pill source | drives the ONE canonical pill | Chevron (BURDENSOME_CONDITION or COMPANY_MAE per corpus fact) |
| `deal.antitrust.litigationObligation` | ENUM | FINAL_JUDGMENT, DEFEND_NO_APPEAL, NO_OBLIGATION, NA | Litigation pill source | drives the ONE canonical pill | Chevron |
| `deal.antitrust.controlLeadParty` | ENUM | PARENT, COMPANY, MUTUAL, NA | AT region | powers Control-row pill | — |
| `deal.antitrust.hsrFilingDeadline` | ISO_DATE / INT_DAYS | PRESENT | AT region | — | — |
| `deal.antitrust.exHsrFilingDeadline` | ISO_DATE / INT_DAYS | PRESENT, NA | AT region | — | — |
| `deal.antitrust.pullAndRefile` | BOOLEAN | PRESENT, ABSENT | `lib/vocab/at-pull-refile-restrictions.js` | pills not verbatim by default | — |
| `deal.antitrust.timingAgreement` | BOOLEAN | PRESENT, ABSENT | AT region | pills not verbatim by default | — |
| `deal.antitrust.clearSkiesParent` | ENUM_MULTI | PRESENT | AT region | 2 canonical pills | Metsera |
| `deal.antitrust.clearSkiesCompany` | TEXT | PRESENT | AT region | cross-ref to IOC only | Metsera |
| `deal.antitrust.burdensomeConditionPresent` | BOOLEAN | PRESENT, ABSENT | AT region | — | Chevron |
| `deal.antitrust.burdensomeConditionScope` | TEXT | PRESENT, NA | AT region | sub-field of caps standard | — |
| `deal.antitrust.burdensomeConditionDefined` | BOOLEAN | PRESENT, ABSENT | AT region | — | — |
| `deal.conditions.antitrust` | TEXT | PRESENT | Conditions section | must never contain "burdensome" | all 40 |
| `deal.conditions.stockholderVote` | ENUM | PRESENT | Conditions section | MAJORITY_OUTSTANDING etc | Metsera |
| `deal.conditions.proxy` | BOOLEAN | PRESENT, ABSENT | Conditions section | — | — |
| `deal.conditions.noMAE` | BOOLEAN | PRESENT | Conditions section | — | — |
| `deal.conditions.repsBringDown` | ENUM (standard+scope compound) | PRESENT | Conditions section | `.standard` + `.scope` + `.excepted_reps` per amendment pattern 1.5 | Metsera |
| `deal.conditions.covenantsBringDown` | ENUM | PRESENT | Conditions section | — | — |
| `deal.termination.outsideDate` | INT_MONTHS + extensions | PRESENT | `outside_date_specs` | temporal, base + extensions[] | Metsera (6mo+3mo) |
| `deal.termination.outsideDateExtensions` | JSONB | PRESENT, ABSENT | `outside_date_specs.extensions` | — | Metsera |
| `deal.termination.rights.byBuyer` | ENUM_MULTI | PRESENT | Termination region | list | — |
| `deal.termination.rights.byCompany` | ENUM_MULTI | PRESENT | Termination region | list | — |
| `deal.termination.rights.mutual` | ENUM_MULTI | PRESENT | Termination region | list | — |
| `deal.termf.companyTerminationFee.amount` | USD_AMOUNT | PRESENT | TERMF region | magnitude polymorphism — also register `.amount_pct_equity` | ≥30 deals |
| `deal.termf.buyerTerminationFee.amount` | USD_AMOUNT | PRESENT, ABSENT | TERMF region | — | — |
| `deal.termf.nakedNoVoteFee.amount` | USD_AMOUNT | PRESENT, ABSENT | TERMF region | — | — |
| `deal.termf.antitrustBreakFee.amount` | USD_AMOUNT | PRESENT, ABSENT | TERMF region | — | — |
| `deal.employeeBenefits.continuationPeriod` | INT_MONTHS | PRESENT | Employee Benefits region | — | Mr. Cooper |
| `deal.employeeBenefits.severancePlan` | TEXT+ENUM | PRESENT, ABSENT | Employee Benefits region | — | — |
| `deal.definedTerms` | JSONB (all definitions) | PRESENT | `defined_terms_index[]` | per-deal; powers `<DefinedTerm>` | Skechers (≥1 MAE definition) |

**GENERATED REMAINDER.** The ~215 fields not inlined above are Codex's Phase 0 responsibility, not the reviewer's. Codex reads `lib/schema/features.js`, `lib/rubric.js`, and `lib/vocab/ioc-categories.js` in full and produces:

- `docs/market-registry/generated-v1.json` — machine-readable, one object per field, minimum shape: `{ key, label, data_type, applies_to, party_scope, structural_patterns[], states[], source_file, resolver_stub }`.
- `docs/market-registry/generated-v1.md` — human-readable, one row per field, same fields as columns.

Both artifacts ship in the Phase 0 PR for reviewer sign-off. **Codex cannot proceed to Phase 0.5 until the reviewer commits `docs/market-registry/FROZEN-v1.json`.** The CI check enforcing this:

```js
test('Phase 0.5 cannot start without FROZEN market registry', () => {
  expect(fs.existsSync('docs/market-registry/FROZEN-v1.json')).toBe(true);
});
```

This test runs as part of the Phase 0.5 allowlist gate (Appendix F) — if the frozen file is absent, Phase 0.5's CI fails immediately regardless of what else Codex did.

---

# APPENDIX B — 10 STRUCTURAL PATTERNS

Copied verbatim in substance from `pm-wp-market-normalization-amendment-01.codex.md` Part 1. Every market field — inlined in Appendix A or generated in Phase 0 — must be tagged with which of these apply before it goes `ACTIVE`.

### B.1 Three-state resolution (limbs / partial-presence)

Every `market_field_deal_values` row carries a `state` column, not just a value:

```sql
alter table market_field_deal_values
  add column state text not null check (state in (
    'PRESENT',              -- value resolved from provision text
    'ABSENT_INTENTIONAL',   -- parent covenant exists but this specific limb/component is NOT restricted
    'UNKNOWN',              -- neither parent covenant nor component found; may not have been scanned
    'NOT_APPLICABLE'        -- applies_to filter or deal-topology excludes this field for this deal
  ));

alter table market_field_deal_values
  add constraint value_only_when_present check (
    (state = 'PRESENT') OR
    (value_text is null AND value_numeric is null AND value_enum is null AND value_boolean is null)
  );
```

### B.2 Component / limb resolvers

New `resolver_kind = 'COMPONENT_LIMB'`. New columns on `market_field_resolvers`: `parent_covenant_type`, `limb_key`, `absence_rule` (`NULL_IS_UNKNOWN` / `IF_PARENT_EXISTS_AND_LIMB_NOT_ENUMERATED_THEN_ABSENT_INTENTIONAL` / `IF_ENUMERATION_LIST_PRESENT_THEN_ABSENT_INTENTIONAL` / `EXPLICIT_NEGATIVE_STATEMENT_REQUIRED`). `test_deal_ids` becomes stateful: `{ "PRESENT": [...], "ABSENT_INTENTIONAL": [...], "UNKNOWN": [...], "NOT_APPLICABLE": [...] }`. Every IOC field with limbs uses `resolver_kind='COMPONENT_LIMB'` referencing `lib/vocab/ioc-components.js` — that file is the sole source of truth for limb names, no free-text `limb_key` values.

`lib/vocab/ioc-components.js` minimum seed (7 categories: `INDEBTEDNESS`, `DIVIDENDS_DISTRIBUTIONS`, `ACQUISITIONS_BUSINESS_COMBINATIONS`, `DISPOSITIONS_ASSET_SALES`, `EQUITY_ISSUANCES`, `CAPITAL_EXPENDITURES`, `EMPLOYEE_COMPENSATION`), each with 2-7 named limbs (see source file for full enumeration — Codex copies it verbatim into the repo, does not re-derive it). Missing categories (`REAL_ESTATE_LEASES`, `LIENS_ENCUMBRANCES`, etc.) get their component list PROPOSED during Phase A corpus scan; reviewer confirms before use.

### B.3 Party asymmetry — no field is party-agnostic without proof

New required column on `market_fields`:

```sql
alter table market_fields
  add column party_scope text not null default 'REQUIRES_PARTY' check (party_scope in (
    'COMPANY_ONLY', 'PARENT_ONLY', 'PER_PARTY', 'MUTUAL_APPLICABLE', 'DEAL_LEVEL'
  ));
```

If `party_scope = 'PER_PARTY'`, the field `key` MUST end in `.company`, `.parent`, or `.both`. Merging `nosol.matching_rights_days.company` and `.parent` into one bare key is banned. Every no-sol, IOC, rep, and termination-fee field must be reviewed for party; default to `PER_PARTY` if unsure. Consideration and deal_value stay `DEAL_LEVEL`.

### B.4 Threshold + presence duality

Every field with an optional dollar/percent threshold splits into a presence field (`BOOLEAN`, e.g. `ioc.indebtedness.guarantee.restricted`) and a threshold field (`USD_AMOUNT`/`FLOAT_PERCENT`, e.g. `ioc.indebtedness.guarantee.threshold_usd`) that are always registered together. Enforced by a DB trigger that raises an exception if a `.threshold_usd`/`.threshold_pct` field lacks a sibling `.restricted` field.

### B.5 Standard + scope compound structure

Standards (e.g. "In all material respects") always pair with the scope they apply to. Any field with `data_type='ENUM'` and key containing `.standard` must have a sibling `.scope` field. Example — reps bring-down: `conditions.bring_down.company.standard` (ENUM: MAE / MATERIAL_ADVERSE_EFFECT_QUALIFIED / IN_ALL_MATERIAL_RESPECTS / DE_MINIMIS / TRUE_AND_CORRECT_ALL_RESPECTS) pairs with `conditions.bring_down.company.scope` (ENUM: ALL_REPS_NOT_OTHERWISE_SPECIFIED / FUNDAMENTAL_REPS_ONLY / SPECIFIC_REPS_LISTED / NONE) and `conditions.bring_down.company.excepted_reps` (ENUM_MULTI).

### B.6 Temporal cutoffs (as-of dates)

Any field whose meaning depends on a lookback or "since" date registers that date as a companion field (`rw.aoc.mae_since.date`, `rw.aoc.ioc_compliance_since.date`, `rw.sec_filings.lookback_months`). Any field with `data_type='INT_MONTHS'` and key containing `.lookback` must have `test_deal_ids.PRESENT` containing at least 3 deals with real lookback values — this is the direct regression guard for the `106.8 years` unit-parse bug.

### B.7 Magnitude polymorphism

Termination fees, MAE dollar carve-outs, and similar magnitudes appear as `$ amount`, `% of equity value`, `% of enterprise value`, `% of transaction value`. Register all four expressions plus a `.reconciled_pct_equity` field computed via a `COMPUTED_FROM_PATHS` resolver with `op: "RECONCILE_MAGNITUDE"`. Every reconciled value row records which basis it came from in `raw_source_path` so reviewers can spot systematic conversion errors.

### B.8 Mutual / reciprocal provisions

A field can be one-sided in Deal X and mutual in Deal Y. Register as `party_scope='PER_PARTY'` with `.company`/`.parent` keys plus a companion `.mutual` BOOLEAN field recording whether the underlying provision was written as one mutual covenant vs two one-sided ones. When `mutual=true`, `.company` and `.parent` values must match — enforced by a DB check trigger.

### B.9 Conditional / triggered provisions

Some values only exist under a trigger condition (e.g. match rights activate only on Superior Proposal). Register the base field plus `.trigger_condition` (ENUM from `lib/vocab/trigger-conditions.js` — canonical, no free text), `.recurring` (BOOLEAN), `.recurring_days` (INT_DAYS) as needed.

### B.10 Heading-wins (section heading beats body-text ambiguity)

This is the §5.01(d) Metsera bug pattern generalized. Classifier config `lib/parser-v2/classify-config.js` defines `CATEGORY_RESOLUTION_ORDER = ['EXPLICIT_SECTION_HEADING', 'DEFINED_TERM_ANCHOR', 'STRUCTURED_LIST_CONTEXT', 'CONTENT_KEYWORDS']`. Every extractor write to a provision row's category must also record `category_source` (one of the four) so the market-norm layer can detect heading/content drift. The nightly snapshot job alerts when the same section heading resolves to different canonical categories across deals.

---

# APPENDIX C — 5-TABLE MARKET REGISTRY SCHEMA

Copied from `pm-wp-market-normalization.codex.md` §2, with the Appendix B state/party/pattern columns layered on as `alter table` statements (apply them in the same migration set, not as an afterthought).

### C.1 `market_fields` — the registry

```sql
create table market_fields (
  key                     text primary key,                    -- e.g. 'nosol.matching_rights_days.company'
  label                   text not null,
  description             text,
  data_type               text not null check (data_type in (
                            'INT_DAYS','INT_MONTHS','FLOAT_PERCENT','USD_AMOUNT',
                            'ENUM','ENUM_MULTI','BOOLEAN','ISO_DATE','TEXT'
                          )),
  applies_to              text not null default 'all',
  provision_type_hint     text,
  enum_values             jsonb,
  unit                    text,
  status                  text not null default 'DRAFT' check (status in (
                            'DRAFT','PROPOSED','ACTIVE','DEPRECATED'
                          )),
  deprecated_in_favor_of  text references market_fields(key),
  min_n_for_display       integer not null default 5,
  dedupe_scope            text not null default 'DEAL' check (dedupe_scope in (
                            'DEAL','DEAL_PROVISION','PROVISION_ROW'
                          )),
  selection_rule          text,
  party_scope             text not null default 'REQUIRES_PARTY' check (party_scope in (
                            'COMPANY_ONLY','PARENT_ONLY','PER_PARTY','MUTUAL_APPLICABLE','DEAL_LEVEL'
                          )),
  structural_patterns     text[] not null default '{}' check (structural_patterns <@ ARRAY[
                            'THREE_STATE','COMPONENT_LIMB','PARTY_ASYMMETRIC',
                            'THRESHOLD_PRESENCE_DUAL','STANDARD_SCOPE_COMPOUND','TEMPORAL_CUTOFF',
                            'MAGNITUDE_POLYMORPHIC','MUTUAL_RECIPROCAL','CONDITIONAL_TRIGGERED',
                            'HEADING_WINS'
                          ]::text[]),
  notes_for_reviewer      text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);
```

### C.2 `market_field_resolvers` — ordered fallback rules

```sql
create table market_field_resolvers (
  id                      uuid primary key default gen_random_uuid(),
  field_key               text not null references market_fields(key) on delete cascade,
  priority                integer not null,
  resolver_kind           text not null check (resolver_kind in (
                            'DIRECT_PATH','FALLBACK_PATH','COMPUTED_FROM_PATHS','ENUM_MAP','UNIT_CONVERT',
                            'COMPONENT_LIMB'
                          )),
  provision_type          text,
  json_path               text,
  fallback_paths          jsonb,
  computation             jsonb,
  enum_map                jsonb,
  unit_convert            jsonb,
  parent_covenant_type    text,
  limb_key                text,
  absence_rule            text check (absence_rule in (
                            'NULL_IS_UNKNOWN',
                            'IF_PARENT_EXISTS_AND_LIMB_NOT_ENUMERATED_THEN_ABSENT_INTENTIONAL',
                            'IF_ENUMERATION_LIST_PRESENT_THEN_ABSENT_INTENTIONAL',
                            'EXPLICIT_NEGATIVE_STATEMENT_REQUIRED'
                          )),
  test_deal_ids           jsonb not null default '{}',  -- stateful shape: {PRESENT:[], ABSENT_INTENTIONAL:[], UNKNOWN:[], NOT_APPLICABLE:[]}
  active                  boolean not null default true,
  created_at              timestamptz default now(),
  unique (field_key, priority)
);
```

Resolver kinds: `DIRECT_PATH` (read canonical path directly), `FALLBACK_PATH` (try `fallback_paths[]` in order), `COMPUTED_FROM_PATHS` (combine multiple paths — `COALESCE`/`SUM`/`MAX`/`PERCENT_OF`/`RECONCILE_MAGNITUDE` ops), `ENUM_MAP` (normalize enum aliases), `UNIT_CONVERT` (e.g. months → days), `COMPONENT_LIMB` (per Appendix B.2).

### C.3 `market_field_aliases` — the discoverable alias index

```sql
create table market_field_aliases (
  id                      uuid primary key default gen_random_uuid(),
  raw_path                text not null,
  provision_type          text,
  observed_in_deal_count  integer not null default 0,
  first_seen_deal_id      uuid references deals(id),
  first_seen_at           timestamptz default now(),
  last_seen_at            timestamptz default now(),
  mapped_field_key        text references market_fields(key),
  mapping_status          text not null default 'UNMAPPED' check (mapping_status in (
                            'UNMAPPED','PROPOSED','APPROVED','REJECTED','IGNORE'
                          )),
  mapping_confidence      text check (mapping_confidence in ('LOW','MEDIUM','HIGH')),
  proposed_by             text,
  reviewer_notes          text,
  sample_values           jsonb,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (raw_path, provision_type)
);
```

Populated by nightly `scripts/market-norm/scan-corpus.js`. Auto-suggest confidence rules: HIGH = exact match or camel/snake equivalence with matching `data_type`; MEDIUM = contains-match with matching `provision_type`; LOW = token-overlap only (Jaccard ≥ 0.5 against `market_fields.label`).

### C.4 `market_field_snapshots` — precomputed coverage & distributions

```sql
create table market_field_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  field_key               text not null references market_fields(key),
  computed_at             timestamptz not null default now(),
  n_deals_total           integer not null,
  n_deals_with_value      integer not null,
  coverage_pct            numeric(5,2) not null,
  distribution            jsonb not null,
  p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric,
  mode_value              text,
  top_2_enum_values       jsonb,
  contributing_deal_ids   jsonb not null,
  excluded_deal_ids       jsonb not null,
  resolver_hit_counts     jsonb not null,
  unique (field_key, computed_at)
);
```

Rebuilt nightly at 02:00 UTC (see nightly cron below) and on-demand after registry edits. Keep last 30 snapshots per field.

### C.5 `market_field_deal_values` — resolved values per deal per field

```sql
create table market_field_deal_values (
  id                      uuid primary key default gen_random_uuid(),
  field_key               text not null references market_fields(key),
  deal_id                 uuid not null references deals(id),
  state                   text not null check (state in ('PRESENT','ABSENT_INTENTIONAL','UNKNOWN','NOT_APPLICABLE')),
  value_text              text,
  value_numeric           numeric,
  value_enum              text,
  value_boolean           boolean,
  resolver_used           uuid references market_field_resolvers(id),
  raw_source_path         text,
  provision_row_id        uuid,
  applicable              boolean not null default true,
  computed_at             timestamptz default now(),
  unique (field_key, deal_id),
  constraint value_only_when_present check (
    (state = 'PRESENT') OR
    (value_text is null AND value_numeric is null AND value_enum is null AND value_boolean is null)
  )
);
```

**Nightly job** (`market-norm-nightly`, cron `02:00 UTC`, scheduled via `pplx-tool schedule_cron`, task metadata `{"kind":"market_norm","version":"v1"}`): (1) run `scripts/market-norm/scan-corpus.js` to refresh aliases; (2) run auto-suggest for unmapped aliases; (3) recompute `market_field_deal_values` for every ACTIVE field; (4) recompute `market_field_snapshots`; (5) rebuild `/newhome` tile caches; (6) if any tile's coverage drops ≥10% vs previous snapshot, post an alert to `admin_alerts` (severity `WARN` at ≥10%, `CRITICAL` at ≥25%). Also triggers on new-deal-ingest-complete, registry approval actions, and manual `/admin/market-registry` trigger. Idempotent — uses row-level advisory lock on `market_field_snapshots` per key.

**Coverage floors** (state-aware, per amendment-01 Part 2): `nosol.matching_rights_days.company` ≥24 PRESENT / ≥27 PRESENT+ABSENT_INTENTIONAL; `termf.company.amount_pct_equity` ≥30/32; `termf.tail_provision_present` ≥30/34; `rep.mae_limbs_count.company` ≥28/32; `conditions.bring_down.company.standard` ≥30/34. Full floor table lives in `tests/market-norm/market-norm.spec.js` — Codex copies it verbatim from the amendment source, does not re-derive.

---

# APPENDIX D — FORBIDDEN-PATTERN GREP

Consolidated from V2 base + amendment-01 + market-norm + market-norm-amendment-01. Lives at `scripts/lint/forbidden-patterns.sh` — **reviewer-owned; Codex may never edit this file** (Appendix J). Every match is a CI failure. Rationale given for every pattern so Codex understands the "why," not just the "don't."

| Pattern | Rationale |
|---|---|
| `ITM only` | Banned label. Use "In the money" — reads better to reviewing attorneys and matches the Phase 1 spec exactly. |
| `Consideration:\s*Cash` | The "Cash" pill was deleted outright in Phase 1, not relabeled. Its reappearance means the old code path leaked back in. |
| `MAE\s*\(partial\)` | AOC final spec (Phase 2) allows exactly 2 sub-rows; "MAE (partial)" was a discarded intermediate design that must never resurface. |
| `TSA\|transition services agreement` (case-insensitive, in Other Covenants) | User explicitly said delete TSA rows from Other Covenants — they don't belong in an M&A interim-covenants view. |
| `Question\s*:.*\|.*Answer\s*:` (outside AOC context) | Q/A-style columns were banned in V1; "Term/Provision" is the only allowed shape. Reintroduction signals a rendering regression. |
| `applies to Parent and Company` | This exact string is the Sidebar MAE bug (Phase 4.5) — it lies about scope whenever a deal has only one MAE-DEF type. Banned unconditionally. |
| `maeAppliesToBoth` | The variable name behind the sidebar lie above; if it exists anywhere, the `total === 1` heuristic bug is still present. |
| `Must defend \(incl\. appeals/final judgment\)` | Old multi-part Litigation pill. Phase 4 collapses Litigation to exactly one of 4 canonical strings — this compound phrase was the discarded shape. |
| `QUALIFICATION.*litigation` | The qualification sub-label field was explicitly deleted in Phase 4 — if it reappears, someone reintroduced the two-part rendering. |
| `burdensome.*closing.condition` | Burdensome-condition language belongs under Caps & Limits only. Its presence in a closing-condition cell is exactly the contamination bug flagged in Round 3 (Chevron). |
| `Substantial Detriment.*closing` | Same contamination class as above — a different caps-standard value leaking into the wrong surface. |
| `Exchange Ratio Type.*Floating.*Exchange Ratio Type.*Fixed` | Signature of the Stock Consideration Mechanics scope-leak bug (Chevron) — a Fixed-ratio deal should never also show Floating from an unrelated equity-award provision in the same table. |
| `TOOLTIP_MAX\s*=\s*600` | The old hover-snip cutoff. Phase 4 raises this to 1500 with sentence-boundary snapping; reversion to 600 truncates mid-sentence on long antitrust clauses. |
| `FullDocumentView\s+provisions=\{provisions\}(?!.*focusProvisionId)` | Passing the full provisions array without `focusProvisionId` re-lights the entire document instead of the one cited provision — the exact bug Round 3 found. |
| `term-cell.*Company pre-closing.*base salary` | Signature of the Employee Benefits column-swap bug — the scope badge belongs on the Provision (right) column, not prefixed to the Term (left) label. |
| `antitrust-substantive-table.*<button.*onClick` | Raw `<button>` labels bypass `<TermCell>`, which is the only component that supplies both click-through and the "see text" hover. Every antitrust row must route through it. |
| `field_path\s*:\s*['"][a-z_]+['"]` | Bare `field_path` lookups are the root cause of the `/newhome` n=0/n=2/n=5 undercounting bug — every query must use `field_key` against the registry instead. |
| `provision_type\s*:\s*['"][A-Z_]+['"]\s*,\s*field_path` | The old adhoc-payload shape. Must be translated to `field_key` via the resolver lookup, never used directly in new code. |
| `\.only\(` | Leftover `test.only` silently disables the rest of a test file — exactly the kind of "skip tests quietly" behavior this whole document exists to prevent. |
| `\.skip\(` | Same as above for `test.skip`. |
| `\bxit\(` | Same as above for Jasmine/Jest `xit`. |
| `TODO\s*[:—-].*market` (case-insensitive) | A TODO left in market-norm code is an admission of incomplete work shipped as if done — the ACK contract forbids this. |
| `FIXME.*market` (case-insensitive) | Same as TODO — an acknowledged-but-unshipped defect must block merge, not slip through. |
| `console\.log` (in market-norm code) | Debug logging left in production code; also a vector for accidentally logging sensitive data. |
| `any\s*<any>` | TypeScript generic syntax — the repo is JS/JSX only; this pattern's presence means TS syntax leaked in. |
| `:\s*string\s*=` | TypeScript type annotation leaking into a `.js`/`.jsx` file. |
| `Mergers,\s*Acquisitions,\s*Dispositions` | The exact propagated §5.01(d) mislabel string (Dividends misclassified as Acquisitions) — if this string exists anywhere outside `lib/vocab/`, the heading-wins fix (Appendix B.10) has regressed. |
| `class="definition-term"(?!.*wrapped)` | A defined-term span that isn't wrapped in `<DefinedTerm>` is inert — clicking it does nothing, which is the exact bug Phase 5 fixes. |

Any line matching any pattern above, anywhere in the diff, fails `bash scripts/lint/forbidden-patterns.sh` (cross-cutting invariant #4, Appendix E). Codex may never extend or edit this script — only the reviewer can add new patterns.

---

# APPENDIX E — 11 CROSS-CUTTING INVARIANTS

Every phase tag (Phase 0 through Phase 7, including 0-A, 0.5, 4.5, 4.6) must pass ALL eleven before merge. Any failure blocks the tag — no partial credit.

1. **`npm run test`** — every test in `tests/` passes. No exceptions, no excluded suites.
2. **`node scripts/audit/ioc-scope-mismatch.js`** — zero party-scope mismatches across the corpus (introduced Phase 3, must stay green through every later phase).
3. **`node scripts/lint/closing-condition-scope.js`** — no burdensome-condition text in closing-condition surfaces anywhere in the corpus (introduced Phase 4).
4. **`bash scripts/lint/forbidden-patterns.sh`** — zero matches against Appendix D.
5. **`node scripts/lint/market-registry-completeness.js`** — every registered field has at least one `test_deal_id` per declared state.
6. **`node scripts/lint/component-reuse.js`** — `<OutsideDateRow>`/`<OutsideDatePillRow>` used in both Antitrust and Termination tables; `<ClosingConditionRow>` used in both Antitrust and Conditions sections; `<TermCell>` used in every substantive table's Term column.
7. **`node scripts/lint/party-scope-audit.js`** — IOC-T provisions must contain more Company/Target/Seller mentions than Parent/Buyer mentions; IOC-B provisions the reverse. Ties allowed.
8. **`node scripts/registry/detect-duplicates.js`** — introduced Phase 0-A. Runs against `docs/market-registry/FROZEN-v1.json` (once frozen) and `docs/market-registry/generated-v1.deduped.json` (until then). Fails if any two rows in the target file share the same `norm(key)` UNLESS both rows are declared party-scope splits in `features.js`. Threshold: zero unauthorized duplicate groups. Also fails if any row lacks a `merged_from` provenance array (empty array is fine for pass-through rows; missing property is not).
9. **`node scripts/registry/orphan-detector.js`** — introduced Phase 0-A. Every field in the active registry (`FROZEN-v1.json` when present, else `generated-v1.deduped.json`) must have ≥ 1 resolver reference — either an entry in `features.js`, `rubric.js`, `ioc-categories.js`, or an explicit `resolver: <path>` property on the row. Orphaned rows (registered but resolvable nowhere in code) fail the invariant. This is stricter than existing invariant #5 (which only checks `test_deal_id` presence) — #9 checks the field is actually extractable, not just tested.
10. **`node scripts/registry/coverage-detector.js`** — introduced Phase 0-A. Every field key exported from `lib/schema/features.js` must appear exactly once in the active registry as a canonical row (not merely as an `also_matches_provision_codes` entry). Missing coverage fails: silently dropping a schema field during dedup is a regression. Excess coverage (a registry row whose key does NOT exist in `features.js` and is NOT sourced from `appendix-a-priority` or `ioc-categories`) also fails.
11. **`node scripts/registry/provenance-log.js`** — introduced Phase 0-A. Every registry row whose `merged_from` array is non-empty must record: the origin (`schema-features` / `rubric-features` / `appendix-a-priority` / `ioc-categories`), the pre-merge `key`, and the merge rule that fired (`cross-origin` / `multi-scope-collapse` / `reviewer-decision`). Any row where `merged_from.length > 0` but any of those three fields is missing on any absorbed sibling fails the invariant. Reviewer-driven merges (rule d in Phase 0-A) additionally require the reviewer decision id from `reviewer-state.json`.

These 11 checks run as part of the pre-tag check for every phase from Phase 0 onward (invariants 2, 3, 6, 7 only become meaningful once their originating phase has shipped; invariants 8, 9, 10, 11 only become meaningful once Phase 0-A has produced `generated-v1.deduped.json`; before their originating phase, they trivially pass because there's nothing yet to violate). Record the pass/fail of each as 11 status lines in the phase's WORKLOG (Appendix H).

---

# APPENDIX F — PHASE ALLOWLISTS

Reviewer commits these once at WP start, at `.github/phase-allowlists/phase-{N}.json`. Codex may never edit these files (Appendix J). Editing anything outside the active phase's `allowed` list is a CI-blocking violation. Phase -1 is a special case: it INSTALLS the allowlist files themselves, so its own allowlist is enforced only by reviewer eyeballs on the PR diff — there is no committed allowlist file for Phase -1 to check against, by construction.

```json
{
  "phase": "-1",
  "name": "enforcement-teeth-installation",
  "allowed": [
    ".github/workflows/ci.yml",
    ".github/phase-allowlists/phase-0.json",
    ".github/phase-allowlists/phase-0-A.json",
    ".github/phase-allowlists/phase-0.5.json",
    ".github/phase-allowlists/phase-1.json",
    ".github/phase-allowlists/phase-2.json",
    ".github/phase-allowlists/phase-3.json",
    ".github/phase-allowlists/phase-4.json",
    ".github/phase-allowlists/phase-4.5.json",
    ".github/phase-allowlists/phase-4.6.json",
    ".github/phase-allowlists/phase-5.json",
    ".github/phase-allowlists/phase-6.json",
    ".github/phase-allowlists/phase-7.json",
    "docs/acks/ACK-MASTER-V1.reference.md",
    "scripts/lint/forbidden-patterns.sh",
    "scripts/lint/closing-condition-scope.js",
    "scripts/lint/market-registry-completeness.js",
    "scripts/lint/component-reuse.js",
    "scripts/lint/party-scope-audit.js",
    "scripts/audit/ioc-scope-mismatch.js",
    "scripts/registry/dedupe.js",
    "scripts/registry/detect-duplicates.js",
    "scripts/registry/orphan-detector.js",
    "scripts/registry/coverage-detector.js",
    "scripts/registry/provenance-log.js",
    "scripts/ci/detect-phase.js",
    "scripts/ci/check-allowlist.js",
    "scripts/ci/run-all-invariants.sh",
    "tests/lint/",
    "tests/ci/",
    "WORKLOG-P-1.md",
    "package.json"
  ],
  "denied": [
    "lib/",
    "pages/",
    "components/",
    "db/",
    "supabase/",
    "docs/market-registry/",
    "docs/vocab/",
    "styles/",
    "package-lock.json"
  ],
  "market_registry_additions": [],
  "bootstrap_note": "Phase -1 self-hosts its allowlist enforcement (see Appendix F preamble). package.json is allowed only for scripts-object additions; dependency changes remain forbidden per phase steps."
}
```

```json
{
  "phase": "0",
  "name": "schema-03-wireup-and-market-registry-generation",
  "allowed": [
    "docs/market-registry/generated-v1.json",
    "docs/market-registry/generated-v1.md",
    "lib/parser-v2/store-cards.js",
    "lib/parser-v2/store.js",
    "pages/api/parse/",
    "components/review/ProvisionCardTable.jsx",
    "pages/review/[id].js",
    "lib/queries/review-deal.js",
    "db/migrations/",
    "tests/review/phase-0-card-model-wireup.spec.js",
    "WORKLOG-P0.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*"],
  "market_registry_additions": []
}
```

```json
{
  "phase": "0-A",
  "name": "registry-dedup-and-reviewer-ui",
  "allowed": [
    "scripts/registry/dedupe.js",
    "scripts/registry/detect-duplicates.js",
    "scripts/registry/orphan-detector.js",
    "scripts/registry/coverage-detector.js",
    "scripts/registry/provenance-log.js",
    "docs/market-registry/generated-v1.deduped.json",
    "docs/market-registry/merge-report.md",
    "docs/market-registry/reviewer-state.json",
    "pages/admin/registry.js",
    "pages/api/admin/registry/decision.js",
    "pages/api/admin/registry/freeze.js",
    "pages/api/admin/registry/preview.js",
    "components/admin/AdminNav.js",
    "components/admin/registry/RegistryCard.jsx",
    "components/admin/registry/RegistrySidebar.jsx",
    "components/admin/registry/FlagBadge.jsx",
    "tests/registry/dedupe.spec.js",
    "tests/admin/registry-ui.spec.js",
    "WORKLOG-P0-A.md"
  ],
  "denied": [
    "scripts/lint/forbidden-patterns.sh",
    ".github/phase-allowlists/*",
    "docs/acks/*",
    "docs/market-registry/FROZEN-*",
    "docs/market-registry/generated-v1.json",
    "lib/parser-v2/*",
    "pages/review/*",
    "lib/schema/*",
    "lib/rubric.js",
    "lib/vocab/*"
  ],
  "market_registry_additions": []
}
```

```json
{
  "phase": "0.5",
  "name": "election-mechanics-reprocess",
  "allowed": [
    "scripts/reprocess/election-mechanics.js",
    "lib/parser-v2/elections.js",
    "lib/parser-v2/consideration-equity.js",
    "pages/api/provisions.js",
    "components/review/ElectionCard.jsx",
    "components/review/ConsiderationTables.js",
    "tests/schema/elections/*.test.js",
    "WORKLOG-P0.5.md",
    "docs/reprocess/round-3.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*"],
  "market_registry_additions": [
    "deal.consideration.electionAvailable",
    "deal.consideration.electionType",
    "deal.consideration.electionDeadline"
  ]
}
```

```json
{
  "phase": "1",
  "name": "consideration-and-employee-equity",
  "allowed": [
    "components/review/ConsiderationSection.jsx",
    "components/review/ConsiderationHeroRow.jsx",
    "components/review/EmployeeEquityTable.jsx",
    "components/review/EsppTable.jsx",
    "components/review/ConsiderationTables.js",
    "lib/queries/review-deal.js",
    "pages/review/[id].js",
    "tests/review/phase-1-consideration.spec.js",
    "WORKLOG-P1.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*"],
  "market_registry_additions": [
    "deal.consideration.exchangeRatioType",
    "deal.consideration.perShareCashComponent",
    "deal.consideration.perShareStockComponent"
  ]
}
```

```json
{
  "phase": "2",
  "name": "rw-and-aoc-final-rewrite",
  "allowed": [
    "components/review/AocRow.jsx",
    "components/review/RwTargetTable.jsx",
    "lib/queries/aoc.js",
    "db/migrations/",
    "tests/review/phase-2-rw-aoc.spec.js",
    "WORKLOG-P2.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*"],
  "market_registry_additions": ["deal.rw.lookback"]
}
```

```json
{
  "phase": "3",
  "name": "material-contracts-ioc-target-nosol",
  "allowed": [
    "components/review/MaterialContractsTable.jsx",
    "components/review/IocTargetSection.jsx",
    "components/review/NosolSection.jsx",
    "lib/vocab/threshold-qualitative.js",
    "lib/vocab/superior-proposal-limbs.js",
    "lib/vocab/nosol-carveouts.js",
    "lib/queries/ioc-target.js",
    "lib/queries/nosol.js",
    "lib/parser-v2/classify.js",
    "scripts/audit/ioc-scope-mismatch.js",
    "scripts/canonical-sweep/threshold-qualitative.js",
    "scripts/canonical-sweep/superior-proposal-limbs.js",
    "scripts/canonical-sweep/nosol-carveouts.js",
    "reports/canonical-sweep/phase-3-*.md",
    "db/migrations/",
    "tests/review/phase-3-*.spec.js",
    "WORKLOG-P3.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*", "docs/vocab/FROZEN-*"],
  "market_registry_additions": []
}
```

```json
{
  "phase": "4",
  "name": "antitrust-final-rewrite",
  "allowed": [
    "components/review/AntitrustSection.jsx",
    "components/review/AtPullRefileRow.jsx",
    "components/review/AtClearSkiesRow.jsx",
    "components/review/AtCapsRow.jsx",
    "lib/vocab/at-pull-refile-restrictions.js",
    "lib/vocab/at-clear-skies-limbs.js",
    "lib/citable.js",
    "components/review/shared.js",
    "components/review/FullDocumentView.js",
    "pages/review/[id].js",
    "scripts/canonical-sweep/at-pull-refile.js",
    "scripts/canonical-sweep/at-clear-skies.js",
    "scripts/lint/closing-condition-scope.js",
    "reports/canonical-sweep/phase-4-*.md",
    "docs/vocab/antitrust-caps.md",
    "docs/vocab/antitrust-litigation.md",
    "tests/review/phase-4-antitrust.spec.js",
    "WORKLOG-P4.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*", "docs/market-registry/FROZEN-*", "docs/vocab/FROZEN-*"],
  "market_registry_additions": [
    "deal.antitrust.capStandard",
    "deal.antitrust.litigationObligation",
    "deal.antitrust.controlLeadParty"
  ]
}
```

```json
{
  "phase": "4.5",
  "name": "sidebar-mae-scope-repair",
  "allowed": [
    "components/review/Sidebar.js",
    "lib/sidebar-groups.js",
    "tests/sidebar-mae-single-company.test.js",
    "tests/sidebar-mae-both.test.js",
    "tests/sidebar-mae-empty.test.js",
    "WORKLOG-P4.5.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*"],
  "market_registry_additions": ["deal.mae.appliesTo"]
}
```

```json
{
  "phase": "4.6",
  "name": "iocb-card-parity",
  "allowed": [
    "components/review/IocPartyCard.jsx",
    "pages/review/[id].js",
    "tests/iocb-card-has-affirmative-subtable.test.js",
    "tests/iocb-card-has-negative-subtable.test.js",
    "tests/ioc-card-single-component.test.js",
    "WORKLOG-P4.6.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*"],
  "market_registry_additions": [
    "deal.ioc.buyerHasAffirmativeCovenants",
    "deal.ioc.buyerHasNegativeCovenants"
  ]
}
```

```json
{
  "phase": "5",
  "name": "termination-other-covenants-definitions",
  "allowed": [
    "components/review/OutsideDateRow.jsx",
    "components/review/DefinedTerm.jsx",
    "components/review/DefinitionDrawer.jsx",
    "components/review/OtherCovenantsSection.jsx",
    "components/review/EmployeeBenefitsTable.jsx",
    "lib/parser-v2/link-defined-terms.js",
    "lib/queries/definitions-index.js",
    "db/migrations/",
    "scripts/data-fix/reclassify-other-covenants.js",
    "tests/review/phase-5-*.spec.js",
    "WORKLOG-P5.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*"],
  "market_registry_additions": ["deal.termination.outsideDate", "deal.definedTerms"]
}
```

```json
{
  "phase": "6",
  "name": "hero-table-backfill",
  "allowed": [
    "scripts/backfill/hero-table-data.js",
    "lib/parser-v2/extract-advisors.js",
    "db/migrations/",
    "pages/index.js",
    "tests/review/phase-6-hero-backfill.spec.js",
    "WORKLOG-P6.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*"],
  "market_registry_additions": []
}
```

```json
{
  "phase": "7",
  "name": "delete-legacy-renderers",
  "allowed": [
    "components/review/ConsiderationTables.js",
    "components/review/NosolFourTables.js",
    "components/review/EmployeeBenefitsTable.js",
    "components/review/SecMeetingTable.js",
    "components/review/NoOtherRepsFraudTable.js",
    "tests/review/phase-7-legacy-deletion.spec.js",
    "WORKLOG-P7.md"
  ],
  "denied": ["scripts/lint/forbidden-patterns.sh", ".github/phase-allowlists/*", "docs/acks/*"],
  "market_registry_additions": []
}
```

---

# APPENDIX G — VOCAB FREEZE WORKFLOW

Codex never ships a canonical vocab list directly to the renderer. It PROPOSES; the reviewer FREEZES; only FROZEN vocab lands in production code paths.

**Process:**
1. Codex runs the relevant corpus-sweep script and writes the proposed canonical set into `docs/vocab/{name}.md` with `status: PROPOSED-vN` at the top.
2. Codex opens the phase PR as DRAFT, referencing the sweep report.
3. Reviewer edits/approves the set and commits `docs/vocab/{name}.md` with `status: FROZEN-vN`. This file is reviewer-owned from that point forward (Appendix J) — Codex never edits a FROZEN file.
4. Codex converts the PR to ready and wires the renderer to read only the FROZEN set.

**CI enforcement:**

```js
test('no PROPOSED vocab used in production', () => {
  const vocabFiles = glob.sync('lib/vocab/**/*.js');
  vocabFiles.forEach(f => {
    const src = fs.readFileSync(f, 'utf-8');
    if (src.includes('status: "PROPOSED"') || src.includes("status: 'PROPOSED'")) {
      const referenced = grepAcrossRepo(path.basename(f, '.js'));
      const productionReferences = referenced.filter(r =>
        !r.file.startsWith('scripts/') &&
        !r.file.startsWith('tests/') &&
        !r.file.startsWith('reports/')
      );
      expect(productionReferences).toHaveLength(0);
    }
  });
});
```

**Vocab sets Codex must PROPOSE (never ship directly) under this WP:**

| Vocab set | Values (minimum) | File |
|---|---|---|
| Antitrust caps standard | `COMPANY_MAE`, `BURDENSOME_CONDITION`, `SUBSTANTIAL_DETRIMENT`, `MATERIAL_ADVERSE_EFFECT_ON_COMBINED`, `OTHER` (5 values) | `docs/vocab/antitrust-caps.md` |
| Antitrust litigation obligation | `FINAL_JUDGMENT`, `DEFEND_NO_APPEAL`, `NO_OBLIGATION`, `NOT_EXTRACTED` (4 values) | `docs/vocab/antitrust-litigation.md` |
| MAE applies to | `COMPANY_ONLY`, `PARENT_ONLY`, `BOTH`, `NA` (4 values) | `docs/vocab/mae-applies-to.md` |
| Consideration headline type | `CASH_ONLY`, `STOCK_ONLY`, `MIXED`, `MIXED_ELECTION`, `CASH_ELECTION`, `STOCK_ELECTION`, `OTHER` (7 values) | `docs/vocab/consideration-headline.md` |
| Exchange ratio type | `FIXED`, `FLOATING`, `NA` (3 values) | `docs/vocab/exchange-ratio-type.md` |
| Election type | `CASH_ELECTION`, `STOCK_ELECTION`, `MIXED_ELECTION`, `NA` (4 values) | `docs/vocab/election-type.md` |
| What does not constitute Acquisition Proposal | `Rule 14d-9 required disclosure`, `Required by law`, `Public statement of proposal receipt with recommendation reaffirmation` (canonical pill set) | `lib/vocab/nosol-carveouts.js` |
| Efforts standards | `BEST_EFFORTS`, `COMMERCIALLY_REASONABLE`, `REASONABLE_BEST_EFFORTS`, `REASONABLE` (4 values) | `docs/vocab/efforts-standards.md` |
| IOC other-exclusions | `OTHER_SPECIFIC`, `FREEFORM` (2 values) | `docs/vocab/ioc-other-exclusions.md` — **FROZEN-v1** in G.1 below |
| R&W SEC filings portions-excluded | `SEC_REPORTS_GENERAL`, `SEC_REPORTS_FORWARD_LOOKING_EXCLUSION`, `SEC_REPORTS_WITH_DISCLOSURE_SCHEDULE`, `SEC_REPORTS_FACE_OF_DISCLOSURE_LIMIT`, `SEC_REPORTS_SPECIFIC_DATE_RANGE`, `SEC_REPORTS_ITEM_404_RELATED_PARTY`, `FREEFORM` (7 values) | `docs/vocab/rw-sec-filings-portions-excluded.md` — **FROZEN-v1** in G.1 below |
| R&W general lookback scopes | `BALANCE_SHEET_DATE`, `ABSOLUTE_DATE`, `SIGNING_DATE`, `SEC_REPORTS_DATE_RANGE`, `MOST_RECENT_FISCAL_YEAR_END`, `OTHER_SPECIFIED_DATE`, `FREEFORM` (7 values) | `docs/vocab/rw-general-lookback-scopes.md` — **FROZEN-v1** in G.1 below |

Each proposed set goes into `docs/vocab/{name}.md` as `PROPOSED-vN`. Reviewer commits `FROZEN-vN`. Only `FROZEN` vocab may land in the renderer. This is identical discipline to Appendix A's market-field freeze — vocab and fields both require a human sign-off gate before production use.

---

## G.1 — Reviewer-frozen vocab seeds (this WP)

The following three vocab sets are **FROZEN-v1** by reviewer decision, dated 2026-07-06, on the basis of the canonical-sweep reports produced earlier in this WP and a full `npm test` passing on HEAD (`014f5ee`, 904 tests). Codex MUST NOT re-propose or edit these three sets — they land straight into `lib/vocab/*.js` and their FROZEN mirror files under `docs/vocab/`.

Ordering in each `*_CANONICAL` array is intentional and drives pill ordering in the review UI. Preserve it.

### G.1.1 IOC other-exclusions — FROZEN-v1

Collapse `Other specific exception (see text)` and `Other specific exception` into a single `OTHER_SPECIFIC` bucket. `(see text)` is a stringification artifact of a stage-1 pass, not a distinct legal category.

**Requirement:** the `OTHER_SPECIFIC` bucket MUST carry the original per-provision text through to the review UI as a hover-full-text on the pill — the vocab key normalises the classifier; the source text is preserved on the row, not on the vocab label. Losing source text on merge would be worse than the pre-freeze state.

`lib/vocab/ioc-other-exclusions.js` — final:

```js
const IOC_OTHER_EXCLUSIONS_CANONICAL = [
  { key: 'OTHER_SPECIFIC', label: 'Other specific exception (source text preserved on provision)' },
  { key: 'FREEFORM',       label: 'Freeform / deal-specific exclusion' },
];

module.exports = { IOC_OTHER_EXCLUSIONS_CANONICAL };
```

### G.1.2 R&W SEC filings portions-excluded — FROZEN-v1

Seven buckets. `WITH_` prefix dropped where redundant. `SEC_REPORTS_FORWARD_LOOKING_EXCLUSION` covers the class (forward-looking / risk-factor / cautionary) rather than the risk-factor sub-instance — the risk-factor phrasing must appear in the alias table (§ G.1.4) but is not a separate bucket. Item 404 keeps its own bucket because 10-K Item 404 carve-outs consistently signal a related-party diligence cleanup.

`lib/vocab/rw-sec-filings-portions-excluded.js` — final:

```js
const RW_SEC_FILINGS_PORTIONS_EXCLUDED_CANONICAL = [
  { key: 'SEC_REPORTS_GENERAL',                    label: 'SEC Reports — general carve-out' },
  { key: 'SEC_REPORTS_FORWARD_LOOKING_EXCLUSION',  label: 'SEC Reports — forward-looking / risk-factor / cautionary language excluded' },
  { key: 'SEC_REPORTS_WITH_DISCLOSURE_SCHEDULE',   label: 'SEC Reports — read together with Disclosure Schedule' },
  { key: 'SEC_REPORTS_FACE_OF_DISCLOSURE_LIMIT',   label: 'SEC Reports — limited to face of the disclosure' },
  { key: 'SEC_REPORTS_SPECIFIC_DATE_RANGE',        label: 'SEC Reports — limited to specified date range' },
  { key: 'SEC_REPORTS_ITEM_404_RELATED_PARTY',     label: 'SEC Reports — Item 404 / related-party carve-out' },
  { key: 'FREEFORM',                               label: 'Freeform / deal-specific exclusion' },
];

module.exports = { RW_SEC_FILINGS_PORTIONS_EXCLUDED_CANONICAL };
```

### G.1.3 R&W general lookback scopes — FROZEN-v1 (paired with a data-bug fix)

`[object Object]` in the sweep report is a data bug, not a vocab entry.

**Root cause.** `scripts/canonical-sweep/rw-general-lookback-scopes.js` L15 calls `addPhrase(map, value, context)` while `value` is still an object (the nested `{ scope, lookbackScope, … }` shape), so `addPhrase`'s `String(value)` coercion emits `[object Object]`.

**Fix.** In `collect(...)`, when `typeof value === 'object'`, DO NOT `addPhrase(map, value, ...)`; only recurse into the nested keys. Concretely, delete the line `addPhrase(map, value, context);` inside the `if (typeof value === 'object')` branch. That single removal kills the artifact repo-wide.

**MUST land in the same PR as the vocab file** — the sweep re-run is what validates the alias table. Do not split.

`lib/vocab/rw-general-lookback-scopes.js` — final:

```js
const RW_GENERAL_LOOKBACK_SCOPES_CANONICAL = [
  { key: 'BALANCE_SHEET_DATE',           label: 'Since Balance Sheet Date' },
  { key: 'ABSOLUTE_DATE',                label: 'Since specified absolute date' },
  { key: 'SIGNING_DATE',                 label: 'Since signing / date of Agreement' },
  { key: 'SEC_REPORTS_DATE_RANGE',       label: 'Since SEC Reports lookback window' },
  { key: 'MOST_RECENT_FISCAL_YEAR_END',  label: 'Since most recent fiscal year-end' },
  { key: 'OTHER_SPECIFIED_DATE',         label: 'Since other specified/defined date' },
  { key: 'FREEFORM',                     label: 'Freeform / deal-specific scope' },
];

module.exports = { RW_GENERAL_LOOKBACK_SCOPES_CANONICAL };
```

`MOST_RECENT_FISCAL_YEAR_END` is provisional: if the post-fix sweep shows <3 hits across the corpus, Codex opens a follow-up PR folding it into `OTHER_SPECIFIED_DATE` and updating the alias table. This is the only bucket in G.1 permitted to be revisited without a fresh reviewer freeze.

### G.1.4 Cross-cutting requirements for all three G.1 vocab sets

1. **Alias tables required.** Each vocab file ships alongside a sibling `lib/vocab/{name}-aliases.js` exporting a case-insensitive alias map from raw sweep-report phrases to canonical keys. Seed the alias map from the exact strings in `reports/canonical-sweep/{name}.md`. Aliases are the ONLY route by which stored freeform values classify — no ad-hoc regex in the renderer.
2. **Coverage test per vocab file.** Add `tests/vocab/{name}.test.js`: every raw phrase in `reports/canonical-sweep/{name}.md` MUST map to a canonical key OR to `FREEFORM`. No silent drops. This is a blocking test for Phase 2 and Phase 3.
3. **Read-time classifier only.** These three vocab sets are read-time classifiers over stored freeform values. Do NOT trigger a corpus-wide reprocess to normalise historical rows. Reprocess ONLY if the post-fix sweep exposes gaps the alias table cannot close — and only then under Appendix I discipline.
4. **`OTHER_SPECIFIC` source-text preservation (G.1.1).** Ship a snapshot test asserting that a provision classified `OTHER_SPECIFIC` renders both (a) the canonical pill and (b) the original per-provision text on hover. Losing (b) is a merge-blocking regression.
5. **Same-PR discipline for G.1.3.** CI blocks any PR that changes `lib/vocab/rw-general-lookback-scopes.js` without also touching `scripts/canonical-sweep/rw-general-lookback-scopes.js`. Add an entry to `.github/phase-allowlists/phase-2.json` covering both files.


---

# APPENDIX H — WORKLOG CONTRACT + ACK CONTRACT

## H.1 ACK-MASTER-V1.md — byte-exact contract

Before touching any file under this WP, Codex commits `ACK-MASTER-V1.md` at repo root containing, byte-exact (including trailing newline), the following text. The reference copy lives at `docs/acks/ACK-MASTER-V1.reference.md`, committed by the reviewer — Codex replicates it, never edits the reference file itself.

```
I acknowledge master straitjacket WP-MASTER-V1. I will:
1. Not touch any file outside the phase allowlist.
2. Emit WORKLOG-P{phase}.md with CODEX_MODEL_UNCHANGED:TRUE, TESTS_SKIPPED:0, TESTS_ONLY:0 for every phase.
3. Not weaken any test. Not skip any test. Not add TESTS_ONLY test files without a review-blocking fixture.
4. Not extend scripts/lint/forbidden-patterns.sh. Not modify .github/phase-allowlists/*. Not modify docs/vocab/FROZEN-* or docs/market-registry/FROZEN-*. Not modify docs/acks/ACK-MASTER-V1.reference.md.
5. Not switch LLM model. Not change any model call parameter without an explicit reviewer request.
6. Emit BLOCKED-P{phase}.md if I cannot complete a phase, rather than half-shipping.
7. Only propose new market fields under Appendix A rules; every new field ships with a resolver and per-state test_deal_ids.
8. Only PROPOSE new vocab sets under Appendix G rules; never land unfrozen vocab in the renderer.
9. Route every substantive-table row label through <TermCell>. No raw <button> labels for these tables.
10. Not emit any string in Appendix D (forbidden-pattern grep) anywhere in the codebase.
11. Not merge Phase N+1 until Phase N tag is present in git log.
12. Not use TypeScript. Repo is JS/JSX. No .ts or .tsx files added or converted.
13. Not add npm dependencies. No version bumps.
14. Not merge until all 7 cross-cutting invariants in Appendix E pass.
15. Every phase involving reprocess ends with docs/reprocess/round-{phase}.md attached to the PR.
```

**CI test:**

```js
test('ACK-MASTER-V1.md matches reference verbatim', () => {
  const ack = fs.readFileSync('ACK-MASTER-V1.md', 'utf-8').trim();
  const ref = fs.readFileSync('docs/acks/ACK-MASTER-V1.reference.md', 'utf-8').trim();
  expect(ack).toBe(ref);
});
```

Missing or non-matching `ACK-MASTER-V1.md` blocks every PR under this WP until fixed. This is checked before the phase-order lock, before the allowlist check, before everything — it is the gate on the gate.

## H.2 Phase-order lock

```js
test(`Phase ${phase}: prior phases merged`, () => {
  const priorPhases = {
    '0': [], '0.5': ['0'], '1': ['0','0.5'], '2': ['0','0.5','1'],
    '3': ['0','0.5','1','2'], '4': ['0','0.5','1','2','3'],
    '4.5': ['0','0.5','1','2','3','4'], '4.6': ['0','0.5','1','2','3','4','4.5'],
    '5': ['0','0.5','1','2','3','4','4.5','4.6'],
    '6': ['0','0.5','1','2','3','4','4.5','4.6','5'],
    '7': ['0','0.5','1','2','3','4','4.5','4.6','5','6']
  };
  for (const p of priorPhases[phase]) {
    expect(gitLogHasMergedTitle(`WP-MASTER-V1 Phase ${p}`)).toBe(true);
  }
});
```

Every phase PR title MUST begin with `WP-MASTER-V1 Phase {N}` exactly, so this grep works. `git log --oneline` must show phase N's tag before phase N+1 opens.

## H.3 Per-phase WORKLOG contract

Every phase produces `WORKLOG-P{phase}.md` at repo root with, at minimum:

```
# WP-MASTER-V1 Phase {N} Worklog

## Files added
- <path>: <one-line reason>

## Files modified
- <path>: <one-line reason>

## Files deleted
- <path>: <one-line reason>
(or: NONE)

## Deviations from brief
- (NONE, or exact section cited + how/why deviated)

## Model check
CODEX_MODEL_UNCHANGED: TRUE

## Test check
TESTS_ADDED: <n>
TESTS_SKIPPED: 0
TESTS_ONLY: 0

## Files touched
FILES_TOUCHED: <full list>
FILES_OUTSIDE_ALLOWLIST: <MUST be empty>

## Cross-cutting invariants (Appendix E)
CROSS_CUTTING_INVARIANTS_PASS:
1. npm run test: PASS
2. ioc-scope-mismatch.js: PASS
3. closing-condition-scope.js: PASS
4. forbidden-patterns.sh: PASS
5. market-registry-completeness.js: PASS
6. component-reuse.js: PASS
7. party-scope-audit.js: PASS

## ACK
ACK_MASTER_V1_SHA256: <sha256 of ACK-MASTER-V1.md>

## Reprocess (if applicable to this phase)
REPROCESS_LOG: docs/reprocess/round-{N}.md
```

**CI test:**

```js
test(`Phase ${phase}: worklog present and valid`, () => {
  const path = `WORKLOG-P${phase}.md`;
  expect(fs.existsSync(path)).toBe(true);
  const src = fs.readFileSync(path, 'utf-8');
  expect(src).toMatch(/CODEX_MODEL_UNCHANGED:\s*TRUE/);
  expect(src).toMatch(/TESTS_SKIPPED:\s*0/);
  expect(src).toMatch(/TESTS_ONLY:\s*0/);
  expect(src).toMatch(/FILES_OUTSIDE_ALLOWLIST:\s*$/m); // must be empty
  expect(src).toMatch(/## Deviations from brief/);
});
```

Lying about `TESTS_SKIPPED: 0` is caught by the forbidden-patterns grep (`.skip(`, `.only(`, `xit(`). Lying about model-unchanged is caught by the runtime model-probe check (Part 1, constraint 3). There is no path to a false "done."

---

# APPENDIX I — REPROCESS INSTRUCTIONS

Before Phase 0.5 opens, run these reprocess steps (via the existing ingest-reprocess job) and attach the combined log as `docs/reprocess/round-3.md` to the Phase 0.5 PR:

1. **Reprocess Skechers** (`af4940e1-a645-437c-acfa-4a53e8d9f7ac`) **consideration.** Confirms `MIXED_ELECTION`, `Fixed` exchange ratio, and Election Deadline all surface via `<ElectionCard>`.
2. **Reprocess Chevron/Anadarko** (`dc042001-b987-404f-bd02-41e1939fb914`) **consideration + antitrust.** Confirms the cash+stock hero-row merge and the Stock Consideration Mechanics scope filter both apply cleanly; confirms Caps & Limits and Litigation obligation resolve to single canonical values.
3. **Reprocess Mr. Cooper** (`8cd0787f-4ca0-40fe-aebf-6f88c0b101da`) **IOC + employee-benefits + termination.** Confirms IOC-B card parity, the Employee Benefits column swap, and the Termination outside-date pill all resolve correctly.
4. **Reprocess Metsera** (`885edae5-49e8-464a-9f33-edd229119d7c`) — already covered by Phase 0's WP-SCHEMA-03 wire-up; no separate action needed here beyond confirming ≥50 `provision_cards` rows exist.

`docs/reprocess/round-3.md` format: one section per deal, each listing what was reprocessed, before/after state, and any residual flags for QA.

---

# APPENDIX J — EXPLICIT NON-SCOPE

Codex may never touch the following, under any phase, under any justification. Any file matching these paths in a diff is grounds for reviewer revert, independent of whether tests pass.

- `styles/` — no CSS-only PRs until the Phase 5 tag is merged. Cosmetic cleanup batches only after Phase 5.
- `scripts/lint/forbidden-patterns.sh` — reviewer-owned.
- `.github/phase-allowlists/*` — reviewer-owned.
- `docs/acks/ACK-MASTER-V1.reference.md` — reviewer-owned.
- `docs/vocab/FROZEN-*` — reviewer-owned; Codex may create `PROPOSED-*` files but never edit a `FROZEN-*` file.
- `docs/market-registry/FROZEN-*` — reviewer-owned.
- Package dependencies — no additions, no version bumps, in any `package.json`/lockfile.
- Model plan — no changes to LLM plan, model name, or provider, anywhere in the codebase or runtime config.
- `supabase/migrations/` beyond the specific additive migrations cited in each phase's steps above.
- TypeScript conversion — the repo is JS/JSX. Do not rewrite any file in TS. Do not add `.ts`/`.tsx` files.

If Codex believes one of these needs to change, it does not change it. It writes `proposed-amendments/<slug>.md`, explains the finding, and waits for reviewer response — per Part 1, constraint 10.

---

## END OF MASTER STRAITJACKET

Every phase step is file-path specific. Every test name is exact and greppable. Every forbidden pattern has a rationale. Every vocab set and every market field requires a human freeze before production use. Every phase ends in a WORKLOG with a SHA256-verifiable ACK. Every phase is locked behind the one before it in git log. There is no path through this document that lets Codex skip a test, switch a model, expand scope silently, or half-ship a phase without leaving a trail.
