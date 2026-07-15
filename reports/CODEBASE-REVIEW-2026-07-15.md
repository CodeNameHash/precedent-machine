# Precedent Machine — root-and-branch code review (2026-07-15)

Twelve-dimension review + five audits, each finding adversarially re-verified by an
independent Fable pass against the actual code and the live DB. **Every critical/high
finding below was CONFIRMED — zero false positives survived verification.** REFUTED
claims are in the appendix. Nothing here has been auto-changed except the mechanical
fixes listed in §"Landed now"; the rest is queued for Ben.

---

## Executive summary

The corpus and the curation tooling built this week are **sound** — independent review
confirmed 0 claim-orphans of 70,654, solid backup-gating, the classify-only write bug
genuinely fixed, and no broad corpus corruption (1% featureless provisions, all in
types where empty is legitimate). All 40 deals are demo-clean at the API layer.

The risks are older and structural, in four clusters:

1. **Security architecture (CRITICAL, your call).** The API has no authentication layer.
2. **Taxonomy integrity (HIGH).** Model-invented codes are persisted with no validation,
   and the SOLICITATION_ACT scoping the docs promise isn't implemented — both let
   plausible-but-wrong canonicals into the product.
3. **Query surface (CRITICAL, but M4 — not yet demo-path).** A pagination bug limits
   every query to 6 of 40 deals; a type-literal typo mis-scores numeric deltas.
4. **Extraction edge-cases (HIGH, mostly latent).** Alias-matched definitions ship with
   no carve-outs; a bounded hole in the quote-verification gate; provenance-offset
   corruption; and a per-type-reprocess feature-strip that has NOT fired yet but would
   on the next REP/COND reprocess.

Plus a **semantic-correctness audit** (Fable reading clauses against source) that found
specific legal mis-codings — the highest-value input for your taxonomy decisions.

## Health scorecard

| Dimension | Grade | Note |
|---|---|---|
| Curation/rematerialize tooling | A | 0 orphans, backup-gated, well-tested after this week's hardening |
| Data integrity | B+ | triple stays in sync; correction re-matcher is the one real risk |
| Render/frontend | B+ | strong bug-fix history; no XSS; one latent shape-precedence issue |
| Extraction pipeline | B− | works corpus-wide, but 6 confirmed edge-case bugs, mostly latent |
| Taxonomy/canonical | C+ | no persistence-time validation; drift in TAGS; unenforced scoping |
| Semantic correctness | B | 90%+ per family; bring-down/materiality is the weak spot (33/40) |
| Query/comparison (M4) | C | two CRITICAL correctness bugs; deferred surface, so lower urgency |
| Security | D | no auth layer on any route |
| Performance | B− | 7–10 MB review payloads; 492 KB review-page chunk; fixable |
| Accessibility | C | systemic keyboard-inaccessibility; low-contrast token |
| Test coverage | B− | strong on pure logic; script main()/write-paths + API routes untested |
| Tech debt | B | contained; two 20k features files + artifact bloat are the items |

---

## CONFIRMED findings, by severity

### CRITICAL

- **SEC-1 — No auth on any API route.** 39 of 64 routes use the RLS-bypassing service-role
  client with no session check; `pages/api/users.js:14` inserts `is_admin` from the
  request body (self-grant); `pages/api/admin/reprocess-cond.js:212` is an
  unauthenticated destructive delete+reinsert. No middleware, no in-repo gate.
  *Verified unauthenticated read on prod earlier this session.* **Fix: JUDGMENT** —
  needs an auth strategy (Vercel deployment protection may already gate this out-of-repo;
  confirm). → BEN-QUEUE.
- **QRY-1 — `/api/query/run.js` unranged fetch.** No `.range()`, so PostgREST's 1000-row
  cap returns only 1000 of 12,619 provisions, spanning **6 of 40 deals**; every query kind
  silently runs on that slice. Same bug already fixed for `claims` elsewhere. **Fix:
  MECHANICAL** (paginate). *Landing now.*
- **QRY-2 — DEAL_COMPARE compares unrelated concepts.** `lib/query/executors/deal-compare.js:11`
  joins only on card-type family and takes `rows[0]`, so "compare the first REP-T" pits
  Insurance vs IP vs an unclassified rep (30 deals have >1). **Fix: JUDGMENT** (needs the
  concept_key/category-join decision — queue item 8). → BEN-QUEUE.

### HIGH — taxonomy integrity

