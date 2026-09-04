# Capitalisation (#25) comparator blockage — technical investigation

**Date:** 2026-08-25  
**Branch:** `codex/recover-m7-20260812`  
**Scope:** Why Work3 sees **0 governed comparator claims**; what would unblock Milestone A **without inventing legal dispositions or sealing a fake package**.

---

## Bottom line

Capitalisation is the only N1 family with **`exact_comparator_run_count: 0`** in the sealed M5 preparation registry. Its calibration pack has an **empty** `comparator_run_bindings` array and five **`SUPPLEMENTAL_NON_COMPARATOR`** source bindings only. Work3 Phase 2 terminal enumeration requires sealed comparator resolution evidence — there is nothing to author profiles from today.

This is **not** a Work3 generator bug and **not** fixable by sealing a synthetic one-profile package.

---

## Evidence chain (verified on disk)

| Layer | Capitalisation state | Contrast (e.g. Dividends #19) |
|---|---|---|
| `m5-calibration-policy.json` / `m5-preparation-authority.json` | `exact_comparator_run_count: 0` | Dividends: `1` |
| `preparation/m5/calibration-packs/CAPITALISATION.json` | `comparator_run_bindings: []` | Dividends: 1 concho run with `resolution_claims: 1` |
| Supplemental inputs | 5 deals, all `SUPPLEMENTAL_NON_COMPARATOR`, reason `COMPLETE_SOURCE_CALIBRATION_OUTSIDE_SEALED_FAMILY_COMPARATOR_REGISTRY` | Dividends: 4 supplemental + 1 comparator |
| M5 compound adapter (generalisation shadow) | `member_claim_count: 0`, `propositions: []` | — |
| Work3 Milestone A on disk | ❌ none | 24 other families sealed |

**Five supplemental deals (provision examples only):** concho §4.2, modiv §3.2, redhat §3.01(c), skechers §3.7, skywater §3.5.  
**Not in calibration pack:** TopBuild (capitalisation lives inside §3.1/3.2 sub-paragraphs — see `step-2e-topbuild-mapping.md`), Metsera, Concho buyer-side §5.2.

---

## Why zero — root causes (stacked)

### 1. Programme parking (primary)

Ben parked Capitalisation on **2026-08-08** under **Stage 9F** (`docs/core/PLAN.md`). Live extraction pins deliberately **exclude** Capitalisation from the TopBuild comparator corpus (`canonical-v2-live-extraction-run.mjs`: *"CAPITALISATION is deliberately absent because Ben parked the family"*).

M5 preparation finalised with **zero comparator runs** rather than promoting any live/replay artifact into the sealed registry.

### 2. No run ever entered the sealed comparator registry

Unlike wave-4 peers (Dividends 1 run, Consideration 4, Appraisal 3, etc.), **no** `evidence/canonical-v2/*-capitalisation-*-final/resolution.json` (or equivalent) is bound in `comparator_run_bindings`.

The calibration pack records `preparation_effects.model_calls: 0` and a STOP diagnostic `BEN_FAMILY_ROLE_APPROVAL_REQUIRED` (M5 prep lane — separate from the Ben-approved role schema now sealed at `family-role-schemas/CAPITALISATION.json`).

### 3. Partial replay exists but is non-comparator

`evidence/canonical-v2/modiv-capitalisation-20260807-replay/` has **9** resolved rows, but:

- Uses **legacy / adjacent** claim keys (`CAPITALIZATION_SHARE_COUNT`, `REPRESENTATION_MEASUREMENT_DATE`, `DISCLOSURE_SCHEDULE_CARVEOUT`) — not the seven sealed M5 Work3 claim defs (`CAPITALISATION_AUTHORISED_CAPITAL`, etc.).
- Classified supplemental-only; **not** wired as a comparator binding.
- Modiv **fullpin** live run failed at Step 2D (timeout plumbing — `--call-timeout-ms` never reached subprocess; see `step-2d-modiv-fan-out.md` BREAK 4). Runner now passes `timeoutMs` through `resolveRunConfig` (fixed since that note).

### 4. TopBuild gap

TopBuild is a standard comparator deal for other families but has **no** Capitalisation supplemental or comparator binding. Capital structure reps are sub-paragraphs of §3.1/3.2, not standalone titled sections — section-family classifier and pin strategy must be deal-specific before a TopBuild run is meaningful.

### 5. Representations overlap (future Q02, not today's 0)

Representations (#6, 70 profiles sealed) covers accuracy-standard content on shared printed sections. Once comparator data exists, expect **Q02 link-only** boundaries — same pattern as other rep-cluster siblings. This does **not** explain today's zero; it affects profile count **after** comparator runs land.

---

## What would unblock (technical path)

Ordered; each step produces inspectable artifacts — **no Milestone A seal until comparator bindings exist and Phase 2 can enumerate governed terminals**.

| Step | Work | Proof |
|---:|---|---|
| 1 | Confirm Stage 9F / parking scope with Ben if live comparator runs are in scope (programme authority — not a taxonomy pick) | Written go/no-go on running comparator extractions |
| 2 | Live extraction across supplemental deals (+ TopBuild once pins exist): `native-producer-capitalisation/v1` via `canonical-v2-live-extraction-run.mjs` | `resolution.json` + `validation.json` per deal under `evidence/canonical-v2/<deal>-capitalisation-*` |
| 3 | Map outputs to sealed M5 claim defs (`CAPITALISATION_*` keys in role schema) — resolution/normalisation work, not inventory disposition | Claim-key census per run matches role schema |
| 4 | Promote runs into M5 comparator registry: populate `comparator_run_bindings`, bump `exact_comparator_run_count`, re-finalise calibration pack | `stage-2y-structure-m5-preparation-finalise.mjs` green; pack `comparator_run_bindings` non-empty |
| 5 | Standard Work3 ladder: Phase 2 → Phase 4 → inventory packet → **Ben disposition** → family package → lawful fixture override | `capitalisation-work3.test.js` + `lawful-work3-fixture-add-override.mjs` |

**Explicit non-starters:**

- Sealing a synthetic one-profile package (lawful fixture would still lack real comparator provenance).
- Treating supplemental bindings or modiv replay as comparator without registry promotion.
- Absorbing Representations profiles without Ben Q02 rulings.

---

## Open legal gates (document only — not resolved here)

Calibration pack still lists **CAPITALISATION-Q01–Q03** as `OPEN_REQUIRES_BEN_RULING` (operative-unit partition, cross-family ownership, M3 edge fill). These gate **disposition quality**, not the mechanical **0 claims** blocker. Ben M5 programme rules were applied for other families verbatim; Capitalisation never reached that inventory stage.

---

## Related paths

- `docs/codex-program/notes/REMAINING-N1-FAMILIES-WORK3-PARALLEL-PREP-2026-08-24.md` §25
- `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md` — #25 blocked row
- `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/CAPITALISATION.json`
- `docs/codex-program/notes/step-2d-modiv-fan-out.md` — BREAK 4 (timeout / incomplete modiv fullpin)
- `docs/core/PLAN.md` — Stage 9F Capitalisation
