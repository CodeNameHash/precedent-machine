# Step 2F — BREAK 5 and BREAK 6

Fixing the two write-succeeds-then-render-fails defects recorded in
`docs/codex-program/notes/step-2f-topbuild-fan-out.md`.

Files changed:

- `lib/canonical-v2/key-terms-mae-product-projection.js` (BREAK 5)
- `lib/canonical-v2/no-other-reps-fraud-product-projection.js` (BREAK 6)
- `tests/canonical-v2-step-2f-breaks-5-6.test.js` (new)

Nothing else is touched. No producer, no resolver, no runner, no bridge.

---

## Baseline, measured before any change

Harness: each family's own committed `resolution.json`, filtered to the
family's own claim-definition keys, handed to the real projection function.
No database, no reader.

```
=== MAE_DEFINITION / KEY_DEFINED_TERMS via projectKeyTermsMaeClaims ===
TopBuild rung4     entries= 38 -> THROWS KeyTermsMaeProductProjectionError [INVALID_GOVERNED_ATTRIBUTES]
TopBuild replay    entries= 19 -> THROWS KeyTermsMaeProductProjectionError [INVALID_GOVERNED_ATTRIBUTES]
Modiv live         entries= 10 -> records=8 mae=8 rollups=2 cards=2

=== NO_OTHER_REPS_FRAUD via projectNoOtherRepsFraudProduct ===
TopBuild rung4     resolved=3 -> THROWS TypeError canonical JSON does not support undefined
Modiv replay       resolved=3 -> THROWS TypeError canonical JSON does not support undefined
Modiv 0806         resolved=3 -> THROWS TypeError canonical JSON does not support undefined
```

Two corrections to the fan-out note, both confirmed against the runs:

1. **BREAK 6 is worse than recorded.** The note says `NO_OTHER_REPS_FRAUD`
   has never rendered on either document. It has never rendered on **any**
   committed run of the family, including `modiv-no-other-reps-20260806`,
   the oldest one. Three runs, three throws.
2. **Modiv's MAE baseline is 8 records, not 10.** Its two `TRAILING_LIST`
   disproportionality claims quarantine into `relationship_review_items` and
   deliberately produce no record; they surface through the 2 rollups /
   2 review cards instead. Any "after" figure has to be read against
   8 + 2 + 2, not 10.

---

## BREAK 5 — `MAE_DEFINITION`'s 38 claims

### The finding that settles it: the resolver already fixed this, yesterday

The fan-out note diagnosed the validator as encoding Modiv's drafting style.
That is right, and there is a sharper way to say it: **the same defect, in
the same words, was found and fixed one layer upstream on 2026-08-07, and
this module was never updated to match.**

`lib/canonical-v2/native-producer/candidate-resolution.js`'s
`handleMaeDisproportionalityCandidate` had the identical
`applies_to_clause_labels ⊆ raw_value` rule.
`docs/codex-program/notes/mae-clause-label.md` replaced it with
`verifyMaeClauseLabel`'s three tiers **for `PER_LIMB` only**, deliberately
leaving `TRAILING_LIST` alone, for exactly the reason BREAK 5 gives. That
change is what turned `topbuild-mae-definition-20260806`'s 2 resolved claims
into `topbuild-mae-definition-20260807-replay`'s 19.

So the resolver has already verified every PER_LIMB label that reaches this
projection against the admitted document. The projection was still applying
the pre-fix rule to the resolver's post-fix output.

### Which conditions were style and which were substance

The old check was one boolean with three clauses. Taken apart:

