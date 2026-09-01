# D&O indemnification family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (auto-recorded per Ben technical delegation; not yet bound to a sealed ruling receipt)

These rulings close the three open narrow legal questions in the D&O calibration pack (`DNO_INDEMNIFICATION.json`). They govern Work3 D&O family seal and downstream M5–M7 repair for this family.

**Delegation note:** Ben delegated technical auto-recording of these rulings on 2026-08-24. Dispositions mirror Termination Q01–Q03 (AGREED / AGREED / MODIFIED inference rule).

---

## DNO_INDEMNIFICATION-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with pack recommended reading.

One independently operative authored unit is **one proposition**. Coordinated elements (survival years, advancement mechanics, tail premium caps, charter continuation limbs where they are part of the same operative grant) are stored as **roles or linked children** within that proposition — not as unrelated duplicate rows unless Q01's unit boundary says they are separate operative units.

**Consequence for linked duties (item-42):** Rights survival, no-adverse-amendment, and claim-continuation subprofiles inside one Metsera source unit may be **linked children** on the same operative proposition (preferred under this ruling), or separate propositions if independently operative in the source — but must **not** be silently omitted while the parent row claims `COMPLETE` / `SUFFICIENT`.

---

## DNO_INDEMNIFICATION-Q02 — One owner; others link

**Ruling:** **AGREED** with pack recommended reading.

When content overlaps families (e.g. indemnification language cross-referenced in representations or interim operating covenants), **one family owns** the semantic proposition. Other families **link** to its stable identity. Do **not** duplicate the same meaning in multiple families.

**Consequence for D&O:** The comparator's seven subtype buckets vs **31** deal-specific profile instances in the Phase 2 partition is a **taxonomy expansion**, not a silent patch. Family seal requires explicit acknowledgment that D&O owns these subtypes and that overlapping surfaces (shared-source duration spans, claim-continuation delegation) follow link-only consumption elsewhere.

---

## DNO_INDEMNIFICATION-Q03 — Inference allowed; must be marked

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

- They do **not** approve the 31-profile inventory (separate Ben inventory session).
- They do **not** approve item-42 linked-duty shape dispositions (deferred to inventory session).
- They do **not** replace contract item-42 preservation (`ITEM42_DECISION_ID` byte spans unchanged).
- They do **not** write to Work3 identity, product DB, or serving.

**Next binding step:** Record these in a successor **D&O family ruling receipt** when that authority exists; until then this note is the checklist source for agents and Ben.
