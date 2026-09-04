# No other reps / fraud family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (sealed M5 programme rulings applied to this family; no family-specific modification recorded)

These entries close the three narrow legal questions carried by the no-other-reps calibration pack (`NO_OTHER_REPS_FRAUD.json`). They govern Work3 no-other-reps family seal and downstream M5–M7 repair for this family.

**Provenance:** Ben was unavailable when family #8 Milestone A was authored. Rather than invent family-specific rulings, this note applies the **sealed** M5 programme rulings (`m5-programme-rulings.json`, approval `BEN_M5_PROGRAMME_RULES_2026_08_12`, ruling record `03198dab444302f28721f5553096154a294341e1bbd8f5999ff8c937b65afc2e`, scope `ALL_25_REGISTERED_FAMILIES`) verbatim. The sealed role schema for `NO_OTHER_REPS_FRAUD` already binds Q01–Q03; this note records how they read for disclaimer profile authoring.

---

## NO_OTHER_REPS_FRAUD-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-OPERATIVE-LIMB`, selection `ONE_COMPOUND_PROPOSITION`.

> Each independently operative authored limb is one proposition. Each limb retains its own standard, conditions and exceptions.

**Reading for no other reps.** A no-additional-representations section is not one proposition. A single section routinely carries a target-side disclaimer, a buyer-side disclaimer, a non-reliance acknowledgment and an extra-contractual reliance disclaimer, each with its own actor, its own scope and its own carve-out. The operative unit is the authored disclaimer limb, not the section that houses it.

This is why the family authored **36 profiles from 36 resolved comparator claims** rather than the seven calibration provision examples. The seven examples are section containers; collapsing the resolved limbs into them would erase exactly the per-limb scope Q01 requires be retained. Three claim definition keys carry the family: `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT` (22 claims), `NON_RELIANCE_ACKNOWLEDGMENT_PRESENT` (9 claims) and `EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT` (5 claims).

**What is held rather than answered.** Twenty-four of the thirty-six rows sit on an authored citation that carries at least one other governed claim — Concho §5.19(b) carries three, Modiv §3.25 carries three, and nine further citations carry two apiece. Whether each of those is a separate proposition or one proposition with ordered roles is the second half of Q01, and the sealed schema's `proposition_unit_rule` (`ONE_INDEPENDENTLY_OPERATIVE_AUTHORED_UNIT_WITH_ORDERED_ROLES_OR_LINKED_CHILDREN`) permits either. Those rows carry `SHARED_SOURCE_CITATION_LINK_ONLY` so the sharing is visible for review; the Milestone A partition keeps them separate and links them, which is reversible, rather than folding them, which is not.

---

## NO_OTHER_REPS_FRAUD-Q02 — One owner; others link

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-SEMANTIC-OWNER`, selection `ONE_OWNER_WITH_LINKED_CONSUMERS`.

> Save each legal fact once under its proper family. Other families may display that fact through a stable link.

**Reading for no other reps.** No other reps owns the disclaimer and the non-reliance acknowledgment. It does not own the surrounding machinery:

| Fact | Owning family | No other reps treatment |
|---|---|---|
| The substantive representations the disclaimer excepts | `REPRESENTATIONS` | link only; the disclaimer row stores that an exception exists, not what the excepted representations say |
| Defined terms pulled into a disclaimer ("Representatives", "Knowledge") | `KEY_DEFINED_TERMS` | link only |
| The entire-agreement / no-third-party clause housing a disclaimer (Metsera §9.07) | `MISC_BOILERPLATE` | link only; the dual pin is a shared source, not shared ownership |
| Willful breach and fraud remedies elsewhere in the agreement | open world | not a Work3 terminal — see below |

**Classifier boundary, verified rather than assumed.** `section-family-classifier.js` deletes a `REPRESENTATIONS` classification when `NO_OTHER_REPS_FRAUD` wins the same M2 source node. Checking the sealed REPRESENTATIONS Phase 2 terminal registry against this family's thirty-six terminals confirms the boundary held: **zero** shared M2 source nodes. Three TopBuild rows (§3.1(w), §3.2(r) ×2) share a *printed section* with sealed REPRESENTATIONS profiles because the disclaimer is a lettered sub-paragraph of the representations article. Those three carry `CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY`. No REPRESENTATIONS profile was absorbed, and no disclaimer content was duplicated into the sealed Representations package.

---

## NO_OTHER_REPS_FRAUD-Q03 — Fail only the dependent proposition

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-FAIL-DEPENDENT-PROPOSITION`, selection `FAIL_ONLY_THE_DEPENDENT_PROPOSITION`.

> Do not infer a required role from missing or ambiguous support. Fail and flag only the dependent proposition.

No family-specific modification is recorded. The Guaranty family's marked-inference variant (`GUARANTY_FINANCING_PARTY-Q03`, MODIFIED) was granted to Ben in session and is **not** carried over here.

**Reading for no other reps.** All seven calibration provision examples carry empty M3 dependency identifier lists, and no authored terminal in this family carries a blocking reference edge, so Q03 draws no per-row hold in Milestone A and the Phase 3 reference chain is skipped. Red Hat's willful-breach definition at §8.03(p) is the one candidate edge, and it is left where the native producer left it: `willful_breach_definitions` is a definition-only stream, the definition is open world, and forcing it into a `FRAUD_CARVEOUT` profile without legal intake would be exactly the inference Q03 forbids.

---

## What these rulings do not do

- They do **not** approve the thirty-six profile inventory. That is a separate Ben inventory session; the technical disposition recorded for Milestone A is APPROVE on all thirty-six rows, each with its review flags acknowledged.
- They do **not** assign the four sealed M5 subtype labels. The calibration pack tags every one of its seven provision examples `NO_OTHER_REPRESENTATIONS_DISCLAIMER`, and the sealed role schema admits all three claim definition keys under all four buckets — `NO_OTHER_REPRESENTATIONS_DISCLAIMER`, `NON_RELIANCE_ACKNOWLEDGMENT`, `FRAUD_CARVEOUT` and `INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT` — so nothing in the sealed evidence separates them. It is tempting to read `NON_RELIANCE_ACKNOWLEDGMENT_PRESENT` as belonging to the `NON_RELIANCE_ACKNOWLEDGMENT` bucket on the strength of the name; the sealed schema declines to say so, and so does this note. All thirty-six rows are therefore authored under `NO_OTHER_REPRESENTATIONS_DISCLAIMER` with all four buckets registered in the classification path registry, and every row carries `LEGAL_GROUPING_REVIEW_REQUIRED`. Deciding which disclaimer element falls in which bucket is lawyer judgment and is held, not guessed.
- They do **not** decide whether coordinated disclaimer elements on one authored citation are one proposition with roles or several linked propositions. That is the open half of Q01, carried as `SHARED_SOURCE_CITATION_LINK_ONLY` on twenty-four rows.
- They do **not** authorise M6, model calls, capitalisation unparking, or any change to product treatment; the sealed rulings' own limitations continue to apply.
