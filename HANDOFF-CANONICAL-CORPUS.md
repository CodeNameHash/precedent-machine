# Handoff — canonical-coding corpus rollout, then the rest of the plan

**For a fresh Claude Code app session. Self-contained: assume no prior conversation.**
Written 2026-07-10. Owner: Ben (monitoring from elsewhere). Main-agent role: Fable/Opus
specs + reviews + audits; production on Codex/Sonnet.

**Your remit is the whole of `PLAN.md`, not just the corpus task.** § 3 below is the
immediate critical path (canonical-coding corpus, PLAN § 1). When it is done and Ben has
signed off the go/no-go checkpoints, keep going down `PLAN.md`: residual capture (§ 2),
comparison surface (§ 3), extraction gaps (§ 4), then milestones M2 → M3 → M5 → M4. `PLAN.md`
is the standing driver; § 7 of this handoff tells you how to continue past the corpus work
and keep `PLAN.md` current.

---

## 0. Bootstrap (run first)

```bash
# from the repo root
git fetch origin
git checkout canonical-coding-corpus     # doc/plan commits live here, off c97a1c9
git pull --ff-only origin canonical-coding-corpus
npm install
npm test && npm run build                # confirm green baseline before any change
```

If the branch has since merged to `main`, use `main` instead. Do NOT push to `main`;
push feature branches and open PRs for Ben to merge.

## 0b. Read these first (in order)

1. `CLAUDE.md` — routing + watchdog protocol (spec-first, diff review, mechanical gates,
   live verification, two-strike escalation). Every delegated change passes these.
2. `docs/schema-shape/provision-taxonomy-triple-model.md` § 8 — the canonical-coding
   model: concept → code → render, the two altitudes, residual buckets (§ 8.5, proposed),
   provision granularity + identity axes (§ 8.6), two kinds of canonical (§ 8.7).
3. `docs/schema-shape/provision-processing-flow.md` § 7 (pipeline) + § 4 (gaps,
   including GAP-A/B/C corpus-blocking and GAP-E residual-capture proposed).
