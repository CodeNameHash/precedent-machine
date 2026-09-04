# Key Defined Terms Work3 parallel prep (2026-08-24)

Research-only handoff for **`KEY_DEFINED_TERMS`**. Programme position: **N1 family #16** (after fifteen sealed families including CONSIDERATION #15). Repair-plan cluster: wave 2 *definitions article — knowledge persons, superior-proposal thresholds, intervening events, willful breach* — same stress class as Representations knowledge linkage (dense definition inventory, cross-family Q02 boundaries), **not** Rep operative-clause or fee-economics cluster.

**Representations boundary:** fifteen `KNOWLEDGE_QUALIFIER` rows in the sealed Representations package are stamped link-only to this family under Q02. Do **not** absorb those Representations profiles; own `KNOWLEDGE_PERSON_SOURCE` and `KNOWLEDGE_STANDARD` content here.

**Do not edit shared spine:** `lib/canonical-v2/m7-v2-contract.js`, `lib/canonical-v2/m7-v2-deterministic-generator.js`, `lib/canonical-v2/m7-v2-profile-authoring.js`, `tests/stage-2y-structure-m7-v2-repair-work3.test.js`.

---

## 1. Existing evidence, calibration, authorities, tests

### M5 calibration and role schema (wave 2)

| Artefact | Path | Status |
|---|---|---|
| Calibration pack | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/KEY_DEFINED_TERMS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `wave: 2` |
| Proposed role schema | `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/KEY_DEFINED_TERMS.json` | `PROPOSED_AWAITING_BEN_APPROVAL`, `runner_eligible: false` |
| **Sealed** role schema (control) | `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/KEY_DEFINED_TERMS.json` | `BEN_APPROVED_AND_SEALED` — Q01–Q03 bound via `m5-programme-rulings.json` |
| Family-specific policy | `evidence/canonical-v2/stage-2y-structure-migration/control/family-specific-role-policies-v2/KEY_DEFINED_TERMS.json` | `BEN_APPROVED_AND_SEALED`, `wave: 2` |
| Family execution authority | `evidence/canonical-v2/stage-2y-structure-migration/control/family-execution-authorities/KEY_DEFINED_TERMS.json` | Active for shadow comparison |
| M5 shadow current | `evidence/canonical-v2/stage-2y-structure-migration/shadow/m5/KEY_DEFINED_TERMS/current.json` | **76** comparator-resolved claims |

**Reconcile before implementation:** calibration pack still lists Q01–Q03 as `OPEN_REQUIRES_BEN_RULING` while the sealed control role schema already binds programme rulings. Same pattern as Consideration / Tax Matters — confirm Ben profile-set approval before claiming `PROFILE_SET_V1`.

**M5 subtype inventory (5 sealed buckets):**

- `KEY_DEFINED_TERMS::ACQUISITION_PROPOSAL`
- `KEY_DEFINED_TERMS::SUPERIOR_PROPOSAL`
- `KEY_DEFINED_TERMS::INTERVENING_EVENT`
- `KEY_DEFINED_TERMS::KNOWLEDGE`
- `KEY_DEFINED_TERMS::WILLFUL_BREACH`

**Claim definitions in scope (12):**

- `ACQUISITION_PROPOSAL_THRESHOLD_PERCENT`
- `SUPERIOR_PROPOSAL_QUALIFIER`
- `SUPERIOR_PROPOSAL_THRESHOLD_PERCENT`
- `INTERVENING_EVENT_DEFINITION`
- `INTERVENING_EVENT_EXCLUSION`
- `KNOWLEDGE_PERSON_SOURCE`
- `KNOWLEDGE_STANDARD`
- `WILLFUL_BREACH_DEFINITION`
- `WILLFUL_BREACH_KNOWLEDGE_STANDARD`
- `ORDINARY_COURSE_DEFINITION_RECORDED`
- `TAX_DEFINITION_RECORDED`
- `TAX_RETURN_DEFINITION_RECORDED`

**Provision examples in calibration pack:** 6 complete source units — all tagged `ACQUISITION_PROPOSAL` pending legal grouping review (`LEGAL_GROUPING_REVIEW_REQUIRED`):

| Example | Deal | Comparator claims |
|---|---|---:|
| EX-01 | concho | 23 |
| EX-02 | metsera | 12 |
| EX-03 | redhat | 4 |
| EX-04 | skechers | 6 |
| EX-05 | skywater | 9 |
| EX-06 | topbuild | 22 |

