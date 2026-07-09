# Precedent Machine — PLAN (what's TO DO)

**One page. Only open work. Done work is deleted, not archived here.**

Goal: **Demo Bar** — all 40 deals render from the schema-first path with scale-safe
canonical output (same legal language → same result on every deal), query works, a
fresh deal ingests seamlessly, UI homogenized end-to-end.

How we work now: Fable (main agent) specs + audits + reviews; parallel work runs on
Fable/Opus subagents in isolated worktrees; mechanical/tested changes ship to `main`
on green; canonical-vocab and extraction changes are Fable-authored and gated by
golden eval + ingest-QA + quote verification, reprocessed per-type (not full
re-ingest). Frozen files (Phase-0-C @ `1ea062d`) stay frozen.

---

## 1. Canonical layer — the current program (biggest lever for scale)

Goal: kill render-time regex "bandaids" (~60 found) by driving output from
extraction-assigned canonical codes through `taxonomy.js` → `labelForCode`, so
identical clauses render identically across all 40 deals. Detail + inventory:
`PLAN-CANONICAL-LAYER.md`.

**TO DO:**

1. **Finish interest-rate-basis end-to-end (in flight).** Wiring (extract codebook + rubric feature + schema regen + transition-safe render) is on `wp/canonical-interest` — review the diff, then **run the gated reprocess** (TERMINATION_FEE), confirm codes populate, flip the render off the `summarizeRate` fallback, delete the regex.
2. **Templatize the loop for the other authored enums.** Same extraction-wire → reprocess → render-swap → cross-deal audit, for: governing law, primary forum, superior-proposal determiner, assignment posture, and the shared solicitation-act vocabulary (no-shop + COR).
3. **A2 remainder — reconcile the pull-refile / timing-agreement codes.** Extraction assigns two different codes (`MUTUAL_CONSENT` vs `NOT_UNREASONABLY_WITHHELD`) to the SAME clause. Fix in the extraction prompt so one clause → one coherent posture.
4. **A1 remaining clean deletes.** Concepts whose code already reaches the render — delete the regex, read the code: reps-control standard (`representativesStandardLabel` regex fallback), restraint finality (make extraction emit the enum reliably first).
5. **Author + wire the harder Section-B concepts** (need more corpus / judgment / discriminators): engagement standard + final-determination standard (refine the existing `fiduciaryOutStandard`/`changeRecStandard` enums with `phase`/`trigger` axes — freeze-gated), notice content, not-a-COR carve-outs, standstill/DADW, superior-proposal test limbs, acceptable-CA terms, acquisition-proposal definition, tail arming (composite), vote standard (data-poor — re-extract `approvalDefinition` first).
6. **Output layer (Phase 3).** One code→display-bundle registry consumed by ALL configs; delete the duplicated local label maps (`FIDUCIARY_STANDARD_LABELS` ×3, `BOARD_CHANGE_STANDARD_LABELS` ×3, `voteStandard` ×3) so one code → one output everywhere.
7. **Governance (Phase 4).** CI invariants: every taxonomy dict has a matching schema enum + tag family (collapse the three-place binding to one source); lint fails any render helper that regexes clause text to produce a label.

## 2. Extraction gaps — `PLAN-EXTRACTION-GAPS.md` (WP-EXTRACT-GAPS-01)

Structured-extraction fixes the redesign surfaced; feed M2/M3. **TO DO:**
- Material-Contracts per-bucket TRIGGER (dollar OR non-dollar) as a structured field + the correct per-bucket §3.13 sub-clause quote (some buckets capture the generic lead-in).
- IOC "in all material respects" standard; classify all 8 of 5.01(i)–(o) (currently `[PROPOSED] Unclassified`).
- Third-party-beneficiary attribute-mapping bug (`thirdPartyBeneficiaries` = 0 rows corpus-wide; names mis-stamped under `…Exceptions`).
- `effectiveTimeShort` "surviving corporation" corruption.
- Per-rep `linkedBringDownStandard` uniform-MAE mis-stamp (item F) — derive from the closing-condition tiers at extraction.

## 3. Milestones remaining (ship core product first; query is deferred)

- **M2 — schema deployed corpus-wide.** All 39 non-Metsera deals render from the schema-first path with the canonical output above; legacy fallback dead; reconciliation applied; parity audit green. (The canonical program + reprocess is the critical path here.)
- **M3 — ingest seamless.** A brand-new deal ingests end-to-end and renders identical to existing deals; two-pass definitions extraction.
- **M5 — UI homogenized + demo-ready.** Extend the review-page polish to all deals; admin pages consistent; full-doc overlay; landing grid; reports UI.
- **M4 — query surface (AFTER M5).** `/query` cross-cutting queries correct on schema-first data; UI polished. Deferred behind the core review product — do last.

## 4. Review-page polish (open items)

- Temp "all sections expanded on load" override — revert to per-section collapse memory when ready.
- No-shop section needs a fuller pass (Ben flagged; more feedback to come).
- Verify the whole page against the old pre-schema reference (`:3010`) once the canonical output lands, deal-by-deal beyond Metsera.
- Stale test cleanup: `tests/queries/claims-render-integration.test.js` `/^Carve-out: /` assertion (pre-existing drift, not in the `npm test` glob).

---

## Independent tracks

- `PLAN-TAXONOMY-GAPS.md` — G1–G11 taxonomy-review gaps; slot into the milestone where each does the most good.
- Freeze gates persist for already-frozen shapes; new gates only when a milestone requires one.
