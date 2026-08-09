# Step 2X-I: mutual termination rights two-row mint (Ben ruling 2)

## Ruling

When `terminating_party_scope === 'EITHER_PARTY'`, the termination resolver mints **two**
assertion rows — one per principal party (`TARGET` / `BUYER` capacities with role
`TERMINATION_RIGHT_HOLDER`) — not a single `EITHER_PRINCIPAL_PARTY` row.

## Files

| File | Change |
|------|--------|
| `lib/canonical-v2/native-producer/candidate-resolution.js` | `resolveMutualPrincipalParties`, `handleTerminationRightCandidate` fans out to two `finalizeTerminationClaim` calls; `MAPPING_TABLE_VERSION` 20→21 |
| `lib/canonical-v2/termination-product-projection.js` | `partyCode` maps `EITHER_PARTY` + mutual concept + `TARGET`/`BUYER` → `PARTY_MUTUAL` |
| `tests/canonical-v2-termination-rights-resolution.test.js` | Mutual / outside / novote expectations |
| `tests/canonical-v2-termination-limb-grant-context.test.js` | Modiv replay counts and party assertions |
| `tests/canonical-v2-termination-product-parity.test.js` | Fixture uses two principal-party rows |

## Digest impact

- **Intentional:** Modiv termination replay re-mints provision and claim identities for every
  `EITHER_PARTY` termination assertion (legal restraint, outside date, mutual consent, etc.).
- **`MAPPING_TABLE_VERSION`:** bumped to 21.
- **`EITHER_PRINCIPAL_PARTY`:** retained for regulatory and closing-condition families only;
  no longer emitted on the termination-rights path.

## Unresolved ref

If `resolveMutualPrincipalParties` cannot split the ref into two distinct principal
capacities, the candidate queues `MUTUAL_PARTY_UNRESOLVED` (fail-closed; no EITHER fallback).
