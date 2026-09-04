# D&O indemnification family — runnable plan (current → seal → next)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md` (full product path M7→M9→M10→Product 3–9); this note scopes **`DNO_INDEMNIFICATION` only**.

Parallel prep: `DNO-WORK3-PARALLEL-PREP-2026-08-24.md`.  
Pattern reference: `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` (Termination Milestone A complete as of 2026-08-24).

Ben rulings: **Q01–Q03 recorded and seal-bound** — `docs/codex-program/notes/DNO-BEN-RULINGS-Q01-Q03-2026-08-24.md` (AGREED/AGREED/MODIFIED).

Milestone A: **COMPLETE on 2026-08-24** (agent `0a6c45cb`; verified 2026-08-24 evening). The 31-profile inventory, Ben disposition (26 APPROVE / 5 HOLD), family seal, in-memory registration, and **on-disk profile package** are green (`tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` — **9/9 pass**). Five Metsera linked-duty profiles remain honest `HOLD` rows with a `DEFERRED` item-42 binding. Activation remains forbidden.

---

## What “done” means for D&O (two levels)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | ~31 comparator-derived blueprint profiles Ben-approved (with honest holds/deferrals); Work3 D&O package registration authority green; item-42 linked-duty ruling preserved | Full product, all families, production serving |
| **B. Full product** | PLAN §1 outcome via M7 repair → M9 → M10 → Product Stages 3–9 | Out of scope for this note except “what’s next” |

This plan runs to **Milestone A**, then lists **immediate programme steps after A**.

---

## Profile count estimate (from calibration pack)

Source: `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/DNO_INDEMNIFICATION.json`.

| Signal | Count | Notes |
|---|---:|---|
| Comparator runs (deals) | **7** | concho, metsera, modiv, redhat, skechers, skywater, topbuild |
| Provision examples | **7** | One complete source unit per deal |
| M5 candidate subtype buckets | **7** | `INDEMNIFICATION_AND_EXCULPATION`, `EXPENSE_ADVANCEMENT`, `CHARTER_AND_CONTRACT_CONTINUATION`, `DNO_INSURANCE_TAIL`, `CLAIMS_PROCEDURE`, `SUCCESSOR_ASSUMPTION`, `THIRD_PARTY_ENFORCEMENT` |
| Sum of `resolution_claims` across comparator runs | **31** | Per-deal: 5+5+5+3+5+4+4 |
| Claim-definition keys in scope | **9** | indemnification continuation/survival, advancement, charter protection, TPB rights, tail obligation/period, premium caps |
| Item-42 Metsera linked subprofiles (contract-sealed) | **+3** | `RIGHTS_SURVIVAL`, `NO_ADVERSE_AMENDMENT`, `CLAIM_CONTINUATION` — may fold into main unit rows or add inventory rows after Ben Q01 |

**Planning estimate for Stage B blueprint inventory:** **~28–31 profiles** (deal-specific shape instances from comparator runs), **not** Termination’s 45. Upper bound if every deal×subtype were materialised independently: 49 — not expected; comparator evidence supports **31** as the working census until Phase 2 partition proves otherwise.

Corpus cross-check: `tests/canonical-v2-claim-scoped-single-row-preview.test.js` expects **31** D&O rows across the fixed sample.

---

## Current state (verified 2026-08-24 evening — 9/9 D&O Work3 tests GREEN)

