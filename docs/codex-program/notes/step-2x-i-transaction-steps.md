# Step 2X-I: model-extracted `transaction_steps`

Branch `cursor/step-2x-free-phase-b641`. Closes the **model half** of topology
(2X-F landed the detector half).

## What landed

| Piece | Path |
|---|---|
| Prompt bump (v2→v3) | `lib/canonical-v2/native-producer/merger-structure-producer-prompt.js` |
| Shaper | `lib/canonical-v2/native-producer/anthropic-provider.js` (`shapeMergerTransactionStepProposals`) |
| Resolver branch | `lib/canonical-v2/native-producer/candidate-resolution.js` (`handleMergerTransactionStepCandidate`) |
| Claim definition V42 | `lib/canonical-v2/contract-bundle.js` (`MERGER_TRANSACTION_STEP`) |
| Topology merge | `lib/canonical-v2/deal-topology-from-claims.js` |
| Tests | `tests/canonical-v2-deal-topology-from-claims.test.js` |

`structure_assertions` / `handlePresenceCarrier` unchanged for governed
mechanics; topology is a separate claim path (`MERGER_TRANSACTION_STEP`).

## Precedence rule (model vs detector)

From `docs/codex-program/notes/topology-investigation.md` §7.5 (mirrors
`lib/employee-benefits.js` direct-beats-inferred):

1. **Model-extracted steps win** when `MERGER_TRANSACTION_STEP` claims exist
   (`step_source: MODEL_EXTRACTED`). Only path that can resolve parallel dual
   mergers (Modiv UPREIT) from quoted concurrency.
2. **Detector-inferred fallback** when no model steps (`step_source:
   DETECTOR_INFERRED`). Always `topology_needs_review: true` regardless of
   detector confidence.
3. **Disagreement** when both exist: model topology wins, but
   `topology_needs_review: true` and `detector_topology` surfaced.
4. **Neither** → `UNDETERMINED`.

Implemented in `mergeDealTopology()` (`deal-topology-from-claims.js`).

## Proof

```
CI=true node --test tests/canonical-v2-deal-topology-from-claims.test.js
CI=true node --test tests/canonical-v2-transaction-topology-detector.test.js
```

Detector seven-deal proof unchanged (2X-F).

## Explicitly not claimed

- No live merger-structure re-extract (2X-K).
- No product UI wiring of topology onto review pages.
- No Postgres `transaction_steps` / `deal_topology` writer hookup.

## UI gaps (for product wiring later)

- Review page topology badge / `step_source` display
- `deal_topology` + `transaction_steps` table writes from merged topology
- Disagreement banner when `detector_topology` differs from model
- Section-family card surfacing per-step claims
- Precedent search / filter by topology code
