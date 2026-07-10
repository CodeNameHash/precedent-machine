# Handoff — canonical-coding corpus rollout

**For a fresh Claude Code app session. Self-contained: assume no prior conversation.**
Written 2026-07-10. Owner: Ben (monitoring from elsewhere). Main-agent role: Fable/Opus
specs + reviews + audits; production on Codex/Sonnet.

---

## 0. Read these first (in order)

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

- Design docs updated on branch **`worktree-agent-ad1fd7f796326777b`**, 3 doc-only commits
  ahead of `c97a1c9`: `3f418fa`, `1778dd1`, `0cfc145` (canonical-coding docs + PLAN
  rewrite + this handoff). **Not merged, not pushed.** Ben decides when these land on
  `main`. If starting fresh, either continue on a branch off these commits or cherry-pick
  the doc commits after they merge.
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