| Check | State |
|---|---|
| M5 calibration pack + proposed role schema | **Proposed** — `PROPOSED_AWAITING_BEN_APPROVAL` |
| Native extraction runs (7 deals) | **On disk** — `*-dno-indemnification-20260809-2xk-final/` |
| Contract item-42 (Metsera §5.7 linked duties) | **Sealed** — `ITEM42_DECISION_ID`, shared-source pair in `m7-v2-contract.js` |
| Phase 2 authoring authority | ✅ `m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json` (31 terminals; GREEN) |
| Phase 3 reference chain | **Not started** — D&O stress is linked duties / shared source, not Termination reference frontier |
| Phase 4 family profile package review authority | ✅ `m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json` (31-profile schedule; GREEN) |
| Work3 Milestone A evidence | ✅ Inventory authority + packet; 26 APPROVE / 5 HOLD disposition; session receipt; seal authority + receipt; registration authority |
| D&O profile package on disk | ✅ `m7-v2-repair-family-work3-profile-package-dno-indemnification.json` (31 profiles, `TREE_OUTPUT_INCOMPLETE`) |
| Dedicated Work3 test module | ✅ `tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` — 9/9 GREEN |
| `prepareDno*` facades | ✅ Phase 2, Phase 4, inventory, Ben disposition, seal, and registration facades GREEN in `m7-v2-dno-indemnification-authoring.js` |
| Termination Milestone A | **Complete** — spine merge strategy now unblocked for coordinated D&O slice |
| D&O Milestone A | **Complete** — inventory → disposition (26 APPROVE / 5 HOLD) → seal → registration → profile package on disk; activation forbidden |

**Do not fork the Termination spine in one shot.** Termination’s Phase 2→5 + Work3 path is ~800KB authoring module + 750KB work3 test; D&O needs a **minimal first slice** (below) in a **new test file** and evidence-only authorities before any shared-spine merge.

---

## Minimal first implementation slice (recommended)

Land in this order; each step has a RED→GREEN test gate before the next.

| Order | Deliverable | Why first |
|---|---|---|
| **S1** | `evidence/.../m7-v2-repair-contract-dno-indemnification-authoring-phase2-authority-v2.json` | Binds 7 comparator runs + item-42 additive identity; no facade yet |
| **S2** | `evidence/.../m7-v2-repair-contract-dno-indemnification-authoring-phase4-family-profile-package-review-authority.json` | ✅ **Profile package review schedule** (31 profiles; Phase 3 skipped) |
| **S3** | `tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` with Phase 2 + Phase 4 tests | ✅ Isolated from Termination merge wars |
| **S4** | `prepareDnoIndemnificationPhase2FamilyProposal` + `prepareDnoIndemnificationFamilyProfilePackageReview` | ✅ GREEN in `m7-v2-dno-indemnification-authoring.js` |
| **S5** | Inventory review packet script + Ben Q01–Q03 ruling capture | ✅ Complete; packet has 31 human-readable `shape_summary` rows |

**Intentionally omitted for D&O:** Phase 3 reference materialisation, Work3 Stage A/B, core integration, and Phase 5. D&O Milestone A derives directly from the Phase 4 review facade.

**First RED test name pattern** (dedicated module, mirror Termination Phase 2 entry):

```text
Phase2 proposal derives a deterministic unapproved DNO_INDEMNIFICATION partition
```

**GREEN proof command (Milestone A — all 9 tests pass as of 2026-08-24):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js
```

Expect exit 0, `# pass 9`. Do **not** pipe to `tail`/`head`; check exit code directly.

Evidence regeneration (after Phase 4 facade or profile package changes):

```bash
node scripts/stage-2y-structure-m7-v2-dno-indemnification-inventory-review-packet.mjs
node scripts/stage-2y-structure-m7-v2-dno-indemnification-ben-inventory-disposition.mjs
node scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs
```

The disposition script also regenerates Work3 successor authority JSONs and the family package seal receipt.

Subsequent test name patterns (later slices, same file):

| Slice | Test name pattern |
|---|---|
| Phase 4 review schedule | `Phase4 DNO_INDEMNIFICATION family profile package review returns unapproved proposals without Work3 identities` |
| Stage B blueprint | `Work3 DNO_INDEMNIFICATION Stage B builds the unapproved blueprint proposal without Work3 identity or core integration` |
| Ben inventory session | `Work3 DNO_INDEMNIFICATION Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal` |
| Family package seal | `Work3 DNO_INDEMNIFICATION family package seal captures Ben seal without Work3 identity or premature registration` |
| Registration | `Work3 DNO_INDEMNIFICATION family package registration binds seal receipt without activation` |
| Profile package on disk | `DNO Milestone A family profile package on disk validates 31 registered profiles` |

