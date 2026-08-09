# Step 2X-F: topology detector with UNDETERMINED

Branch `cursor/step-2x-free-phase-b641`. Closed 2026-08-09 for the **detector
half**. Model-extracted `transaction_steps` (prompt bump / 2X-I) and the
model-vs-detector precedence merge remain for a later rung.

## Rulings applied (DECISIONS.md §14)

- No matched pattern → `UNDETERMINED`, never a silent `SINGLE_MERGER`.
- Double dummy requires HoldCo; skywater/topbuild without HoldCo →
  `REVERSE_TRIANGULAR_THEN_LLC`.
- Explicit simultaneity → `PARALLEL_MERGERS` (Modiv UPREIT).
- `FORWARD_TRIANGULAR` / `REVERSE_TRIANGULAR` still only via
  `opts.singleStepTopology` — documented, not invented from step_kind.

## What landed

| Piece | Path |
|---|---|
| Taxonomy + invariants | `lib/schema/topology-detector.js` |
| Detector patterns | `lib/parser-v2/detectors/transaction-steps.js` |
| Evidence adapter | `lib/canonical-v2/sections-for-transaction-detector.js` |
| Seven-deal proof | `tests/canonical-v2-transaction-topology-detector.test.js` |

Detector fixes:

- Tender signal = `Acceptance Time` / `251(h)` only (drops bare `the offer` and
  no-shop `tender offer` boilerplate).
- Named mergers from quoted defined terms / `X Merger Effective Time`.
- Merger-scoped simultaneity (not no-shop “simultaneously provided”).
- Detector-inferred rows always `topology_needs_review: true` and
  `step_source: 'DETECTOR_INFERRED'`.

## Proof — seven deals (hash-verified)

```
CI=true node --test tests/canonical-v2-transaction-topology-detector.test.js
```

| deal | topology | steps |
|---|---|---:|
| concho | `SINGLE_MERGER` | 1 |
| metsera | `SINGLE_MERGER` | 1 |
| redhat | `SINGLE_MERGER` | 1 |
| skechers | `SINGLE_MERGER` | 1 |
| skywater | `REVERSE_TRIANGULAR_THEN_LLC` | 2 |
| topbuild | `REVERSE_TRIANGULAR_THEN_LLC` | 2 |
| modiv | `PARALLEL_MERGERS` | 2 |

Was 4/7 before this step (skechers false tender; topbuild/modiv silent
single-step). Now 7/7 on the detector half.

## Explicitly not claimed

- No prompt bump; no model-extracted `transaction_steps`.
- No V2 product wiring of topology onto review pages.
- No live Modiv re-extract (2X-K).
