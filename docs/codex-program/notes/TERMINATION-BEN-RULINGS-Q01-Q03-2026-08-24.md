# Termination family — Ben rulings (Q01–Q03)

Date: 2026-08-24  
Status: **PROGRAMME INPUT** (not yet bound to a sealed ruling receipt or role-schema `ben_ruling_id`)

These rulings close the three open narrow legal questions in the Termination calibration pack (`TERMINATION.json`). They govern Work3 Termination family seal and downstream M5–M7 repair for this family.

---

## TERMINATION-Q01 — One proposition per operative unit

**Ruling:** **AGREED** with pack recommended reading.

One independently operative authored unit is **one proposition**. Coordinated elements (dates, notice mechanics, carve-outs, extension limbs where they are part of the same operative grant) are stored as **roles or linked children** within that proposition — not as unrelated duplicate rows unless Q01’s unit boundary says they are separate operative units.

**Consequence for outside date:** Automatic or elective **extension** may be a **linked child** or role on the same outside-date proposition (preferred under this ruling), or a separate proposition if it is independently operative in the source — but it must **not** be silently omitted while the parent row claims `COMPLETE` / `SUFFICIENT`.

---

## TERMINATION-Q02 — One owner; others link

**Ruling:** **AGREED** with pack recommended reading.

When content overlaps families (e.g. Marketing Period extension language, conditions cross-referenced in termination sections), **one family owns** the semantic proposition. Other families **link** to its stable identity. Do **not** duplicate the same meaning in multiple families.

**Consequence for Termination:** Expanding from the sealed M5 four-bucket candidate set to **ten** third-level buckets in the 45-profile inventory is a **taxonomy expansion**, not a silent patch. Family seal requires explicit acknowledgment that Termination owns these subtypes and that overlapping surfaces (extension, conditions) follow link-only consumption elsewhere.

---

## TERMINATION-Q03 — Inference allowed; must be marked

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

- They do **not** approve the 45-profile inventory (separate session).
- They do **not** approve outside-date **extension** shapes (deferred; see run plan).
- They do **not** replace B9e disclosure-note ruling (`contained in non-public disclosure letter` — display only).
- They do **not** write to Work3 identity, product DB, or serving.

**Next binding step:** Record these in a successor **Termination family ruling receipt** when that authority exists; until then this note is the checklist source for agents and Ben.
