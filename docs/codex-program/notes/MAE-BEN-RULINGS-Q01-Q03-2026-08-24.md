# MAE Definition family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (auto-recorded per Ben technical delegation; not yet bound to a sealed ruling receipt)

These rulings close the three open narrow legal questions in the MAE Definition calibration pack (`MAE_DEFINITION.json`). They govern Work3 MAE family seal and downstream M5–M7 repair for this family.

**Delegation note:** Ben delegated technical auto-recording of these rulings on 2026-08-24. Dispositions mirror Termination Q01–Q03 (AGREED / AGREED / MODIFIED inference rule). The sealed role schema already binds Q01–Q03; this note records programme direction for Work3 profile authoring.

---

## MAE_DEFINITION-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with pack recommended reading.

One independently operative authored unit is **one proposition**. Coordinated elements (definition prongs, carve-out lists, disproportionality carve-backs, underlying-cause restoration limbs where they are part of the same operative grant) are stored as **roles or linked children** within that proposition — not as unrelated duplicate rows unless Q01's unit boundary says they are separate operative units.

**Consequence for carve-outs:** A single MAE carve-out code may be a **linked child** on the same exclusion proposition (preferred under this ruling), or a separate proposition if independently operative in the source — but must **not** be silently omitted while the parent row claims `COMPLETE` / `SUFFICIENT`.

---

## MAE_DEFINITION-Q02 — One owner; others link

**Ruling:** **AGREED** with pack recommended reading.

When content overlaps families (e.g. MAE definition language cross-referenced in conditions, termination, or representations), **one family owns** the semantic proposition. Other families **link** to its stable identity. Do **not** duplicate the same meaning in multiple families.

**Consequence for MAE:** The sealed M5 five-bucket subtype set vs deal-specific profile instances in the Phase 2 partition is a **taxonomy expansion**, not a silent patch. Family seal requires explicit acknowledgment that MAE_DEFINITION owns these subtypes and that overlapping surfaces (carve-out codes, subject-term corroboration) follow link-only consumption elsewhere.

---

## MAE_DEFINITION-Q03 — Inference allowed; must be marked

**Ruling:** **MODIFIED** from pack recommended reading.

| Pack recommended | Ben ruling |
|---|---|
| Fail only the dependent proposition; do not infer the role | **Inference from ambiguous or unresolved M3 context is permitted**, but any value filled by inference must be **explicitly marked** as inferred / pending human approval. It must **not** be served or sealed as proven fact until approved. |

**Machine-readable expectation (programme direction):**

- Provenance or validation must carry an **inference disposition** (e.g. `INFERRED_PENDING_APPROVAL`) distinct from `PROVEN` / `MATERIALISED`.
- UI and review packets must show inferred fields as **needs approval**, not blank and not green.
- Fail-closed still applies to **serving**: unapproved inference does not render as settled law.

---

## What these rulings do not do

- They do **not** approve the four-profile (six-terminal) inventory (separate Ben inventory session).
- They do **not** approve self-containment or subject-term review stamp dispositions (deferred to inventory session).
- They do **not** replace native resolution stamps (`MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN`, `MAE_DEFINITION_SUBJECT_TERM_MISMATCH`).
- They do **not** write to Work3 identity, product DB, or serving.

**Next binding step:** Record these in a successor **MAE family ruling receipt** when that authority exists; until then this note is the checklist source for agents and Ben.
