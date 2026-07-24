# QXO deal identity and serving dimensions correction

## Problem

The QXO F2 termination-fee semantic dry-run failed with
`canonical deal identity conflict`. Staging already contains the immutable
canonical deal:

```json
{
  "deal_key": "deal:qxo-topbuild",
  "deal_admission_id": "62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f",
  "document_hash": "abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d"
}
```

The generated termination packet attempted to write the same identity with
additional query dimensions. The authoritative writer correctly rejected the
different payload digest.

## Approved boundary

One source-backed deal produces two deliberately different objects:

1. `semanticDeal` is the immutable canonical identity persisted by
   `DEAL_SCOPE_RUN`. It contains only `deal_key`, `deal_admission_id` and
   `document_hash`, matching the existing staging payload exactly.
2. `servingDeal` contains the same identity plus reviewed dimensions used to
   build the market observation and shared serving row.

Dimensions remain present in Query, Compare and Corpus Context outputs. They
do not mutate the authoritative semantic deal record.

## Data flow

`buildQxoTerminationFeeAdmittedSlice` builds `semanticDeal`, derives
`servingDeal` from it, and passes only `servingDeal` into metric projection and
cohort construction. Its `semantic_write_set.deal` is `semanticDeal`.

Candidate release identities derived from the serving row must remain
unchanged. The `DEAL_SCOPE_RUN` input digest and receipt are expected to move
because the persisted write set changes. Any other identity movement stops the
run for investigation. The Option A generator must regenerate and repin the
semantic values before staging resumes.

## Failure handling

The writer's immutable-identity conflict remains unchanged. The generated
verify-before block must still prove that the termination write and candidate
release are absent. No active release pointer may change.

## Shared immutable excerpt

The corrected deal dry-run then exposed one `canonical excerpt identity
conflict`. Of the nine termination write-set excerpts, only the admitted
$17 billion deal-value excerpt already exists. Its global `excerpt_id`, source
coordinates, exact bytes and complete payload are identical to the material-
contracts excerpt. Only the proposed `closure_id` differed.

The termination write must reuse that exact immutable excerpt with its
first-admitted material-contracts closure. It remains present in the
termination write set so validation can resolve the claim's derivation
evidence and the writer can verify the existing object transactionally. The
writer then performs an exact idempotent no-op for that row. The eight new
termination excerpts retain the termination closure.

The generated guard must assert both sides explicitly: eight excerpts owned
by the termination closure, and one exact shared deal-value excerpt owned by
the pinned material-contracts closure. Claims and derived results may combine
evidence from those separate semantic closures. The shared excerpt does not
move ownership and is not duplicated under a fabricated identity.

No schema expansion is part of this packet. If closure membership later needs
to be queryable independently from first-admission ownership, that requires a
separate governed excerpt-membership relation. It must not be simulated by
duplicating source evidence.

## Acceptance

- The semantic deal exactly equals the existing staging canonical payload.
- The serving deal retains all seven reviewed dimensions.
- The deal-value excerpt exactly reuses its material-contracts closure and
  all other termination excerpts use the termination closure.
- The semantic guard proves eight new termination excerpts plus one exact
  shared excerpt.
- The market observation remains 3.52941176 percent of deal value.
- Candidate serving and release identities remain stable.
- The regenerated semantic dry-run succeeds and rolls back.
- Semantic apply commits one exact receipt with zero residuals and quarantines.
- Candidate import dry-run succeeds, then apply creates one inactive release.
- Post-import verification proves the generation-8 active pointer is unchanged.
- Production market statistics and canonical Query flags remain disabled.
