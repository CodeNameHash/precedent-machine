# General Covenants family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (auto-recorded per Ben technical delegation; not yet bound to a sealed ruling receipt)

These rulings close the three open narrow legal questions in the General Covenants calibration pack (`GENERAL_COVENANTS.json`). They govern Work3 General Covenants family seal and downstream M5–M7 repair for this family.

**Delegation note:** Ben delegated technical auto-recording of these rulings on 2026-08-24. Dispositions mirror Termination Q01–Q03 (AGREED / AGREED / MODIFIED inference rule).

---

## GENERAL_COVENANTS-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with pack recommended reading.

One independently operative authored unit is **one proposition**. Coordinated elements (notice mechanics, scope qualifiers, business-hours timing, reasonableness limbs where they are part of the same operative grant) are stored as **roles or linked children** within that proposition — not as unrelated duplicate rows unless Q01's unit boundary says they are separate operative units.

**Consequence for access scope (item-44):** The six Work1 access dimensions (`ACCESS_OBJECTS`, `ACCESS_PURPOSE`, `NOTICE_REQUIREMENT`, `BUSINESS_HOURS_TIMING`, `REASONABLENESS`, `NON_INTERFERENCE`) may be **linked children** on the same access proposition (preferred under this ruling), or separate propositions if independently operative in the source — but must **not** be silently omitted while the parent row claims `COMPLETE` / `SUFFICIENT`.

---

## GENERAL_COVENANTS-Q02 — One owner; others link

**Ruling:** **AGREED** with pack recommended reading.

When content overlaps families (e.g. access or notification language cross-referenced in interim operating covenants or conditions), **one family owns** the semantic proposition. Other families **link** to its stable identity. Do **not** duplicate the same meaning in multiple families.

**Consequence for General Covenants:** The comparator's eleven subtype buckets vs **54** deal-specific profile instances in the Phase 2 partition is a **taxonomy expansion**, not a silent patch. Family seal requires explicit acknowledgment that GENERAL_COVENANTS owns these subtypes and that overlapping surfaces (shared notification spans, access delegation) follow link-only consumption elsewhere.

---

## GENERAL_COVENANTS-Q03 — Inference allowed; must be marked

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

- They do **not** approve the 54-profile inventory (separate Ben inventory session).
- They do **not** approve item-44 access-scope shape dispositions (deferred to inventory session review stamps).
- They do **not** replace Work1 item-44 preservation (`WIDER_MATERIAL_SCOPE_UNMODELLED` unchanged).
- They do **not** write to Work3 identity, product DB, or serving.

**Next binding step:** Record these in a successor **General Covenants family ruling receipt** when that authority exists; until then this note is the checklist source for agents and Ben.
