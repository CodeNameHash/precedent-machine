# Card Renderer Inline Canonical Editor

Phase 0-C design only. Phase 1 wires this into `/review/[id]`.

Every canonical-keyed card field gets a pencil icon beside the rendered value. Opening it shows:

- frozen-vocab dropdown with labels and definitions,
- provenance strip with canonical key, extractor raw value, source provision id, and reconciliation log id where available,
- required reviewer rationale input,
- save and revert controls.

Saving appends to `docs/schema-shape/manual-overrides.jsonl`. Re-extraction must preserve an active manual override unless a reviewer explicitly reverts it.