| Condition | Verdict | Disposition |
|---|---|---|
| `raw_value` is a string | **Substance.** No quote, no evidence. | Kept, unchanged. |
| `raw_value` contains `comparison_baseline_phrase` | **Substance.** "Relative to whom" *is* the legal content of a disproportionality carve-back, and the attribute asserts it is verbatim from the quote displayed beside it. | Kept, unchanged. Now fails with its own message and details naming the claim. |
| every label ∈ `raw_value`, for `TRAILING_LIST` | **Substance.** One trailing proviso names the clauses it reaches inside its own text. The labels are an assertion the quote makes; the quote is their only evidence. A label the proviso does not recite is invented scope. | Kept, unchanged, and proved still to fire (below). |
| every label ∈ `raw_value`, for `PER_LIMB` | **Style.** The label is the enumeration marker *preceding* the clause body, not part of it. A correctly narrowed quote can never contain its own label. This clause, and only this clause, encoded Modiv's trailing-proviso convention as a universal invariant. | Replaced, not deleted — see below. |

### What replaced it

`carvebackClauseLabelGrounded`, two tiers, mirroring the resolver's own
structure at the strength this layer can actually support:

1. **Tier 1, unchanged.** `raw_value.includes(label)`. Tried first, so every
   pre-existing fixture takes a byte-identical path. This is the whole rule
   for `TRAILING_LIST`.
2. **Tier 2, `PER_LIMB` only.** The label must appear in the entry's
   `governing_context_quote`, that context must contain `raw_value`
   verbatim, and the label's first occurrence must be at or before where the
   quote starts — an enumeration marker precedes its own clause body.

`governing_context_quote` is the only real source text a resolution entry
carries, and on both documents it is exactly the label-prefixed clause. This
is the projection-layer analogue of the resolver's tier 2, weaker
(position, not immediate adjacency) because a context quote is all this
layer holds. The projection does not re-run the resolver's verification and
must not: it has no admitted source bytes.

A label grounded by neither tier now fails with a new typed code,
`CARVEBACK_CLAUSE_LABEL_UNGROUNDED`, whose `details` carry
`claim_definition_key`, `claim_revision_id`, `section_reference`,
`carveback_source_form` and the offending `clause_label`.

All comparisons are between two JS strings drawn from the same JSON
document, so `includes` / `indexOf` are consistent with one another. No byte
offset is involved and none may be introduced here.

### After

```
TopBuild rung4     entries= 38 -> records=38 mae=38 rollups=2 cards=2
TopBuild replay    entries= 19 -> records=19 mae=19 rollups=1 cards=1
Modiv live         entries= 10 -> records= 8 mae= 8 rollups=2 cards=2   (unchanged)
```

TopBuild rung 4, per MAE definition: 11 limbs each, **5 covered**,
0 relationship review items, 7 relationship edges — matching the 5
disproportionality carve-backs the filing actually has per definition.

`KEY_DEFINED_TERMS`, which shares this module, is unaffected:
TopBuild rung 2 21 → 21 records, Modiv 8.12 live 10 → 10.

---

## BREAK 6 — `NO_OTHER_REPS_FRAUD`

### Root cause, corrected in one respect

The fan-out note says the module "was written against an older resolver".
More precisely: **there are two live resolvers for this family, and the
projection reads the wrong one's shape.**

- `lib/canonical-v2/native-producer/no-other-reps-fraud-resolution.js`'s
  `resolveNoOtherRepsFraudProposals` emits `resolution_id`,
  `claim.concept_key`, `claim.owner_family` and `evidence_only` directly.
  It is still live — `review-preview-assembly.js` and six test files drive
  it — so it cannot simply be abandoned.
- The live extraction runner writes `candidate-resolution.js`'s entry shape,
  the one 25 families and both documents agree on. Identity is
  `claim.claim_revision_id`; the concept sits on the **entry** as
  `entry.concept_key`; owner family and evidence-only routing are not
  serialised at all.

The producer is not changed. Each of the four fields is now derived,
preferring the explicit field when the legacy resolver supplied it:

