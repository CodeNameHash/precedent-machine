# Representations family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (sealed M5 programme rulings applied to this family; no family-specific modification recorded)

These entries close the three narrow legal questions carried by the representations calibration pack (`REPRESENTATIONS.json`). They govern Work3 representations family seal and downstream M5–M7 repair for this family.

**Provenance:** Ben was unavailable when family #6 Milestone A was authored. Rather than invent family-specific rulings, this note applies the **sealed** M5 programme rulings (`m5-programme-rulings.json`, approval `BEN_M5_PROGRAMME_RULES_2026_08_12`, ruling record `03198dab444302f28721f5553096154a294341e1bbd8f5999ff8c937b65afc2e`, scope `ALL_25_REGISTERED_FAMILIES`) verbatim. The sealed role schema for `REPRESENTATIONS` already binds Q01–Q03; this note records how they read for representations profile authoring.

---

## REPRESENTATIONS-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-OPERATIVE-LIMB`, selection `ONE_COMPOUND_PROPOSITION`.

> Each independently operative authored limb is one proposition. Each limb retains its own standard, conditions and exceptions.

**Reading for representations.** A representations article is not one proposition, and neither is a single representation section. The operative unit here is the accuracy standard actually attached to an authored representation — "true and correct in all material respects", "true and correct in all respects except as would not reasonably be expected to have a Material Adverse Effect", "true and correct in all respects" — together with the knowledge qualifier that limits it. Each such attached standard is its own proposition and keeps its own materiality scale.

This is why the family authored **70 profiles from 70 resolved comparator claims** rather than the six calibration provision examples. The six examples are section containers; collapsing the resolved standards into them would erase exactly the per-limb standard Q01 requires be retained. Two claim definition keys carry the family: `REPRESENTATION_ACCURACY_STANDARD` (55 claims) and `KNOWLEDGE_QUALIFIER` (15 claims).

---

## REPRESENTATIONS-Q02 — One owner; others link

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-SEMANTIC-OWNER`, selection `ONE_OWNER_WITH_LINKED_CONSUMERS`.

> Save each legal fact once under its proper family. Other families may display that fact through a stable link.

**Reading for representations.** Representations owns the accuracy standard and its scope. It does not own the surrounding machinery:

| Fact | Owning family | Representations treatment |
|---|---|---|
| Definition of the knowledge persons ("Knowledge of the Company") | `KEY_DEFINED_TERMS` | link only; the knowledge-qualifier row stores that the standard is knowledge-limited, not who the knowledge persons are |
| MAE definition and its carve-outs | `MAE_DEFINITION` | link only; an MAE-scaled accuracy standard stores the scale, not the definition |
| Bring-down of the representations at closing | `CLOSING_CONDITIONS` | link only; owned by closing conditions, which reciprocally links back here |
| Termination for breach of a representation | `TERMINATION_RIGHTS` | link only; owned by termination |

The fifteen `KNOWLEDGE_QUALIFIER` rows carry `CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY` for this reason and are excluded from any later collapse that would duplicate the defined-terms family's fact.

---

## REPRESENTATIONS-Q03 — Fail only the dependent proposition

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-FAIL-DEPENDENT-PROPOSITION`, selection `FAIL_ONLY_THE_DEPENDENT_PROPOSITION`.

> Do not infer a required role from missing or ambiguous support. Fail and flag only the dependent proposition.

No family-specific modification is recorded. The Guaranty family's marked-inference variant (`GUARANTY_FINANCING_PARTY-Q03`, MODIFIED) was granted to Ben in session and is **not** carried over here.

**Reading for representations.** All six calibration provision examples carry empty M3 dependency identifier lists, and no authored terminal in this family carries a blocking reference edge, so Q03 draws no per-row hold in Milestone A. Where a knowledge qualifier's defined-term target cannot be resolved, the affected row is flagged link-only rather than resolved by inference.

---

## What these rulings do not do

- They do **not** approve the seventy profile inventory. That is a separate Ben inventory session; the technical disposition recorded for Milestone A is APPROVE on all seventy rows, each with its review flags acknowledged.
- They do **not** assign the six sealed M5 subtype labels. The calibration pack tags every one of its six provision examples `STATUS_REPRESENTATION`, and the resolution data carries no field that separates `COMPLIANCE_REPRESENTATION`, `DOCUMENT_REPRESENTATION`, `CONTRACT_REPRESENTATION`, `FINANCIAL_REPRESENTATION` or `NEGATIVE_REPRESENTATION` from it. All seventy rows are therefore authored under `STATUS_REPRESENTATION` with all six buckets registered in the classification path registry, and every row carries `LEGAL_GROUPING_REVIEW_REQUIRED`. Deciding which representation falls in which bucket is lawyer judgment and is held, not guessed.
- They do **not** authorise M6, model calls, capitalisation unparking, or any change to product treatment; the sealed rulings' own limitations continue to apply.
