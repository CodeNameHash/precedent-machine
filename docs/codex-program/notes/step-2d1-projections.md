# Step 2D1, defects 3 and 4 — projection membership and schema-kind drift

Working notes, written incrementally. Owns: `lib/canonical-v2/*-product-projection.js`
and the tests added for them
(`tests/canonical-v2-step-2d1-defects-3-4.test.js`).

Both defects are silent: a family that succeeds all the way to a written
claim and then renders nothing, indistinguishable from a family that
genuinely found nothing.

## Defect 3 — `remedies-misc-product-projection.js` matches neither family it claims

Confirmed exactly as described. `REMEDIES_DEFINITIONS`/`MISC_DEFINITIONS`
named an older, finer-grained claim vocabulary (`GOVERNING_LAW_STATE`,
`FORUM_SELECTION_PROVISION`, ten MISC keys under `ADMIN-*` concepts, plus six
REMEDIES keys) that `candidate-resolution.js` stopped emitting. The real
keys are `SPECIFIC_PERFORMANCE_REMEDY_PRESENT` (concept
`REMEDY-SPECIFIC-PERFORMANCE`, already in `REMEDIES_CONCEPTS` but never in
`REMEDIES_DEFINITIONS`) and `MISC_BOILERPLATE_MECHANIC_PRESENT` (concept
`MISC-BOILERPLATE`, which the `isMisc` check's `.startsWith('ADMIN-')` never
matched). `candidate-resolution.js` line ~10182 already carries a comment
saying exactly this — "a real fix consumes MISC_BOILERPLATE_MECHANIC_PRESENT
from this resolver instead of reinventing a claim vocabulary the registry
never adopted" — written 2026-08-05, two days before this step, and not
acted on until now.

Both real claims are generic presence carriers sub-typed only by
`claim.attributes.assertion_kind`, drawn from
`anthropic-provider.js`'s `SPECIFIC_PERFORMANCE_ASSERTION_KINDS` (one value:
`SPECIFIC_PERFORMANCE`) and `MISC_ASSERTION_KINDS` (seven values:
`GOVERNING_LAW`, `FORUM_FALLBACK`, `WAIVER_OR_SURVIVAL`,
`CONSTRUCTION_OR_EXPENSES`, `TPB_EXCEPTION`, `ASSIGNMENT_DETAIL`, `NOTICE`).
No structured sub-fields exist (no parsed governing-law code, no forum
reference) — `handlePresenceCarrier` only ever sets `{ assertion_kind: kind
}`. Fixed by adding both keys to their membership sets, and deriving
features from `assertion_kind` (validated against the imported enum,
`fail()`-ing on anything outside it) rather than reinventing structure the
claim doesn't carry. `mainConcept` (the raw quote) is the only feature for
the generic-carrier branches, matching the same pattern already used by
`general-covenants-product-projection.js` for its own generic carriers.

**Card counts, committed `-20260807-replay` runs, before → after:**

| Family | Run | Cards before | Cards after |
| --- | --- | --- | --- |
| `SPECIFIC_PERFORMANCE_REMEDIES` | `modiv-specific-performance-20260807-replay` | 0 | 1 |
| `MISC_BOILERPLATE` | `modiv-misc-boilerplate-20260807-replay` | 0 | 5 (14 claims, grouped by provision/section: 8.2, 8.3, 8.4 ×6, 8.7 ×2, 8.10 ×3) |