4. `PLAN.md` — the one-page TO-DO. This handoff executes PLAN § 1 first.
5. `PLAN-CLAIMS-LAYER.md` — detailed claims-layer design (table already built; the
   reprocess-time rematerialize is what's missing).

## 1. Repo / branch state

- Remote: `github.com/CodeNameHash/precedent-machine`. Work branch
  **`canonical-coding-corpus`** (pushed), 4 doc/plan-only commits ahead of `c97a1c9`:
  `3f418fa`, `1778dd1`, `0cfc145`, `d24f2b9` (canonical-coding docs + PLAN rewrite + this
  handoff). No code changed yet. Ben decides when these land on `main` (open a PR when he
  asks).
- `main` tracks production (Vercel). Never push to `main` without Ben.
- Frozen files (Phase-0-C @ `1ea062d`) stay frozen.
- Gate before any merge: `npm test` (node:test) + `npm run build`, both green.

## 2. What's proven vs blocked

**Proven (Metsera, end-to-end):** rubric `list-tagged`/`tagged` flag → `schema-inventory.js`
→ `generate-registry.js` → prompt embeds codebook (`lib/schema/prompt.js`) → extraction
assigns `{code,label,text}` into `provisions.ai_metadata.features` → claims materialize →
`labelForCode` renders a canonical pill (transition-safe fallback). Five Section-B families
wired: `interestRateBasis`, `SOLICITATION_ACT` (shared by `ceaseDiscussionsProhibitedList` +
`changeOfRecommendationItems`), `superiorProposalDeterminer`, `governingLaw`,
`parentAssignmentConditions`.

**Blocked (corpus scale):** `scripts/reprocess.js` writes provisions only and never calls
the claim writer, so `claims` (what the render reads) go stale after reprocess (GAP-A). The
card-rewrite path `scripts/backfill/extract-to-cards.js` fails on NOSOL with
`provision_cards_deal_region_hash_unique` (GAP-B). NOSOL reprocess churns counts (GAP-C).

## 3. Task queue (spec-first; acceptance criteria written before delegating)

Work top-down. Do NOT run `reprocess.js --all` until TASK 1 is proven on ≥3 deals.

### TASK 1 — claims-only rematerialize (GAP-A + GAP-B) [CRITICAL PATH]
- **Route:** Codex (writable spec, deterministic script over Supabase). Fable reviews.
- **What:** a post-reprocess step that re-runs the existing claim writer claims-only (no
  card rewrite). The writer is `storeClaimsForDeal` / `buildClaimRowsForCard` /
  `upsertClaims` in `lib/parser-v2/store-claims.js`. The `claims` table and reader
  (`lib/queries/review-deal.js`) already exist.
- **Anchor on `excerpt_id`**, not `region_id`/`region_hash` (region path is dead: NULL on
  ~98.7% of rows; it is why extract-to-cards fails on NOSOL). Match cards to provisions by
  `short_title == category`.
- **Acceptance:** on a 3-deal pilot (Metsera + 2 others) — (a) card↔provision match covers
  100% of coded features with zero ambiguity; (b) `claims.canonical` populates for the 5
  wired families; (c) idempotent (second run is a no-op, row counts identical); (d)
  `npm test` + `npm run build` green; (e) live: the deal's review page renders the canonical
  pills, verified in-browser, not just built.

### TASK 2 — NOSOL card stability (GAP-C)
- **Route:** Sonnet subagent (DB investigation) → Codex if a dedup script is needed.
- **What:** run NOSOL reprocess repeatedly on the 3 pilot deals; confirm card/claim counts
  are stable. If duplicate cards (Change-of-Rec ×4, Disclosure ×3 seen on Metsera) cause
  drift, add NOSOL provision de-duplication.
- **Acceptance:** counts stable across ≥3 repeated reprocess runs; no new dup cards; QA
  nosol count does not drift.

### TASK 3 — corpus reprocess + rematerialize + regex delete
- **Route:** Sonnet wrapper drives `reprocess.js` per-deal with retries; Fable spot-checks.
- **What:** `reprocess.js --all --types NOSOL,MISC,TERMF --apply` → TASK-1 rematerialize
  across all 40 → verify code population per deal → flip renders off the regex fallbacks and
  delete the regexes (only after codes confirmed corpus-wide).
- **Acceptance:** codes populate on all 40 for the 5 families; quote verification at ZERO
  flags; deal-by-deal parity vs pre-schema reference (`:3010`); Metsera parity gate
  (`PLAN-CLAIMS-LAYER.md` Phase 7) passes.

### TASK 4 — residual capture + feedback loop (GAP-E) [PROPOSED, not corpus-blocking]
- **Route:** Fable specs (design call); Codex implements plumbing.
- **What:** explicit `unclassified`/`other` provision bucket + `OTHER`/verbatim-only feature
  outcome, both captured and flagged to `/admin/schema-loss`; loop residual → review →
  Freeze Gate PR. See taxonomy § 8.5.
- **Acceptance:** a misfit clause lands in the residual bucket, appears in schema-loss, is
  NOT force-mapped; Verbatim byte-preserved.

### TASK 5 — comparison surface: numeric normalization + identity [after TASK 3]
- **Route:** Codex for the normalizer + tests; Fable for the identity/`concept_key` decision.
- **What:** numeric-normalization canonical kind (number + unit) for thresholds/lookbacks/
  survival, distinct from enum coding. Decide whether to promote a stable single-field
  `concept_key` (today the join key is the `(provisions.type, provisions.category)` pair).
- **Acceptance:** round-trip fixtures pass ("$5,000,000"→5000000, "twenty-four (24)
  months"→24, variant forms); a cross-deal range query returns ordered numbers.

**Legal-judgment work (Fable end-to-end, do NOT delegate mechanically):** reps/IOC feature
coding (which features become `list-tagged`/`tagged`, the codebook contents),
`lib/taxonomy.js` / `lib/rubric.js` semantics, extraction-prompt engineering. A
plausible-but-wrong taxonomy reads as correct and corrupts the product.

## 4. Gates (run on every change; from CLAUDE.md watchdog protocol)

- `npm test` + `npm run build` — always.
- `scripts/ingest-qa.js` — anything touching ingest (0 unverified quotes, 0 dup provisions).
- `scripts/eval.js` golden eval — any extraction-prompt change; quote verification at ZERO.
- Live verification in-browser for anything user-facing (build ≠ runtime).
- Two-strike escalation: if delegated output fails review twice, redo on Fable/Opus.

## 5. Guardrails

- Do NOT push/merge to `main` without Ben.
- Do NOT run `reprocess.js --all` before TASK 1 is proven on ≥3 deals.
- Do NOT edit the reps/IOC rubric or codebooks mechanically — that is deliberate legal work.
- Do NOT fabricate a canonical: null canonicalKey stays null; residuals are flagged, never
  coerced.
- Residual capture (GAP-E / TASK 4) is PROPOSED — do not describe it as existing.
- Frozen files stay frozen; new freeze gate only when a milestone requires one.

## 6. Monitoring checkpoints (for Ben, from elsewhere)

- After TASK 1: ask for the 3-deal pilot report — match coverage %, canonical-populated %
  per family, idempotency result, and a screenshot of one deal's canonical pills.
- Before TASK 3 fires `--all`: explicit go/no-go — confirm TASK 1 + 2 acceptance met.
- After TASK 3: the corpus verification table (codes per deal per family) + the Metsera
  parity report (legacy signal → new-page location; zero unexplained drops).
- Any legal-judgment call (reps/IOC codebooks, `concept_key` decision, residual vocab):
  surfaced to Ben before it lands, not decided by a cheap model.

## 7. Continuing past the corpus work (drive the rest of PLAN.md)

Once TASK 1–3 are done and Ben has signed off, do not stop. `PLAN.md` is the standing
backlog; work it top-down, keeping the same spec-first + gated discipline. Order:

1. **PLAN § 2 — residual capture (GAP-E / TASK 4).** Proposed; Fable specs the design,
   Codex implements the plumbing.
2. **PLAN § 3 — comparison surface (TASK 5).** Numeric-normalization canonical kind; the
   `concept_key` decision; then reps/IOC feature coding (Fable-authored legal work — declare
   the closed features `list-tagged`/`tagged`, author codebooks, golden-eval-gated).
3. **PLAN § 4 — extraction gaps** (`PLAN-EXTRACTION-GAPS.md`): Material-Contracts trigger,
   IOC standard + 5.01(i)–(o) classification, third-party-beneficiary mapping bug,
   `effectiveTimeShort` corruption, per-rep bring-down mis-stamp.
4. **Milestones M2 → M3 → M5 → M4** (PLAN "Milestones remaining"). M2 (schema deployed
   corpus-wide) is largely the payoff of TASK 3. M3 folds the claim writer into the ingest
   persist stage so fresh deals render at the Claim level (`PLAN-CLAIMS-LAYER.md` Phase 4–5).
   M5 is UI homogenization + demo polish. M4 (query surface) is last, built on the `claims`
   substrate. Detailed sub-plans: `PLAN-M2-schema-deploy.md`, `PLAN-M3-ingest-seamless.md`,
   `PLAN-M5-ui-homogenized.md`, `PLAN-M4-query.md`; taxonomy gaps G1–G11 in
   `PLAN-TAXONOMY-GAPS.md`.

**Keep the plan current.** As work lands, delete done items from `PLAN.md` (it tracks only
open work) and update `processing-flow-gaps.json` gap `status` fields. When a new gap is
found, add it to the flow doc § 4 + the gaps JSON (parser-safe format — see the two admin
docs). Open a PR per shippable unit; let Ben merge. Re-read `PLAN.md` at the start of each
session so you always resume from the current front of the backlog.

## 8. Paste-into-a-fresh-session prompt

Give the new Claude Code app session this, verbatim:

```
You are the main agent (Fable/Opus) for the Precedent Machine repo. Read, in order:
HANDOFF-CANONICAL-CORPUS.md, then CLAUDE.md, then PLAN.md, then
docs/schema-shape/provision-taxonomy-triple-model.md and
docs/schema-shape/provision-processing-flow.md. Run the Bootstrap in the handoff § 0 to
get a green baseline. Then execute the task queue in handoff § 3 starting at TASK 1
(claims-only rematerialize), following the watchdog protocol in CLAUDE.md: write
acceptance criteria before delegating, route production to Codex/Sonnet, review every
diff, run the gates (npm test + npm run build, plus ingest-qa / golden eval where noted),
verify live in-browser. Do NOT run reprocess.js --all until TASK 1 is proven on 3 deals.
Do NOT push to main or make legal-judgment taxonomy calls without me. Stop at each
go/no-go checkpoint in handoff § 6 and report. When the corpus work is signed off,
continue down PLAN.md per handoff § 7 and keep PLAN.md current.
```
