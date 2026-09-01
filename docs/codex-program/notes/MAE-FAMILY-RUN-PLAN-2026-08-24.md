# MAE Definition family — runnable plan (current → seal)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md`; prep: `MAE-WORK3-PARALLEL-PREP-2026-08-24.md`  
Programme slot: **Work3 archetype #2** per `M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md` — after Termination Milestone A, before D&O (#3). Parallel prep may overlap D&O; **no spine merge** until Termination quiesces.

**Constraint this plan:** family-local authorities, `lib/canonical-v2/m7-v2-mae-definition-authoring.js`, branch tests only. **No spine edits yet.**

---

## What “done” means for MAE (Milestone A)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | Derived Work3 profile package on disk; Ben-approved subtype shapes (honest holds for self-containment / subject-term review stamps); registration authority green | Product serving, M9/M10, full calibration-pack Ben approval as `PROFILE_SET_V1` |

Stop at Phase 4 unapproved package review unless Ben approves a MAE-specific governed-disclosure gap (Termination B9e pattern does **not** apply).

---

## M5 pack — profile / subtype census

Source: sealed `family-role-schemas/MAE_DEFINITION.json` + `preparation/m5/calibration-packs/MAE_DEFINITION.json`.

### M5 subtype profiles (5 sealed)

| Subtype profile | Claim focus |
|---|---|
| `MAE_DEFINITION::DEFINITION_INSTANCE` | Operative “MAE means …” header unit |
| `MAE_DEFINITION::DEFINITION_PRONG` | `MAE_DEFINITION_PRONG` — `BUSINESS_EFFECTS`, `CONSUMMATION_PREVENTION` |
| `MAE_DEFINITION::EXCLUSION` | `MAE_CARVEOUT` — 25 enum codes (`MAE_CARVEOUT_CODES_V2`) |
| `MAE_DEFINITION::DISPROPORTIONALITY_CARVEBACK` | `MAE_DISPROPORTIONALITY_CARVEBACK` |
| `MAE_DEFINITION::UNDERLYING_CAUSE_RESTORATION` | Carve-back restoration / underlying-cause clauses |

**Claim keys in scope:** `MAE_CARVEOUT`, `MAE_DEFINITION_PRONG`, `MAE_DISPROPORTIONALITY_CARVEBACK`.  
**Programme rulings (sealed in role schema):** Q01 → one operative limb; Q02 → one semantic owner; Q03 → fail dependent proposition.

### Calibration comparator runs (5 deals, 108 M4 claims)

| Deal | Run | Resolution claims |
|---|---|---:|
| metsera | `metsera-mae-definition-20260809-2xk-final` | 15 |
| redhat | `redhat-mae-definition-20260809-2xk-final` | 15 |
| skechers | `skechers-mae-definition-20260809-2xk-final` | 12 |
| skywater | `skywater-mae-definition-20260809-2xk-final` | 28 |
| topbuild | `topbuild-mae-definition-20260809-2xk-r4-final` | 38 |
| **Total** | | **108** |

Pack status: `PROPOSED_AWAITING_BEN_APPROVAL` (control role schema is `BEN_APPROVED_AND_SEALED` — reconcile before claiming `PROFILE_SET_V1`).

### Work3 derived-profile estimate

| Metric | Value |
|---|---|
| Phase2 classification buckets | 5 (aligned to M5 subtypes) |
| M4 terminal units (calibration) | 108 |
| Work1 MAE acceptance cases | 5 (`item-33`…`item-36`, `item-47`) — carve-back operators |
| **Estimated derived Work3 profiles** | **~60–100** — partition `(classification_path, required_expression_signature)`; 25 carveout codes × nested `EXCEPTION_TO` / `TO_EXTENT` / `CONSEQUENCE_MODIFIER` variants inflate vs Termination’s 45 |

---

## Current state (verified 2026-08-24)

