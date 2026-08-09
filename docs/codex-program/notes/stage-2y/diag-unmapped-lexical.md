# Diagnosis: UNMAPPED_GENERIC_CLAIM_KEY (713) and LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE (635)

Status: IN PROGRESS
Branch: origin/cursor/step-2x-free-phase-b641 (read-only, via `git show`)
Started: 2026-08-09

## Method
- Read code via `git show origin/cursor/step-2x-free-phase-b641:<path>` (read-only, no checkout/edit).
- Parse `evidence/canonical-v2/corpus-review-20260809.html` (3.6MB) with node, not full read.
- Cross-reference `evidence/canonical-v2/*/resolution.json` for raw samples.

## Corpus artifact ground truth

`evidence/canonical-v2/corpus-review-20260809.html` is a static, pre-rendered
list of `-2xk-final`-suffixed runs only (varying suffixes: `-2xk-final`,
`-2xk-r3-final`, `-2xk-r4-final`, etc. — one winning run per deal×family).
Parsed with a regex-based node script (`parse-html.js` in scratchpad),
extracting `<article class="card" data-family=...>` → `<li data-state=...>`
rows. Occurrence counts reproduce the brief exactly:
`UNMAPPED_GENERIC_CLAIM_KEY` = 713, `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` = 635.
Cross-joined against `evidence/canonical-v2/<runDir>/resolution.json` for the
same 27 (UNMAPPED) / 79 (LEXICAL) run directories named in the HTML's own
`.meta` field — joined counts match 713/635 exactly, confirming the HTML
faithfully mirrors the underlying resolution.json for the winning runs.

## 1. UNMAPPED_GENERIC_CLAIM_KEY — where raised, what it means