---

## Phase 0 — Hygiene (agent, ~1 session)

**Goal:** Stop false rebuilds; make Ben’s eventual review possible without reading raw comparator JSON.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 0.1 | Agent | Confirm `DNO-WORK3-PARALLEL-PREP-2026-08-24.md` spine no-touch list still accurate | No accidental `work3.test.js` / `m7-v2-profile-authoring.js` edits in D&O branch |
| 0.2 | Agent | Ben legal intake on calibration pack + proposed role schema (7 subtypes, Q01–Q03) | Ben acknowledges or revises subtype tree before Phase 2 authority |
| 0.3 | Agent | Draft inventory packet skim note (deal, shape_summary, review_flags) — script **not** written until S4 green | Note lists 31-row census assumption |
| 0.4 | Agent | Flag item-42 rows with `LINKED_DUTY_SHARED_SOURCE` in `review_flags`; preserve `ITEM42_DECISION_ID` byte spans | Contract suite still green |

**Comparator binding paths** (all under `evidence/canonical-v2/`):

- `concho-dno-indemnification-20260809-2xk-final/`
- `metsera-dno-indemnification-20260809-2xk-final/` (+ item-42 closure)
- `modiv-dno-indemnification-20260809-2xk-final/`
- `redhat-dno-indemnification-20260809-2xk-final/`
- `skechers-dno-indemnification-20260809-2xk-final/`
- `skywater-dno-indemnification-20260809-2xk-final/`
- `topbuild-dno-indemnification-20260809-2xk-r4-final/`

---

## Phase 1 — Governance reconciliation (agent + Ben, ~1 session)

**Goal:** Paper matches code; approval has somewhere to land.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 1.1 | Ben | Rule on Q01–Q03 (one proposition per operative unit; one semantic owner; inference policy) | ✅ `DNO-BEN-RULINGS-Q01-Q03-2026-08-24.md` (auto-recorded per technical delegation) |
| 1.2 | Agent | Commit S1 Phase 2 authority v2 JSON (governed proposal from M2/M3/M4/M5 + item-42) | ✅ Authority sha256 bound in test |
| 1.3 | Agent | Commit S2 Phase 4 review authority with **comparator-run review schedule** (31 profile slots) | ✅ Schedule matches sum of `expected_counts` |
| 1.4 | Agent | RED test S3 in `stage-2y-structure-m7-v2-repair-dno-work3.test.js` | ✅ Exit 0 |
| 1.5 | Agent | GREEN `prepareDnoIndemnificationPhase2FamilyProposal` + `prepareDnoIndemnificationFamilyProfilePackageReview` | ✅ Phase 2 + Phase 4 proofs pass |

**Stop:** Do not run Ben’s inventory session until 1.1 and 1.5 exist.

---

## Phase 2 — Ben inventory session (Ben + agent scribe, ~2–3 hours)

**Goal:** Programme input: which of ~31 shapes Ben accepts, holds, or rejects.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 2.1 | Ben | Review rows using **shape_summary** + deal + `review_flags` (not raw signature alone) | ✅ 31-row packet captured |
| 2.2 | Ben | **Default:** APPROVE subtype shape except explicit gaps | ✅ 26 APPROVE |
| 2.3 | Ben | **Hold** rows where linked-duty / shared-source / tail mechanics need explicit ruling | ✅ 5 Metsera HOLD rows |
| 2.4 | Ben | Confirm item-42 linked-duty treatment | ✅ Five holds preserve the shared-source review stop |
| 2.5 | Ben | Acknowledge M5 **7 subtype buckets** vs comparator **31 deal-specific instances** | ✅ `taxonomy_expansion_acknowledged=true` |
| 2.6 | Agent | Record dispositions in successor approval artefact — not by editing draft packet JSON | ✅ Disposition + session receipt sealed |

**Bucket checklist (planning — refine after Phase 2 partition):**

