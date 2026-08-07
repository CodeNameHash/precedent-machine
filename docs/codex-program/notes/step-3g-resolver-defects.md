# Step 3G — four located resolver defects

All four fixes live in `lib/canonical-v2/native-producer/candidate-resolution.js`.
Two ship with new sibling lexicon files (`general-covenant-corroboration.js`,
`tax-cooperation-corroboration.js`), matching the shape of
`ioc-corroboration.js` as the plan asked. Every before/after number below was
produced by replaying the named committed `-20260807-replay` run through the
**real** `resolveCandidates` — `run_receipt.json` and `adapter-result.json`'s
`admitted_source_contexts[0]` both loaded verbatim from the committed
evidence directory, zero model calls, zero reconstruction. The harness is
`tests/canonical-v2-step-3g-resolver-defects.test.js`'s `loadAndResolve()`.

## Defect 1 — Material Contracts ANY-threshold (candidate-resolution.js, `materialContractGroundingFailure`)

**Before → after (`modiv-material-contracts-20260807-replay`):** open-world
16 → 7 (**−9**). `MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED` 9 → 0, fully
cleared. `MATERIAL_CONTRACT_BUCKET_UNCORROBORATED` (4) and
`NATIVE_OPEN_WORLD_PROPOSAL` (3) untouched, as expected.

The old gate demanded the literal word "any" sit within 80 characters of
"contract(s)" in the item's own quote, AND `threshold_value === "any"`. Real
Modiv drafting never does this: e.g. `"is a Company Space Lease, Ground
Lease or Company Lease"` (REAL_ESTATE bucket) contains neither word at all —
the chapeau already establishes "any Contract of the following types is
material," so per-item text just states the category. Checked all 11 ANY-
tagged threshold candidates in the run: only 1 of 11 even contains both
words anywhere in the quote (`SEC_ITEM_601`, and still fails the 80-char
proximity requirement) — 10 contain neither, or only one.

Fix: ANY is corroborated when `threshold_value` is literally "any" AND the
quote carries no `MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION` — a real
numeric/percent/count marker (`\$[\d,]+`, a percent literal, or "top N")
that would contradict "no threshold." This is the inverse of a synonym
widening (there is no vocabulary to widen; ANY means absence of threshold
language), but the shape — a named, documented, hostile-tested regex
constant a future reader can find and adjust — is the one `lib/taxonomy.js`
already uses for `MATERIAL_CONTRACT_BUCKET_META.synonyms`.

**Hostile test:** `tests/canonical-v2-step-3g-resolver-defects.test.js`,
`"HOSTILE: a real USD-threshold Material Contract quote does not corroborate
as ANY, even if mistagged"`. Uses the run's own real REAL_ESTATE USD
candidate (`"any real property with a fair market value in excess of
$200,000"`, genuinely tagged `threshold_kind: USD` in the committed run),
forges its `threshold_kind`/`threshold_value`/`canonical_value` to ANY
in-memory, and replays it through the real `resolveCandidates`. It still
refuses: `resolved.length === 0`, `open_world[0].reason ===
'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED'`.

## Defect 2 — General Covenants lexicon (candidate-resolution.js, `generalCovenantGroundingFailure`; new `general-covenant-corroboration.js`)

**Before → after (`modiv-general-covenants-20260807-replay`):** open-world
12 → 1 (**−11**). `GENERAL_COVENANT_CODE_UNCORROBORATED` 11 → 0, fully
cleared — the family stops resolving zero. Remaining 1 is
`NATIVE_OPEN_WORLD_PROPOSAL` (a genuine model decline, untouched).

