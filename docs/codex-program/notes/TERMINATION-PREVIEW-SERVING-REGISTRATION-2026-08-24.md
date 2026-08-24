# Termination Rights preview serving registration

**Date:** 2026-08-24  
**Status:** Design only — `CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES = {}` today; product path wired, no deal registered.

## 1. Deal(s) with Termination V2 analysis/projection available

**One deal is the intended preview target:**

| Field | Value |
|---|---|
| Production deal UUID | `2b9a6571-6fe7-4aac-931d-a96ab227ea43` |
| Deal name | IBM / Red Hat (`lib/generated/home-deal-directory-v1.json`) |
| Immutable agreement id | `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a` |

**Why this deal:** M7 V2 Termination repair evidence, Stage B B9e jurisdiction-list ruling, and the pinned shadow chain (m2 agreement index, m3 context, m4 base analysis, Work3 family packages) all target the Red Hat agreement — not Modiv or QXO/TopBuild.

**What “available” means today:** There is no committed `AGREEMENT_ANALYSIS/V2` or `AGREEMENT_PROJECTION/V2` JSON artefact on disk. Preview serving must **rebuild at read time** from pinned evidence through the existing pipeline:

1. `generateAnalysisV2` (`lib/canonical-v2/m7-v2-deterministic-generator.js`)
2. `projectAgreement` (`lib/canonical-v2/agreement-projection.js`)
3. `assembleTerminationRightsReviewV2` (`lib/canonical-v2/termination-rights-review-attachment.js`)

Validation uses `validateAnalysisV2` / `validateProjectionV2` (`lib/canonical-v2/m7-v2-contract.js`) — **do not edit contract or profile-authoring** while the integration agent is active; the serving builder only *calls* those exports.

**Not registered for Termination Rights V2 preview:**

- `dfaa71fa-9723-4794-825d-bd5024aa0b5d` (Modiv) — termination **fee** V2 serving only (`termination-fee-serving-source.js`)
- `7dc3a05f-b170-4d59-a255-b7103cca16e1` (QXO / TopBuild) — same; fee only

## 2. Minimal code change (preview only, env-gated)

Mirror `lib/canonical-v2/termination-fee-serving-source.js`:

```javascript
const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY =
  'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING';
const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE =
  'ENABLED_LOCAL_PREPRODUCTION';

const RED_HAT_DEAL_ID = '2b9a6571-6fe7-4aac-931d-a96ab227ea43';

function isCanonicalV2TerminationRightsReviewServingEnabled(env) {
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!resolvedEnv || typeof resolvedEnv !== 'object') return false;
  const value = ownEnvValue(resolvedEnv, CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY);
  if (value !== CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE) return false;
  return isPermittedCanonicalV2Runtime(resolvedEnv);
}
```

Wrap the existing attacher export:

```javascript
async function attachCanonicalTerminationRightsReview(reviewDeal, options = {}) {
  const env = options.env || process.env;
  if (!isCanonicalV2TerminationRightsReviewServingEnabled(env)) return reviewDeal;
  return attachCanonicalTerminationRightsReviewCore(reviewDeal, options);
}
```

Register **one** async source builder and empty transient state:

```javascript
const CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES = Object.freeze({
  [RED_HAT_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
});

const CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE = Object.freeze({
  [RED_HAT_DEAL_ID]: Object.freeze({
    open_review_keys: [],
    prompts: [],
    fact_groups: [],
  }),
});

const CANONICAL_TERMINATION_RIGHTS_REVIEW_STAGE_B_BLUEPRINTS = Object.freeze({
  [RED_HAT_DEAL_ID]: redHatB9eStageBBlueprint(), // from B9e ruling authority
});
```

Pass `stageBBlueprints: CANONICAL_TERMINATION_RIGHTS_REVIEW_STAGE_B_BLUEPRINTS` into the core attacher (already supported).

`buildRedHatTerminationRightsReviewSource(dealId)` returns the bundle shape validated by `validateSourceBundle`:

- `application_deal_id` === `dealId`
- `analysis` — `AGREEMENT_ANALYSIS/V2` from generator
- `projection` — `AGREEMENT_PROJECTION/V2` from `projectAgreement`
- `agreement_indexes` — Red Hat m2 index record(s)
- `view_policy` — `STAGE_2Y_M7_V2_VIEW_POLICY/V1`
- `resolve_binding` — byte resolver over pinned files (same binding pattern as serving-source tests)

Use **literal `require()`** of generated/pinned modules for Vercel file-tracing safety (same lesson as QXO termination-fee excerpts).

**Preview env (Vercel preview or local `NODE_ENV !== 'production'`):**

```bash
CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING=ENABLED_LOCAL_PREPRODUCTION
```

No `NEXT_PUBLIC_` flag. Gate off → same reference back, byte-identical to today.

## 3. Files to change

| File | Change |
|---|---|
| `lib/canonical-v2/termination-rights-review-serving-source.js` | **Primary** — env gate, `RED_HAT_DEAL_ID`, registries, builder, Stage B blueprint, wrap export |
| `pages/api/review/[id]/cards.js` | Optional — pass `{ env: process.env }` into attach (fee route already does; rights call works without it because gate reads `process.env` by default) |
| `lib/queries/review-deal-wire.js` | **No change** — already allowlists `canonical_v2_termination_rights_review_*` fields |
| `components/review/table-configs/termination-rights.config.js` | **No change** — already prefers V2 rows when present |
| `lib/canonical-v2/m7-v2-contract.js` | **Do not edit** (integration agent) |
| `lib/canonical-v2/m7-v2-profile-authoring.js` | **Do not edit** (integration agent) |

## 4. What Ben sees after registration (preview + env on)

On `/review/2b9a6571-6fe7-4aac-931d-a96ab227ea43` with the env gate on:

1. **Termination Rights section shows V2 rows**, not the legacy `TERMR-*` canonical table (`hasCanonicalV2ReviewRows` suppresses `visibleFamilyGroups`).
2. **Rich review UI** from `buildTerminationRightsReviewGroups` — subtype labels (Legal restraint, Outside date, Breach, etc.), nested expression trees, evidence-backed facts, review-status chips.
3. **B9e Stage B note** on the Legal restraint row: display text `contained in non-public disclosure letter` on field `JURISDICTION_LIST_REFERENCE` (governed disclosure note, not a typed fact). Ruling: `evidence/.../m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json`.
4. **Wire fields** stamped on `reviewDeal`: `canonical_v2_termination_rights_review_rows`, `canonical_v2_termination_rights_review_prompts`, `canonical_v2_termination_rights_review_source_status` (`ATTACHED`).
5. **Cache-Control** `private, no-store` (transient review state; `terminationRightsReviewCacheControl` in `cards.js`).
6. **Cross-cutting legacy groups** (remedies, fiduciary-out, deferred evidence) may still appear below V2 rows when legacy cards carry those features.

Gate off, production, or any other deal → unchanged legacy TERMR behaviour.

## 5. Constraints

| Constraint | How |
|---|---|
| Preview only | `isPermittedCanonicalV2Runtime` — Vercel `preview` or local non-production only |
| Exact env sentinel | Only `ENABLED_LOCAL_PREPRODUCTION`; not `true` / `1` |
| No production alias | No widening of `isPermittedCanonicalV2Runtime`; no `NEXT_PUBLIC_` gate |
| No DB writes | Read-time assembly from pinned repo evidence; no `canonical_v2_write`, no Supabase |
| No legacy merge | V2 rows on separate wire fields; legacy TERMR cards stay in `cards[]` but are not rendered as the primary table when V2 attaches |
| Fail closed | Unregistered deal or gate off → exact no-op; registered failure → `FAILED` status, no partial rows |

## Reference wiring (already on main)

```
pages/api/review/[id]/cards.js
  → attachCanonicalTerminationFeeServing (env-gated, per-deal)
  → attachCanonicalTerminationRightsReview (path exists; registry empty)
  → terminationRightsReviewCacheControl
  → trimReviewDealForWire
```

Tests to extend after implementation: `tests/canonical-v2-termination-rights-review-serving-source.test.js`, `tests/canonical-v2-termination-rights-preview-registration.test.js`.