- **TAX-1 — No freeze gate at persistence.** `store-claims.js:105` copies model codes into
  `claims.canonical` with no validity check; `claims-adapter.js:123` humanizes unknown
  codes into plausible pills. Live-confirmed invented codes: `PRIME_BLOOMBERG`, `INFORM`,
  `PREDICTIVE_FORWARD_LOOKING`, and `BUYER_OPTION_CONSULT` stored under `pullRefile`
  (cross-dictionary leak). **Fix: MECHANICAL gate** (validate against the registry, flag
  invalid to schema-loss); **disposition of each existing invented code: JUDGMENT.**
  *Gate landing now; code dispositions → BEN-QUEUE.*
- **TAX-2 — SOLICITATION_ACT scoping unimplemented.** Docs §8.3 promise per-key code
  subsets (COR codes must never tag the no-shop list); nothing implements it
  (`extract.js:819/823` call both keys with the full codebook). Live: `WITHDRAW_QUALIFY_REC`
  (a COR code) appears ×2 on `ceaseDiscussionsProhibitedList`. **Fix: JUDGMENT** — and the
  verifier flags that the "never" rule may itself be wrong (the leaked spans look like
  genuine agreement text). → BEN-QUEUE.
- **TAX-3 — TAGS hand-vs-generated drift.** `lib/schema/tags.js` is missing all 20 Stage-4
  tags present in `tags.generated.js`; `registry-generated-drift.test.js` guards FEATURES
  only, never TAGS. **Fix: MECHANICAL** (sync + extend the drift test). *Landing now.*
- **TAX-4 — Four `list-tagged` keys have no dictionary** (`absenceOfChangesExceptions`,
  `undisclosedLiabilitiesExceptions`, `negativePreambleExceptions`, `instrumentVesting`):
  no codebook in prompt, no render dict → wholesale invention (one key: 17 distinct
  canonicals, ~15 out-of-vocab). **Fix: JUDGMENT** (author codebooks or de-tag). → BEN-QUEUE.

### HIGH — extraction

- **EXT-1 — Alias-matched definitions ship featureless.** `extract.js:4429` dead filter
  means Strategy-D (alias-matched) definitions never get features; the MAE carve-out pass
  covers inline defs only. Live: 1,698/5,870 DEF rows substantively featureless; **24/68
  DEF-MAE definitions missing carve-outs.** **Fix: MECHANICAL + backfill.** → BEN-QUEUE
  (needs a targeted re-extract; not a blind auto-fix).
- **EXT-2 — Quote-gate fabricated-tail hole.** `verification.js:94` lets a non-elided
  single-fragment quote verify on its first 80 chars, so a genuine head + fabricated tail
  passes the zero-flags gate. Bounded to >80-char quotes with a real contiguous head.
  **Fix: MECHANICAL** (gate the head-fallback on an actual truncation marker). *Landing now.*
- **EXT-3 — Strategy-B provenance-offset corruption.** `extract.js:3647` stamps every
  provision in a multi-section chunk with the first section's `startChar`; no downstream
  repair. Live: 88/108 NOSOL/ANTI/TERMF deal×type groups have ≥5 provisions on one offset.
  **Fix: MECHANICAL** (compute per-section offsets). → BEN-QUEUE (touches extract core;
  spec + golden-eval before landing).
- **EXT-4 — Per-type reprocess strips cross-type features.** `run-extract.js:134`
  reprocesses a type without the cross-type post-passes; 3 of the 4 affected keys are
  MODEL_READONLY so a strip is unrecoverable by reprocess. **Confirmed latent — did NOT
  fire on TASK 3** (features live only on REP/COND/DEF, none on the NOSOL/MISC/TERMF I
  ran). Risk is the next REP/COND per-type reprocess. **Fix: MECHANICAL guard** (run the
  post-passes, or refuse a per-type reprocess of a type carrying MODEL_READONLY features).
  → BEN-QUEUE (guard spec).
- **EXT-5 — `dedupeProvisions` is code-blind.** `store.js:496` drops same-text provisions
  ignoring code, so a second distinct canonical sharing a minimal span is silently lost;
  post-hoc unmeasurable. **Fix: MECHANICAL** (key dedupe on code too). → BEN-QUEUE (store
  core; spec first).

### HIGH — query / data

- **QRY-3 — Numeric deltas scored as strings.** `delta.js:13` returns `'numeric'`;
  `shared.js:57` checks `'number'/'decimal'/…` — never `'numeric'`, so a $2M-vs-$20M gap
  scores MINOR not MAJOR. The unit test masks it by bypassing `fieldKind`. **Fix:
  MECHANICAL** (align the literal + fix the test). *Landing now.*
