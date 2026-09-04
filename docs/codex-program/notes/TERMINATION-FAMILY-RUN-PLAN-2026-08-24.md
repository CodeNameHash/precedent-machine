# Termination family — runnable plan (current → seal → next)

Date: 2026-08-24  
Branch: `codex/recover-m7-20260812`  
Authority: `docs/core/PLAN.md` (full product path M7→M9→M10→Product 3–9); this note scopes **Termination only**.

Ben rulings: `TERMINATION-BEN-RULINGS-Q01-Q03-2026-08-24.md` (Q01 agreed, Q02 agreed, Q03 modified — inference allowed if marked pending approval).

---

## What “done” means for Termination (two levels)

| Milestone | Meaning | Not included |
|---|---|---|
| **A. Family shape seal** | 45 subtype blueprint profiles Ben-approved (with honest holds/deferrals); Work3 Termination package registration authority green; extension disposition recorded | Full product, all families, production serving |
| **B. Full product** | PLAN §1 outcome via M7 repair → M9 → M10 → Product Stages 3–9 | Out of scope for this note except “what’s next” |

This plan runs to **Milestone A**, then lists **immediate programme steps after A**.

---

## Current state (verified 2026-08-24)

| Check | State |
|---|---|
| Stage B facade + 45 profiles | **Green** — `prepareTerminationWork3StageBBlueprintProposal` |
| Core integration fixture review | **Green** (+ completion receipt) |
| Inventory review validator scaffold | **Green** (+ completion receipt) |
| Ben inventory session disposition facade | **Green** — `prepareTerminationWork3BenInventorySessionDisposition` |
| Ben disposition + session receipt files | **Written** — Phase 2 default disposition (40 APPROVE, 5 HOLD) |
| Family package seal facade | **Green** — `prepareTerminationWork3FamilyPackageSeal` |
| Family package registration facade | **Green** — `prepareTerminationWork3FamilyPackageRegistration` |
| Family profile package on disk | **Written** — `m7-v2-repair-family-work3-profile-package-termination.json` (45 profiles; 41 APPROVE + 4 PARTIAL) |
| Module size (HEAD) | `m7-v2-profile-authoring.js` 821283 bytes; work3 test 752846 bytes |
| `STAGE_B_HANDOFF.md` | **Stale** — describes 2026-08-23 stop before repo landing; do not use as construction gate |
| Ben approval sink | **Disposition recorded** — `m7-v2-repair-termination-45-profile-inventory-disposition.json` + session receipt |
| Outside-date extension in signatures | **Option B links on Stage B** — 4 deals carry `outside_date_extension_links` (7 open-world propositions); concho `no_extension_complete` APPROVE; 4 holds remain |
| Q01–Q03 | **Sealed** — bound in family package seal receipt |
| Family package seal receipt | **Written** — `m7-v2-repair-termination-family-package-seal-receipt.json` |
| Registration successor authority | **Green** — `m7-v2-repair-contract-work3-termination-registration-successor-authority.json` |

**Proof command (Work3 Termination slice):**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  --test-name-pattern 'Work3 Termination Stage B|core integration|inventory review|family package seal|family package registration' \
  tests/stage-2y-structure-m7-v2-repair-work3.test.js
```

Expect: 12 tests, 12 pass, ~8–10 min. Do **not** pipe to `tail`/`head`; check exit code and `# fail 0`.

---

## Phase 0 — Hygiene (agent, ~1 session)

**Goal:** Stop false rebuilds and make Ben’s review possible.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 0.1 | Agent | Add **stale banner** to `STAGE_B_HANDOFF.md` pointing to green tests + this plan | Banner matches HEAD test names |
| 0.2 | Agent | Regenerate inventory packet with **deal**, **shape_summary**, **review_flags** (script update) | Packet JSON contains new fields on all 45 rows |
| 0.3 | Agent | Mark outside-date rows (and date-dependent breach rows if flagged) with `EXTENSION_MECHANICS_DEFERRED` in `review_flags`; do **not** claim extension is modeled | Ben can see hold reason without reading 900-char signatures |
| 0.4 | Ben | Skim regenerated packet per **`TERMINATION-45-PROFILE-INVENTORY-REVIEW-PACKET-2026-08-24.md`** skim checklist (B9e + one outside-date hold row) | No reopen of B9e legal text; extension deferral flags visible on hold row |

**Regenerate packet:**

```bash
node scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs --mode stage-b
```

---

## Phase 1 — Governance reconciliation (agent + Ben decision, ~1 session)