| Field | Legacy | Native fallback |
|---|---|---|
| `id` | `item.resolution_id` | `claim.claim_revision_id` (a real SHA-256, so `row_id` stays well-formed) |
| `concept_key` | `claim.concept_key` | `entry.concept_key` |
| `owner_family` | `claim.owner_family` | `ELEMENTS[key].owner_family` from `native-producer/no-other-reps-fraud-contract.js` |
| `evidence_only` | `item.evidence_only` | `ELEMENTS[key].qualified_owner_family` → the same `{qualified_owner_family, EVIDENCE_ONLY_UNADJUDICATED, quote}` envelope the legacy resolver builds, else `null` |

Nothing is invented: owner family and the evidence-only envelope both come
from the registry **the native resolver itself reads to set them**, so both
paths resolve to the same value for the same claim. A test asserts that
equality directly, comparing whole market rows through `canonicalJson`.

Two further changes:

- `source_section_reference` is carried on the fact instead of being
  recovered by `resolved.find(item => item.resolution_id === fact.id)`. That
  lookup silently returned `null` for every native entry, and was O(n²).
- `answer_provenance` is stripped from fact attributes, following
  `tax-dividends-appraisal-product-projection.js` and
  `financing-guaranty-product-projection.js`'s `SYSTEM_ATTRIBUTE_KEYS`.
  Every native claim in this family carries it; leaving it in would put a
  provenance blob into a market-metric breakdown and fragment its cohorts.

### After

All three committed runs render 3 facts across all four surfaces:

```
TopBuild rung4     resolved=3 -> review=3 query=3 compare=3 market=3
Modiv replay       resolved=3 -> review=3 query=3 compare=3 market=3
Modiv 0806         resolved=3 -> review=3 query=3 compare=3 market=3
```

---

## Failing loudly

Both modules now refuse rather than shorten a list. `projectNoOtherRepsFraudProduct`
throws `NoOtherRepsFraudProductProjectionError` with a code and a `details`
object naming the claim and its index, following
`termination-product-projection.js`'s `TERMINATION_RIGHT_TITLE_UNMAPPED` and
`remedies-misc-product-projection.js`'s `UNMAPPED_FAMILY_CLAIM_DEFINITION`:

| Code | Fires when |
|---|---|
| `NOT_A_POSITIVE_PRESENCE_CLAIM` | a resolved item is not `PRESENT` / `true` |
| `MISSING_CLAIM_IDENTITY` | neither `resolution_id` nor `claim_revision_id` |
| `MISSING_CONCEPT_KEY` | concept on neither claim nor entry |
| `UNMAPPED_FAMILY_CLAIM_DEFINITION` | the key is absent from the family's own contract |
| `NO_OTHER_REPS_FRAUD_LABEL_UNMAPPED` | the key is in the contract but has no product-surface label |

The last one cannot fire against today's registry — all six `ELEMENTS` keys
are in `LABELS` — and is stated as such in its own comment. It exists for the
next element added to the contract, which is exactly how the termination case
arrived.

### Every guard proved to fire

Mechanically, by neutering one guard at a time and re-running
`tests/canonical-v2-step-2f-breaks-5-6.test.js`, then restoring:

```
FIRES   MAE tier-1 / TRAILING_LIST label substring:      1 test fails without it
FIRES   MAE tier-2 quote-located-in-context:             1
FIRES   MAE tier-2 label-precedes-quote position:        2
FIRES   MAE whole clause-label guard:                    4
FIRES   MAE comparison-baseline containment:             1
FIRES   NORF claim identity:                             1
FIRES   NORF concept key:                                1
FIRES   NORF owner family from family contract:          1
FIRES   NORF positive-presence claim:                    1
FIRES   NORF product-surface label:                      4
restored: 0 failing
```

The first pass of this exercise found one dead guard: `factOwnerFamily` and
`factLabel` shared the code `UNMAPPED_FAMILY_CLAIM_DEFINITION`, so neutering
the first changed nothing — the second caught the same input with the same
code and the test still passed. Splitting the codes made it fire. That is the
whole reason for running the removal proof rather than assuming.