- **DATA-1 — `reprocess.js --apply` never materializes claims (GAP-A).** The per-type path
  writes provisions only; an operator can ship stale codes with no error. The
  rematerialize is a separate manual step. **Fix: JUDGMENT** (wire rematerialize into
  reprocess, or hard-warn). → BEN-QUEUE.
- **DATA-2 — Correction re-matcher can misgraft.** `reapply-corrections.js:78` Jaccard
  floor 0.3 with a category match, no runner-up margin, no quote re-check; 73% of live
  corrections have lost their `provision_id` anchor and depend on it. **Fix: MECHANICAL
  hardening** (raise floor, require margin, re-verify quote). → BEN-QUEUE (touches human-
  correction safety; spec + review).

### MEDIUM / notable

- **TEST-1** `admin/reprocess-cond.js` destructive route, zero tests (pairs with SEC-1).
- **PERF-1** review API ships 7.5–10.4 MB/deal — `resolvedReferences` embeds full
  definition rows (MAE duplicated dozens of times). Fix: reference pointers. *Mechanical.*
- **PERF-2** review-page client chunk 492 KB from importing the 20k-line features file.
- **RENDER-1** reversed shape-precedence in `card-utils.js:24` vs `table-logic.js:17`
  (latent; only bites a future object feature with a field named `value`).
- **A11Y-1..4** systemic keyboard-inaccessibility (0 `tabIndex`/`role`/`onKeyDown`),
  EditPanel unlabeled inputs, compare tables clip instead of scroll, `text-inkFaint`
  ~2.4:1 contrast. First three mechanical; contrast needs a color decision.

---

## Semantic correctness (taxonomy legal audit) — all → BEN-QUEUE

Fable read clauses against source. Families are 90%+ correct; the exceptions:

1. **Endeavor** superiorProposalDeterminer coded BOARD, should be COMMITTEE (Exec/Special
   Committee clause) — on a conflicted take-private.
2. **Bring-down/materiality is the weak family (33/40).** HireRight + Carrols coded
   *strictest* when the buyer-side "prevent-or-materially-delay" qualifier makes them
   loosest (dictionary lacks that code). **MAT_MAE_QUALIFIED vs MAT_MAE_AGGREGATE applied
   at random** for identical drafting — cross-deal comparison on that split is meaningless;
   merge or re-normalize.
3. **Governing law:** 10 deals carry BOTH a DELAWARE and a SPLIT_FINANCING claim (single-
   value consumers report nondeterministically); SPLIT_FINANCING hardwiring NY
   (`taxonomy.js:1040`) mis-codes M.D.C.'s Japan carve-out as FOREIGN.
4. **Dictionary hygiene:** duplicate labels (two "As disclosed", two "With Parent's
   consent", MAT_DE_MINIMIS twins); "3-month LIBOR" tenor hardwired; INTEREST_RATE_BASIS
   has LIBOR but no SOFR; no OTHER code in any Stage-4 dict while `extract.js:1723`
   mandates "pick the closest available code" (the §8.5 force-fit anti-pattern).

---

## Landed now (mechanical, gated)

See the commits following this report: QRY-1 pagination, QRY-3 numeric-delta + test,
EXT-2 quote-gate tightening, TAX-3 TAGS sync + drift-test, TAX-1 persistence-time
code-validation gate (flag-only, non-breaking), plus tech-debt/a11y quick wins.

## Needs Ben (in BEN-QUEUE-2026-07-15.md, new §13–14)

Security architecture (SEC-1); DEAL_COMPARE join / concept_key (QRY-2); SOLICITATION_ACT
scoping incl. whether the rule is right (TAX-2); the four dictionary-less list-tagged keys
(TAX-4); alias-def re-extract (EXT-1); Strategy-B offset fix (EXT-3); per-type-reprocess
guard (EXT-4); dedupe-by-code (EXT-5); GAP-A wiring (DATA-1); correction-matcher
hardening (DATA-2); and all semantic mis-codings above.

## Appendix — REFUTED / downgraded

None refuted. Downgrades from reviewer claims: EXT-4 "would corrupt corpus" → "latent, did
not fire on TASK 3"; EXT-2 "any fabrication passes" → "bounded to >80-char genuine-head
quotes"; counts refreshed (DEF-MAE 18/46 → 24/68 as corpus grew).