**Sum of comparator `resolved` claims:** **76** across **6 deals** (M5 shadow `claim_count: 76` confirms). 56 claims appear in provision examples; 20 are outside calibration examples.

**Claim-definition split (76 total):**

| Claim definition | Count |
|---|---:|
| `ACQUISITION_PROPOSAL_THRESHOLD_PERCENT` | 16 |
| `SUPERIOR_PROPOSAL_QUALIFIER` | 14 |
| `INTERVENING_EVENT_EXCLUSION` | 12 |
| `INTERVENING_EVENT_DEFINITION` | 6 |
| `KNOWLEDGE_PERSON_SOURCE` | 6 |
| `KNOWLEDGE_STANDARD` | 5 |
| `SUPERIOR_PROPOSAL_THRESHOLD_PERCENT` | 5 |
| `WILLFUL_BREACH_DEFINITION` | 4 |
| `WILLFUL_BREACH_KNOWLEDGE_STANDARD` | 4 |
| `TAX_DEFINITION_RECORDED` | 2 |
| `ORDINARY_COURSE_DEFINITION_RECORDED` | 1 |
| `TAX_RETURN_DEFINITION_RECORDED` | 1 |

### Comparator runs

| Deal | Run | Governed claims |
|---|---|---:|
| concho | `concho-key-defined-terms-20260809-2xk-final` | 23 |
| metsera | `metsera-key-defined-terms-20260809-2xk-final` | 12 |
| redhat | `redhat-key-defined-terms-20260809-2xk-final` | 4 |
| skechers | `skechers-key-defined-terms-20260809-2xk-final` | 6 |
| skywater | `skywater-key-defined-terms-20260809-2xk-final` | 9 |
| topbuild | `topbuild-key-defined-terms-20260809-2xk-r2-final` | 22 |

### M7 V2 contract references (read-only)

- `KEY_DEFINED_TERMS` in `FAMILY_KEYS` and `FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY`
- Expected package path: `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-key-defined-terms.json`
- **No** Work3 family-local module or dedicated test exists yet.

**Work3 first-candidate subtype:** `KEY_DEFINED_TERMS::ACQUISITION_PROPOSAL` — `tests/stage-2y-structure-m7-v2-repair-work3.test.js` (`EXPECTED_FIRST_CANDIDATES`).

---

## 2. Pattern files to mirror

Mirror **Consideration** (M4-claim-scale partition, D&O-minimal path, Phase 3 skipped):

- Phase 2: `m7-v2-repair-contract-key-defined-terms-authoring-phase2-authority-v2.json`
- Phase 4: `m7-v2-repair-contract-key-defined-terms-authoring-phase4-family-profile-package-review-authority.json`
- Family package: `m7-v2-repair-family-work3-profile-package-key-defined-terms.json`
- Dedicated module: `lib/canonical-v2/m7-v2-key-defined-terms-authoring.js`
- Dedicated tests: `tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js`

---

## 3. Family-specific scope — cross-family boundaries

| Boundary | Disposition |
|---|---|
| Representations `KNOWLEDGE_QUALIFIER` (15 rows) | Q02 link-only — Representations owns the qualifier limb; this family owns knowledge-person and standard definitions |
| Tax Matters / Employee Matters definition cross-refs | Q02 link-only where another family owns the operative covenant |

### Review flags (expected)

- `LEGAL_GROUPING_REVIEW_REQUIRED` on all 76 rows (calibration tags every example `ACQUISITION_PROPOSAL`; source-first buckets span five sealed subtypes)
- `SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE` on ~56 rows (non-`ACQUISITION_PROPOSAL` bucket assignment)
- `COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES` on 20 rows

---

## 4. Milestone A execution ladder

1. Bootstrap family-local module + scripts from Consideration template
2. Emit Phase 2 authority (76 terminals from M4 claims)
3. Emit Phase 4 authority (skip Phase 3)
4. Inventory review packet + Ben disposition (KEEP_ALL_76_PROPOSALS mechanical)
5. Family package seal + registration artefacts
6. On-disk package via generator + lawful fixture override
7. Dedicated work3 test green

**Proof:**

```bash
CI=true NODE_OPTIONS='--max-old-space-size=8192' node --test \
  tests/stage-2y-structure-m7-v2-repair-key-defined-terms-work3.test.js
```