The old check normalised `lib/rubric.js`'s `CODES[code].label`/`.aliases`
("Access to Information", "Public Announcements; Disclosure", "Notification
of Certain Matters") and required the quote to contain one of those
PRESENTATION strings verbatim. Real operative text never does — Modiv's own
clauses read "give Parent and its authorized Representatives reasonable
access," "shall consult with each other before issuing any press release,"
"shall give prompt notice to Parent." None of the 11 real candidates in the
committed run contained any rubric phrase, so the family resolved zero.

Fix: `general-covenant-corroboration.js`, an 18-code table
(`GENERAL_COVENANT_CODE_PATTERNS`) of operative-text regexes, in the shape
of `ioc-corroboration.js`. The three codes with real candidates in this run
(`COV-ACCESS`, `COV-PUBLICITY`, `COV-NOTIFY`) are grounded and tested
against the run's own quotes; the other 14 have no real candidate yet and
stay deliberately narrow, drawn from each code's own `rubric.js`
`description` (never its label/aliases).

**Hostile test:** `tests/canonical-v2-general-covenant-corroboration.test.js`
— every real Modiv quote (ACCESS, PUBLICITY, NOTIFY) cross-wired against
codes it does NOT belong to (e.g. the real ACCESS quote tested against
PUBLICITY/NOTIFY/CONSENT) all correctly refuse, plus an unknown-code case.

## Defect 3 — Representations ACCURACY REVIEW-routing (candidate-resolution.js, `handleRepresentationQualifierCarrier`)

**Before → after (`modiv-representations-20260807-replay`):** open-world
28 → 18 (**−10**). `REPRESENTATION_QUALIFIER_KIND_NOT_EXACT` 10 → 0, fully
cleared. `REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED` (9, TEMPORAL/THRESHOLD-
tagged qualifiers — PLAN.md Step 3H's explicit territory, not this defect)
and the 9 `NATIVE_OPEN_WORLD_PROPOSAL` prose declines are both untouched.

**Where the plan's "19, not 9" figure does not hold up.** I traced all 19
non-prose-decline open-world entries individually (see the diagnostic in
this session's transcript): 10 are ACCURACY-tagged and 9 are
TEMPORAL/THRESHOLD-tagged. Only the 10 ACCURACY ones go through the code
path this defect actually describes (`classifyQualifierQuote({modelKind:
'ACCURACY'})`, REVIEW folded into `NOT_EXACT`) — every one of them returns
`outcome: 'REVIEW', reason: 'QUALIFIER_KIND_UNCLASSIFIED'`, confirmed by
direct instrumentation. The 9 TEMPORAL/THRESHOLD entries hit a completely
different, unconditional branch (`qualifierKind` not ACCURACY/KNOWLEDGE →
`REPRESENTATION_QUALIFIER_KIND_NOT_GOVERNED`) that never calls
`classifyQualifierQuote` at all and has nothing to do with REVIEW-routing —
it is exactly the "Representations' temporal and threshold qualifiers"
Step 3H already lists as its own, separate, undecided item. So the real
count this defect moves is **10**, not 19; the plan's own "real loss is 19"
note appears to conflate this defect with Step 3H's adjacent gap.

Fix: when `classifyQualifierQuote` returns `outcome: 'REVIEW'` for an
ACCURACY-tagged qualifier, route to `review_queue` via `pushReviewUnresolved`
instead of `open_world`. REVIEW means the classifier recognised marker text
and deliberately declined to pick a family (ambiguity or carve-out doubt) —
never "not a qualifier." Every other non-CLASSIFIED outcome (in practice,
`SPLIT`; `OPEN_WORLD` is structurally unreachable here because
`modelKind: 'ACCURACY'` is itself identity-bearing in
`qualifier-kind-lexicon.js`, so every doubt path upgrades to REVIEW) still
falls through to `REPRESENTATION_QUALIFIER_KIND_NOT_EXACT` unchanged.

**Hostile test:** `tests/canonical-v2-step-3g-resolver-defects.test.js` — the
family-level test asserts every one of the 10 moved candidates lands in
`review_queue` with `has_resolution: false`, `auto_pass: false` (never
silently resolved), and a second test confirms the 9 genuine prose declines
stay in `open_world` and never leak into `review_queue`.

An existing fixture,
`tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js`
(`corpus-cards.json` card `100febba-7cae-42da-99ef-80401f878707`, a real
production-corpus ACCURACY/`MAT_ALL_MATERIAL` excerpt), asserted the exact
old symptom (`open_world.length === 1`, reason `NOT_EXACT`) for a candidate
that independently classifies as REVIEW. Updated in the same change to
branch on the real `classifyQualifierQuote` outcome rather than hardcoding
the pre-fix answer — the file's second REPRESENTATIONS card
(`31826de1-...`) classifies as `SPLIT`, not `REVIEW`, and correctly keeps
the old open-world assertion unchanged, which is why the fix needed a
branch rather than a flip.

## Defect 4 — Tax Matters cooperation lexicon (candidate-resolution.js, `handleTaxMattersCandidate`; new `tax-cooperation-corroboration.js`)

**Before → after (`modiv-tax-matters-20260807-replay`):** open-world 11 → 6
(**−5**). `resolved.length` 0 → 5 (the 4 `TAX_OPINION_COOPERATION` + 1
`TRANSFER_COOPERATION` candidates). `TAX_TREATMENT_KIND_UNCORROBORATED` (3,
`INTENDED_TREATMENT` kind) and 2 remaining `TAX_ASSERTION_OPEN_WORLD`
(`TREATMENT_PROTECTION`, a REIT-status covenant, a different assertion kind
this fix never touches) plus 1 non-native `NATIVE_OPEN_WORLD_PROPOSAL` are
untouched, as the plan itself says to expect ("do not expect this fix to
clear the family").

**Where the plan's bookkeeping is internally inconsistent.** The plan names
the defect as `TAX_OPINION_COOPERATION`/`TRANSFER_COOPERATION`'s hardcoded
regexes (confirmed real: the old check required the literal bigram
`/tax opinion/i`, which appears in none of the 4 real
`TAX_OPINION_COOPERATION` candidates — Modiv's clauses say "Tax
Representation Letter" and "render the opinion," never "tax opinion"
adjacent; and `TRANSFER_COOPERATION`'s old check required the literal word
forms "preparation"/"filing," but Modiv's own clause uses "prepare"/"file"/
"filed," none of which contain those word forms as substrings). But the same
paragraph then says only 3 of the family's 11 open-world entries are "this
defect," naming reason `TAX_TREATMENT_KIND_UNCORROBORATED` — which comes
from a completely unrelated code path (`kind === 'INTENDED_TREATMENT'`,
checking for literal `Section 351`/`Section 368(a)` citations, never
mentioned in the defect's own fix description) — and assigns the 7
`TAX_ASSERTION_OPEN_WORLD` entries (which is exactly where the 4
`TAX_OPINION_COOPERATION` + 2 `TREATMENT_PROTECTION` + 1
`TRANSFER_COOPERATION` failures actually land) to Step 3H instead. Fixing
what the defect actually describes therefore moves 5 items
(`TAX_OPINION_COOPERATION` + `TRANSFER_COOPERATION`), not the stated 3, and
leaves `TAX_TREATMENT_KIND_UNCORROBORATED` (a different, unaddressed defect)
and `TREATMENT_PROTECTION` (Step 3H's territory) both exactly where they
were.

Fix: `tax-cooperation-corroboration.js`, two independent AND-gated pattern
pairs (subject-matter vocabulary + a cooperative-action verb), in the shape
of `ioc-corroboration.js`.

**Hostile test:** `tests/canonical-v2-tax-cooperation-corroboration.test.js`
— both corroborators tested against real filed text from a genuinely
different `TAX_MATTERS` assertion kind (`TREATMENT_PROTECTION`,
`INTENDED_TREATMENT`) and against each other's real quote (Transfer-Tax
vocabulary with no opinion vocabulary, and vice versa), plus two
subject-matter-only-no-action-verb cases (a bare opinion description, a bare
Transfer Tax allocation sentence — real drafting shapes, not cooperation
covenants) — all correctly refuse.

## Totals

| Family | Before | After | Δ |
|---|---|---|---|
| Material Contracts | 16 | 7 | −9 |
| General Covenants | 12 | 1 | −11 |
| Representations | 28 | 18 | −10 |
| Tax Matters | 11 | 6 | −5 |
| **Total** | **67** | **32** | **−35** |

35 ≥ 30 — the acceptance bar is met, not stretched to meet it. (The plan's
own "41 items" framing does not reconcile cleanly against these
independently re-measured numbers — see the per-defect notes above for
where its bookkeeping and mine diverge; 35 is what I actually observed
against the real resolver, not a number chosen to clear a bar.)

## Tests

- `tests/canonical-v2-step-3g-resolver-defects.test.js` — all four
  family-level before/after replays (real `resolveCandidates`, committed
  evidence, zero model calls) + the Material Contracts hostile test + the
  Representations review-routing hostile tests + the aggregate ≥30 check.
- `tests/canonical-v2-general-covenant-corroboration.test.js` — lexicon unit
  + cross-code hostile tests.
- `tests/canonical-v2-tax-cooperation-corroboration.test.js` — lexicon unit
  + cross-kind and subject-matter-only hostile tests.
- `tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js`
  — updated in place (see Defect 3) to branch on the real classification
  outcome instead of a hardcoded pre-fix expectation.

**Targeted runs, exit codes:**
- `CI=true node --test tests/canonical-v2-general-covenant-corroboration.test.js tests/canonical-v2-tax-cooperation-corroboration.test.js tests/canonical-v2-step-3g-resolver-defects.test.js` → `EXIT=0` (25 pass, 0 fail).
- `CI=true node --test` across all 71 existing test files that `grep -rl "candidate-resolution" tests/*.js` finds (every test that touches this module) → `EXIT=0` (757 tests, 743 pass, 14 skipped — pre-existing skips, unrelated to this change — 0 fail).
- `bash scripts/lint/forbidden-patterns.sh` → `EXIT=0`.

## Files touched

- `lib/canonical-v2/native-producer/candidate-resolution.js` (owned this
  Step; header comment updated in the same change, per the module's own
  "FAMILY-SPECIFIC CORROBORATION GATES" paragraph).
- `lib/canonical-v2/native-producer/general-covenant-corroboration.js` (new).
- `lib/canonical-v2/native-producer/tax-cooperation-corroboration.js` (new).
- `tests/canonical-v2-step-3g-resolver-defects.test.js` (new).
- `tests/canonical-v2-general-covenant-corroboration.test.js` (new).
- `tests/canonical-v2-tax-cooperation-corroboration.test.js` (new).
- `tests/canonical-v2-m3-representations-merger-remedies-resolution.test.js`
  (updated: one assertion branch, see Defect 3).
