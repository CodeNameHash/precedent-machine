# Component rows for assertion-node subjects (closes final-audit M1)

**Date:** 2026-08-01. **Approved:** Ben, approvals ack item 3 (slice (a)).
**Parent spec:** `2026-08-01-claim-identity-provenance-design.md` §1.
**Problem:** limb-level (ITEM-attached) resolved claims carry assertion-node
subject ids that resolve against nothing at validation — they queue but can
never publish (`docs/handoffs/F28-THIRD-LIVE-RUN.md`, register item 1).

## Design

The write set gains `components` rows minted from assertion nodes, and
ITEM-attached claims are rekeyed onto them. All existing machinery is
reused; nothing new is invented:

1. **Minting is lazy and adapter-side.** Only assertion nodes that are
   actual claim subjects get a `PROVISION_COMPONENT/V1` row. The adapter is
   the ONLY place this can happen: `buildProvisionComponent`
   (source-structure.js) requires document-absolute spans, and the adapter
   is where section-local offsets become absolute. Path nodes never mint
   (they carry no spans by design).
2. **Component identity is the real one.** The row comes from
   `buildProvisionComponent({source, parentProvision, span, componentKey:
   'REPRESENTATION_LIMB', ordinal, contractBundle})` — span containment in
   the parent provision enforced, key registered, id content-derived. The
   resolver-side assertion-node id (`LIMB_ASSERTION_COMPONENT/V1`) is a
   resolution-layer identity, NOT a write-set identity; the adapter rekeys
   the claim's `subject_occurrence_id` to the minted
   `provision_component_id` and re-derives the claim identity chain, in the
   same pass where it already re-derives identity for the offset shift.
3. **Ordinals** are the component's rank among all minted components under
   the same parent provision, by (absolute_start, absolute_end) — same
   determinism rule as assertion-node ordinals; independent of input order.
4. **The join is recorded, never inferred.** The adapter result gains
   `component_subject_map`: frozen entries {assertion_node_id,
   provision_component_id, limb_path} so the UI/review layer can walk from
   a published claim back to its limb-tree node without recomputing spans.
5. **Inputs.** `buildNativeWriteSet` gains optional `resolution` context:
   the provisions minted by `resolveCandidates` (parents for containment)
   and `limb_component_trees` (to find each subject's assertion node and
   limb_path). Absent that context, behavior is exactly today's — claims
   with unknown subjects flow through and fail typed at validation; the
   parameter is additive, no existing caller breaks.
6. **What must NOT change:** claims-relationships.js stays frozen; the
   validator is untouched (components rows and subject resolution already
   work — that is the point of this design); no model input anywhere.

## Acceptance

- An ITEM-attached KNOWLEDGE claim (synthetic fixture on real 3.1(b) text)
  travels resolver → adapter → validator and lands in
  `publishableWriteSet.claims` with its subject resolving to a
  `REPRESENTATION_LIMB` component row contained in its parent provision.
- Component ids are permutation-invariant and byte-stable across runs.
- The F28 third-run recorded response replays with zero behavior change
  for CHAPEAU claims (its resolved claims are all rep-level).
- Existing adapter/validator/writer suites stay green untouched except the
  adapter suite's own extension.