`lib/canonical-v2/native-producer/candidate-resolution.js`. Five call sites
(`pushOpenWorld({..., reason: 'UNMAPPED_GENERIC_CLAIM_KEY'})`), all downstream
of `lookupGenericClaimKeyMapping(genericClaimKey, deterministicKind,
attachmentPosition)` (line 1141) returning `null` against
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE` (line 736) — i.e. genuinely "no table
entry", not a quote-pinned lookup. Confirmed this is NOT the
ioc-corroboration.js quote-pinned-compatibility-mapping defect: the table is
keyed on `(generic_claim_key, deterministic_kind, attachment_position)` — all
structural/enum fields — never on quote text. That lead does not explain any
of the 713.

**State split: 713/713 = 100% OPEN_WORLD. 0 are HELD.** This code never
appears on a HELD (review_queue) item — it is exclusively an open-world
routing outcome.

**By claim kind** (the coordinator's specific ask):
`NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE` = 707/713 (99.2%).
Remainder: `NATIVE_FRAUD_CARVEOUT_CANDIDATE` 4, `NATIVE_WILLFUL_BREACH_
DEFINITION_CANDIDATE` 1, `NATIVE_INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_
CANDIDATE` 1.

**By family**: REPRESENTATIONS 623, MAE_DEFINITION 84, NO_OTHER_REPS_FRAUD 6.

`LIMB_ASSERTION_CLAIM_KEY` (`lib/canonical-v2/native-producer/anthropic-
provider.js:261`, value `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE`) is
explicitly, deliberately absent from `GENERIC_CLAIM_KEY_RESOLUTION_TABLE`
(candidate-resolution.js line ~720-724: "the bare text of a representation
limb ... carries no canonical_value at all ... the governed vocabulary has no
registered 'a limb was asserted' presence claim for this family"). This is a
correctly-documented, current design decision, not a stale comment — but see
below: the module's own file-header comment (anthropic-provider.js line
28-32) says this key is "minted by BOTH the CAPITALISATION shaper ... and the
REPRESENTATIONS shaper" — that header is now STALE. Grep confirms a third,
unlisted minter: `shapeMaeDefinitionLimbAssertionProposals` (line 2344) also
mints the identical `LIMB_ASSERTION_CLAIM_KEY`, for every `limbs[]` entry
under a `mae_definition_instances` record. This is exactly the CLAUDE.md
"stale header" failure mode, found live.

## Card #936 hypothesis (coordinator's lead) — CONFIRMED, with nuance

The hypothesis that the 713 are "newly-minted limb assertions that carry no
subject-matched claim key because they mint under one fixed capitalisation-
named kind regardless of what the limb is about" is correct for the dominant
707/713. Every representation limb (compliance with law, litigation, ERISA,
SEC filings, financial statements, permits, organization/standing, tax,
environmental, IP, ...) gets the SAME generic `claim_definition_key` —
`NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE` — a name that is a historical
accident (the shaper originated in the capitalisation family and was
generalised to REPRESENTATIONS/MAE_DEFINITION by Step 2X-L without renaming).
This IS by design at the mechanical-shaping layer (anthropic-provider.js's own
header: "one proposal per qualifier/limb assertion/bring-down tier/open-world
candidate, using fixed generic `_CANDIDATE` keys ... NOT legal classification
... deliberately left to a later stage") — but candidate-resolution.js, the
"later stage," never performs that classification either. So the content IS
obvious (see sampling below) and the taxonomy genuinely has no home for it —
this is a real gap, not a routing bug that resolver code alone can close for
free, because no registered claim definition exists to route to.

Each stored candidate DOES already carry `attributes.subject`: a short,
model-written free-text paraphrase of the limb's topic (e.g. "Organisation,
standing and entity power", "SEC filing and furnishing compliance", "ERISA
Plan qualification and penalties or taxes", "compliance of Company Plans with
applicable Laws"). Sampled 40+ of these against raw_value text: the content is
overwhelmingly standard, textbook M&A representation topics — organization/
standing, SEC-document compliance, financial-statement fair presentation,
ordinary-course conduct, permits, ERISA/benefit-plan compliance, litigation/
proceedings, tax. 693/713 carry a subject label; 644 distinct subject strings
(near 1:1 — it is a per-limb paraphrase, not a controlled code). Applying the
coordinator's "obviousness" test (a lawyer could name the clause in one phrase
from its own words) to the sample: the large majority pass — this is not
fragment noise, it is the substantive content of standard reps, currently
captured as verbatim text with nowhere to resolve.

**Checked the unconsumed-vocabulary lead** (`lib/taxonomy.js`, `lib/schema/
features.js`, `lib/category-summary-features.js`) for a ready-made key this
population could route to for free. `lib/taxonomy.js` has no `REP-T-*`
concept family broad enough to cover representation *topics* generally (only
narrow ones like material-contracts buckets). `lib/schema/features.js` (551
features) has exactly 7 `*RepPresent` boolean features (`parentLitigationRep
Present`, `parentBrokersRepPresent`, `parentOwnershipRepPresent`, `solvencyRep
Present`, `sufficientFundsRepPresent`, `topCustomersSuppliersRepPresent`,
`antiRelianceRepPresent`) — a thin, unrelated slice (financing/M&A-specific
reps), not a match for "compliance with law", "ERISA", "SEC filings",
"organization/standing" etc. **Verdict: this is NOT pure curation** — the
concept ("which representation topic does this limb state") has no existing
governed key waiting to be wired up. It needs new claim-definition design.
BUT: because the raw quote AND the model's own subject label are already
stored on every candidate, a fix does not require new model calls — a new
claim definition + a resolver-side lexical classifier (keyword/pattern
matching over the ~20-30 recurring topics, in the same style as the existing
`lexical-disagreement-net.js` lexicon) could be built and validated entirely
by replay. The DESIGN step (which topics get codes, what the canonical_value
enum looks like) is judgment work (Opus/spec-level per CLAUDE.md routing);
the WIRING step, once designed, is free and replay-validatable.

## The MAE_DEFINITION 84 — a distinct, smaller, genuinely free-fixable defect

Checked every one of the 84 MAE_DEFINITION-family unmapped limb assertions
against that same run's resolved claims for exact raw_value text matches
(`agg3.js`/manual dir walk): **59/84 (70%) are byte-identical duplicates of
an already-RESOLVED `MAE_CARVEOUT` / `MAE_DEFINITION_PRONG` / `MAE_
DISPROPORTIONALITY_CARVEBACK` claim in the same run.** Confirmed concretely
on `metsera-mae-definition-20260809-2xk-final`: all 3 of its unmapped entries
exact-match already-resolved MAE_DEFINITION_PRONG raw_value strings.
`shapeMaeDefinitionLimbAssertionProposals` (anthropic-provider.js:2344) walks
the SAME `mae_definition_instances[].limbs[]` array that
`shapeMaeCarveoutAssertion`/`shapeMaeDefinitionProngAssertion` already turn
into properly-classified, resolvable claims — so the same carveout/prong
sentence gets minted twice: once correctly, once as a redundant generic limb
assertion that has no home by construction. **This is pure over-emission
noise — a producer-shaping-layer defect, not a taxonomy gap.**

Remaining 25/84 (30%) are orphans with no matching resolved text —
concentrated entirely in `concho-mae-definition-20260809-2xk-final` (11/11
orphaned; that run has ZERO resolved MAE_CARVEOUT claims at all — the
carveout/prong channel produced nothing for Concho, and the only surviving
copy of the carveout list is the (unmapped) generic limb-assertion channel).
For Concho specifically this is a genuine content-loss risk, not noise:
mae_carveout_assertions/prong_assertions came back empty from the model for
that deal while limbs[] did not — worth flagging as a possible per-deal
extraction miss, but distinguishing "correctly declined" from "silently
dropped" would need the raw provider response (not reviewed here — out of
budget). Uncertain: whether this is a prompt-classification failure specific
to Concho's MAE annex phrasing, or a genuine absence of carveout_code-
classifiable content that argument.

## Fix ranked list — UNMAPPED_GENERIC_CLAIM_KEY (713)

1. **[59 of 713, resolver-side, free, replay-validatable]** Suppress a
   `LIMB_ASSERTION_CLAIM_KEY` open-world entry whose `raw_value` byte-matches
   an already-resolved claim's `raw_value` in the same run/section. Cleanest
   fix point: `candidate-resolution.js`, right before the generic-fallback
   `pushOpenWorld` at line ~10989 — check a same-section resolved-text set
   first. (Alternative, equally free: suppress at the shaper,
   `shapeMaeDefinitionLimbAssertionProposals`, by skipping any limb whose
   `assertion_quote` exactly matches a `carveout_assertions`/`prong_
   assertions` quote already shaped for the same instance — this never calls
   the model, only reshapes the stored response, so it is replay-validatable
   too, just one layer upstream of the resolver.)
2. **[~625-654 of 713 (623 REPRESENTATIONS + up to 25 MAE orphans + 6 NO_
   OTHER_REPS_FRAUD), taxonomy/spec design + free wiring]** Register a
   controlled "representation topic present" claim family and a resolver-side
   lexical classifier over `attributes.subject`/`raw_value`, keyed to the
   ~20-30 recurring textbook topics observed in sampling (organization/
   standing, compliance with law, SEC filings, financial statements, ERISA/
   benefit plans, litigation, tax, permits, environmental, IP, ordinary-
   course conduct, ...). Requires new claim-definition/taxonomy work (Opus/
   spec-level judgment on the code list and canonical_value shape) but NOT a
   prompt change — raw evidence and the subject label are already stored, so
   the classifier can be validated by replay at zero model cost once
   designed. Highest-count fix by far; ranks #1 by volume, #2 here only
   because it needs a design step before it's free.
3. **[≤4-5 of 713, NATIVE_FRAUD_CARVEOUT/WILLFUL_BREACH/INDEPENDENT_
   INVESTIGATION candidates]** Too small a population (6 total across 3 keys)
   to characterise reliably from a handful of samples; likely the same "no
   registered concept for this specific carveout" pattern as #2, at
   negligible count. Not separately prioritised.

## 2. LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE — where raised, what it means

Raised in `candidate-resolution.js` line 4412, inside the lexical-net wiring
pass over already-`resolved` claims (NOT open-world, NOT held):
```
} else if (familyOutcome.outcome === 'LEXICAL_UNMATCHED_SIGNALS') {
  newReasons = Object.freeze([...newReasons, 'LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE']);
}
```
`familyOutcome` comes from `lexicalFamilyOutcomeFromReceipt(receipt, entry.
concept_key)` in `lib/canonical-v2/native-producer/lexical-disagreement-
net.js`. The receipt is built per-section by `matchFamily()` (line 1115):
every literal-phrase/acronym/regex pattern in a fixed lexicon is scanned
against the section's normalised text; each hit is classified MATCHED only if
its byte range overlaps an evidence span belonging to a compiled candidate of
that SAME family in that SAME section; otherwise UNMATCHED, and the family's
whole outcome for that section becomes `LEXICAL_UNMATCHED_SIGNALS` (a single
unmatched hit anywhere flips the whole family). This gate then blocks
`auto_pass` (`gateFailureReasons` at line 4419) but does NOT change the
claim's state — the claim stays `RESOLVED` with a real `resolved_claim_
definition_key`.

**State split: 635/635 = 100% RESOLVED (with auto-pass blocked). 0 HELD, 0
OPEN_WORLD.** This is a third bucket the owner's held/open-world framing
doesn't capture: these claims already reached a governed claim type; the flag
only prevents the stricter "both nets clean" auto-pass status. Fixing this
code does not create new content — it un-blocks already-resolved claims.

**Fan-out**: 635 claim-level flags collapse to **164 distinct (deal, section,
concept_family) root events** — avg ~3.9 resolved claims tainted per root
event, because every resolved claim sharing that concept_key in that section
gets the same flag once the family outcome for that section is `UNMATCHED`.
Fixing the underlying 164 events (not 635 individually) clears all 635.

**By family** (top 5 of 20): NO_SHOP 220 (dominant: NOSOL_PROHIBITED_ACTION
126, NOSOL_EXCEPTION_PREREQUISITE 78), MAE_DEFINITION 108 (MAE_CARVEOUT 78,
PRONG 12, DISPROPORTIONALITY 18), MATERIAL_CONTRACTS 84 (BUCKET_PRESENT 43,
THRESHOLD_STRUCTURE 41), TERMINATION 29, ANTITRUST_REGULATORY 35,
PROXY_MEETING 31, GENERAL_COVENANTS 38.

**Sampled root cause** (`concho-no-shop-20260809-2xk-final`, section 6.3):
inspected the raw `lexical-disagreement.json` receipt directly (not
reconstructable from resolution.json alone — this file carries the full
`disagreement_set` with excerpts). In the no-shop family's own concepts
(NOSOL-PROHIBIT, NOSOL-EXCEPT, NOSOL-NOTICE, NOSOL-MATCH, NOSOL-REMATCH), the
unmatched hits are overwhelmingly repeat occurrences of the SAME defining
phrase ("written notice", "Superior Proposal", "solicit/encourage/
facilitate") recurring many times across one long, single no-shop covenant
that legitimately has ONE representative extracted claim/evidence-span per
concept. E.g. NOSOL-PROHIBIT: 3 matched / 7 unmatched — the lexicon's
`SOLICIT_STEM` regex fires on 10 occurrences of "solicit..." across the whole
6.3 clause (chapeau + multiple sub-clause elaborations of the same
prohibition), while the extracted candidate's evidence span covers only the
chapeau sentence. This reads as **lexicon-side over-triggering on a single,
correctly-captured covenant**, not 7 missed distinct provisions — but I did
not verify this for all 164 roots (bandwidth); it is the pattern in the one
section inspected in depth, and is architecturally what you'd expect any time
a single covenant restates a defined term multiple times within one section
(no-shop, MAE carveout lists, and material-contract bucket lists all have
this shape — the top 3 families by count are exactly the "one long provision,
many phrase recurrences" families).

## Fix ranked list — LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE (635)

1. **[all 635, resolver/lexicon-side, free, replay-validatable]** Tighten
   `matchFamily()` in `lexical-disagreement-net.js`: treat a family as
   "matched" for a section once ANY evidence span for that family in that
   section overlaps ANY pattern hit for a concept the extraction already
   captured, rather than requiring every individual literal-phrase
   recurrence to have its own overlapping span. Concretely: dedupe hits that
   fall within the same sentence/sub-clause as an already-matched hit, or
   score coverage as "concept captured y/n" rather than "hit-by-hit
   overlap". This does not require new model calls (same stored receipts and
   candidates); it is a change to the disagreement-net's own matching
   granularity, replay-validatable against the 164 stored roots directly.
   NOT verified in full for all 164 roots — recommend re-running the
   receipt-build against the 164 (dir, section, concept) tuples after any
   matcher change and confirming the disagreement_set count actually drops,
   rather than assuming from the one section sampled.
2. A residual minority of the 164 roots may be genuine coverage gaps (a
   distinct sub-clause the extraction never produced a candidate for at all,
   as opposed to one already-captured concept restated in prose) —
   uninvestigated at the 164-root level; would need per-root inspection of
   each `lexical-disagreement.json` to separate "same covenant, phrase
   repeats" from "actually a second, uncaptured item." Recommend running
   this as a scripted classification pass (compare disagreement_set excerpts
   against the section's compiled candidate list) before any matcher change,
   since it changes whether the correct fix is #1 (loosen matching) or
   extraction-side (mint the missing second candidate).

## Answer to "how many of the 1,348 are recoverable resolver-side at zero
model cost vs needing a prompt change"

- **UNMAPPED_GENERIC_CLAIM_KEY (713):** 59 free today (MAE duplicate
  suppression). Up to ~654 more (REPRESENTATIONS 623 + MAE orphans ≤25 +
  NO_OTHER_REPS_FRAUD 6) are resolver-side/replay-validatable in principle —
  no new model calls needed because evidence+subject are already stored —
  but require a taxonomy/claim-definition design step first (judgment work,
  not free in the "no thinking required" sense, though zero-cost in model
  calls). Call it **59 free now, ~654 free-after-design, 0 requiring a
  prompt/digest change.**
- **LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE (635):** structurally all 635 (164
  roots) look resolver/lexicon-side and replay-validatable — no candidate
  needs re-extraction, only the matching/scoring logic changes. **Provisional
  635 free**, pending the per-root genuine-gap check in fix #2 above, which
  could reclassify some sub-fraction as needing new candidates (still not a
  prompt change necessarily — could be resolver-visible as a corroboration
  gap — but not verified).
- **Total: 0 of 1,348 require a prompt change on current evidence.** Both
  codes are artifacts of shaping/matching logic downstream of the model
  response, not of what the model was asked to extract. This is a stronger
  claim than the brief expected going in and should be treated as
  provisional on the two explicitly-flagged uncertainties above (MAE Concho
  orphans; LEXICAL per-root gap classification).

