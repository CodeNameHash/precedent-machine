# Codex handoff — 2026-08-03 (post-overnight-run)

Self-contained brief for a Codex (gpt-5.x) session picking up the
canonical-v2 extraction program. Assume NO conversation history. Repo:
`precedent-machine` (Next.js + Supabase M&A contract-review app), branch
of record for this work: `claude/claim-definitions-taxonomy-8xy16l`
(develop and push here; `main` is production via Vercel).

## 1. Where the program stands

- PRs #474 (P1 cap-table numerics) and #475 (comparator/lexical-net
  wiring) are MERGED to main. Everything below is on the working branch.
- Working-branch slices committed tonight, each built to an
  audit-amended spec and reviewed (all gates green at every commit):
  - `1ce030c` v1 reclassification CODE ONLY (R1/R2/R3 taxonomy splits,
    retired-code enforcement, anti-reliance element scan). DB applies
    NOT run — gated on Ben.
  - `6a15514` producer-prompt-registry seam (frozen dispatch map +
    two-stage section-family classifier with AI-flagged provenance).
  - `e98695a` termination-fee family (bundle V15, MAPPING_TABLE 5).
  - `ccb2a63` no-shop family (five NOSOL concepts, MAPPING_TABLE 6).
  - `2ead228` MAE-definition family (bundle V16, MAPPING_TABLE 7,
    EDGAR-committed definition fixtures).
  - `aded743` termination-rights family (bundle V17, MAPPING_TABLE 8,
    TERMINATION producer registered).
  - `5cb04d3` P2 qualifier kinds PHASE 1 (six-kind vocabulary,
    front-doors, parsers, validator lockstep — REGISTRY WIRING NOT
    DONE; see Task A).
- Twenty family design specs committed across five waves under
  `docs/superpowers/specs/2026-08-0{2,3}-family-*-design.md`, all
  Status: AUDIT-AMENDED. Specs are the acceptance criteria for builds.
- Current version constants at head: `MAPPING_TABLE_VERSION` 8
  (`lib/canonical-v2/native-producer/candidate-resolution.js`),
  `LEXICAL_FAMILY_LEXICON_VERSION` 5 (`lexical-disagreement-net.js`),
  contract-bundle fixture fingerprints through F17
  (`lib/canonical-v2/contract-bundle.js`),
  `QUALIFIER_KIND_LEXICON_VERSION` 2, `MEASUREMENT_DATE_PARSE_VERSION` 2.

## 2. Non-negotiable conventions (read before writing code)

1. **The spec is the acceptance criteria.** Every slice builds against
   its audit-amended spec file; silent scope-narrowing is the named
   failure mode. If you cannot implement a pin as written, SAY SO in
   your report — an honest gap passes review, hidden narrowing fails.
2. **Never resolve flagged legal-judgment calls.** Items marked
   decide-at-PR / FLAGGED FOR BEN get the spec's default plus a line in
   your report.
3. **Gates before any commit:** `npm test` (0 failures), `npm run
   build`, `bash scripts/lint/forbidden-patterns.sh` (INVARIANT-4),
   `node scripts/verify-codex-program-spec.mjs` (if it fails after your
   change, regen with `--write` and include
   `docs/codex-program/specification-manifest.json` in the commit — it
   passes locally with uncommitted changes but fails in CI otherwise).
4. **Version-pin sweep on any version bump.** If you bump
   MAPPING_TABLE_VERSION / lexicon version / bundle version: grep
   `tests/` for EVERY pin of the old value (version literals, the
   additivity `resolution_receipt_id` literal — current value
   `f43d13ba47d9f71a956dc2e25f425aead98365378754c2fe4ce8ac977817417c`
   — REGISTERED_CONCEPT_KEYS allowlists, F-fingerprint lists), re-pin
   each with a derivation comment, and re-derive the receipt id by
   running the f28-third-run baseline (the pattern is in
   `tests/canonical-v2-v1v2-comparator-wiring.test.js` ~line 240) and
   documenting the exact field-level delta. Three consecutive reviews
   had to finish missed pins — budget for this.
5. **Typed outcomes everywhere.** Parsers never repair, never guess:
   every non-RESOLVED outcome is a typed ABSTAIN routed to review.
   Never write a possibly-undefined value into claim attributes or
   receipts — canonical-JSON hashing throws on undefined (this exact
   bug was fixed at review tonight, candidate-resolution.js TEMPORAL
   open-world push).
6. **`wp/` PR branches are built by cherry-picking the slice commits
   onto fresh `origin/main` in a separate worktree** — never by
   branching the working branch. Each needs
   `.github/phase-allowlists/wp-<name>.json` covering exactly the
   changed files.
7. **Do not touch** `lib/canonical-v2/native-producer/v1v2-comparator.js`
   semantics, M3 protocol text (`docs/codex-program/EXECUTION-LEDGER.md`
   ~190–270), or `lib/rubric.js`/`lib/taxonomy.js` semantics without a
   Fable-reviewed spec.

## 3. Task A (first): P2 qualifier kinds PHASE 2

Spec: `docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md`.
Phase 1 (commit `5cb04d3`) shipped classification front-doors, the
schedule-reference and V2 measurement-date parsers, and the
two-of-three-site validator lockstep. Phase 2 completes the slice:

