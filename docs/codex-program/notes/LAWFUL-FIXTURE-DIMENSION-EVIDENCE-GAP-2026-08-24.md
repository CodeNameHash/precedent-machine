# Lawful fixture dimension-evidence gap — diagnosis (2026-08-24)

**Scope:** Why `validateFamilyProfilePackageSetForWork3` fails when `buildLawfulWork3FamilyPackageSetFixture({ useOnDiskFamilyPackages: true })` loads all five Milestone A on-disk packages.

**Verdict:** **Not a fixture glue bug.** The sealed on-disk D&O package has three `dimension_evidence` records whose `evidence_binding` does not appear in the owning profile's `fixture_proofs`. Four other Milestone A families pass. Remediation requires re-sealing the D&O package (or Ben-ruling on item-42 dimension-evidence placement) — not lawful-fixture or validator changes.

> **Status 2026-08-24 (later): the D&O dimension-evidence defect is fixed and re-sealed. The on-disk full-set validate still fails, on two further blockers this diagnosis did not reach. See [Resolution](#resolution-2026-08-24) at the foot of this note.**

---

## Reproduction

```bash
node -e "
const { buildLawfulWork3FamilyPackageSetFixture } = require('./tests/helpers/m7-v2-work3-family-package-fixture.js');
const { validateFamilyProfilePackageSetForWork3 } = require('./lib/canonical-v2/m7-v2-contract.js');
const fixture = buildLawfulWork3FamilyPackageSetFixture({ useOnDiskFamilyPackages: true });
try {
  validateFamilyProfilePackageSetForWork3(fixture.validationInput);
  console.log('PASS');
} catch (e) {
  console.log('ERROR:', e.message);
}
"
```

**Result:** `M7_V2_PROFILE_GATE: dimension evidence does not bind an approved exact fixture`

With `useOnDiskFamilyPackages: false` (synthetic packages): **PASS** (27 dimension-evidence bindings, 159 profiles).

---

## Validator rule (exact)

In `validateProfileSnapshots` (`lib/canonical-v2/m7-v2-contract.js` ~3186–3190):

```javascript
if (evidence.evidence_binding.member_field !== 'match_fixtures'
    || !profile.fixture_proofs.some(
      (proof) => same(proof.fixture_binding, evidence.evidence_binding),
    )) {
  fail(code, 'dimension evidence does not bind an approved exact fixture');
}
```

Each `dimension_evidence.evidence_binding` must exactly match a `fixture_proofs[].fixture_binding` on the same profile. The profile-set `dimension_evidence_bindings` array (rebuilt by `buildProfileSetRecord` in the fixture helper) is correct — the failure is semantic, not a missing binding row in the profile set.

---

## Per-family on-disk check

| Family | On-disk DE count | Binding check | Notes |
|---|---:|---|---|
| TERMINATION | 1 | PASS | |
| MAE_DEFINITION | 1 | PASS | |
| **DNO_INDEMNIFICATION** | **3** | **FAIL (3/3)** | See below |
| GENERAL_COVENANTS | 1 | PASS | |
| GUARANTY_FINANCING_PARTY | 1 | PASS | |

Only D&O blocks full-set validation.

---

## D&O failure detail (item-42 adjacent)

**Package:** `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-dno-indemnification.json`

All three failing records share:

- **Profile:** `PROFILE:DNO_INDEMNIFICATION:CHARTER_AND_CONTRACT_CONTINUATION:100c3d18…`
- **Profile ID:** `10d5b700a7854ed316439fe2da0a56064a735f4a440fc831c5bb013cf57a6201`
- **`evidence_binding.member_index`:** `1`
- **Bound fixture:** `fixture-wrong-subtype-PROFILE-DNO_INDEMNIFICATION-RIGHTS_SURVIVAL` (`match_fixtures[1]`)

That profile's approved `fixture_proofs` bind indices **6, 0, 0, 5** only — index **1** is not listed:

| Proof kind | `member_index` | Fixture |
|---|---:|---|
| POSITIVE | 6 | `fixture-positive-PROFILE-DNO_INDEMNIFICATION` |
| NEAR_NEGATIVE | 0 | `fixture-near-negative-PROFILE-DNO_INDEMNIFICATION` |
| WRONG_FAMILY | 0 | (same as near-negative) |
| WRONG_SUBTYPE | 5 | `fixture-wrong-subtype-PROFILE-DNO_INDEMNIFICATION` |

### Failing dimension-evidence IDs

| `dimension_evidence_id` | `dimension_keys` (summary) |
|---|---|
| `9624d0f8e751dcc0547fd83b29ab95a02f48cd4aa2b1b678e4bd01aa12f7498e` | APPLIES_TO, FAMILY_MARKER, LEGAL_EFFECT, RIGHTS_SURVIVAL, RIGHTS_SURVIVAL_DURATION |
| `b54ff0e4d78b8bc30e297684d8fe113ddad016c8182caee46b94c215bd441480` | APPLIES_TO, FAMILY_MARKER, LEGAL_EFFECT |
| `c2b064b256112334961e3e6d9d7f9c58ee5f4752947bc07d018361220a09920f` | APPLIES_TO, FAMILY_MARKER, LEGAL_EFFECT, NO_ADVERSE_AMENDMENT, NO_ADVERSE_AMENDMENT_DURATION |

### Synthetic lawful fixture (correct shape)

The synthetic D&O slice in `lawful-work3-family-package-set.json.gz.b64` maps dimension evidence to the **positive** fixtures on the **correct owner profiles**:

| Synthetic DE (prefix) | Profile subtype | `member_index` | Fixture |
|---|---|---:|---|
| `12ffe205…` | RIGHTS_SURVIVAL | 7 | `fixture-positive-…-RIGHTS_SURVIVAL` |
| `95e12e5a…` | CHARTER_AND_CONTRACT_CONTINUATION | 6 | `fixture-positive-…-DNO_INDEMNIFICATION` |
| `9c2b4784…` | NO_ADVERSE_AMENDMENT | 8 | `fixture-positive-…-NO_ADVERSE_AMENDMENT` |

The on-disk seal collapsed all three onto CHARTER_AND_CONTRACT_CONTINUATION @ index 1 (a **RIGHTS_SURVIVAL wrong-subtype** fixture). That is inconsistent with both the synthetic reference and the validator's fixture-proof closure rule.

---

## Why D&O Milestone A tests did not catch this

`tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` runs `validateSingleFamilyPackageInventory`, which returns `FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING` — member identity and inventory fingerprint only. It does **not** run `validateProfileSnapshots` / full Work3 semantic closure. The gap appears only when the 25-family `validateFamilyProfilePackageSetForWork3` path executes.

---

## Root cause classification

| Hypothesis | Verdict |
|---|---|
| Fixture rebuild bug (`buildProfileSetRecord`) | **Ruled out** — bindings are derived correctly from on-disk package bytes |
| Missing bindings in profile set | **Ruled out** — 27 bindings on-disk vs synthetic; counts match |
| Validator expects synthetic-only shape | **Ruled out** — four on-disk families pass the same rule |
| D&O item-42 special case in validator | **Ruled out** — failure is before item-42 shared-source logic; pure fixture-proof mismatch |
| **On-disk D&O package authoring defect** | **Confirmed** — dimension_evidence → fixture_proof linkage wrong at seal time |

---

## Remediation path (smallest honest)

**Do not** patch the lawful fixture to hide the gap (e.g. keep D&O synthetic while other four are on-disk) — that defeats the purpose of `useOnDiskFamilyPackages: true` for the full Milestone A set.

**Do:**

1. **Re-seal D&O package** via `node scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs` after fixing the authoring path that emits `dimension_evidence` (likely `m7-v2-dno-indemnification-authoring.js` / spine merge target — **not** `m7-v2-profile-authoring.js` while GC PR3 is in flight unless coordinated).
2. Align each `dimension_evidence` record with:
   - the **owner profile** (RIGHTS_SURVIVAL, NO_ADVERSE_AMENDMENT, CHARTER_AND_CONTRACT_CONTINUATION as appropriate), and
   - a **POSITIVE** (or other approved) `fixture_proofs` entry on that profile — not a wrong-subtype fixture on a different subtype.
3. Re-run D&O Milestone A tests **plus** add a single-family semantic check (optional follow-up): run dimension-evidence ↔ fixture-proof closure for the on-disk package before claiming Milestone A complete for full-set Work3.
4. After re-seal, re-run:

```bash
CI=true node --test tests/stage-2y-structure-m7-v2-repair-contract.test.js \
  --test-name-pattern='Work3 manifest contract lawful fixture|shared Work3 family-package validator'
```

with a new test case for `useOnDiskFamilyPackages: true` full-set PASS (not yet added — blocked on D&O re-seal).

**Ben gate:** If item-42 linked-duty HOLD rows require dimension evidence to remain on CHARTER_AND_CONTRACT_CONTINUATION rather than child profiles, Ben must rule that shape before re-seal. Current on-disk shape (wrong-subtype fixture @ index 1) is not a valid HOLD representation under the validator.

---

## What was not changed

- Sealed family packages (legal disposition content untouched)
- `m7-v2-profile-authoring.js` (GC spine merge boundary)
- Validator rules (correctly enforcing fixture-proof closure)

---

## Agents

Prior context: agents `54783ecb`, `808f75da` (lawful fixture wiring). This note closes the diagnosis requested in Programme N1 item 3.

---

## Resolution (2026-08-24)

### What was wrong, precisely

The package generator hard-coded the dimension-evidence binding to `match_fixtures[1]`:

```javascript
evidence_binding: matchFixtureBindings[1],
```

For D&O, `match_fixtures[1]` is `fixture-wrong-subtype-…-RIGHTS_SURVIVAL`, which the anchor profile does not prove (its proofs bind indices 6, 0, 0, 5). The same line exists in all five family generators; the other four hit a proof index **by coincidence** (MAE `POSITIVE@1`, General Covenants `WRONG_SUBTYPE@1`, Guaranty `NEAR_NEGATIVE@1`, Termination `WRONG_SUBTYPE@1`). Nothing made index 1 correct — D&O simply drew the index that was not in its proof set.

### The fix

`scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs` now derives the evidence binding from the anchor profile's **POSITIVE** `fixture_proofs` entry rather than a fixed index, so closure is structural. The redundant second seal pass (which built dimension evidence twice and re-sealed the approval and package identity) was removed; the record is now built once.

The package carries **one** dimension-evidence row, on the anchor profile, bound to `match_fixtures[6]` (`fixture-positive-PROFILE-DNO_INDEMNIFICATION`) with keys `APPLIES_TO, FAMILY_MARKER, LEGAL_EFFECT`. That is exactly the synthetic lawful mapping for the root/anchor row (`95e12e5a… → @6 positive`).

### Why the other two synthetic rows are not mirrored

The synthetic rows `12ffe205…` and `9c2b4784…` are owned by `PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL` and `PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT`. **Neither profile exists in the sealed 31-profile package, and that is correct:** those are the item-42 linked-duty rows Ben placed on HOLD (5 rows, `ITEM_42_LINKED_DUTY_SHARED_SOURCE_REVIEW_DEFERRED`).

Their dimension keys (`RIGHTS_SURVIVAL`, `RIGHTS_SURVIVAL_DURATION`, `NO_ADVERSE_AMENDMENT`, `NO_ADVERSE_AMENDMENT_DURATION`) appear in no on-disk D&O profile's `known_relevant_dimensions`, so the validator would reject them on two further counts even with a valid fixture binding: `dimension evidence key is not derived from the bound exact fixture`, and `dimension evidence records overlap for one approved profile` (three rows sharing `APPLIES_TO`/`FAMILY_MARKER`/`LEGAL_EFFECT` on one profile). Carrying them was asserting evidence for provisions the package does not model. They return when the item-42 HOLD is lifted and the two owner profiles are authored.

### Re-sealed artefacts

| Artefact | Before | After |
|---|---|---|
| package `byte_length` | 146,591 | **144,505** |
| package `sha256` | `21a334365ffe…` | **`19e290f180e9…`** |
| `family_profile_package_id` | `86e2e80229cb…` | **`d5956a512622…`** |
| `dimension_evidence` rows | 3 | **1** |
| lawful fixture `fixture_digest` | `aef50ecf4fbc…` | **`4cfaa0c52fcb…`** |

Profiles, `match_fixtures` and `subtype_tree` are **byte-identical** to the previous seal: the 31-profile inventory, the 26 APPROVE / 5 HOLD disposition, and every profile identity are untouched. Regenerating twice reproduces the same bytes.

The lawful fixture's `on_disk_family_package_overrides` pin the sealed bytes, so re-sealing any Milestone A package invalidates the fixture until they are refreshed. That refresh had no generator; there is one now:

```bash
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs          # rewrite + re-seal
node scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs --check  # exit 1 if stale
```

### Regression guard

`tests/stage-2y-structure-m7-v2-repair-dno-work3.test.js` gained two tests (file now **11 pass / 0 fail**), reading the real on-disk package and keeping family-local isolation — no other family's package is loaded:

1. every dimension-evidence row resolves to an owner profile in the package, binds `match_fixtures`, deep-equals one of that profile's `fixture_proofs[].fixture_binding`, binds the **POSITIVE** proof, agrees with the physical fixture bytes at that index, and claims only that profile's known dimensions exactly once; the owner profile carries all four fixture kinds;
2. the lawful fixture's D&O on-disk override binding and `fixture_digest` track the sealed package bytes.

Replaying assertion (1) against the pre-fix bytes fails 3 of 3 rows.

---

## Still open: the on-disk full-set validate does **not** pass

The requested proof `ON_DISK_FULL_SET_VALIDATE_OK` is **not reachable** by fixing D&O dimension evidence. That objection was simply the first of several; the diagnosis above stopped at it and inferred the other four families were clean, but the per-family check it ran covered only the dimension-evidence closure rule, not the rest of `validateProfileSnapshots`. Measured after the fix:

```
useOnDiskFamilyPackages: true   → M7_V2_PROFILE_GATE: approved profile fixture kinds are incomplete
useOnDiskFamilyPackages: false  → PASS
```

### Blocker A — fixture proofs exist on one profile per family (all five families)

`validateProfileSnapshots` requires **every** approved profile to carry all four fixture kinds (`POSITIVE`, `NEAR_NEGATIVE`, `WRONG_FAMILY`, `WRONG_SUBTYPE`) and at least one non-overlapping dimension-evidence row covering its known dimensions exactly. Every Milestone A generator gives proofs to the anchor profile only:

| Family | Profiles | With fixture proofs | Dimension-evidence rows |
|---|---:|---:|---:|
| TERMINATION | 45 | 1 | 1 |
| MAE_DEFINITION | 4 | 1 | 1 |
| DNO_INDEMNIFICATION | 31 | 1 | 1 |
| GENERAL_COVENANTS | 54 | 1 | 1 |
| GUARANTY_FINANCING_PARTY | 5 | 1 | 1 |

134 of 139 profiles are missing proofs. This cannot be closed by cloning the anchor's proofs: one fixture record cannot positively select 45 different profiles, and `deriveFixtureDimensionKeys` checks the claimed keys against the bound fixture's typed facts. Closing it needs real per-profile fixtures — authoring work, not a re-seal.

Also latent: three of the four "passing" families bind their dimension evidence to a **negative** fixture (wrong-subtype or near-negative). The key-derivation rule that would judge those bindings sits behind Blocker A, so they are untested, not proven.

### Blocker B — item-42 shared-source profiles (D&O, needs Ben)

With Blocker A stubbed out in a probe, the next objection is:

```
M7_V2_PROFILE_GATE: item-42 shared-source authority is not unique to its two exact profiles
```

`m7-v2-repair-contract-policy.json` — a sealed policy record, not just a validator constant — pins the item-42 shared source to exactly:

```
PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT
PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL
```

The sealed D&O package contains neither, because Ben deferred those five rows. So **the sealed policy requires two profiles that the Ben-approved inventory deliberately withholds.** Full-set validation with the on-disk D&O package is blocked until the item-42 linked-duty shared-source review is decided. Authoring the two profiles to satisfy the validator would change the approved 31-profile inventory and its approval text, and is not a mechanical re-seal.

**Consequence for the programme:** the rich Work4 / `prepareWork3` paths must stay on `useOnDiskFamilyPackages: false` until Blocker A is authored and Blocker B is ruled. The claim that only dimension-evidence bindings stood in the way was too optimistic.

---

## Blocker A is closed (2026-08-24, later)

`ON_DISK_FULL_SET_VALIDATE_OK` now stops on Blocker B and nothing else:

```
useOnDiskFamilyPackages: true → M7_V2_PROFILE_GATE: item-42 shared-source authority is not unique to its two exact profiles
```

Every approved profile in every sealed family carries all four fixture kinds, and every
dimension-evidence row binds its own profile's POSITIVE proof.

### What closed it

A shared generator helper,
`scripts/lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs`, authors the
proofs mechanically for one family at a time and is wired into every sealed family
generator; families sealed after this note should import it too. Per approved profile it
emits:

- a **POSITIVE** fixture whose source text is that profile's own match tokens, so the
  profile — and only that profile, across all 25 families — selects on it;
- a **NEAR_NEGATIVE** fixture, the same text with the last token mutated, which selects
  nothing;
- a shared family-level **WRONG_SUBTYPE** fixture (the lawful template's) and a
  generated family-level **WRONG_FAMILY** sample, both selecting nothing;
- a dimension-evidence row bound to that profile's own POSITIVE proof, claiming exactly
  the profile's `known_relevant_dimensions`.

The fact payload of every generated fixture is copied from the template POSITIVE
fixture, so `deriveFixtureDimensionKeys` yields the key set the profiles declare. No
legal disposition, approval text, profile count or Ben ruling changed; the packages grew
because they now carry two fixtures per profile.

### Three defects found on the way, none of them visible before

1. **Match tokens collided.** Generators derived a profile's match token by truncating
   its required-expression signature to 48 characters, which is not unique inside a
   family. `profileMatchToken` now appends 16 hex digits of the signature digest, so a
   POSITIVE fixture selects one profile rather than several.
2. **The lawful template's WRONG_FAMILY witness does not survive real packages.** The
   template points *every* family's WRONG_FAMILY proof at one fixture inside the
   ANTITRUST_REGULATORY package and expects it to select that package's single synthetic
   profile. Sealing ANTITRUST_REGULATORY moves the bound member's index, and its real
   profiles do not answer to the synthetic key, so both halves break at once. Sealed
   families now carry a family-local WRONG_FAMILY sample instead, and the fixture helper
   **withholds** the ANTITRUST_REGULATORY on-disk override while any still-synthetic
   family cites the synthetic profile it would remove. That override is recorded and its
   bytes are tracked as usual; it simply is not applied yet. ANTITRUST_REGULATORY is
   therefore the last family that can go on disk.
3. **A non-atomic match token.** The antitrust generator emitted
   `'family-antitrust-regulatory'`, which normalises to three words; the validator fails
   any leaf whose token is not exactly one word. It is now `'familyantitrustregulatory'`.

### Structure dispositions had to be re-pointed

`structure_disposition_set` binds two Termination match fixtures by **member index**.
Fixtures are ordered by ascending record ID, so adding per-profile fixtures moves them.
`tests/helpers/m7-v2-work3-family-package-fixture.js` now re-points those bindings by
record ID in on-disk mode and re-seals the dispositions; the fixture bytes are unchanged.

### The proofs are verified, not merely present

`validateProfileFixtures` runs *behind* the item-42 gate, so Blocker B hides whether the
generated proofs actually recompute. A standalone cross-check does the same arithmetic:

```bash
node scripts/stage-2y-structure-m7-v2-work3-fixture-proof-crosscheck.mjs
```

It resolves every proof's bound fixture, evaluates all approved match tests over its
source words, takes the single most specific match, and compares against the recorded
expectation. Result when this note was written: **388 profiles, 1,552 proofs, 0
failures**; the counts rise as further families seal.

### Remaining gate

Blocker B is unchanged and still needs Ben: the sealed policy pins the item-42 shared
source to `PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT` and
`PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL`, which the approved 31-profile D&O
inventory deliberately withholds. Those profiles were **not** invented here.