| Check | State |
|---|---|
| Termination Milestone A | **Green** — seal + registration facades |
| MAE Phase2–4 authoring authorities | **Phase4 complete** — 6 terminals, 108 M4 claims, 4 derived profiles; package review facade green |
| MAE profile package on disk | **Present** — `m7-v2-repair-family-work3-profile-package-mae-definition.json` (4 profiles, `TREE_OUTPUT_INCOMPLETE`) |
| `prepareMaeDefinition*` facades | **Milestone A complete** — Phase2 proposal + Phase4 review + inventory/seal/registration |
| Family-local authoring module | **Present** — `lib/canonical-v2/m7-v2-mae-definition-authoring.js` |
| Branch Work3 tests | **Present** — `tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js` (17 tests green) |
| Ben Q01–Q03 rulings note | **Present** — `docs/codex-program/notes/MAE-BEN-RULINGS-Q01-Q03-2026-08-24.md` |
| Native pipeline (producer, resolution, UI) | **Present** — pre–Work3 corroboration only |
| Work3 first-candidate binding | **Set** — `EXPECTED_FIRST_CANDIDATES.MAE_DEFINITION` = `MAE_DEFINITION::DEFINITION_INSTANCE` |

**Proof command (when branch tests exist):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js
```

Do **not** pipe to `tail`/`head`; check exit code and `# fail 0` (17 tests).

---

## Phase 0 — Governance gate (agent, ~½ session)

**Goal:** M5 paper matches sealed role schema before Phase2 terminal registry.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 0.1 | Agent | Record calibration-pack vs sealed-schema reconciliation note (pack `PROPOSED` vs schema `SEALED`; Q01–Q03 bound in schema) | Note in evidence or this plan’s appendix |
| 0.2 | Ben | Confirm MAE Q01–Q03 rulings apply to Work3 profile authoring (mirror Termination Q01–Q03 disposition pattern) | ✅ `MAE-BEN-RULINGS-Q01-Q03-2026-08-24.md` |
| 0.3 | Agent | Confirm Termination registration receipt is predecessor for programme manifest | `m7-v2-repair-termination-family-package-seal-receipt.json` exists |

**Stop:** Do not draft Phase2 authority until 0.2 is recorded (legal field contract per subtype).

---

## Phase 1 — Phase2 authority + partition (agent, ~1–2 sessions)

**Goal:** Terminal registry over five calibration agreements + Work1 MAE cases; `maeDefinitionProposalPartition` matching Termination shape.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 1.1 | Agent | ✅ `m7-v2-repair-contract-mae-definition-authoring-phase2-authority-v1.json` — six terminals; items 33–36 converge; item 47 distinct | 10 mae tests pass |
| 1.2 | Agent | ✅ `prepareMaeDefinitionFamilyProposal` + partition in `m7-v2-mae-definition-authoring.js` | RED→GREEN partition |
| 1.3 | Agent | ✅ `M7_V2_MAE_DEFINITION_*` error codes + branch tests | Stage B stub RED (expected) |

**Classification buckets:** `DEFINITION_INSTANCE`, `DEFINITION_PRONG`, `EXCLUSION`, `DISPROPORTIONALITY_CARVEBACK`, `UNDERLYING_CAUSE_RESTORATION`.

---

## Phase 2 — Phase3 reference (minimal) + Phase4 package (agent, ~2–3 sessions)

**Goal:** Unapproved family profile package bytes; **no** Termination temporal / Company Letter authorities unless Phase2 proves equivalent slots.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 2.1 | Agent | Phase3 authorities: definition / self-containment / subject-term materialisation only | **Skipped** — minimal Phase4 direct from Phase2 partition |
| 2.2 | Agent | ✅ Phase4 authority + `prepareMaeDefinitionFamilyProfilePackageReview` | 12 mae tests pass |
| 2.3 | Agent | ✅ Materialise `m7-v2-repair-family-work3-profile-package-mae-definition.json` | 17 mae tests pass; `validateSingleFamilyPackageInventory` green |

**Defer:** Phase5 governed-disclosure note and Work3 Stage A/B unless Ben identifies a MAE display-only gap.

---

## Phase 3 — Branch tests + inventory scaffold (agent, ~1 session)

**Goal:** Isolated proof surface; do not extend `work3.test.js`.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 3.1 | Agent | ✅ `tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js` — Phase2 partition + Phase4 review tests green | 16 mae tests pass |
| 3.2 | Agent | ✅ Inventory review packet script + draft JSON with `shape_summary` + `review_flags` | `m7-v2-repair-mae-4-profile-inventory-review-packet-draft.json` |