1. **Registry (bundle V18):** add the `DISCLOSURE_SCHEDULE_CARVEOUT`
   and `PERFORMANCE_VESTING_ASSUMPTION` claim definitions per spec
   section 3 (pointer value type `SCHEDULE_REFERENCE_STRING` — the
   fixture-shape typedDefinition whitelist in contract-bundle.js is the
   THIRD lockstep site the phase-1 test comment explicitly says is not
   yet exercised). Follow the V15/V16/V17 pattern (frozen input spread,
   FROZEN_F18 fingerprint, dedicated `canonical-v2-contract-bundle-v18`
   test, superset-diff by content).
2. **Resolver handlers** in `candidate-resolution.js` minting resolved
   carve-out claims (via `parseScheduleReference`) and
   performance-assumption claims, per spec section 4; route
   `PERIOD_DETECTED` to `parseMeasurementPeriod`
   (measurement-date-parse.js exports it) instead of the phase-1 typed
   open-world stopgap (search comment "P2 phase 1 (Fable build review
   2026-08-03, F-1)").
3. **Receipt:** thread `schedule_reference_parse_version` into
   receiptBody (the spec's additivity item 9) — this changes the
   receipt id; do the full pin sweep (convention 4).
4. **Acceptance item 11:** one resolved carve-out claim (ITEM), one
   performance claim, and one period pair through adapter →
   validate-write-set → publishable write set; malformed
   `3.2(f)@OTHER` rejected.
5. Re-derive replay counts. Phase-1 pinned (all verified against the
   spec's CONVERTS-ON-REPLAY table): F28 5/6/31, Skechers 2/2/37,
   Modiv 4/7/59. Phase 2 will move the Modiv carve-out
   DISCLOSURE_CARVEOUT_PARTIAL rows and the F28 performance rows again
   — re-derive, don't guess, and verify each moved row against the
   spec table. Two review-side routings were accepted at phase-1
   review pending phase-2 verification: +1 CITATION_NOT_VALIDATED @
   Skechers 3.7 and +2 ASSERTION_SCOPE_AMBIGUOUS @ Modiv 3.2 — confirm
   both are the spec-intended routes once the period/carve-out
   handlers land.

## 4. Task B: family builds from committed specs

Build order (file-collision-driven, one at a time, same five-layer
shape as the four shipped families — use the termination-fee slice
`e98695a` as the exemplar diff): antitrust-regulatory-efforts (receipt
gate already PASSED — see its Status header), closing-conditions, IOC,
consideration, then the wave-3/4/5 specs. EXCEPTIONS: dividends
(consider bundling with consideration — tiny), guaranty (needs Ben's
new-code adjudications first — see its spec's flagged items).

## 5. Task C (BLOCKED until Ben's explicit go): v1 reclassification DB applies

Code merged at `1ce030c`; apply order documented in
`scripts/reprocess.js` (comment block "v1 reclassification (2026-08-02)
apply order"): per deal, comparator-fixture deals FIRST
(TopBuild/Skechers/Modiv), classify → extract → extract-to-cards
backfill with `--extraction-version m2-01-reclass-v1` → rematerialize.
Post-apply read-only assertions are in the spec
(`2026-08-02-v1-reclassification-design.md` §4). Do NOT start this
without Ben's written go — it writes to production.

## 6. Environment for Codex sessions

Codex runs in Ben's local terminal. Needed values and where they live
(NEVER commit values to the repo):

- `.env.local` (repo root, gitignored, already on Ben's machine):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (extraction runs use
  the subscription CLI instead where possible), plus app config.
- **Production Supabase project ref: `tzulhdasmioeechxapdy`.** WARNING:
  some environments carry env vars pointing at an EMPTY STAGING
  project — verify before any data work:
  `psql`-free check: `node -e "console.log(process.env.SUPABASE_URL)"`
  must contain `tzulhdasmioeechxapdy`. If not, load the right env file.
- Scripts that touch data take `--env-file <path>`
  (`scripts/backfill/extract-to-cards.js`, `scripts/reprocess.js`,
  ingest/QA scripts) — pass the production env file explicitly rather
  than relying on ambient env.
- Vercel project `deal-corpus` (codenamehashs-projects): production
  env values also live in Vercel → Settings → Environment Variables.
- RLS is enabled and hardened on all production tables (2026-08-02):
  anon key gets 401s by design; service-role key is required for
  script access. Handle accordingly and never weaken policies.

## 7. Ben-gated items (implement nothing for these without his ruling)

DB-applies go (Task C); TERMR-MUTUAL / TERMR-LEGAL concepts and
EITHER_PRINCIPAL_PARTY capacity (termination-rights PR notes);
CAPITAL_STRUCTURE materiality rank 52 (merged in #474, awaiting
confirm); NOSOL fiduciary-tier + day_kind defaults; TopBuild
per-clause disproportionality drafting (MAE
`tests/fixtures/canonical-v2/mae-definition-family/PROVENANCE.json`);
REM-CAP deferral + `bd837f1d…` open-world (specific-performance spec
rulings to ratify); tax-matters covenant re-decide; rank-88 materiality
collision (merger-structure vs appraisal specs); guaranty [PROPOSED]
new v1 codes; proxy-meeting `{CONVENE_OBLIGATION, MEETING_DEADLINE}`
device provenance; whole-letter carve-out banking (P2 out-of-scope
list).
