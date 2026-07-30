# Canonical Corpus V2 execution ledger

This is the human-readable programme status. It is an operational control, not
an architecture document. The governing architecture is
[CODEX-PROGRAM.md](../CODEX-PROGRAM.md).

The PM controller owns the integration queue and updates this ledger after each
main integration.

## 1. Current state

| Item | State |
| --- | --- |
| Main basis | `7b6bc64157c49832129fa2ca227399850cd983fc` |
| Governance balance branch | `claude/codex-attestations-build-balance-z3xm23` |
| Contract bundle | 171 authored inputs, 170 substantive contracts, 8 categories |
| Current bundle ID | `fe17399f1d09743c9e510a75cc0aff76abce8d59b7e59710010da54e3f631311` |
| Current canonical bundle digest | `46a1c644c22333ed81490441c5724dad6624ba2bafa5ac7517abe5c98c3ca69a` |
| Contract dependency graph | 170 nodes, 274 links, 0 missing, duplicate, conflict, unresolved or cyclic links |
| Clean compile check | PASS, two uncached compiles produced identical canonical bytes |
| Latest complete suite on governance candidate | 4,576 pass, 0 fail, 7 skip |
| Latest production build on basis | PASS, 29/29 pages |
| M1 contract freeze | OPEN |
| M2 vertical slice | OPEN |
| M3 full-corpus certification | OPEN |
| M4 pre-cutover | OPEN |
| Tier A containment | ACTIVE |
| Tier B attacker-model security | DEFERRED_POST_CUTOVER |

No signed status artefact or protected publication is required for
pre-production work. This table is the current state.

## Plain-English stage

The programme is in P8. P8 means that one real Agreement provision and one
real Process provision must travel from source evidence to every required
product view.

P1-P7 supplied the contracts and pure processing modules. The remaining P8
work is to connect those modules to real QXO and Metsera inputs, the canonical
writer, one candidate release and the shared product rows. The governance
balance unit removes obsolete review machinery. It does not change extracted
facts or legal meaning.

## 2. Work underway