**Review stamps (not typed Work3 identity):** `MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN`, `MAE_DEFINITION_SUBJECT_TERM_MISMATCH`.

---

## Phase 4 — Ben inventory session + seal (Ben + agent, ~2–4 hours)

**Goal:** Milestone A — MAE Work3 package registered in-memory; zero product writes.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 4.1 | Ben | ✅ Review derived profiles by **subtype bucket** + deal + `review_flags` | Disposition file (APPROVE all 4) |
| 4.2 | Agent | ✅ `prepareMaeDefinitionWork3FamilyPackageSeal` facade (family-local) | Seal receipt JSON |
| 4.3 | Agent | ✅ Registration successor authority + `prepareMaeDefinitionWork3FamilyPackageRegistration` | 16 mae tests pass |

**Proof bundle (post–spine merge):**

```bash
CI=true npm test
npm run build
bash scripts/lint/forbidden-patterns.sh
```

---

## First slice recommendation

**Start here:** ✅ `MAE_DEFINITION::DEFINITION_INSTANCE` on **Red Hat** — landed in family-local module + phase2 authority v1.

**Second slice:** ✅ Metsera `EXCLUSION` / `CHANGE_IN_GAAP` — 2 terminals, 5 mae tests pass.

**Third slice:** ✅ Skechers `DISPROPORTIONALITY_CARVEBACK` / Work1 `item-33` — 3 terminals, 42 M4 claims, 6 mae tests pass.

**Fourth slice:** ✅ Skywater + Topbuild Work1 `item-34`…`item-36` convergence — 5 terminals, 89 M4 claims, 3 derived profiles (items 33–36 merge), 8 mae tests pass.

**Fifth slice:** ✅ Topbuild Parent MAE (section 3.2) Work1 `item-47` — 6 terminals, 108 M4 claims, 4 derived profiles, 10 mae tests pass.

**Sixth slice:** ✅ Phase4 family profile package review — 4-profile schedule, `prepareMaeDefinitionFamilyProfilePackageReview`, Ben Q01–Q03 rulings note, 12 mae tests pass.

**Seventh slice:** ✅ Milestone A — inventory packet + disposition (APPROVE all 4), seal + registration facades, 17 mae tests pass.

**Eighth slice:** ✅ Family profile package materialised on disk — 4 registered profiles, `validateSingleFamilyPackageInventory` green.

**Next:** Spine merge PR for MAE family-local slice; then Stage B blueprint / activation ladder per programme order (Termination quiesce → MAE → D&O).

---

## Files must NOT touch (until coordinated spine merge)

- `lib/canonical-v2/m7-v2-contract.js`
- `lib/canonical-v2/m7-v2-deterministic-generator.js`
- `lib/canonical-v2/m7-v2-profile-authoring.js`
- `tests/stage-2y-structure-m7-v2-repair-work3.test.js`
- Termination-only evidence under `m7-v2-repair-contract-termination-*`

**Merge order:** Termination quiesce → MAE family-local land → dedicated spine PR → D&O (#3) spine slice (separate commit).

---

## Execution order (agent “just run at it”)

1. **Phase 0** — M5 governance reconciliation + Ben Q01–Q03 confirmation for Work3  
2. **Phase 1** — Phase2 authority + `prepareMaeDefinitionFamilyProposal` (family-local)  
3. **Phase 2** — minimal Phase3 + Phase4 package on disk  
4. **Phase 3** — branch test file + inventory packet scaffold  
5. **Phase 4** — Ben inventory → seal → registration  
6. Hand off to **D&O** (`DNO-WORK3-PARALLEL-PREP-2026-08-24.md`) then programme N2–N9 ladder  

**Do not:** copy Termination B9e / outside-date / Company Letter authorities.  
**Do not:** merge MAE and D&O spine changes in one undiffed commit.  
**Do not:** claim `PROFILE_SET_V1` while calibration pack remains `PROPOSED_AWAITING_BEN_APPROVAL` without explicit reconciliation.

---

## Appendix — Ben rulings one-liner (M5 sealed)

- **Q01:** One independently operative authored unit → one proposition; parts are roles/linked children.  
- **Q02:** MAE_DEFINITION owns; other families link only.  
- **Q03:** Unresolved M3 edge fails the dependent proposition; no silent role fill.
