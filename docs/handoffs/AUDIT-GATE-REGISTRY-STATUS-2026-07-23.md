# Gate-registry status audit, 2026-07-23 (specification review)

Produced under the `specification_review` work class after Ben directed
work to run exclusively from `docs/CODEX-PROGRAM.md`. Full gate-by-gate
table in the session record; this document carries the findings that
require Ben's ruling.

## Headline: the registry's formal state is ALL GATES OPEN

The registry's declared `status_artifact`
(`docs/certification/programme-gate-status.json`) and its
`evidence_directory` (`docs/certification/evidence/`) do not exist in the
repo or its history, and the registry rules `absent_status_effect:
ALL_GATES_OPEN`. Formally, all 35 gates are OPEN and only two work
classes are unlocked: `specification_review` and `emergency_containment`.

## The uncomfortable, honest consequence

Implementation has been outrunning the registry — before this session and
during it. The projection-binding slice, the vertical-slice work, the
bounded Query endpoint, both Query UI slices, and the D3 widening all
merged to `main` (behind flags, reviewed, deployable) while the work
classes that formally authorize them (`implementation_planning` →
`canonical_work_start` → `vertical_slice_execution`) are locked. The
staging Supabase project was built and used while the three
security-disposition gates (Zayo, Claude credential rotation, Supabase
secret) remain open by the programme document's own admission. The
handoff lineage and Ben's explicit approvals authorized each step de
facto; the registry never recorded any of it de jure.

## Items needing Ben's ruling (in order of consequence)

1. **Operating-mode decision.** Choose one and record it:
   (a) pause all non-containment implementation until the G0 gates close
   formally; (b) amend the programme/registry to recognize the de facto
   operating mode (Ben-approved slices behind disabled flags with Fable
   review), so the registry matches reality going forward; or
   (c) backfill: create `docs/certification/` and record evidence
   artifacts for what is genuinely done, closing gates properly. (b) and
   (c) combine naturally. Until ruled, this session holds to
   specification review and containment only.
2. **`G0_BROAD_CORPUS_ROUTES_CONTAINED` prose/code contradiction.**
   `docs/CODEX-PROGRAM.md` lists `/api/query/run` among routes
   "hard-closed or replaced"; the file is live, performs a full-corpus
   fetch per cache miss, and is the product's working legacy query path
   (and the fallback for the new UI slices). Either the prose overstates
   (fix the document) or the route needs the admission-controlled
   replacement (a product-breaking change only Ben should schedule).
   Needs verification of whatever ceilings/admission the route does have
   before any action.
3. **Security-disposition records (Zayo owner/purpose, Claude credential
   rotation, Supabase secret disposition)** — non-secret completion
   records are still absent; only Ben can supply them. These block
   `isolation_boundary_setup` and everything downstream formally.
4. **Cheap unrecorded closures available**: `G0_MARKET_STATS_CONTAINED`
   (containment code + live 503 probes are real; the attestation object
   was never written) and `P1_VERTICAL_SLICE_PASS` (a self-consistent
   `VerticalSliceAttestation` exists at
   `tests/fixtures/canonical-v2/p1-vertical-slice-attestation.json` but
   outside the evidence directory and without the required envelope).
   On Ben's go, these can be formalized quickly.
5. **Clarifications recorded to prevent future conflation**:
   `verify:codex-program` proves spec-document integrity only — it is not
   a gate-status generator; `reports/PARITY-GATE-2026-07-15.md` is the
   legacy M2 parity gate, not `P9_RENDER_PARITY` evidence; the per-slice
   Fable adversarial reviews are not the five-lane
   `G0_EXACT_DIGEST_REVIEW_SET`; the DECISIONS 2026-07-23 product
   approvals are not `G0_BEN_SPEC_APPROVAL`.

## Standing state while awaiting the ruling

Everything shipped remains flag-off and production-contained (re-verified
live after every merge today). No further implementation proceeds under
programme scope until Ben rules on item 1.
