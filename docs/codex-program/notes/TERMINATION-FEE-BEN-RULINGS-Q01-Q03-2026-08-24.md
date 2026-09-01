# Termination fee family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (sealed M5 programme rulings applied to this family; no family-specific modification recorded)

These entries close the three narrow legal questions carried by the termination fee calibration pack (`TERMINATION_FEE.json`). They govern Work3 termination fee family seal and downstream M5–M7 repair for this family.

**Provenance:** Ben was unavailable when family #10 Milestone A was authored. Rather than invent family-specific rulings, this note applies the **sealed** M5 programme rulings (`m5-programme-rulings.json`, approval `BEN_M5_PROGRAMME_RULES_2026_08_12`, ruling record `03198dab444302f28721f5553096154a294341e1bbd8f5999ff8c937b65afc2e`, scope `ALL_25_REGISTERED_FAMILIES`) verbatim. The sealed role schema for `TERMINATION_FEE` already binds Q01–Q03; this note records how they read for termination fee profile authoring.

---

## TERMINATION_FEE-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-OPERATIVE-LIMB`, selection `ONE_COMPOUND_PROPOSITION`.

> Each independently operative authored limb is one proposition. Each limb retains its own standard, conditions and exceptions.

**Reading for termination fee.** A fee section is not one proposition. The fee amount, the tail-period test, the sole-remedy legal effect and each carve-out from that sole remedy are separately operative: each has its own trigger, its own measure and its own exceptions. This is why the family authored **20 profiles from 20 resolved comparator claims** rather than six provision-example rows: the six examples are section containers (Concho 8.3, Metsera 8.02, Red Hat 5.06, Skechers 8.3, SkyWater 10.5, TopBuild 6.5), and collapsing their limbs would erase the per-limb standards Q01 requires be retained. Metsera 8.02 alone carries five such limbs.

---

## TERMINATION_FEE-Q02 — One owner; others link

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-SEMANTIC-OWNER`, selection `ONE_OWNER_WITH_LINKED_CONSUMERS`.

> Save each legal fact once under its proper family. Other families may display that fact through a stable link.

**Reading for termination fee.** Termination fee sits beside several other families and must not restate their content:

| Fact | Owning family | Termination fee treatment |
|---|---|---|
| Who may terminate, and on what ground | `TERMINATION` (Milestone A sealed) | link only; the fee row stores the payment trigger, not the termination right |
| Failure of a closing condition as a fee trigger | `CLOSING_CONDITIONS` (Milestone A sealed) | link only; the fee row stores the reference, not the condition |
| Sole remedy and its carve-outs | **unresolved** — see below | held, not claimed |

The sole-remedy boundary is the open question, and it is open on the evidence rather than on preference. All ten sole-remedy rows in the comparator resolutions (`SOLE_REMEDY_LEGAL_EFFECT_PRESENT`, `SOLE_REMEDY_CARVEOUT_KIND`) carry `owner_family: SPECIFIC_PERFORMANCE_REMEDIES` and were resolved by the supplemental resolver `native-sole-remedy-resolution/v1`, not by the termination fee producer. Q02 permits exactly one owner, and the source does not settle whether that owner is termination fee (the fee those rows cap) or specific performance remedies (the remedy they restrict). Those ten rows are therefore **held**, flagged `COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED`, and are not sealed as termination fee facts.

---

## TERMINATION_FEE-Q03 — Fail only the dependent proposition

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-FAIL-DEPENDENT-PROPOSITION`, selection `FAIL_ONLY_THE_DEPENDENT_PROPOSITION`.

> Do not infer a required role from missing or ambiguous support. Fail and flag only the dependent proposition.

No family-specific modification is recorded. The Guaranty family's marked-inference variant (`GUARANTY_FINANCING_PARTY-Q03`, MODIFIED) was granted to Ben in session and is **not** carried over here.

**Reading for termination fee.** Where a fee row's ownership or subtype membership is unsettled, that row alone is held; the rest of the family is unaffected. Twelve of twenty rows are held on this basis:

- ten sole-remedy rows the comparator assigns to another family (`COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED`);
- two reverse-side fee rows (Skechers 8.3 and TopBuild 6.5, both `party.capacity = BUYER`) whose subtype membership the single sealed `FEE_AMOUNT` label does not distinguish (`FEE_SIDE_PARTITION_DISPOSITION_REQUIRED`).

Nothing is inferred to fill those gaps, and no held row is served or sealed as proven fact. The eight approved rows are the four target-side fee amounts and the four tail-period rows, where the family owns the semantics and the sealed subtype label is unambiguous.

---

## What these rulings do not do

- They do **not** approve the twenty profile inventory. That is a separate Ben inventory session; the technical disposition recorded for Milestone A is APPROVE-with-holds (8 approve / 12 hold).
- They do **not** decide whether sole remedy and its carve-outs belong to termination fee or to specific performance remedies. That is the lawyer-judgment hold above, carried into the inventory packet.
- They do **not** decide whether a reverse termination fee is the same subtype as a target termination fee with a different payer role, or a subtype of its own. Four sealed M5 labels (`FEE_TRIGGER`, `EXPENSE_REIMBURSEMENT`, `LATE_INTEREST`, `CONDITIONAL_FEE_SCHEDULE`) drew no comparator instances at all and are not materialised as profiles.
- They do **not** authorise M6, model calls, capitalisation unparking, or any change to product treatment; the sealed rulings' own limitations continue to apply.