Verified by loading the real committed `resolution.json` for each run through
both the pre-fix module (`git show HEAD:...` before this session's edits) and
the fixed one — the "before" run threw nothing and returned `cards: []` for
both; it did not error, which is exactly the danger the step named.

**The silence, broken.** Two layers, both proven by removing what they guard
and watching a test fail (then restoring):

1. A projection that matches an owned concept (`REM-`/`REMEDY-` prefix, or
   the exact `MISC-BOILERPLATE` key) with an unrecognised claim-definition
   key now throws `RemediesMiscProjectionError`
   (`UNMAPPED_FAMILY_CLAIM_DEFINITION`), naming the concept and the missing
   key, instead of silently `continue`-ing past it. This is precisely the
   shape defect 3 had before the fix — reverting the membership-set fix and
   re-running the test suite drops it to 8/19 passing test cases, most of
   them the guard tests firing on real pre-fix behaviour that no longer
   throws.
2. An `assertion_kind` outside the governed enum for either generic carrier
   throws `REMEDIES_ASSERTION_KIND_UNMAPPED`/`MISC_ASSERTION_KIND_UNMAPPED`
   rather than mislabeling the feature.

A concept this module genuinely does not own (e.g. a `TERMINATION_*` entry)
still returns zero cards silently — "a family returning zero can be correct"
still holds for entries that were never this module's business.

The ten legacy MISC definitions and the parity test that hand-builds them
(`tests/canonical-v2-remedies-misc-product-parity.test.js`) stay as-is —
adding the two real keys didn't remove them, and nothing says they're wrong,
only that nothing emits them today (same "resolver-dead, not incorrect"
verdict `candidate-resolution.js`'s own comment already reached about
`merger-structure-product-projection.js`, which it deleted; this module was
kept because its `REM-SOLE` branch is live).

## Defect 4 — stale `schema_version` comparisons

**Full grep, whole projection layer** (`lib/canonical-v2/*projection*.js`,
20 files): only **5** files ever compare `provision.schema_version` to a
literal `'PROVISION_INSTANCE/V1'` at all. Of those, **4** compared it as the
*only* acceptable value (the defect's own count — "four projections", naming
files, not the seven families they cover):

- `tax-dividends-appraisal-product-projection.js` (TAX_MATTERS, DIVIDENDS,
  APPRAISAL_DISSENTERS_RIGHTS)
- `financing-guaranty-product-projection.js` (FINANCING_COVENANTS,
  GUARANTY_FINANCING_PARTY)
- `representations-product-projection.js` (REPRESENTATIONS)
- `ioc-wave-a-product-projection.js` (INTERIM_OPERATING)

The 5th, `key-terms-mae-product-projection.js`, already picked between
`STRUCTURAL_PROVISION_INSTANCE/V1` and `PROVISION_INSTANCE/V1` per family
(`KEY_DEFINED_TERMS` vs `MAE_DEFINITION`) before this step and needed no
change — not counted as stale.

**Ground-truthed against real committed data**, not assumed:

| Family | File | Real provision kind (committed run) | Resolved-entry count |
| --- | --- | --- | --- |
| TAX_MATTERS | tax-dividends-appraisal | `STRUCTURAL_PROVISION_INSTANCE/V1` (100%) | 5 — **confirmed live**, was throwing |
| DIVIDENDS | tax-dividends-appraisal | untested | 0 |
| APPRAISAL_DISSENTERS_RIGHTS | tax-dividends-appraisal | untested | 0 |
| FINANCING_COVENANTS | financing-guaranty | untested (mixed by design — see below) | 0 |
| GUARANTY_FINANCING_PARTY | financing-guaranty | untested | 0 |
| REPRESENTATIONS | representations | untested | 0 |
| INTERIM_OPERATING | ioc-wave-a | `PROVISION_INSTANCE/V1` (100%, all 10) | 10 — **was already correct** |

Confirmed: **TAX_MATTERS only**, from real data. **Untested for want of a
provision-bound claim**: DIVIDENDS, APPRAISAL_DISSENTERS_RIGHTS,
FINANCING_COVENANTS, GUARANTY_FINANCING_PARTY, REPRESENTATIONS — all five
have zero resolved entries in every committed `-20260807-replay` run for
that family.

**Why the fix is "accept the union", not "swap one literal for another".**
`validate-write-set.js`'s `assertStructuralRowShape`/`expectedObjectId`
admit both `PROVISION_INSTANCE/V1` (party-bound) and
`STRUCTURAL_PROVISION_INSTANCE/V1` (partyless) as legitimate rows — which one
applies is decided per claim by whether `candidate-resolution.js`'s
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE` gives that concept a `party_field`, not
fixed per family. Proven directly on **FINANCING_COVENANTS**, which is
genuinely mixed within one family: `handleFinancingCandidate`'s
`OBTAIN_EFFORTS`/`COOPERATION_GRANT` branches resolve a real party
(`mintProvision`) while `NO_FINANCING_CONDITION_ACK`/`PAYOFF_LEAD_TIME`/
`MARKETING_PERIOD_LENGTH` never set one (`mintStructuralProvision`) — same
`FINANCING_CLAIMS` table, both provision kinds. A per-family static choice
(the `key-terms-mae` pattern) would have been wrong here. Fixed three files
(`tax-dividends-appraisal`, `financing-guaranty`, `representations`) by
widening the check to `GOVERNED_PROVISION_SCHEMA_VERSIONS.has(...)`, a
two-member `Set` of both real kinds.

**`ioc-wave-a-product-projection.js` (INTERIM_OPERATING) was investigated
and deliberately NOT widened.** Every `IOC-*` row in
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE` carries `party_field:
'covenant_obligor'` — an IOC restriction is party-bound by construction,
confirmed on all 10 resolved entries in the committed run. Widening this one
the same way would have been actively wrong: the party check sits in the same
`||` chain as the schema check —
`provision.schema_version !== '...' || canonicalJson(provision.party) !==
canonicalJson(party)` — short-circuited today because a schema mismatch
never reaches the second clause. Accept `STRUCTURAL_PROVISION_INSTANCE/V1`
(no `party` field) and that line stops being skipped: `canonicalJson(undefined)`
throws `'canonical JSON does not support undefined'` deep inside
`canonical-bytes.js` instead of this module's own clean, named
`INVALID_PARENT_PROVISION` failure — the exact cryptic-crash shape
`termination-product-projection.js`'s header comment warns about. Left on a
single literal on purpose, now a named constant
(`GOVERNED_PROVISION_SCHEMA_VERSION`) with a header comment explaining why,
and a test (`canonical-v2-step-2d1-defects-3-4.test.js`) reproducing
`canonicalJson(undefined)`'s throw directly against `canonical-bytes.js`, to
prove the risk is real rather than asserted.

**A guard that cannot fire is worse than none, applied to REPRESENTATIONS.**
Widening its schema check to accept the structural kind is safe *only*
because `sideForParty(provision.party)` immediately downstream already fails
closed (`UNRESOLVED_REPRESENTATION_SIDE`) on `undefined`. Proven directly: a
hand-built entry with a `STRUCTURAL_PROVISION_INSTANCE/V1` provision passes
the (now widened) schema gate and is correctly rejected one line later, not
silently accepted.

### A second defect, found investigating the first, same files

Getting TAX_MATTERS past the schema_version gate surfaced a *different*
blocker on the same committed run:
`UNADJUDICATED_PRODUCT_ATTRIBUTE`. The tax/dividends/appraisal producer's
structured response is one fixed JSON schema shared across every
`assertion_kind` in the family — a `TAX_OPINION_COOPERATION_COVENANT` claim's
real `attributes` arrive with every *other* family ref field present and
`null` (`bearer_ref`, `dividend_term_ref`, `statute_ref`, ...), plus
`assertion_kind`, `section_reference` and `answer_provenance` — all
routing/provenance metadata this module already reads from
`entry.concept_key`, `entry.section_reference` and the resolved
`claim_definition_key`, never from these attribute keys.
`rejectUngovernedAttributes` treated every one of those as an "ungoverned
attribute" and TAX_MATTERS failed closed on its very first real claim — the
schema_version fix alone was not enough to make it actually project. The
parity test never caught this because it hand-builds `attributes` with only
the exact allowed keys, bypassing the resolver's real output shape (the same
"test bypassed the resolver" trap CLAUDE.md names).

