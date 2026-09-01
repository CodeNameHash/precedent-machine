# Closing conditions family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (sealed M5 programme rulings applied to this family; no family-specific modification recorded)

These entries close the three narrow legal questions carried by the closing conditions calibration pack (`CLOSING_CONDITIONS.json`). They govern Work3 closing conditions family seal and downstream M5–M7 repair for this family.

**Provenance:** Ben was unavailable when family #7 Milestone A was authored. Rather than invent family-specific rulings, this note applies the **sealed** M5 programme rulings (`m5-programme-rulings.json`, approval `BEN_M5_PROGRAMME_RULES_2026_08_12`, ruling record `03198dab444302f28721f5553096154a294341e1bbd8f5999ff8c937b65afc2e`, scope `ALL_25_REGISTERED_FAMILIES`) verbatim. The sealed role schema for `CLOSING_CONDITIONS` already binds Q01–Q03; this note records how they read for closing conditions profile authoring.

---

## CLOSING_CONDITIONS-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-OPERATIVE-LIMB`, selection `ONE_COMPOUND_PROPOSITION`.

> Each independently operative authored limb is one proposition. Each limb retains its own standard, conditions and exceptions.

**Reading for closing conditions.** A condition-precedent article is not one proposition. Each independently operative condition limb — stockholder approval, each regulatory clearance, each legal-restraint branch, S-4 effectiveness, each bring-down certificate, covenant compliance, no-MAE, listing — is its own proposition and keeps its own standard. This is why the family authored **57 profiles from 57 resolved comparator claims** rather than seven provision-example rows: the seven examples are section containers, and collapsing their limbs would erase the per-limb standards Q01 requires be retained.

---

## CLOSING_CONDITIONS-Q02 — One owner; others link

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-ONE-SEMANTIC-OWNER`, selection `ONE_OWNER_WITH_LINKED_CONSUMERS`.

> Save each legal fact once under its proper family. Other families may display that fact through a stable link.

**Reading for closing conditions.** Closing conditions sit downstream of several other families and must not restate their content:

| Fact | Owning family | Closing conditions treatment |
|---|---|---|
| MAE definition and its carve-outs | `MAE_DEFINITION` | link only; the no-MAE condition stores the trigger, not the definition |
| Representation bring-down standard text | `REPRESENTATIONS_WARRANTIES` | link only; the certificate condition stores the bring-down test, not the reps |
| Termination on failure of a condition | `TERMINATION_RIGHTS` | link only; owned by termination |
| Covenant text being complied with | `GENERAL_COVENANTS` | link only; the compliance condition stores the test |

Rows whose substance is owned elsewhere carry `CROSS_FAMILY_LINK_ONLY_MAE_DEFINITION` or `CROSS_FAMILY_LINK_ONLY_REPRESENTATIONS_BRINGDOWN` and are excluded from any later collapse that would duplicate the owning family's fact.

---

## CLOSING_CONDITIONS-Q03 — Fail only the dependent proposition

**Ruling:** **AGREED** with sealed programme reading — `M5-RULING-FAIL-DEPENDENT-PROPOSITION`, selection `FAIL_ONLY_THE_DEPENDENT_PROPOSITION`.

> Do not infer a required role from missing or ambiguous support. Fail and flag only the dependent proposition.

No family-specific modification is recorded. The Guaranty family's marked-inference variant (`GUARANTY_FINANCING_PARTY-Q03`, MODIFIED) was granted to Ben in session and is **not** carried over here.

**Reading for closing conditions.** Where a condition's supporting M3 context is missing or ambiguous, the affected row is held and flagged — the rest of the family is unaffected. Sixteen of fifty-seven rows are held on this basis:

- fifteen rows in comparator buckets with no corresponding sealed M5 subtype label (`M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED`);
- one Metsera frustration-branch row needing an explicit legal disposition (`METSERA_FRUSTRATION_BRANCH_DISPOSITION_REQUIRED`).

Nothing is inferred to fill those gaps, and no held row is served or sealed as proven fact.

---

## What these rulings do not do

- They do **not** approve the fifty-seven profile inventory. That is a separate Ben inventory session; the technical disposition recorded for Milestone A is APPROVE-with-holds (41 approve / 16 hold).
- They do **not** reconcile the nine comparator classification buckets against the eight sealed M5 subtype labels. Three comparator buckets (`COVENANT_COMPLIANCE`, `NO_MAE`, `LISTING`) have no sealed label, and two sealed labels (`BRINGDOWN`, `TAX_OPINION`) drew no comparator instances. That reconciliation is a lawyer-judgment hold, carried into the inventory packet.
- They do **not** authorise M6, model calls, capitalisation unparking, or any change to product treatment; the sealed rulings' own limitations continue to apply.