| Unit | Phase | Outcome | Owner | Branch and files | Required checks | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PM-GOV-BALANCE-01` | control | Replace pre-production attestation machinery with four milestone reviews and Tier A/Tier B security. | PM controller | `codex/governance-balance-v2`; governing docs, generated manifest and apparatus-only tests; commit `afbf1a4`. | 4,576 pass, 0 fail, 7 skip; production build PASS. | INTEGRATION | Include the committed unit in the next controlled main movement. | No |
| `PM-QXO-F28-LINK-01` | P8 | Bind the F28 graph, all 14 metric slots, correction head and Product result without hiding missing runtime links. | PM implementation | `codex/qxo-f28-runtime-link-v1`; commit `d582705`. | 4 focused tests PASS. | COMPLETE | Preserve the fail-closed runtime plan. | No |
| `PM-QXO-F28-WRITER-01` | P8 | Convert the exact F28 graph into the canonical writer's closed `DEAL_SCOPE_RUN` input. | PM implementation | Same branch; commit `32af4b2`. | 3 focused tests PASS. | COMPLETE | Preserve the typed writer-schema rejection. | No |
| `PM-QXO-F28-CONDITION-GROUP-WRITER-01` | P2/P8 | Admit the existing `CAPITALISATION_CONDITION_GROUP/V1` rows to the writer without converting or dropping them. | PM implementation | Exact branch and files to be reserved. | Writer structure, identity, persistence, replay and data-loss tests. | READY | Add a governed condition-group collection to the writer path. | No |
| `PM-QXO-F28-CANDIDATE-01` | P8 | Add one immutable F28 candidate envelope for one row with 14 ordered metric terminals. | PM implementation | Same branch; commit `cec829c`; controller-owned registry and manifest integration. | 6 focused hostile tests plus 27-test bundle chain PASS. | COMPLETE | Build the envelope runtime and additive Product adapter V2. | No |
| `PM-QUERY-FIXTURE-LINK-01` | P8 | Execute fixture-scoped Product Query and Review paths without opening the production route. | PM implementation | Exact runtime branch and paths to be reserved. | Query, Review, Compare and Corpus Context parity. | READY | Implement after QXO writer link. | No |
| `PI-METSERA-RUNTIME-01` | P8 | Connect sealed Metsera sources through acquisition, enumeration, validation and pilot materialisation. | Process Intelligence | PI branch and exact files to be supplied in one batch. | Focused Process chain and sealed-gold comparison. | READY | Build the first real-source runtime link. | No |

## 3. Next 48 hours

1. Complete `PM-QXO-F28-LINK-01`.
2. Implement `PM-QUERY-FIXTURE-LINK-01`.
3. Integrate the PI Metsera runtime batch once its focused chain passes.
4. Compile and review the exact M1 bundle.
5. Ask Ben once to approve that exact bundle fingerprint.
6. Move the combined milestone batch to main.
7. Run QXO and Metsera in isolated staging.

## 4. Bounded units through P11

| Unit | Phase | Outcome | Owner | Dependency | Evidence | Status | Next action | Ben |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P1-CONTRACT-BUNDLE` | P1 | One complete Agreement, shared and Process contract bundle. | PM controller | Complete the condition-group writer contract. | Current 170-contract bundle checks PASS. Final recompile and independent exact-byte reviews remain. | ACTIVE | Close the writer contract gap, then rebuild the exact M1 bundle. | Yes |
| `P2-IDENTITY-WRITER` | P2 | Stable identities and one canonical writer. | PM implementation | P1 bundle. | Identity and transactional writer tests. | COMPLETE | Preserve. | No |
| `P3-SCOPE-EXTRACTION` | P3 | Definitions-first scope and extraction with open-world residuals. | PM and PI | P1 bundle. | Goldens, evals, quote verification and hostile correctness tests. | ACTIVE | Complete real Metsera link. | No |
| `P4-OBSERVATIONS-QUERY` | P4 | Normalised observations and one Product Query IR. | PM and PI | P3 outputs. | Numeric, unit, field, Ask/Browse and filter tests. | ACTIVE | Connect real release inputs. | No |
| `P5-CORRECTIONS-RELEASE` | P5 | Corrections survive re-extraction and candidate releases are immutable. | PM implementation | P3 and P4. | Correction-head and release tests. | ACTIVE | Connect QXO and Metsera pilot outputs. | No |
| `P6-SERVING` | P6 | Bounded set-based serving and release-aware cache. | PM implementation | P5 candidate release. | Call-budget, cache and query tests. | ACTIVE | Execute fixture-scoped runtime path. | No |
| `P7-SHARED-ROWS` | P7 | Query, Review, Compare and Corpus Context use one row contract. | PM and PI | P6. | Cross-view byte and browser parity. | ACTIVE | Run real pilot rows through each view. | No |
| `P8-VERTICAL-SLICES` | P8 | QXO and Metsera pass source-to-product staging runs. | PM controller | P1-P7 links. | M2 acknowledgement and complete pilot evidence. | BLOCKED | Finish the three active runtime links. | No |
| `P9-CORPUS-CERTIFICATION` | P9 | Full corpus passes quality, identity, drift, performance, restore and rollback controls. | PM controller | M2 pass. | M3 acknowledgement and Phase 9 gates. | BLOCKED | Begin after both pilots pass. | No |
| `P10-PRODUCTION-IMPORT` | P10 | Exact inactive production import with member parity and resumable checkpoints. | PM controller | M3 pass. | Replay no-op, conflicting replay fail-closed, complete parity. | BLOCKED | Run only after staging certification. | Where contract requires |
| `P11-CUTOVER` | P11 | Atomic whole-tuple activation, smoke and rollback. | PM controller | M4 pass and Ben authorisation. | Cutover receipt, production smoke and rollback. | BLOCKED | Request one-use authorisation at M4. | Yes |
| `P12-SECURITY-HARDENING` | P12 | Add attacker-model certification for the internal product. | PM implementation | Successful cutover. | Route/action inventories, probes, egress and revocation tests. | BLOCKED | Start after cutover. | No unless governance changes |

## 5. Critical path

`PM-GOV-BALANCE-01` → M1 bundle acknowledgement and Ben approval → QXO runtime
link → Metsera runtime link → isolated staging pilots → M2 → full-corpus
certification → M3 → inactive production import → M4 → one-use Ben cutover
authorisation → atomic activation → production smoke and rollback.

P1-P7 close when:

- every required contract input has one final identity and dependency;
- two uncached compiles are byte-identical;
- the bundle has no missing member, duplicate identity, conflict, cycle or
  unresolved dependency;
- the canonical writer, corrections, candidate release, bounded serving and
  shared row contracts pass;
- QXO and Metsera have executable real-source links through every required
  product surface.

Production import and cutover retain:

- exact bundle digest and member parity;
- checkpointed resumable import;
- replay no-op and conflicting replay fail-closed;
- atomic whole-tuple activation;
- post-cutover smoke with rollback; and
- one-use Ben cutover authorisation.

## Retired units

- `PM-P8-REVIEW-CONTROLLER-01`: RETIRED. Replaced by milestone
  acknowledgements.
- `PM-P8-REVIEW-REGISTRATION-01`: RETIRED. No signed reviewer registration is
  required.
- `PM-P8-PROTECTED-REVIEW-PRODUCER-01`: RETIRED. No protected review producer is
  required.
- `PM-P8-SIGNED-STATUS-PUBLISHER-01`: RETIRED for pre-production work. The
  ledger is the status source.
