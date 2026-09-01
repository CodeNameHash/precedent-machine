# Specific performance remedies family — Work3 Milestone A run plan (2026-08-24)

**Family:** `SPECIFIC_PERFORMANCE_REMEDIES` (N1 family #20)  
**State:** Milestone A complete — 8 profiles sealed and registered, **1 APPROVE / 7 HOLD**, dedicated test file **10 pass / 0 fail**  
**Prep note:** `SPECIFIC-PERFORMANCE-REMEDIES-WORK3-PARALLEL-PREP-2026-08-24.md`

---

## What was built

Family-local module, mirroring Termination Fee / Consideration pattern:

- `lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js` — self-contained Work3 ladder facade.
- `tests/stage-2y-structure-m7-v2-repair-specific-performance-remedies-work3.test.js` — 10 tests, family-local.

Six generator scripts plus binding sync and lawful fixture override (see prep note for exact commands).

Phase 3 skipped. Termination Fee sole-remedy cross-references are Q02 link-only under sealed programme rulings.

## Proof

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-specific-performance-remedies-work3.test.js
```

Exit 0, **10 pass / 0 fail** (2026-08-25).

## Sealed artefacts

| Artefact | Path (under `evidence/.../control/`) |
|---|---|
| Phase 2 authority | `m7-v2-repair-contract-specific-performance-remedies-authoring-phase2-authority-v2.json` |
| Phase 4 review authority | `m7-v2-repair-contract-specific-performance-remedies-authoring-phase4-family-profile-package-review-authority.json` |
| Inventory review authority | `m7-v2-repair-contract-work3-specific-performance-remedies-unapproved-inventory-review-authority.json` |
| Inventory review packet | `m7-v2-repair-specific-performance-remedies-8-profile-inventory-review-packet-draft.json` |
| Inventory disposition | `m7-v2-repair-specific-performance-remedies-8-profile-inventory-disposition.json` |
| Ben session receipt | `m7-v2-repair-specific-performance-remedies-ben-inventory-session-receipt.json` |
| Package seal receipt | `m7-v2-repair-specific-performance-remedies-family-package-seal-receipt.json` |
| **Family profile package** | `m7-v2-repair-family-work3-profile-package-specific-performance-remedies.json` |

Package identity `fad946796c2f5d6b50a66a906d35be00335d4f61a1f59ba59c26a4dbeff28669`, validation status `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING`.

---

## The 7 holds (honest — not bugs)

**Seven profiles: Termination Fee sole-remedy owner-family still open.** Each row on Concho, Metsera (×2), Red Hat, Skechers, or TopBuild (×2) carries `COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED` because the supplemental sole-remedy resolver names this family while Termination Fee Milestone A HOLDs the mirror `REM-SOLE` rows. Q02 permits one semantic owner; Ben has not chosen between fee economics and equitable-remedy ownership. Flag stamped HOLD here — not resolved into either family.

**SkyWater only APPROVE.** Its single terminal has no owner-family conflict; it still carries `LEGAL_GROUPING_REVIEW_REQUIRED` (subtype grouping pending legal).

**No new Ben rulings invented.** Q01–Q03 reuse sealed M5 programme rulings (`m5-programme-rulings.json`). Disposition records `termination_fee_sole_remedy_owner_family_open: true`.

---

## Open question for Ben

When you rule on Termination Fee sole-remedy ownership, seven SPR profiles and ten Termination Fee rows may need coordinated disposition — do not activate either family’s contested rows until that ruling lands. Until then both families remain mechanically HOLD on owner-family flags.