A second thing the proof caught: a hostile test that relabels a carve-back to
a **nonsense** label never reaches the guard at all.
`buildMaeDisproportionalityRollups` quarantines it first
(`PER_LIMB_TARGET_LIMB_NOT_FOUND` / `UNRESOLVED_CARVEOUT_LIMB_NO_OPEN_WORLD_EVIDENCE`)
and it is filtered out of `records` before `projectEntry` sees it. The tests
therefore relabel to a **real sibling limb** — `(C)` on TopBuild, `(e)` on
Modiv — which the rollup builder resolves happily and only the text-grounding
guard can catch. That quarantine path is not silent (it names the claim in
`relationship_review_items` and flips the rollup to `REVIEW_REQUIRED`), so it
is left alone.

---

## Verification

```
CI=true node --test tests/canonical-v2-step-2f-breaks-5-6.test.js          exit 0   11/11
CI=true node --test <19 files touching either module or its consumers>     exit 0  315/315
CI=true node --test tests/canonical-v2-phase1-authority-boundary.test.js \
                    tests/canonical-v2-successor-m1-readiness-packet.test.js exit 0   24/24
bash scripts/lint/forbidden-patterns.sh                                     exit 0   INVARIANT-4: PASS
```

The 19 files are the union of everything requiring
`key-terms-mae-product-projection`, `no-other-reps-fraud-product-projection`,
`no-other-reps-fraud-dark-bridge` or `review-preview-assembly`.

The new test reads only **git-tracked** evidence. The 2026-08-08 rung-4 runs
are untracked at the time of writing, and a test that silently passes when
its input is missing proves nothing while reading like it proves everything.
`topbuild-mae-definition-20260807-replay` (19 entries, 5 PER_LIMB carve-backs)
is the committed run that threw, so it locks the regression either way; the
rung-4 figures above were measured with the same harness and are reported,
not asserted.

Both `topbuild-mae-definition-20260807-replay/resolution.json` and
`modiv-no-other-reps-20260807-replay/resolution.json` are **modified in the
working tree** by another agent's in-flight change. The differences are
confined to `closure_id` and `extraction_provenance` receipt ids; no claim
content moved. Every figure above was reproduced against the `HEAD` version
of all four evidence files and is identical, so nothing here depends on which
version lands.

---

## Other things found, none of them mine to fix

1. **`scripts/canonical-v2-reader-resolution-contract-check.js` now carries a
   stale paragraph** (around line 388) explaining at length that
   `NO_OTHER_REPS_FRAUD` "is intentionally NOT render-checked here" because
   the projection reads fields that do not exist. That was true this morning
   and is false now. It belongs to today's reader work, not to this piece, so
   it is flagged rather than edited — but it should be replaced with an actual
   render check, which will now pass.
2. **TopBuild's MAE limb labels are inconsistent between its own two
   sections.** On §3.2 the three nested sub-items of clause (A) carry
   `clause_label` `(1)`, `(2)`, `(3)`; on §3.1 the identical three sub-items
   all carry `(A)`. Same document, same drafting, two conventions out of the
   producer. Nothing throws, and no relationship is mis-established, but
   §3.1's rollup renders four separate rows labelled `(A)` to a lawyer, three
   of which are sub-limbs of the fourth. Producer/resolver territory; see
   `docs/codex-program/notes/nested-lettering-collision.md`.
3. **Modiv's MAE disproportionality relationship is entirely unestablished,
   and always has been.** Both rollups: 2 limbs, **0 covered**, 6
   `UNRESOLVED_CARVEOUT_LIMB_NO_OPEN_WORLD_EVIDENCE` review items each. The
   proviso names clauses (a), (b), (c), (d), (g), (k); the run resolved only
   limbs (e) and (h), so not one named label has a limb to attach to. This is
   visible (`relationship_state: REVIEW_REQUIRED`), not silent, and it is
   unchanged by this work — but it means the document where the carve-back
   check "passed" all along was never actually producing a relationship.
   TopBuild, after this fix, produces 10 of them.
