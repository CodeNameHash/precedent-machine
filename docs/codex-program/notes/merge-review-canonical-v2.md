# Merge review: lib/canonical-v2/** and lib/schema/**

Reviewer: read-only review agent. Branch `claude/codex-handoff-plan-status-77wn7n` vs `origin/main`.
Scope: `lib/canonical-v2/**`, `lib/schema/**` (42 files changed, +7525/-205).

Status: IN PROGRESS — appending as I go.

## Priority targets (per brief)
- [ ] contract-bundle.js (V41, REPRESENTATION_ACCURACY_STANDARD widen+narrow, MAT_MAE_AGGREGATE retirement, resolution.json claim)
- [ ] anthropic-provider.js (REPRESENTATIONS limb shaper — 69 limbs vs 6 assertion nodes vs 0 residuals)
- [ ] qualifier-kind-lexicon.js (v2 -> v3 -> back)
- [ ] ioc-corroboration.js (fail-closed second chance)

## File-by-file notes

### contract-bundle.js (V41)
Net effect of the widen (fee01be1) then narrow: `REPRESENTATION_ACCURACY_STANDARD`
allowed_canonical_values ends at 5 codes (4 original + MAT_MATERIAL_INLINE),
`MAT_MAE_AGGREGATE` never lands in the final state. `claim_definition_version`
correctly stays 1 (verified: origin/main's V1 had the same 4 codes minus
MAT_MATERIAL_INLINE, so this diff's *net* addition is one code, and version
was never bumped for it — deliberate, documented, and does not re-mint
existing claim identities).

BUT: the file's own comment ("No committed V2 resolution.json carries the
retired code") is **false on this branch**, and the branch's own fee01be1
commit message says so explicitly — it just never fixed it.
`evidence/canonical-v2/redhat-representations-20260808-2xl-replay/resolution.json`
is tracked in git (added by 501e2d26) and carries `MAT_MAE_AGGREGATE` 26
times under `claim_definition_version: 1`, i.e. the same version number
current V41 uses for a *different* allowed-value set. `run-manifest.json`
for that run claims `"contract_bundle_version": "compileFixtureContractV41"`
— a false claim, since it was captured while V41 briefly included the code
that was later reverted. Checked `evidence/canonical-v2/baseline-manifest.json`:
this run is already `"importable": false, "import_refusal":
"PUBLISHABLE_SHORTFALL"` for an unrelated reason, so nothing in production
can currently ingest the stale evidence. Not a runtime bug today, but a
stale, self-contradicting artifact sitting in the tree, with the fix
(re-run replay, costs no model call) already identified and not done.
**Follow-up, not a hard blocker** — but should be fixed before merge if a
spare five minutes exists, because it will keep confusing the next reader.

`termination-fee-trigger-path.js`'s V2/V3/V4-aware validation (schema_version
branch) was checked against the file itself — confirmed accurate: V2 effects
validate via the untouched `EFFECT_KEYS`/`allowed_payment_timings` path, V3
via `EFFECT_KEYS_V3`/split trigger-event+delay, V4 reuses `EFFECT_KEYS_V3`
(same key names, different `payment_delay` value shape) validated by
`isWellFormedPaymentDelay`. Sound.

Verdict: **sound**, one stale-evidence follow-up.

### anthropic-provider.js / candidate-resolution.js — the 69-limb question
Traced end to end using the Red Hat replay evidence. Of 69 model-emitted
limbs: 1 has an unverifiable quote and is recorded as a
`PROVIDER_EVIDENCE_RESIDUAL` (`LIMB_ASSERTION_QUOTE_UNVERIFIED`) in
`adapter-result.json.residuals`. The other 68 are **not silently dropped**
— each is written into `write_set.open_world_candidates` with
`attempted_claim_definition_key: "NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE"`
and `reason_code: "UNMAPPED_GENERIC_CLAIM_KEY"`. This matches the module's
own documented design (candidate-resolution.js: "LIMB_ASSERTION proposals:
still open-world as claims, but the tree's path/assertion nodes are included
in the resolution result" — Task 3 work item 6). Separately, 6 of those 68
also feed `limb_component_trees[].assertion_nodes` (a structural pre-pass at
candidate-resolution.js ~line 5907-5963, family-agnostic, keyed only on
`LIMB_ASSERTION_CLAIM_KEY`/`QUALIFIER_CLAIM_KEY`) used for later
qualifier-to-limb attachment. Every one of the 69 is accounted for and
traceable. **Not a blocker.**

Real finding from chasing this: `composeQualifierHostClassification`
(introduced earlier the same day, cceb940e, Stage 3 inheritance-fix work)
carries a comment claiming "no tree (today true for every family except
CAPITALISATION, whose producer is the only one emitting LIMB_ASSERTION
candidates...)". That was true when cceb940e was written but **became false
the moment 501e2d26 (Step 2X-L) landed** — the tree-building pre-pass is
family-agnostic and now genuinely builds trees for REPRESENTATIONS too
(proven: 2 trees, 6 assertion nodes, in a REPRESENTATIONS-only run). That
means `composeQualifierHostClassification`'s host+qualifier composite
inference — built and reasoned about only against CAPITALISATION data — can
now silently activate on REPRESENTATIONS-family qualifier resolution, an
interaction neither commit's own comments or tests account for. In the one
fixture checked, `HOST_COMPOSED_BRING_DOWN_INFERENCE` never actually fires
(0 occurrences), so this is latent, not proven to misfire — but it is
exactly the "behaviour changed without the header comment changing" pattern
this review was asked to look for, produced by two branches merging.
**Should-fix before merge**: update the comment and confirm (a test) whether
composition should be allowed to fire for REPRESENTATIONS, or gate it to
CAPITALISATION explicitly if that was the intent.