| Bucket | Comparator signal | Ben focus |
|---|---|---|
| Indemnification & exculpation (core) | All 7 deals | Survival years, continuation scope |
| Expense advancement | Subset of 5-claim deals | Advancement vs indemnification boundary |
| Charter / contract continuation | Most deals | Charter vs bylaw protection |
| D&O insurance tail | Subset | Tail period, premium cap mechanics |
| Claims procedure | Sparse | Notice / procedure vs substantive indemnity |
| Successor assumption | Sparse | Assumption obligation shape |
| Third-party enforcement | Sparse | TPB / beneficiary rights |
| Item-42 linked duties (Metsera) | Fixed sample | Shared-source duration; delegation to survival owner |

---

## Phase 3 — Family package seal (agent + Ben) — **Milestone A entry**

**Goal:** D&O Work3 package sealed in-memory; zero product writes and zero activation.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 3.1 | Agent | GREEN `prepareDnoIndemnificationWork3FamilyPackageSeal` + authority JSON + test | ✅ Seal facade proof |
| 3.2 | Ben | Seal receipt binds Q01–Q03 digest + disposition + session receipt | ✅ Seal receipt recorded |
| 3.3 | Agent | Preserve item-42 / linked-duty holds | ✅ `linked_duty_disposition_binding.disposition_status=DEFERRED`; no separate table required |

**Deferred is not forbidden** — holds on tail premium cap, advancement carve-outs, or unresolved M3 edges must not imply complete serving.

---

## Phase 4 — Family package registration (agent + Ben) — **Milestone A complete**

**Goal:** D&O Work3 package registered in-memory with Work3 identity; still no activation.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 4.1 | Agent | GREEN `prepareDnoIndemnificationWork3FamilyPackageRegistration` + successor authority JSON | ✅ 31 profile identities + 1 family identity = 32 Work3 identities |
| 4.2 | Agent | Bind the family seal receipt without activation | ✅ In-memory registration only; zero product writes |
| 4.3 | Programme | Activation and product serving | Deferred beyond Milestone A |

**Proof bundle:**

```bash
CI=true npm test
npm run build
bash scripts/lint/forbidden-patterns.sh
```

Filtered D&O Work3 proof:

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js
```

---

## What to do next after D&O family seal (programme)

| Order | Work | Owner | Proof |
|---|---|---|---|
| N1 | Remaining Work 3 archetypes (General Covenants, Guaranty, …) | Agent | Per-family run plans |
| N2 | Work 4 — M6 formatter-only | Agent | M6 shadow parity |
| N3 | Work 5 — 50-item lawyer review replay | Ben + agent | Improved pass rate |
| N4–N9 | Per `TERMINATION-FAMILY-RUN-PLAN-2026-08-24.md` programme ladder | Agent / Ben | M7 accepted → product |

D&O is **one family** inside N1. Item-42 NORMAL path in `work1-acceptance-cases.json` waits until 4.3.

---

## Execution order (agent “just run at it”)

1. **Phase 0** — Ben calibration intake + hygiene flags  
2. **Minimal slice S1–S4** — Phase 2 authority + Phase 4 review schedule + RED test + first facade  
3. **Phase 1** — governance reconciliation + Ben Q01–Q03  
4. **Phase 2** — ✅ Ben inventory session (~31 rows)  
5. **Phase 3** — ✅ family package seal  
6. **Phase 4** — ✅ registration → Milestone A  
7. Hand off to programme N1–N9  

**Do not:** copy Termination’s full Phase 3 reference chain without a D&O deal proving the edge.  
**Do not:** edit `m7-v2-profile-authoring.js` or `work3.test.js` in the first PR — use dedicated module + evidence.  
**Do not:** edit draft packet JSON as approval.  
**Do not:** register product or change production serving without explicit authority.

---

## Appendix — open legal questions (calibration pack)

- **Q01:** One independently operative authored unit → one proposition; parts are roles/linked children.  
- **Q02:** One owner family; others link.  
- **Q03:** Ambiguous M3 edge — recommended: fail dependent proposition only; no silent inference.

**D&O-specific stress (vs Termination):** linked duties inside one source unit, shared typed values (`SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE`), claim-continuation delegation — not governed-disclosure-note / Company Letter frontier.
