# General Covenants family — runnable plan (current → seal → next)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md` (full product path M7→M9→M10→Product 3–9); this note scopes **`GENERAL_COVENANTS` only**.

Parallel prep: `GENERAL-COVENANTS-WORK3-PARALLEL-PREP-2026-08-24.md`.  
Pattern reference: `DNO-FAMILY-RUN-PLAN-2026-08-24.md` (D&O Milestone A complete as of 2026-08-24).

Ben rulings: **Q01–Q03 recorded** — `GENERAL-COVENANTS-BEN-RULINGS-Q01-Q03-2026-08-24.md` (Ben delegated technical auto-recording 2026-08-24).

Milestone A slice S1–S7: **COMPLETE** (2026-08-24). Phase 2 + Phase 4 + inventory session + seal + registration + on-disk package.

---

## What “done” means for General Covenants (two levels)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | Comparator-derived blueprint profiles Ben-approved; Work3 GC package registration authority green; item-44 access-scope review preserved | Full product, all families, production serving |
| **B. Full product** | PLAN §1 outcome via M7 repair → M9 → M10 → Product Stages 3–9 | Out of scope for this note except “what’s next” |

This plan runs to **Milestone A**, then lists **immediate programme steps after A**.

---

## Profile count estimate (from calibration pack)

Source: `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/GENERAL_COVENANTS.json`.

| Signal | Count | Notes |
|---|---:|---|
| Comparator runs (deals) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Provision examples | **7** | One complete source unit per deal (all proposed `ACCESS` in pack examples) |
| M5 candidate subtype buckets | **11** | ACCESS, LITIGATION_NOTIFICATION, GENERAL_NOTIFICATION, SECTION_16, DELISTING, TAKEOVER_LAW, MERGER_SUB_OBLIGATION, PUBLICITY, RESIGNATION, CVR, LISTING |
| Sum of `resolution_claims` across comparator runs | **54** | Per-deal: 9+8+6+3+7+12+9 |
| Phase 2 partition (verified) | **54** | One terminal per admitted M4 claim; signatures include `m4_claim_id` to avoid within-deal collapse |
| ACCESS terminals (item-44 stress) | **6** | Flagged `ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED` in Phase 4 schedule |

**Planning estimate for Stage B blueprint inventory:** **54 profiles** (comparator census; not 11 subtype buckets × 7 deals).

Corpus cross-check: seven GC extraction runs under `evidence/canonical-v2/*-general-covenants-20260809-2xk-final/` (topbuild `…-r3-final`).

---

## Current state (verified 2026-08-24 — 9/9 GC Work3 tests GREEN)

| Check | State |
|---|---|
| M5 calibration pack + proposed role schema | **Proposed** — `PROPOSED_AWAITING_BEN_APPROVAL` |
| Native extraction runs (7 deals) | **On disk** |
| Phase 2 authoring authority | ✅ `m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json` (54 terminals; GREEN) |
| Phase 3 reference chain | **Not started** — GC first slice skips reference materialisation |
| Phase 4 family profile package review authority | ✅ `m7-v2-repair-contract-general-covenants-authoring-phase4-family-profile-package-review-authority.json` (54-profile schedule; GREEN) |
| Ben Q01–Q03 rulings note | ✅ `GENERAL-COVENANTS-BEN-RULINGS-Q01-Q03-2026-08-24.md` |
| Work3 Milestone A evidence | ✅ inventory packet, disposition, session receipt, seal + registration authorities |
| GC profile package on disk | ✅ `m7-v2-repair-family-work3-profile-package-general-covenants.json` (54 profiles) |
| Dedicated Work3 test module | ✅ `tests/stage-2y-structure-m7-v2-repair-general-covenants-work3.test.js` — **9/9 GREEN** |
| `prepareGeneralCovenants*` facades | ✅ Phase 2 + Phase 4 + Work3 ladder in `m7-v2-general-covenants-authoring.js` |
| GC Milestone A | ✅ **COMPLETE** — 54 APPROVE, 6 ACCESS item-44 stamps acknowledged |

**Do not edit** `m7-v2-profile-authoring.js` until coordinated spine merge.

---

## Minimal first implementation slice (recommended)