**Goal:** Paper matches code; approval has somewhere to land.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 1.1 | Agent | ✅ Packet header now separates `repository_verification` + `current_governance_stop` (`core_integration_state: PERFORMED`) from `stage_b_facade_governance_stop` | Regenerated packet `inventory_review_packet_id=217720c2…` |
| 1.2 | Ben | ✅ **WRITE** completion receipts for core integration + inventory review GREEN runs | `m7-v2-repair-contract-work3-governed-disclosure-note-core-integration-execution-completion-receipt.json`, `m7-v2-repair-contract-work3-termination-unapproved-inventory-review-execution-completion-receipt.json` |
| 1.3 | Agent | ✅ Draft: `TERMINATION-BEN-INVENTORY-SESSION-SUCCESSOR-AUTHORITY-DRAFT-2026-08-24.md` + **RED** test scaffold (`Ben inventory session disposition` in work3 test — exit 1 until facade export) | Schema draft + RED proof for Ben |
| 1.4 | Ben | ✅ Deferred scope approved — disposition file + session receipt only; authority JSON committed + **GREEN** `prepareTerminationWork3BenInventorySessionDisposition` | `m7-v2-repair-contract-work3-termination-ben-inventory-session-successor-authority.json` |

**Stop:** Do not run Ben’s 45-row approval session until 1.3–1.4 exist.

---

## Phase 2 — Ben inventory session (Ben + agent scribe, ~2–4 hours) ✅ DONE 2026-08-24

**Goal:** Programme input: which of 45 shapes Ben accepts, holds, or rejects.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 2.1 | Ben | Review 45 rows using **shape_summary** + deal + `review_flags` (not raw signature alone) | ✅ Default disposition applied |
| 2.2 | Ben | **Default:** APPROVE subtype shape except explicit gaps | ✅ 40 APPROVE |
| 2.3 | Ben | **Hold** all `OUTSIDE_DATE_RIGHT` rows until extension disposition (Phase 3) OR approve with explicit “trigger/carve-out/exercise only; extension deferred” recorded in disposition file | ✅ 5 HOLD |
| 2.4 | Ben | Confirm B9e: disclosure note attachment only; jurisdiction list remains **retained source gap** | ✅ `b9e_note_only_acknowledged: true` |
| 2.5 | Ben | Acknowledge **taxonomy expansion** (M5 had 4 candidate subtypes; inventory has 10 buckets) per Q02 | ✅ `taxonomy_expansion_acknowledged: true` |
| 2.6 | Agent | Record dispositions in **successor approval artefact** (once 1.3 exists) — not by editing draft packet JSON | ✅ `inventory_disposition_id=b752907e…` |

**Evidence files:**

- `evidence/.../m7-v2-repair-termination-45-profile-inventory-disposition.json`
- `evidence/.../m7-v2-repair-termination-ben-inventory-session-receipt.json`
- Packet binding: `inventory_review_packet_id=217720c2…`, sha256 `4420906a…`

**Bucket checklist (45 rows):**

| Bucket | Count | Ben focus |
|---|---:|---|
| Legal restraint | 6 | Restraint **type** (statute/reg/order/injunction/court/gov); finality; carve-out |
| Outside date | 5 | **Hold** for extension unless explicitly approving partial |
| Breach | 7 | Cure mechanics; party; carve-out |
| Stockholder approval failure | 7 | Vote held / approval not obtained |
| Recommendation change | 6 | Board reco change |
| Mutual consent | 6 | Mutual written consent |
| Superior proposal | 4 | §8.05(b) accord + stockholder approval |
| No-solicitation breach | 2 | No-shop breach |
| Fiduciary notice | 1 | Fiduciary notice event |
| Failure to close | 1 | Failure to close |

---

## Phase 3 — Outside-date extension disposition (Option B links landed, partial)

**Goal:** Close the largest honest gap before calling outside-date “complete.”

Grounded in **Q01** (extension as linked child/role on same proposition unless independently operative) and **Phase 2 authority** `m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json` (extension state machines already modeled for metsera, skechers, redhat, skywater; concho has none).

| Step | Owner | Action | Gate |
|---|---|---|---|
| 3.1 | Agent | ✅ Side-by-side table: `TERMINATION-OUTSIDE-DATE-EXTENSION-DISPOSITION-TABLE-2026-08-24.md` | Table for Ben |
| 3.2 | Agent | **Option B** — separate `OUTSIDE_DATE_EXTENSION` linked propositions; `OUTSIDE_DATE_RIGHT` links (Q02) | ✅ Stage B `outside_date_extension_links` on 4 profiles (7 propositions) |
| 3.3 | Agent | Skechers Marketing Period extension — **Termination-owned**; other families link only | ✅ Recorded in extension table note |
| 3.4 | Agent | Concho `no_extension_complete` disposition APPROVE; extension artefact `PARTIAL_OPTION_B_CONCHO_COMPLETE` | ✅ `m7-v2-repair-termination-outside-date-extension-disposition.json` |
| 3.5 | Agent | ✅ Four extension rows **PARTIAL_APPROVE** with links acknowledged (Ben delegated) | 41 APPROVE / 4 PARTIAL in disposition |

**Deferred is not forbidden** — four extension rows are partial approve with deferred extension mechanics; serving must not imply extension complete on those rows.

---

## Phase 4 — Family package seal + registration (agent + Ben) — **Milestone A complete**

