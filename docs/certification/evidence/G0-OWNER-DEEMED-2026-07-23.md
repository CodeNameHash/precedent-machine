# G0 owner-deemed closure record — 2026-07-23

Ben (programme owner) directed, verbatim: **"Deem G0 complete."** —
2026-07-23, recorded Claude session
(session_01JARAgSVuGXttPVmtRRSeWk), following review of
`docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md`.

Effect: all ten `G0_*` gates in `docs/codex-program/programme-gates.yaml`
are closed by owner authority. The
`programme-gate-evidence-envelope/v2` cryptographic evidence contract is
NOT satisfied by this record and no status validator has run; the owner's
directive waives the envelope for the G0 set only. Consumers must treat
`OWNER_DEEMED` as distinct from validator-verified `PASS`.

Unlocked work classes as a consequence (per the registry's TRANSITIVE_ALL_OF
semantics): `implementation_planning`, `isolation_boundary_setup`,
`snapshot_restore_and_preview`, `canonical_work_start`. Still locked:
`vertical_slice_execution` (needs `P1_CONTRACT_FREEZE_ATTESTED`, OPEN) and
everything downstream of it; every `P1_*`/`P9_*` gate remains OPEN.

Known caveat carried into the record rather than hidden:
`G0_BROAD_CORPUS_ROUTES_CONTAINED` is deemed closed while
`/api/query/run` remains the live legacy query path (60-second
full-context cache + inflight dedupe; no admission ceilings). The
discrepancy, options, and recommendation are in
`docs/handoffs/AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md` item 2 and the
session record of 2026-07-23.