`financing-guaranty-product-projection.js` carries the identical
`answer_provenance` key (`finalizeFinancingGuarantyClaim`'s
`attributesReplace`, unconditionally) for **every** FINANCING_COVENANTS and
GUARANTY_FINANCING_PARTY claim, and would have hit the same failure the
first time either resolves one — latent, not confirmed, but certain, so the
same fix (`SYSTEM_ATTRIBUTE_KEYS`, and a `sanitizeAttributes` step that
strips those keys plus null-valued placeholders once, upstream of
`rejectUngovernedAttributes`/`validateAttributes`/`taxDimensions`) went into
that file too.

**Proof, real data:** `projectTaxDividendsAppraisalClaims` on the committed
`modiv-tax-matters-20260807-replay` run now returns 5 records (all
`owner_family: 'TAX_MATTERS'`), up from an uncaught throw
(`INVALID_PROVISION_BINDING`, then `UNADJUDICATED_PRODUCT_ATTRIBUTE` once
the schema check alone was fixed) before both fixes landed.

## Tests

`tests/canonical-v2-step-2d1-defects-3-4.test.js`, 19 cases, all against real
committed `-20260807-replay` evidence where a run exists, hand-built entries
in the producer's real shape where a family has zero resolved claims:

- Defect 3: real-data card counts for both families; the old definitions
  stay registered; the zero-match guard fires on an owned-but-unmapped
  concept for both REMEDIES and MISC, and does *not* fire on a genuinely
  unrelated family; an out-of-enum `assertion_kind` fails loudly for both
  generic carriers.
- Defect 4: TAX_MATTERS projects on real data with the structural kind, and
  still rejects a made-up third schema kind; the null-placeholder/system-key
  attribute fix, proven against the real fixture; the five untested-latent
  families' zero-resolved-claim counts pinned against the real runs;
  FINANCING_COVENANTS' mixed party-bound/partyless shape, both proven
  together; GUARANTY_FINANCING_PARTY (always partyless); REPRESENTATIONS
  (widened gate, still fails closed on the missing party);
  INTERIM_OPERATING's real run still projects in full, and the
  `canonicalJson(undefined)` crash risk reproduced directly to justify not
  widening it; a full-count regression pin over the whole projection layer.
- Every "the fix works" claim above was re-verified the hard way: the five
  touched source files were reverted to their pre-session `HEAD` versions,
  the test file was re-run (8/19 passing — the guard and fix assertions
  genuinely fail without the fix), then the fixed files were restored and
  the suite re-run to 19/19.