**Goal:** Milestone A — Termination Work3 package registered in-memory with Work3 identity; still zero product writes and zero activation.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 4.1 | Agent | ✅ **GREEN** — `prepareTerminationWork3FamilyPackageSeal` + authority JSON + full test (`family package seal` in work3 test — exit 0) | ✅ GREEN proof |
| 4.2 | Ben | ✅ **DONE** — seal receipt binds Q01–Q03 digest + disposition `b752907e…` + session receipt + extension DEFERRED | `m7-v2-repair-termination-family-package-seal-receipt.json` |
| 4.3 | Agent | ✅ **GREEN** — `prepareTerminationWork3FamilyPackageRegistration` + `WORK3_TERMINATION_REGISTRATION_SUCCESSOR_AUTHORITY` + seal receipt predecessor `65df8225…` | `m7-v2-repair-contract-work3-termination-registration-successor-authority.json` |
| 4.4 | Agent | ✅ **Written** — on-disk family package from 45 registered profiles (41 APPROVE + 4 PARTIAL outside-date) | `m7-v2-repair-family-work3-profile-package-termination.json`; generator `scripts/stage-2y-structure-m7-v2-termination-family-profile-package.mjs` |

**Regenerate family package:**

```bash
node scripts/stage-2y-structure-m7-v2-termination-family-profile-package.mjs
```

**Proof bundle (verified 2026-08-24):** Work3 Termination + family package tests **18 pass, exit 0**; `CI=true npm run build` **exit 0**.

```bash
CI=true npm test
npm run build
bash scripts/lint/forbidden-patterns.sh
```

---

## Phase 5 — Preview expansion (optional before other families, agent)

**Goal:** Validate shapes in UI beyond Red Hat 1-row B9e smoke.

| Step | Owner | Action | Gate |
|---|---|---|---|
| 5.1 | Agent | ✅ Five env-gated preview deals: Red Hat B9e, Metsera outside-date, Skechers outside-date, SkyWater + Concho bridge slots | `termination-rights-review-serving-source.js`; 23 preview tests pass |
| 5.2 | Agent | Preview rows match sealed disposition (Ben delegated technical sign-off) | No production serving |

**Not production.** Not full 45-row serving until seal + serving policy explicit.

---

## What to do next after Termination family seal (programme, not Termination-only)

Run in parallel where disjoint; do **not** skip M7 gates for other classes.

| Order | Work | Owner | Proof |
|---|---|---|---|
| N1 | **Work 3** — five families sealed (Termination, MAE, D&O, General Covenants, Guaranty); **Representations** (#6) + **Closing Conditions** (#7) in flight; spine merge MAE+D&O+GC done | Agent | Combined proof 2026-08-24: **210 pass / 0 fail**, tests exit 0 + `CI=true npm run build` exit 0 — `evidence/canonical-v2/stage-2y-structure-migration/control/n1-combined-work3-verification-2026-08-24.log` |
| N2 | **Work 4** — M6 formatter-only (no legal inference) | Agent | M6 shadow parity |
| N3 | **Work 5** — replay fixed 50-item lawyer review | Ben + agent | Improved pass rate vs 19/50 |
| N4 | **Work 6** — full affected corpus audit | Agent | Work 6 receipt |
| N5 | **Work 7** — adversarial + legal gates | Independent reviewer + Ben | **M7 accepted** |
| N6 | **M9** certificate | Agent | `shadow/m9/stage-2y-certificate.json` |
| N7 | **M10** private internal extractor | Ben authority | Selector active; still no product DB |
| N8 | **Product Stage 3** — open-world disposition ledger (remaining families + any Termination tail) | Ben seals targets | Stage 3 receipt |
| N9 | **Product Stages 4–9** | Per PLAN §16 | Production cutover receipt |

Termination is **one family** inside N1. Full product requires **all** families and stages above.

---

## Execution order (agent “just run at it”)

1. **Phase 0** — packet script + regenerate + stale handoff banner  
2. **Phase 1** — approval-capture authority design → Ben approves scope  
3. **Phase 2** — ✅ Ben inventory session (with holds on outside-date)  
4. **Phase 3** — ✅ Option B links on Stage B; concho complete; 4 holds remain for Ben re-review  
5. **Phase 4** — ✅ Milestone A complete: seal receipt (4.2) + registration facade (4.3)  
6. **Phase 5** — ✅ Metsera outside-date preview registered (env-gated)  
7. Hand off to **N1–N9** programme ladder  

**Do not:** rebuild producer v12 from `STAGE_B_HANDOFF.md`; treat Work3 tests as source of truth.  
**Do not:** edit draft packet JSON as approval.  
**Do not:** register product or change production serving without explicit authority.

---

## Appendix — Ben rulings one-liner

- **Q01:** One operative unit → one proposition; parts are roles/linked children.  
- **Q02:** One owner family; others link.  
- **Q03:** May infer from ambiguous context; must mark **inferred / pending approval**; never silent fact.
