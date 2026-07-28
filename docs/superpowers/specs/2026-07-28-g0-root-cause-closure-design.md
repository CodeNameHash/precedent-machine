# G0 root-cause closure design

## Objective

Close the thirteen blocking findings from exact-root cold-review run
`30376936502` without another open-ended prose amendment. The next review must
receive a self-contained specification, and mechanical checks must reject each
of the thirteen failure modes before review is dispatched.

## 1. Self-contained bootstrap acceptance

Add one frozen, root-independent bootstrap acceptance-source artefact to the
reviewed specification. It contains the complete schemas, member universes and
typed predicate definitions for the ten G0 gates and
`P1_CONTRACT_FREEZE_ATTESTED`. The compiler binds those eleven source
definitions to the exact specification root. The ten G0 gates remain the
genesis status set; P1 remains the later pre-bundle gate.

The review controller copies this artefact into every isolated lane. Executable
validator code implements the frozen source but is not semantic authority.

Define the specification root as SHA-256 over one unambiguous octet stream:
the UTF-8 domain separator plus LF, followed by one record for each ordered
member, including the manifest. Each record is:

`UTF8(path) || NUL || ASCII(decimal byte length) || NUL || lowercase SHA-256 || LF`

No raw member bytes or implicit records are appended. The manifest's `files`
array omits itself; the verifier computes the member-one record directly from
the manifest's raw bytes.

## 2. Production blob verification

Make `VERIFY_PRODUCTION_BLOB_AVAILABILITY` the explicit eighth top-level action
of `CERTIFIED_RELEASE_IMPORT_BATCH`. Its closed subgrammar runs after
`OPEN_IMPORT` and before pre-seal controls. It streams the uploaded generation,
verifies namespace, generation, byte length and digest, then writes or returns
one byte-equal immutable availability receipt through the canonical writer.

The action is added consistently to the operation, carrier, disposition, lock
and generated SQL registries. No separate application or uploader database
write path is introduced.

## 3. Query result delivery

Delete `ImmutableQueryExecutionResult` and
`IMMUTABLE_EXECUTION_RESULT_FETCH`. Persisting every result page adds a write,
retention machinery and another database pressure path without improving the
legal-market outcome.

An in-app navigation carries the already validated bounded response. A direct
load, reload or expired client state compiles and executes exactly one normal
bounded set-based query. It does not execute a validation query and then repeat
it. Saved-query lookup returns the stored plan identity, after which the plan is
executed once. The supported-query registry, goldens and soak matrix reflect
these two paths and contain no result-carrier class.

## 4. Residual and novel-concept impacts

Use one closed impact-to-publication mapping for both governed residuals and
novel concepts:

- isolated source-specific: Review-only publication with an explicit
  non-comparable reason;
- affects canonical result: every intersecting result is incomplete and every
  intersecting metric slot is excluded;
- affects corpus scope: the affected candidate scope is blocked;
- affects canonical contract: the affected candidate is blocked and a
  successor contract version is required.

A contract-impact finding never retroactively invalidates its immutable
predecessor contract. It blocks certification under that predecessor and
prevents the successor contract freeze until the candidate is dispositioned,
the successor bundle is approved and affected spans and transitive dependants
are reprocessed.

Every claim-owned and result-owned metric slot carries an impact-clearance
projection derived from the complete evidence and dependency closure. A slot
intersecting any non-isolated impact cannot enter a canonical market cohort,
even after the impact itself has a terminal reviewed disposition. Unaffected
siblings remain renderable.

## 5. Atomic activation and later promotion

Make `CutoverAuthorisation` an explicit tagged union:

- first cutover selects current programme status and
  `DeploymentReadinessMirror`;
- every later promotion or historical reactivation selects current
  `OngoingReleasePromotionHead` and fresh `OngoingReleaseReadiness`.

The activation RPC locks and consumes the selected authority. For later
promotions it revalidates the exact promotion-head predecessor, policy,
revocation, deployment and candidate tuples.

Fold release certification and promotion-head advancement into the successful
`COMMIT_PASS` serialisable transaction. The first cutover writes `PASS_FIXED`,
the available fence, `ReleaseActivationCertification` and the genesis ongoing
head atomically. A later promotion writes `PASS_FIXED`, its certification,
promotion receipt and exact-predecessor head successor atomically. There is no
state in which an active release is available but uncertified or absent from
the promotion head.

## 6. Review execution and exit criteria

Convert the protected controller from five blocking sequential Codex
invocations to five concurrent child processes. Each lane retains a separate
GENESIS session, isolated read-only copy, prompt, runtime context and signed
controller record. No lane receives another lane's output.

Before dispatch, the verifier must mechanically prove:

1. all ordered specification members and the exact root grammar;
2. eleven complete bootstrap definitions, with ten genesis gates and one P1;
3. the eight-action import grammar and blob-verification ownership;
4. absence of query-result carrier contracts and complete replacement-path
   coverage;
5. residual and novel impact parity, successor-freeze semantics and claim-only
   metric exclusion;
6. tagged cutover authority and atomic certification/head advancement; and
7. five-lane concurrent execution with unchanged isolation invariants.

The amendment passes only after the full local suite is green and one
exact-commit concurrent cold-review bundle returns `PASS` in all five lanes.