| Order | Deliverable | State |
|---|---|---|
| **S1** | `m7-v2-repair-contract-general-covenants-authoring-phase2-authority-v2.json` | ✅ GREEN |
| **S2** | `m7-v2-repair-contract-general-covenants-authoring-phase4-family-profile-package-review-authority.json` | ✅ GREEN |
| **S3** | `tests/stage-2y-structure-m7-v2-repair-general-covenants-work3.test.js` Phase 2 + Phase 4 | ✅ GREEN |
| **S4** | `prepareGeneralCovenantsPhase2FamilyProposal` + `prepareGeneralCovenantsFamilyProfilePackageReview` | ✅ GREEN |
| **S5** | Inventory review packet + Ben Q01–Q03 ruling capture | ✅ GREEN |
| **S6** | Disposition + session receipt + seal + registration authorities | ✅ GREEN |
| **S7** | On-disk profile package + full Work3 test ladder | ✅ GREEN |

**GREEN proof command (Milestone A complete):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-general-covenants-work3.test.js
```

Expect exit 0, `# pass 9`. Do **not** pipe to `tail`/`head`; check exit code directly.

Evidence regeneration:

```bash
node scripts/stage-2y-structure-m7-v2-general-covenants-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-general-covenants-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-general-covenants-family-profile-package.mjs
```

---

## Phase 0 — Hygiene (agent)

| Step | Action | Gate |
|---|---|---|
| 0.1 | Confirm spine no-touch list in prep note | No `work3.test.js` / `m7-v2-profile-authoring.js` edits |
| 0.2 | Ben legal intake on calibration pack (11 subtypes, Q01–Q03) | Ben acknowledges or revises before inventory seal |
| 0.3 | Flag ACCESS rows with item-44 review stop in Phase 4 schedule | 6 ACCESS rows carry `ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED` |

**Comparator binding paths** (all under `evidence/canonical-v2/`):

- `concho-general-covenants-20260809-2xk-final/`
- `metsera-general-covenants-20260809-2xk-final/`
- `modiv-general-covenants-20260809-2xk-final/`
- `redhat-general-covenants-20260809-2xk-final/`
- `skechers-general-covenants-20260809-2xk-final/`
- `skywater-general-covenants-20260809-2xk-final/`
- `topbuild-general-covenants-20260809-2xk-r3-final/`

---

## Phase 1 — Governance reconciliation (agent + Ben)

| Step | Owner | Action | Gate |
|---|---|---|---|
| 1.1 | Ben | Rule on Q01–Q03 | ✅ recorded (delegated auto-capture) |
| 1.2 | Agent | Phase 2 authority v2 | ✅ |
| 1.3 | Agent | Phase 4 review authority (54 profile slots) | ✅ |
| 1.4 | Agent | RED→GREEN tests in dedicated module | ✅ |
| 1.5 | Agent | Phase 2 + Phase 4 facades | ✅ |

---

## Phase 2 — Ben inventory session (Ben + agent scribe)

**Goal:** Which of **54** comparator-derived shapes Ben accepts, holds, or rejects.

**Outcome (2026-08-24):** 54 APPROVE (default disposition). Six ACCESS terminals carry `ACCESS_SCOPE_WORK1_ITEM_44_REVIEW_UNAPPROVED` review stamp; item-44 scope disposition deferred at seal.

---

## Phase 3–4 — Seal and registration (Milestone A)

✅ **COMPLETE** — mirror D&O/MAE pattern. Package registered in-memory; activation forbidden until programme authority.

---

## GC-specific stress (vs D&O / Termination)

- **Topic classification:** 11 subtype buckets from native `COV-*` codes; not Termination reference frontier.
- **Access-covenant scope:** Work1 item-44 six access dimensions; `WIDER_MATERIAL_SCOPE_UNMODELLED`; 6 ACCESS terminals flagged.
- **Within-deal multiplicity:** Multiple terminals per deal per code (e.g. five `COV-NOTIFY` on Modiv); partition signatures bind `m4_claim_id`.

---

## Do not

- Edit `m7-v2-profile-authoring.js` in the first PR
- Edit draft inventory packets as approval
- Register product or change production serving without explicit authority