Ceiling-overflow detection (`RESPONSE_TRUNCATED_BY_OUTPUT_CEILING`) is
arithmetic-only (`output_tokens >= maxOutputTokens`), checked before any
parsing, never content-based — matches CLAUDE.md's "a family returning zero
can be correct" discipline. Sound.

`shapeOpenWorldCandidate`'s non-object-candidate fix (ee0cd148) verified:
now records `OPEN_WORLD_CANDIDATE_NOT_AN_OBJECT` for any non-empty
string/other candidate before returning null; the true-empty/nullish case
correctly returns null with nothing to record. Sound, matches the brief's
description of the fix.

Verdict: **sound**, one should-fix (stale comment / untested cross-family
interaction), not a hard blocker on its own but worth doing before merge.

### qualifier-kind-lexicon.js (v2 → v3 → v4)
Version and code set are consistent at rest: final `ACCURACY_CODES` excludes
`MAT_MAE_AGGREGATE` (removed at v4, matching contract-bundle.js's final V41
list exactly), includes `MAT_MATERIAL_INLINE`. A load-time assertion loop
throws if any `ACCURACY_CODES` key is missing from `lib/taxonomy.js`
`MATERIALITY_CODES` — fail-fast, not runtime-silent. The MAE-qualifier front
door resolves both the bare and "individually or in the aggregate" forms to
`MAT_MAE_QUALIFIED` only, consistent with the DECISIONS.md reversal.
**Sound.**

### ioc-corroboration.js (fail-closed second chance)
Traced all branches of `corroborateRestrictionCategory`. The V1-vocabulary
second chance only runs when the primary test found **zero** matches
(`matches.length === 0`); it is skipped entirely when the primary test
already matched >1 (ambiguous) or exactly 1 non-matching category — those
still go straight to `REVIEW`, unchanged from before. Within the second
chance: exactly one V1 hit mapping to the asserted category → resolved;
more than one hit including the asserted category → `REVIEW`
(`AMBIGUOUS_CATEGORY_CORROBORATION`); anything else (zero hits, one
non-matching hit, hits not including the asserted category) falls through to
the same final `REVIEW`/`CATEGORY_UNCORROBORATED` as before. An unmapped V1
category is tagged `V1_ONLY:<key>` so it can never be silently conflated with
a real V2 category, and still counts toward ambiguity. Genuinely fail-closed.
**Sound.**

### Other files (lighter-touch pass)
- `open-world-evidence-serving.js` (new): well-designed marker-honouring
  layer with a documented, fixed prior bug (marker-absence check accepted an
  old QXO row with no marker at all, mislabelling it "Governed claim" — now
  a positive `schema_version === CLAIM_REVISION/V1` check). Sound.
- `validate-write-set.js`: change is additive (third optional write-set key,
  `conditional_termination_fee_values`); the only removed lines are the old
  comment being rewritten for the third key, not a check being dropped.
  Sound.
- `lib/schema/features.js` / `features.generated.js` / `tags.js` /
  `tags.generated.js`: small, additive, internally consistent — two
  features' `listItemTagFamily` corrected to match newly-registered tag
  families (`INTERVENING_EVENT_EXCEPTION_CODES`, `SEC_FILING_EXCLUSION_CODES`).
  Sound.
- Byte/char spot checks: `findTerminationSectionEitherGrantContext` (new,
  candidate-resolution.js) correctly converts JS-string regex indices to
  byte offsets via `byteOffset()` before combining with `section.start`.
  `maeDefinedTermScopeText` (new) stays entirely within JS-string space and
  is never converted back to a byte span — no bug found in either.
- `modiv-termination-fee-payment-timing-parser.js` (new, deal-specific):
  self-documented as a "pilot-only sidecar" hardcoded to Modiv's exact
  sentences, throws (fails closed, caller converts to empty result) on any
  partial match. Same shape as the pre-existing (main-branch)
  `modiv-termination-fee-source-parser.js`. Consistent with established
  convention, not new risk. Follow-up note only: another deal-specific
  sidecar is scope creep worth watching, not blocking.

## Summary verdict

No finding in this slice rises to a correctness bug that would corrupt
stored data or silently drop evidence today. Two items are worth fixing
before or shortly after merge; neither blocks on its own.
