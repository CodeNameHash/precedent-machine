# Guaranty financing party family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (auto-recorded per Ben technical delegation; not yet bound to a sealed ruling receipt)

These rulings close the three open narrow legal questions in the Guaranty financing party calibration pack (`GUARANTY_FINANCING_PARTY.json`). They govern Work3 Guaranty family seal and downstream M5–M7 repair for this family.

**Delegation note:** Ben delegated technical auto-recording of these rulings on 2026-08-24. Dispositions mirror programme Q01–Q03 (AGREED / AGREED / MODIFIED inference rule). The sealed role schema already binds Q01–Q03; this note records programme direction for Work3 profile authoring.

---

## GUARANTY_FINANCING_PARTY-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with pack recommended reading.

One independently operative authored unit is **one proposition**. Coordinated elements within a guaranty or financing-party limb are stored as **roles or linked children** within that proposition — not as unrelated duplicate rows unless Q01's unit boundary says they are separate operative units.

---

## GUARANTY_FINANCING_PARTY-Q02 — One owner; others link

**Ruling:** **AGREED** with pack recommended reading.

When content overlaps families (e.g. financing-source protection vs performance guaranty vs financing covenants), **one family owns** the semantic proposition. Other families **link** to its stable identity. Do **not** duplicate the same meaning in multiple families.

**Consequence for Guaranty:** The five provision-example profiles pending subtype grouping review (especially `PERFORMANCE_GUARANTY` vs `FINANCING_SOURCE_PROTECTION`) require explicit legal acknowledgment before taxonomy collapse — technical Milestone A may proceed with five distinct blueprint rows and `LEGAL_GROUPING_REVIEW_REQUIRED` flags.

---

## GUARANTY_FINANCING_PARTY-Q03 — Inference allowed; must be marked

**Ruling:** **MODIFIED** from pack recommended reading.

| Pack recommended | Ben ruling |
|---|---|
| Fail only the dependent proposition; do not infer the role | **Inference from ambiguous or unresolved M3 context is permitted**, but any value filled by inference must be **explicitly marked** as inferred / pending human approval. It must **not** be served or sealed as proven fact until approved. |

---

## What these rulings do not do

- They do **not** approve the five-profile inventory (separate Ben inventory session with default APPROVE-all technical disposition).
- They do **not** resolve `PERFORMANCE_GUARANTY` subtype grouping — that remains a legal hold flagged in review packets.
