# Sweep disposition table

Every finding from the 2026-08-08 repository sweep, with exactly one
disposition. Ben asked for this so the plan can be audited rather than trusted:
nothing from the sweep is allowed to be quietly dropped.

Dispositions are: **PLAN** (becomes a Step 2X sub-step), **CRITERION** (becomes
acceptance evidence for an existing step), **GRAVEYARD** (record as dead),
**BEN** (needs a decision), **DROP** (deliberately not pursued, with a reason).
There is no sixth. "Needs more analysis" is not a disposition.

Source notes: `asset-sweep-lib-root.md`, `asset-sweep-parser-schema.md`,
`asset-sweep-lib-subdirs.md`, `asset-sweep-ui.md`,
`canonical-v2-capability-inventory.md`, `asset-sweep-scripts-sql.md`,
`asset-sweep-tests.md`, `topology-investigation.md`,
`cross-family-consistency.md`, `revalidation-ladder.md`.

## Structure and inheritance

| finding | disposition | where |
|---|---|---|
| `segmentSubClauses` is a complete, tested limb segmenter canonical-V2 never requires | PLAN | 2X-A |
| Its CHILD-OPEN rule refused colon-introduced inline enumerations | **DONE** | landed 2026-08-08 with guard proof; 8/8 |
| Five structure mechanisms unaware of each other | PLAN | 2X-A — DECIDED by Fable: converge two, keep three. `findIocChapeau` is not superseded (the segmenter mis-nests where it is correct); `qualifier-attachment.js` takes no span; `limb-components.js` consumes model-declared paths |
| **22 of 25 families have no sub-clause representation at all** — flat assertion lists, one row, no parent. Only 2 prompts declare `limbs`; IOC has a separate components mechanism | PLAN | **2X-A BROADENED** on Ben's question. Fable had not considered it — scope inherited from the framing, not decided on evidence. A corpus-wide placement pass gives every family's assertions a `structure_context` by containment on existing byte spans. Replay-validated, zero model calls |
| `segmentSubClauses` mis-nests a second colon-introduced list under the first | CRITERION | measured at **1.1%** — 45 markers across 6 sections of 538, over all 213 runs and 7 deals. Detectable as a same-style parent-child path link, which is structurally impossible in real outlining, so it fails closed as UNDETERMINED rather than silently. Reproduced independently |
| Annotation does not mint identity | CRITERION | the distinction that makes broadening safe: derived trees annotate flat families and never mint for them; identity stays with model-declared limbs |
| `EXCEPTED_BY` exists with schema and validator, scoped `deal:qxo-topbuild`, `OFFLINE_REVIEW_ONLY`, zero evidence files | PLAN | 2X-A |
| `limb_component_trees` non-empty in 1 of 202 runs | PLAN | **2X-L** — CORRECTED. The producer DOES emit limbs (69 in Red Hat's two sections); `shapeRepresentationQualifierProposals` discards them. Resolver-side and free. The earlier entry read "producer emits no limb candidates; resolver work cannot reach it" and was wrong — it inferred absence at the source from a run receipt, which records what the shaper produced, not what the model returned |
| Tree pre-pass keys on capitalisation-specific candidate names | PLAN | 2X-L — this is the *only* cause for REPRESENTATIONS, not the shallower of two |
| `qualifier-attachment.js` runs live on REPRESENTATIONS | CRITERION | keep working through 2X-A |
| Segmentation is UTF-16; pipeline is UTF-8 | CRITERION | 2X-A convert at the boundary, do not port |
| `provision_components` are flat under an instance — no component-to-component parent | BEN | narrow→limb→clause needs two levels of nesting; schema supports one |

## Vocabulary and concept identification

| finding | disposition | where |
|---|---|---|
| `bring-down-tiers.js` implements whole-clause-then-flag with proviso splitting | PLAN | 2X-A as the shape to copy |
| IOC second-chance fallback missing from three corroboration modules | PLAN | 2X-B |
| Non-collision asserted in a comment, never checked at run time, in two modules | PLAN | 2X-C |
| `MAT_MAE_AGGREGATE` defined twice in `taxonomy.js` with different meanings | **DONE** | 2X-D — documented rather than deleted; deleting either entry breaks stored V1 claims |
| `taxonomy.js` — 54 vocabularies, 429 codes, one consumed | PLAN | 2X-J |
| `MAE_CARVEOUT_META` 27 codes unconsumed | PLAN | 2X-J |
| `lib/schema/features.js` 551 feature definitions unconsumed | PLAN | 2X-J |
| `category-summary-features.js` — ~200 expected rows, annotated with PW question numbers | CRITERION | per-family expected yield in 2X-J |
| `canonical-conditions.js` — canonical code first, regex fallback | **DONE** | reused for 2X-E |
| `employee-benefits.js` — bundled inherits standard and quote, direct beats inferred, `bundled` flag | CRITERION | provenance-flag pattern, required of every derived value |
| `lib/vocab/` — 3 real, 1 partial, 3 empty scaffolds | DROP | the three empty ones are Ben's to fill; do not populate |
| Open-world promotion does not exist | PLAN | 2X-G |
| IOC producer enum has 11 categories, V1 has 25, nine hit the corpus and cannot be emitted | PLAN | 2X-I |

## Product surfaces

| finding | disposition | where |
|---|---|---|
| 14 unsafe absence wordings across 11 config files | **DONE** | 2X-E — verified zero remaining, and the string resolves to "Not found (may not be present, or not yet extracted)" |
| `termination-fees.config.js` NOT_YET_EXTRACTED vs ESTABLISHED_ABSENT pill | DROP for other families | no other family has a second source; inventing one would fabricate a signal |
| `NoShopCrossViewPreview.jsx` `formatCode(null) → 'Not applicable'` | PLAN | 2X-E, still open; fix is same-file consistency |
| `configDecorations.js` computes legal-adjacent facts at render time with no provenance flag | PLAN | 2X-E follow-on, display-only, low risk |
| `ClauseSidebar.jsx` implements fact→limb→clause expansion | CRITERION | the reference implementation for Ben's ruling 3 |
| `nosol-section.config.js` GROUP_DEFS assembles sub-families as limbs | CRITERION | working chapeau precedent for 2X-A |
| `CanonicalReviewSection.jsx` throws on incomplete certified evidence | CRITERION | refusal discipline to preserve |
| `REVIEW_V2_CONFIGS` lists 20 configs; its header says 19 | **DONE** | stale-header instance, corrected |
| `pages/deals/[id].js`, `pages/provisions/[id].js` orphaned, reachable only by typed URL | GRAVEYARD | |
| Six large families build rows dynamically with no fixed catalogue | CRITERION | sparse output there can be legitimately deal-driven, not a defect |

## Topology

| finding | disposition | where |
|---|---|---|
| Detector scores 4/7 on real text | PLAN | 2X-F |
| Skechers false positive at HIGH confidence from a generic `/the offer/i` regex | PLAN | 2X-F |
| TopBuild false negative — pattern hardcoded to "first/second/subsequent merger" | PLAN | 2X-F |
| Modiv parallel merger unrepresentable; `step_order` is an enforced total order | PLAN | 2X-F, Ben ruled invent the taxonomy |
| `DOUBLE_DUMMY` a misnomer for SkyWater and TopBuild | PLAN | 2X-F, Ben ruled add the real structure |
| `FORWARD_TRIANGULAR` / `REVERSE_TRIANGULAR` declared but unreachable | PLAN | 2X-F |
| `assertion_kind` tagged `ACTIONS` vs `EFFECTS` inconsistently across deals | BEN → Fable | taxonomy semantics |
| `surviving_entity` must be the post-merger defined term or chaining spuriously fails | CRITERION | 2X-F |
| `transaction_steps` prompt boundary line points at a real V1 detector | PLAN | 2X-F, detector as corroboration only |

## Measurement and tooling

| finding | disposition | where |
|---|---|---|
| Input tokens recorded as 426 across 172 calls | PLAN | 2X-H |
| `review_queue` is the attempted set, not a reject pile — earlier rates wrong | **DONE** | corrected in 2X preamble; denominator stated |
| Output dominates cost: 2,734,334 tokens, 15,897/call average | CRITERION | 2X-I open question on pre-call segmentation |
| `generate-codebase-inventory.js` exists and nobody runs it | PLAN | 2X-J, direct antidote to the stated failure mode |
| ~100 of 300 scripts confidently dead | GRAVEYARD | |
| `review-parity-check.js` exit 2 means nothing was compared | CRITERION | must never be reported as a pass |
| Replay costs zero model calls | CRITERION | 2X-K places the prompt bump |
| 33 rules already asserted in the test suite | CRITERION | acceptance criteria for 2X-A through 2X-F |
| Seven hash-pinned agreements and three recorded run directories replayable | CRITERION | 2X-K rungs |
| 11 skipped tests, all environment-gated | DROP | none abandoned; no action |

## Over-fitting risk

| finding | disposition | where |
|---|---|---|
| 200 files in `lib/` mention a deal name | DROP | 79 self-declare in the filename; most of the rest are comment-only calibration citations or pilot schema tags |
| Modiv termination-fee parsers invoked from `candidate-resolution.js` | CRITERION | the one live instance, already gated fail-closed; watch item |
| `findTerminationLimbGrantContext` carried two Modiv grammars | **DONE** | generalised 2026-08-08 |
| Four stale header comments found in one day | CRITERION | update the header in the same change that changes behaviour |

## Open with Ben

| question | status |
|---|---|
| Ruling 2 — mutual right mints two rows | agreed to hold; folded into 2X-I |
| Ruling 3 — narrow→limb→clause storage model | answered: one span per node plus a parent pointer, expansion is a pointer walk. Remaining gap is component-to-component nesting |
| MAE aggregate split | ruled: revert. 2X-D |
| Parallel merger taxonomy | ruled: invent it. 2X-F |
| `DOUBLE_DUMMY` naming | ruled: add the real structure. 2X-F |
| `ACTIONS` vs `EFFECTS` | to Fable |
| IOC categories | ruled: all 25, into the rubric. 2X-I, 2X-J |
| Promotion threshold | ruled: three or four deals with a confidence and collision check. 2X-G |
| Deterministic vs model boundary | recommendation and alternative both go to Fable, not a conclusion to ratify |


## Corrections made after Fable's review, 2026-08-08

| claim | status |
|---|---|
| "the REPRESENTATIONS producer emits zero limb-assertion candidates" | **FALSE.** 69 limbs in Red Hat's §3.01 and §3.02 recorded responses. Verified by parsing `raw_response_text`, not the receipt |
| "the raw material is absent from the run" | **FALSE.** Same error, same cause |
| "no resolver change can reach the limb tree" | **FALSE.** The shaper is resolver-side and replay re-feeds the recorded response through it, so the fix costs zero model calls |
| MAE limb emission needs the prompt bump | **TRUE.** Neither Red Hat's nor SkyWater's MAE responses contain a `limbs` array. Verified |
| 2X-A: converge all five | **DECIDED: converge two.** `findIocChapeau` is correct on an input where `segmentSubClauses` mis-nests, so the service is not a superset |
| 2X-K phase list | **INCOMPLETE.** Omitted 2X-F, G, H; 2X-F straddles both phases |

Everything else Fable checked held: the duplicate `MAT_MAE_AGGREGATE` at
`taxonomy.js` lines 105 and 143, IOC 11 versus 25, the vocab-scaffold DROP not
conflicting with 2X-B, `subclauses.js`'s four consumers, and the denominator
correction. No ruling of Ben's was contradicted.

**The lesson worth keeping.** A run receipt records what the *shaper produced*,
not what the *model returned*. Concluding a producer emits nothing from a
receipt is the same error class as concluding a module does one thing from its
header comment. Read `raw_response_text`.

## Added after the sweep, 2026-08-08

| finding | disposition | where |
|---|---|---|
| A **sixth** structure mechanism — `deterministic-sectionizer.js`'s `buildMarkerTree`, whole-document, byte-native, already live | PLAN | 2X-A — the service's second input and the section inventory; not the base, since it structurally cannot see inline markers |
| The two sub-clause detectors are complementary on marker RECALL but both mis-nest a restarting `(a)` | CRITERION | same-style refusal stays mandatory regardless of detector agreement |
| Colon-introduced back-reference mis-read by the colon rule | CRITERION | detectable by the same-style signature; pinned as a test |
| **Forward** reference read as the next sibling, swallowing the real limb | PLAN | 2X-A — the same-style detector is BLIND to it; resolved by the line-anchored start winning. Corpus frequency low: `provided that (X)` 1, `pursuant to (X)` 3, others zero |
| Limb EXTENT is ambiguous at sentence boundaries; nesting is not | CRITERION | independent evidence for start-anchored identity — a limb's start is a fact about the document, its end a fact about our algorithm |
| 2X-D arrived with a premise that was true on its own branch and false here | **DONE** | corrected in `contract-bundle.js` with the replay that settles it |