Command: `CI=true node --test tests/canonical-v2-step-2d1-defects-3-4.test.js`
— 19/19 pass.

Broader regression sweep (existing suites touching these five files plus the
new one), all green:

```
CI=true node --test \
  tests/canonical-v2-remedies-misc-product-parity.test.js \
  tests/canonical-v2-remedies-misc-follow-on.test.js \
  tests/canonical-v2-sole-remedy-resolution.test.js \
  tests/misc-boilerplate-card-selection.test.js \
  tests/termination-fee-card-selection.test.js \
  tests/canonical-v2-financing-guaranty-product-projection.test.js \
  tests/canonical-v2-tax-dividends-appraisal-product-projection.test.js \
  tests/canonical-v2-representations-product-projection.test.js \
  tests/canonical-v2-ioc-parent-child-resolution.test.js \
  tests/canonical-v2-ioc-remaining.test.js \
  tests/canonical-v2-consideration-ioc-product-parity.test.js \
  tests/canonical-v2-consideration-ioc-real-replay.test.js \
  tests/canonical-v2-step-2d1-defects-3-4.test.js \
  tests/canonical-v2-financing-guaranty-follow-on.test.js \
  tests/canonical-v2-financing-guaranty-resolution.test.js \
  tests/canonical-v2-guaranty.test.js \
  tests/canonical-v2-representations-dark-bridge.test.js \
  tests/canonical-v2-tax-dividend-appraisal-follow-on.test.js \
  tests/canonical-v2-tax-dividends-appraisal-resolution.test.js \
  tests/canonical-v2-tax-cooperation-corroboration.test.js \
  tests/canonical-v2-run-projects-to-product-cards.test.js \
  tests/canonical-v2-modiv-interim-operating-open-world-freeze-replay.test.js
```
— 138/138 pass.

`bash scripts/lint/forbidden-patterns.sh` — `INVARIANT-4: PASS`, exit 0.

Not run: full `npm test` / `npm run build` (out of scope for this targeted
fix per the step's own ground rules — other agents are mid-flight on
`scripts/canonical-v2-live-extraction-run.mjs` and
`supabase/canonical-v2-foundation.sql`).

## Things found wrong that are not in this note's two defects

- `remedies-misc-product-projection.js`'s MISC_DEFINITIONS/REMEDIES_DEFINITIONS
  problem was already diagnosed, in writing, in
  `candidate-resolution.js` two days before this step and not acted on —
  worth flagging as a process gap (a comment naming a live defect in a file
  nobody owns should probably become a plan line, not sit there).
- The `UNADJUDICATED_PRODUCT_ATTRIBUTE` defect (above) has no PLAN.md line
  of its own; it was fixed here because it directly blocked proving defect
  4's own acceptance criterion on real data, in the same two files, same
  investigation. Flagging in case a future session goes looking for why
  `tax-dividends-appraisal-product-projection.js`'s `rejectUngovernedAttributes`
  differs from a plain "extra key -> fail".
- **`docs/core/CODEBASE-GUIDE.md` section ~12.5, "Updated 2026-08-07",
  is stale against `evidence/canonical-v2/baseline-manifest.json` itself,
  the file it tells you to read instead of trusting the prose.** It lists
  ten families as publishing zero claims on the `-20260807-replay` runs:
  `APPRAISAL_DISSENTERS_RIGHTS, DIVIDENDS, EMPLOYEE_MATTERS,
  FINANCING_COVENANTS, GENERAL_COVENANTS, GUARANTY_FINANCING_PARTY,
  KEY_DEFINED_TERMS, REPRESENTATIONS, SPECIFIC_PERFORMANCE_REMEDIES,
  TAX_MATTERS`. Checked directly against the manifest: `GENERAL_COVENANTS`
  resolves 10, `SPECIFIC_PERFORMANCE_REMEDIES` resolves 1,
  `TAX_MATTERS` resolves 5, and `KEY_DEFINED_TERMS` has a second,
  `-fullpin-` run that resolves 10 — none of those four is zero. The other
  six in that list (`APPRAISAL_DISSENTERS_RIGHTS`, `DIVIDENDS`,
  `EMPLOYEE_MATTERS`, `FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`,
  `REPRESENTATIONS`, plain `KEY_DEFINED_TERMS` without `-fullpin-`) are
  genuinely zero. Not corrected here — this note's owner is
  `lib/canonical-v2/*-product-projection.js`, not `docs/core/`, and
  `PLAN.md` is mid-edit by another agent on this same step — but it is
  exactly the failure mode CLAUDE.md's own opening section names, in the
  document that exists to prevent it, so it needs a human or the doc's owner
  to fix the "ten" list and re-derive which families are genuinely zero
  before anyone plans against it.
